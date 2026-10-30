import { useEffect, useState } from 'react'
import type { Fill } from '../../engine/model/fill.ts'
import type { QuizQuestion, Response } from '../../engine/model/quiz.ts'
import { useAccount } from './account.ts'
import { cloud } from './client.ts'

/**
 * Quizzes played with friends. A live game is played by everyone at once: the host moves
 * it from question to question and everyone answers on their own iPad. A challenge is
 * played by each friend in their own time; the standings fill up as they finish.
 */

export type GameMode = 'live' | 'challenge'
export type GameState = 'lobby' | 'question' | 'reveal' | 'done' | 'open' | 'closed'

export interface Game {
  id: string
  host: string
  mode: GameMode
  title: string
  cover: Fill
  questionCount: number
  state: GameState
  /** The question a live game is at. */
  question: number
  createdAt: string
}

export interface Player {
  id: string
  name: string
  picture?: string
  status: 'invited' | 'joined' | 'declined' | 'finished'
  score: number
  correct: number
  answered: number
}

export interface GameAnswer {
  player: string
  question: number
  response: Response
  points: number
  correct: boolean | null
  seconds: number
}

interface GameRow {
  id: string
  host: string
  mode: GameMode
  title: string
  cover: Fill
  question_count: number
  state: GameState
  question: number
  created_at: string
}

interface PlayerRow {
  game_id: string
  player: string
  name: string
  picture: string | null
  status: Player['status']
  score: number
  correct: number
  answered: number
}

const GAME_COLUMNS = 'id, host, mode, title, cover, question_count, state, question, created_at'
const PLAYER_COLUMNS = 'game_id, player, name, picture, status, score, correct, answered'

function gameFromRow(row: GameRow): Game {
  return {
    id: row.id,
    host: row.host,
    mode: row.mode,
    title: row.title,
    cover: row.cover,
    questionCount: row.question_count,
    state: row.state,
    question: row.question,
    createdAt: row.created_at,
  }
}

function playerFromRow(row: PlayerRow): Player {
  return {
    id: row.player,
    name: row.name,
    ...(row.picture ? { picture: row.picture } : {}),
    status: row.status,
    score: row.score,
    correct: row.correct,
    answered: row.answered,
  }
}

/** Highest score first; players still invited or who declined last. */
export function standings(players: Player[]): Player[] {
  const rank = (p: Player) => (p.status === 'declined' ? 2 : p.status === 'invited' ? 1 : 0)
  return [...players].sort((a, b) => rank(a) - rank(b) || b.score - a.score)
}

/** Starts a game of these questions with friends; returns its id. */
export async function createGame(
  mode: GameMode,
  title: string,
  cover: Fill,
  questions: QuizQuestion[],
  friends: string[],
): Promise<string> {
  const sb = await cloud()
  const { data, error } = await sb.rpc('create_game', {
    game_mode: mode,
    game_title: title,
    game_cover: cover,
    game_questions: questions,
    friends,
  })
  if (error) throw error
  gamesChanged()
  return data as string
}

export async function answerInvite(game: string, accept: boolean): Promise<void> {
  const sb = await cloud()
  const { error } = await sb.rpc('answer_invite', { game, accept })
  if (error) throw error
  gamesChanged()
}

/** The host moves a live game on, or closes a challenge. */
export async function moveGame(game: string, state: GameState, question: number): Promise<void> {
  const sb = await cloud()
  const { error } = await sb.rpc('move_game', {
    game,
    next_state: state,
    next_question: question,
  })
  if (error) throw error
}

export async function submitAnswer(game: string, answer: Omit<GameAnswer, 'player'>) {
  const sb = await cloud()
  const { error } = await sb.rpc('submit_answer', {
    game,
    question_index: answer.question,
    answer_response: answer.response,
    answer_points: answer.points,
    answer_correct: answer.correct,
    answer_seconds: answer.seconds,
  })
  if (error) throw error
}

export interface GameView {
  game: Game
  players: Player[]
  answers: GameAnswer[]
  questions: QuizQuestion[]
}

async function loadGame(id: string, questions?: QuizQuestion[]): Promise<GameView | null> {
  const sb = await cloud()
  const [game, players, answers, quiz] = await Promise.all([
    sb.from('games').select(GAME_COLUMNS).eq('id', id).maybeSingle<GameRow>(),
    sb.from('game_players').select(PLAYER_COLUMNS).eq('game_id', id).returns<PlayerRow[]>(),
    sb
      .from('game_answers')
      .select('player, question, response, points, correct, seconds')
      .eq('game_id', id)
      .returns<GameAnswer[]>(),
    questions
      ? Promise.resolve({ data: { questions }, error: null })
      : sb
          .from('game_quizzes')
          .select('questions')
          .eq('game_id', id)
          .maybeSingle<{ questions: QuizQuestion[] }>(),
  ])
  const error = game.error ?? players.error ?? answers.error ?? quiz.error
  if (error) throw error
  if (!game.data || !quiz.data) return null
  return {
    game: gameFromRow(game.data),
    players: (players.data ?? []).map(playerFromRow),
    answers: answers.data ?? [],
    questions: quiz.data.questions,
  }
}

/**
 * A game, kept up to date: live updates from the server, and a regular check in case an
 * update was missed (the iPad slept, the connection dropped). Undefined while loading,
 * null when there is no such game (or it is not yours to see).
 */
export function useGame(id: string): GameView | null | undefined {
  const [view, setView] = useState<GameView | null | undefined>(undefined)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let alive = true
    let questions: QuizQuestion[] | undefined
    let busy = false
    let again = false
    const load = () => {
      if (busy) {
        again = true
        return
      }
      busy = true
      loadGame(id, questions)
        .then((next) => {
          if (!alive) return
          questions = next?.questions
          setView(next)
          setFailed(false)
        })
        .catch((err: unknown) => {
          console.error(err)
          if (alive) setFailed(true)
        })
        .finally(() => {
          busy = false
          if (again && alive) {
            again = false
            load()
          }
        })
    }
    load()
    const channel = cloud().then((sb) =>
      sb
        .channel(`game:${id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'games', filter: `id=eq.${id}` },
          load,
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${id}` },
          load,
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'game_answers', filter: `game_id=eq.${id}` },
          load,
        )
        .subscribe(),
    )
    const timer = setInterval(load, 3000)
    window.addEventListener('focus', load)
    return () => {
      alive = false
      clearInterval(timer)
      window.removeEventListener('focus', load)
      void channel.then((c) => c.unsubscribe())
    }
  }, [id])
  return failed && view === undefined ? null : view
}

export interface MyGame {
  game: Game
  me: Player
  host: Player | undefined
}

const gameListeners = new Set<() => void>()
function gamesChanged(): void {
  for (const listener of gameListeners) listener()
}

/** The games the signed-in account is in (newest first), kept up to date. */
export function useMyGames(): MyGame[] {
  const account = useAccount()
  const me = account.status === 'signedIn' ? account.profile.id : null
  const [games, setGames] = useState<MyGame[]>([])
  useEffect(() => {
    if (!me) return
    let alive = true
    const load = async () => {
      const sb = await cloud()
      const mine = await sb
        .from('game_players')
        .select(PLAYER_COLUMNS)
        .eq('player', me)
        .returns<PlayerRow[]>()
      if (mine.error) throw mine.error
      const ids = mine.data.map((p) => p.game_id)
      if (!ids.length) return alive && setGames([])
      const list = await sb
        .from('games')
        .select(GAME_COLUMNS)
        .in('id', ids)
        .order('created_at', { ascending: false })
        .limit(30)
        .returns<GameRow[]>()
      if (list.error) throw list.error
      const everyone = await sb
        .from('game_players')
        .select(PLAYER_COLUMNS)
        .in('game_id', ids)
        .returns<PlayerRow[]>()
      if (everyone.error) throw everyone.error
      const find = (game: string, player: string) => {
        const row = everyone.data.find((p) => p.game_id === game && p.player === player)
        return row ? playerFromRow(row) : undefined
      }
      if (alive) {
        setGames(
          list.data.flatMap((row) => {
            const mine = find(row.id, me)
            return mine ? [{ game: gameFromRow(row), me: mine, host: find(row.id, row.host) }] : []
          }),
        )
      }
    }
    const reload = () => void load().catch((err: unknown) => console.error(err))
    reload()
    gameListeners.add(reload)
    const channel = cloud().then((sb) =>
      sb
        .channel(`my-games:${me}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'game_players', filter: `player=eq.${me}` },
          reload,
        )
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games' }, reload)
        .subscribe(),
    )
    window.addEventListener('focus', reload)
    const timer = setInterval(reload, 15000)
    return () => {
      alive = false
      clearInterval(timer)
      gameListeners.delete(reload)
      window.removeEventListener('focus', reload)
      void channel.then((c) => c.unsubscribe())
    }
  }, [me])
  return me ? games : []
}

/** Whether a game still waits for this player: an invitation, or a challenge to play. */
export function waitsForMe({ game, me }: MyGame): boolean {
  if (me.status === 'invited') return game.state !== 'done' && game.state !== 'closed'
  return game.mode === 'challenge' && game.state === 'open' && me.status === 'joined'
}
