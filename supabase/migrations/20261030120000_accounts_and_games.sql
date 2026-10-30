-- Broomit accounts: profiles with a Broomit ID, friends, and quizzes played with friends
-- (live, all at once, or as a challenge each player plays in their own time).
--
-- Clients only read tables (row level security limits each to what concerns its user);
-- every change goes through the functions below, which check who may do what.

-- Profiles ------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  -- The Broomit ID friends add each other with, e.g. 'K7Q3-XM2P'. It never changes.
  broomit_id text not null unique check (broomit_id ~ '^[A-Z0-9]{4}-[A-Z0-9]{4}$'),
  name text not null default '' check (char_length(name) <= 40),
  -- A small square JPEG as a data URL.
  picture text check (picture is null or char_length(picture) <= 200000),
  updated_at timestamptz not null default now()
);

-- Without look-alikes (0/O, 1/I/L), so an ID can be read out and typed.
create function public.new_broomit_id() returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..8 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
      if i = 4 then code := code || '-'; end if;
    end loop;
    exit when not exists (select 1 from public.profiles where broomit_id = code);
  end loop;
  return code;
end $$;

create function public.create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, broomit_id) values (new.id, public.new_broomit_id());
  return new;
end $$;

create trigger create_profile after insert on auth.users
  for each row execute function public.create_profile();

-- Friends -------------------------------------------------------------------------------

create table public.friendships (
  requester uuid not null references public.profiles on delete cascade,
  addressee uuid not null references public.profiles on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);
create index friendships_addressee on public.friendships (addressee);

create function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and ((requester = a and addressee = b) or (requester = b and addressee = a))
  )
$$;

-- Games ---------------------------------------------------------------------------------

create table public.games (
  id uuid primary key default gen_random_uuid(),
  host uuid not null references public.profiles on delete cascade,
  mode text not null check (mode in ('live', 'challenge')),
  title text not null check (char_length(title) <= 120),
  -- The quiz's cover (a fill, as in the app).
  cover jsonb not null,
  question_count int not null check (question_count between 1 and 200),
  -- Live games: where the game is. Challenges stay 'open' until the host closes them.
  state text not null default 'lobby'
    check (state in ('lobby', 'question', 'reveal', 'done', 'open', 'closed')),
  question int not null default -1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The questions, apart from the game so live updates stay small.
create table public.game_quizzes (
  game_id uuid primary key references public.games on delete cascade,
  questions jsonb not null check (jsonb_typeof(questions) = 'array'),
  check (pg_column_size(questions) <= 4000000)
);

create table public.game_players (
  game_id uuid not null references public.games on delete cascade,
  player uuid not null references public.profiles on delete cascade,
  -- Name and picture as they were when invited, so everyone sees everyone.
  name text not null default '',
  picture text,
  status text not null default 'invited'
    check (status in ('invited', 'joined', 'declined', 'finished')),
  score int not null default 0,
  correct int not null default 0,
  answered int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (game_id, player)
);
create index game_players_player on public.game_players (player);

create table public.game_answers (
  game_id uuid not null,
  player uuid not null,
  question int not null check (question >= 0),
  response jsonb not null,
  points int not null check (points between 0 and 1000),
  correct boolean,
  seconds real not null,
  created_at timestamptz not null default now(),
  primary key (game_id, player, question),
  foreign key (game_id, player) references public.game_players on delete cascade
);

create function public.in_game(game uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.game_players where game_id = game and player = (select auth.uid())
  )
$$;

-- Who may read what ---------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.games enable row level security;
alter table public.game_quizzes enable row level security;
alter table public.game_players enable row level security;
alter table public.game_answers enable row level security;

-- Your own profile, and those of people you are friends with or asked to be.
create policy "profiles: self and friends" on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.friendships f
      where (f.requester = (select auth.uid()) and f.addressee = profiles.id)
         or (f.addressee = (select auth.uid()) and f.requester = profiles.id)
    )
  );

create policy "friendships: own" on public.friendships for select to authenticated
  using ((select auth.uid()) in (requester, addressee));

create policy "games: players" on public.games for select to authenticated
  using (public.in_game(id));
create policy "game quizzes: players" on public.game_quizzes for select to authenticated
  using (public.in_game(game_id));
create policy "game players: players" on public.game_players for select to authenticated
  using (public.in_game(game_id));
create policy "game answers: players" on public.game_answers for select to authenticated
  using (public.in_game(game_id));

-- Clients change nothing directly.
revoke insert, update, delete on all tables in schema public from anon, authenticated;
revoke all on all tables in schema public from anon;

-- What a signed-in user can do ----------------------------------------------------------

create function public.update_profile(new_name text, new_picture text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  update public.profiles
     set name = left(coalesce(new_name, ''), 40), picture = new_picture, updated_at = now()
   where id = auth.uid();
end $$;

-- Asks the person with this Broomit ID to be friends; if they already asked, you are now
-- friends. Returns 'requested', 'friends', or raises when there is no such ID.
create function public.add_friend(code text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  other uuid;
begin
  if me is null then raise exception 'Not signed in'; end if;
  select id into other from public.profiles where broomit_id = upper(trim(code));
  if other is null then raise exception 'No Broomit account has this ID' using errcode = 'P0002'; end if;
  if other = me then raise exception 'This is your own Broomit ID' using errcode = 'P0001'; end if;
  if exists (select 1 from public.friendships where requester = other and addressee = me) then
    update public.friendships set status = 'accepted' where requester = other and addressee = me;
    return 'friends';
  end if;
  insert into public.friendships (requester, addressee) values (me, other)
    on conflict do nothing;
  return case when public.are_friends(me, other) then 'friends' else 'requested' end;
end $$;

create function public.answer_friend(other uuid, accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if accept then
    update public.friendships set status = 'accepted'
     where requester = other and addressee = auth.uid();
  else
    delete from public.friendships where requester = other and addressee = auth.uid();
  end if;
end $$;

-- Ends a friendship, or takes back a request.
create function public.remove_friend(other uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.friendships
   where (requester = auth.uid() and addressee = other)
      or (requester = other and addressee = auth.uid());
end $$;

-- Starts a game of a quiz with friends; the host joins it at once.
create function public.create_game(
  game_mode text, game_title text, game_cover jsonb, game_questions jsonb, friends uuid[]
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  game uuid;
  friend uuid;
begin
  if me is null then raise exception 'Not signed in'; end if;
  if coalesce(array_length(friends, 1), 0) = 0 then raise exception 'Invite at least one friend'; end if;
  if array_length(friends, 1) > 50 then raise exception 'Invite at most 50 friends'; end if;
  insert into public.games (host, mode, title, cover, question_count, state)
    values (me, game_mode, game_title, game_cover, jsonb_array_length(game_questions),
            case when game_mode = 'live' then 'lobby' else 'open' end)
    returning id into game;
  insert into public.game_quizzes (game_id, questions) values (game, game_questions);
  insert into public.game_players (game_id, player, name, picture, status)
    select game, p.id, p.name, p.picture, 'joined' from public.profiles p where p.id = me;
  foreach friend in array friends loop
    if not public.are_friends(me, friend) then raise exception 'Only friends can be invited'; end if;
    insert into public.game_players (game_id, player, name, picture)
      select game, p.id, p.name, p.picture from public.profiles p where p.id = friend
      on conflict do nothing;
  end loop;
  return game;
end $$;

-- Joins or declines a game you were invited to.
create function public.answer_invite(game uuid, accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.game_players
     set status = case when accept then 'joined' else 'declined' end, updated_at = now()
   where game_id = game and player = auth.uid() and status in ('invited', 'joined', 'declined');
end $$;

-- The host moves a live game on: to a question, to its answers, or to the end.
create function public.move_game(game uuid, next_state text, next_question int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if next_state not in ('lobby', 'question', 'reveal', 'done', 'closed') then
    raise exception 'Unknown state';
  end if;
  update public.games
     set state = next_state, question = next_question, updated_at = now()
   where id = game and host = auth.uid();
  if not found then raise exception 'Only the host can move the game on'; end if;
end $$;

-- Records your answer to a question (once); the points are counted on the device.
create function public.submit_answer(
  game uuid, question_index int, answer_response jsonb, answer_points int,
  answer_correct boolean, answer_seconds real
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  g public.games;
begin
  select * into g from public.games where id = game;
  if g.id is null or not public.in_game(game) then raise exception 'Not in this game'; end if;
  if question_index < 0 or question_index >= g.question_count then raise exception 'No such question'; end if;
  if g.mode = 'live' and (g.state <> 'question' or g.question <> question_index) then
    raise exception 'This question is closed';
  end if;
  if g.mode = 'challenge' and g.state <> 'open' then raise exception 'This challenge is closed'; end if;
  insert into public.game_answers (game_id, player, question, response, points, correct, seconds)
    values (game, auth.uid(), question_index, answer_response,
            greatest(0, least(answer_points, 1000)), answer_correct, answer_seconds)
    on conflict do nothing;
  if found then
    update public.game_players
       set score = score + greatest(0, least(answer_points, 1000)),
           correct = correct + case when answer_correct then 1 else 0 end,
           answered = answered + 1,
           status = case
             when g.mode = 'challenge' and answered + 1 >= g.question_count then 'finished'
             else 'joined' end,
           updated_at = now()
     where game_id = game and player = auth.uid();
  end if;
end $$;

-- Deletes your account and everything in it (profile, friendships, games you host).
create function public.delete_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.update_profile(text, text),
  public.add_friend(text),
  public.answer_friend(uuid, boolean),
  public.remove_friend(uuid),
  public.create_game(text, text, jsonb, jsonb, uuid[]),
  public.answer_invite(uuid, boolean),
  public.move_game(uuid, text, int),
  public.submit_answer(uuid, int, jsonb, int, boolean, real),
  public.delete_account()
  to authenticated;
-- Used inside the row level security policies.
grant execute on function public.in_game(uuid), public.are_friends(uuid, uuid) to authenticated;

-- Live updates for friends, invitations and games.
alter publication supabase_realtime
  add table public.friendships, public.games, public.game_players, public.game_answers;
