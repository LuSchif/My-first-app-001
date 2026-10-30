import { Check, UserPlus, X } from 'lucide-react'
import { useState } from 'react'
import { Button, IconButton, TextField } from '../../design/index.ts'
import { showNotice } from '../../lib/notices.ts'
import { useAccount } from '../../storage/cloud/account.ts'
import { cloudError } from '../../storage/cloud/client.ts'
import {
  addFriend,
  answerFriend,
  formatBroomitId,
  removeFriend,
  useFriends,
  type Friend,
} from '../../storage/cloud/friends.ts'
import { Avatar } from './Avatar.tsx'
import { ProfileCard } from './ProfileCard.tsx'

/** Adding friends by Broomit ID, answering requests, and the list of friends. */
export function FriendsCard() {
  const account = useAccount()
  const friends = useFriends()
  if (account.status !== 'signedIn') return null
  const incoming = friends?.filter((f) => f.status === 'incoming') ?? []
  const outgoing = friends?.filter((f) => f.status === 'outgoing') ?? []
  const mine = friends?.filter((f) => f.status === 'friend') ?? []
  return (
    <ProfileCard title="Friends">
      <AddFriend />
      {friends === null ? <p className="text-sm text-ink-muted">Loading your friends…</p> : null}
      {incoming.length ? (
        <FriendList title="Want to be your friend">
          {incoming.map((f) => (
            <FriendRow key={f.id} friend={f}>
              <Button
                variant="primary"
                icon={<Check size={18} />}
                onClick={() =>
                  act(() => answerFriend(f.id, true), `${label(f)} is your friend now.`)
                }
              >
                Accept
              </Button>
              <IconButton
                label={`Decline ${label(f)}`}
                icon={<X size={18} />}
                onClick={() => act(() => answerFriend(f.id, false))}
              />
            </FriendRow>
          ))}
        </FriendList>
      ) : null}
      {friends !== null ? (
        <FriendList title={mine.length ? `Your friends (${mine.length})` : 'Your friends'}>
          {mine.length === 0 ? (
            <li className="py-2 text-sm text-ink-muted">
              No friends yet. Share your Broomit ID, or add a friend's above.
            </li>
          ) : null}
          {mine.map((f) => (
            <FriendRow key={f.id} friend={f}>
              <RemoveButton friend={f} />
            </FriendRow>
          ))}
        </FriendList>
      ) : null}
      {outgoing.length ? (
        <FriendList title="Asked, waiting for an answer">
          {outgoing.map((f) => (
            <FriendRow key={f.id} friend={f}>
              <Button variant="ghost" onClick={() => act(() => removeFriend(f.id))}>
                Take back
              </Button>
            </FriendRow>
          ))}
        </FriendList>
      ) : null}
    </ProfileCard>
  )
}

function label(friend: Friend): string {
  return friend.name || friend.broomitId
}

function act(work: () => Promise<void>, done?: string): void {
  work()
    .then(() => done && showNotice(done))
    .catch((err: unknown) => showNotice(cloudError(err)))
}

function AddFriend() {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        setBusy(true)
        setError(null)
        addFriend(code)
          .then((result) => {
            setCode('')
            showNotice(
              result === 'friends'
                ? 'You are friends now.'
                : 'Asked. You are friends once they accept.',
            )
          })
          .catch((err: unknown) => setError(cloudError(err)))
          .finally(() => setBusy(false))
      }}
    >
      <div className="min-w-[12rem] flex-1">
        <TextField
          label="Add a friend by Broomit ID"
          placeholder="ABCD-1234"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          value={code}
          error={error ?? undefined}
          onChange={(e) => setCode(formatBroomitId(e.target.value))}
          className="font-mono tracking-wider"
        />
      </div>
      <Button
        type="submit"
        variant="primary"
        icon={<UserPlus size={18} />}
        disabled={busy || code.length !== 9}
        className={error ? 'mb-6' : undefined}
      >
        Add
      </Button>
    </form>
  )
}

function FriendList({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="grid divide-y divide-line">{children}</ul>
    </div>
  )
}

function FriendRow({ friend, children }: { friend: Friend; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <Avatar profile={friend} size={40} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{friend.name || 'No name yet'}</span>
        <span className="block font-mono text-xs text-ink-muted">{friend.broomitId}</span>
      </span>
      {children}
    </li>
  )
}

/** Removing asks once more, in place. */
function RemoveButton({ friend }: { friend: Friend }) {
  const [sure, setSure] = useState(false)
  if (!sure) {
    return (
      <Button variant="ghost" onClick={() => setSure(true)}>
        Remove
      </Button>
    )
  }
  return (
    <>
      <Button variant="ghost" onClick={() => setSure(false)}>
        Keep
      </Button>
      <Button variant="danger" onClick={() => act(() => removeFriend(friend.id))}>
        Remove {label(friend)}
      </Button>
    </>
  )
}
