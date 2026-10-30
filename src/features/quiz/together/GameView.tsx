import { useEffect, useState } from 'react'
import { navigate } from '../../../app/router.ts'
import { Button } from '../../../design/index.ts'
import {
  isCorrect,
  pointsFor,
  type QuizQuestion,
  type Response,
} from '../../../engine/model/quiz.ts'
import { showNotice } from '../../../lib/notices.ts'
import { useAccount } from '../../../storage/cloud/account.ts'
import { cloudError } from '../../../storage/cloud/client.ts'
import {
  answerInvite,
  moveGame,
  submitAnswer,
  useGame,
  type GameAnswer,
  type GameView as View,
  type Player,
} from '../../../storage/cloud/games.ts'
import { Asking, PlayScreen, QuestionHeading, Verdict, type Answered } from '../playParts.tsx'
import { QuizIntro, QuizSummary } from '../QuizSummary.tsx'
import { Standings } from './Standings.tsx'

const exit = () => navigate({ name: 'library' })

function report(err: unknown): void {
  console.error(err)
  showNotice(cloudError(err))
}

/** Scores an answer on this iPad and sends it; returns what to show right away. */
function answer(
  gameId: string,
  question: QuizQuestion,
  index: number,
  response: Response,
  seconds: number,
): Answered {
  const answered: Answered = {
    response,
    seconds,
    points: pointsFor(question, response, seconds),
    correct: isCorrect(question, response),
  }
  submitAnswer(gameId, { question: index, ...answered }).catch(report)
  return answered
}

function myAnswers(view: View, me: string): (Answered | undefined)[] {
  return view.questions.map((_, i) => view.answers.find((a) => a.player === me && a.question === i))
}

function Message({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <PlayScreen onExit={exit}>
      <p className="max-w-md text-center text-xl font-bold text-balance">{text}</p>
      {children}
    </PlayScreen>
  )
}

/** A quiz played with friends (`#/game/<id>`), live or as a challenge. */
export function GameView({ id }: { id: string }) {
  const account = useAccount()
  const view = useGame(id)
  if (account.status === 'unavailable')
    return <Message text="Playing with friends is not available here." />
  if (account.status === 'signedOut') {
    return (
      <Message text="Sign in to your Broomit account to play with friends.">
        <Button variant="primary" onClick={() => navigate({ name: 'profile' })}>
          Open your profile
        </Button>
      </Message>
    )
  }
  if (account.status === 'loading' || view === undefined)
    return <Message text="Loading the game…" />
  const me = view?.players.find((p) => p.id === account.profile.id)
  if (!view || !me) {
    return (
      <Message text="This game is not available. The host may have deleted it.">
        <Button onClick={exit}>Back to the library</Button>
      </Message>
    )
  }
  if (me.status === 'invited' || me.status === 'declined') {
    return <Invitation view={view} me={me} />
  }
  return view.game.mode === 'live' ? (
    <LiveGame view={view} me={me} />
  ) : (
    <Challenge view={view} me={me} />
  )
}

function Invitation({ view, me }: { view: View; me: Player }) {
  const { game } = view
  const host = view.players.find((p) => p.id === game.host)
  const over = game.state === 'done' || game.state === 'closed'
  const [busy, setBusy] = useState(false)
  return (
    <PlayScreen onExit={exit}>
      <QuizIntro
        title={game.title}
        cover={game.cover}
        count={game.questionCount}
        note={
          <p className="font-semibold">
            {host?.name || 'A friend'} invites you to{' '}
            {game.mode === 'live' ? 'play live, all at once' : 'a challenge'}.
          </p>
        }
      >
        {over ? (
          <p className="text-ink-muted">This game is over.</p>
        ) : (
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              disabled={busy}
              onClick={() => {
                setBusy(true)
                answerInvite(game.id, false)
                  .then(exit)
                  .catch(report)
                  .finally(() => setBusy(false))
              }}
            >
              {me.status === 'declined' ? 'Not now' : 'Decline'}
            </Button>
            <Button
              variant="primary"
              size="lg"
              disabled={busy}
              onClick={() => {
                setBusy(true)
                answerInvite(game.id, true)
                  .catch(report)
                  .finally(() => setBusy(false))
              }}
            >
              Join
            </Button>
          </div>
        )}
      </QuizIntro>
    </PlayScreen>
  )
}

function asAnswered(a: GameAnswer | undefined): Answered | undefined {
  return a && { response: a.response, points: a.points, correct: a.correct, seconds: a.seconds }
}

/** Everyone at once: the host moves from question to question; all answer on their iPads. */
function LiveGame({ view, me }: { view: View; me: Player }) {
  const { game, players, answers, questions } = view
  const isHost = game.host === me.id
  const host = players.find((p) => p.id === game.host)
  const playing = players.filter((p) => p.status === 'joined' || p.status === 'finished')
  const question = questions[game.question]
  const answeredNow = new Set(
    answers.filter((a) => a.question === game.question).map((a) => a.player),
  )
  const allIn = playing.every((p) => answeredNow.has(p.id))
  // Shown at once, before the server has it.
  const [sent, setSent] = useState<{ question: number; answered: Answered } | null>(null)
  const mine =
    asAnswered(answers.find((a) => a.player === me.id && a.question === game.question)) ??
    (sent?.question === game.question ? sent.answered : undefined)
  const move = (state: Parameters<typeof moveGame>[1], index: number) =>
    void moveGame(game.id, state, index).catch(report)

  // When everyone has answered, the host's iPad shows the answers.
  useEffect(() => {
    if (isHost && game.state === 'question' && allIn) {
      moveGame(game.id, 'reveal', game.question).catch(report)
    }
  }, [isHost, game.state, game.question, game.id, allIn])

  const top = question ? (
    <>
      <span>
        Question {game.question + 1} of {questions.length}
      </span>
      <span className="tabular-nums">{me.score} points</span>
    </>
  ) : (
    <span>Live game</span>
  )

  if (game.state === 'closed') return <Message text="The host ended this game." />

  if (game.state === 'lobby') {
    const others = playing.filter((p) => p.id !== me.id).length
    return (
      <PlayScreen onExit={exit} top={top}>
        <QuizIntro title={game.title} cover={game.cover} count={questions.length}>
          {isHost ? (
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => move('closed', -1)}>End game</Button>
              <Button
                variant="primary"
                size="lg"
                disabled={others === 0}
                onClick={() => move('question', 0)}
              >
                {others === 0 ? 'Waiting for friends…' : 'Start'}
              </Button>
            </div>
          ) : (
            <p className="text-ink-muted">Waiting for {host?.name || 'the host'} to start…</p>
          )}
        </QuizIntro>
        <Standings players={players} me={me.id} title="Players" showStatus />
      </PlayScreen>
    )
  }

  if (game.state === 'done' || !question) {
    return (
      <PlayScreen onExit={exit}>
        <QuizSummary
          questions={questions}
          answers={myAnswers(view, me.id)}
          side={<Standings players={players} me={me.id} title="Final standings" />}
        >
          <Button variant="primary" onClick={exit}>
            Done
          </Button>
        </QuizSummary>
      </PlayScreen>
    )
  }

  if (game.state === 'question') {
    return (
      <PlayScreen onExit={exit} top={top}>
        <QuestionHeading question={question} />
        {mine ? (
          <div className="grid w-full max-w-xl justify-items-center gap-3 rounded-card bg-surface-raised p-6 text-center shadow-soft ring-1 ring-line">
            <p className="text-xl font-bold">Your answer is in</p>
            <p className="text-ink-muted">
              {answeredNow.size} of {playing.length} answered
            </p>
            {isHost ? (
              <Button onClick={() => move('reveal', game.question)}>Show the answers now</Button>
            ) : null}
          </div>
        ) : (
          <Asking
            key={game.question}
            question={question}
            onAnswer={(response, seconds) =>
              setSent({
                question: game.question,
                answered: answer(game.id, question, game.question, response, seconds),
              })
            }
          />
        )}
      </PlayScreen>
    )
  }

  // Reveal: right or wrong, and the standings so far.
  const last = game.question + 1 >= questions.length
  return (
    <PlayScreen onExit={exit} top={top}>
      <QuestionHeading question={question} />
      <Verdict
        question={question}
        answered={mine ?? { response: { kind: 'none' }, points: 0, correct: false, seconds: 0 }}
      />
      <Standings players={players} me={me.id} answeredNow={answeredNow} />
      {isHost ? (
        <Button
          variant="primary"
          size="lg"
          className="min-w-40"
          onClick={() => (last ? move('done', game.question) : move('question', game.question + 1))}
        >
          {last ? 'Final standings' : 'Next question'}
        </Button>
      ) : (
        <p className="text-ink-muted">Waiting for {host?.name || 'the host'} to go on…</p>
      )}
    </PlayScreen>
  )
}

/** Each player in their own time; the standings fill up as they finish. */
function Challenge({ view, me }: { view: View; me: Player }) {
  const { game, players, questions } = view
  const isHost = game.host === me.id
  const [local, setLocal] = useState<(Answered | undefined)[]>([])
  const [phase, setPhase] = useState<'intro' | 'question' | 'feedback'>('intro')
  const [shown, setShown] = useState(0)
  const server = myAnswers(view, me.id)
  const mine = questions.map((_, i) => server[i] ?? local[i])
  const next = mine.findIndex((a) => !a)
  const open = game.state === 'open'

  if (phase === 'feedback') {
    const question = questions[shown]!
    const last = next === -1
    return (
      <PlayScreen
        onExit={exit}
        top={
          <span>
            Question {shown + 1} of {questions.length}
          </span>
        }
      >
        <QuestionHeading question={question} />
        <Verdict question={question} answered={mine[shown]!} />
        <Button
          variant="primary"
          size="lg"
          className="min-w-40"
          onClick={() => setPhase(last ? 'intro' : 'question')}
        >
          {last ? 'See the standings' : 'Next question'}
        </Button>
      </PlayScreen>
    )
  }

  if (next === -1 || !open) {
    return (
      <PlayScreen onExit={exit}>
        <QuizSummary
          questions={questions}
          answers={mine}
          side={<Standings players={players} me={me.id} showStatus />}
        >
          {isHost && open ? (
            <Button onClick={() => void moveGame(game.id, 'closed', -1).catch(report)}>
              Close the challenge
            </Button>
          ) : null}
          <Button variant="primary" onClick={exit}>
            Done
          </Button>
        </QuizSummary>
        {!open ? <p className="text-ink-muted">This challenge is closed.</p> : null}
      </PlayScreen>
    )
  }

  if (phase === 'intro') {
    return (
      <PlayScreen onExit={exit}>
        <QuizIntro title={game.title} cover={game.cover} count={questions.length}>
          <Button
            variant="primary"
            size="lg"
            className="min-w-40"
            onClick={() => setPhase('question')}
          >
            {next > 0 ? 'Continue' : 'Start'}
          </Button>
        </QuizIntro>
        <Standings players={players} me={me.id} showStatus />
      </PlayScreen>
    )
  }

  const question = questions[next]!
  return (
    <PlayScreen
      onExit={exit}
      top={
        <>
          <span>
            Question {next + 1} of {questions.length}
          </span>
          <span className="tabular-nums">
            {mine.reduce((sum, a) => sum + (a?.points ?? 0), 0)} points
          </span>
        </>
      }
    >
      <QuestionHeading question={question} />
      <Asking
        key={next}
        question={question}
        onAnswer={(response, seconds) => {
          const answered = answer(game.id, question, next, response, seconds)
          setLocal((list) => {
            const copy = [...list]
            copy[next] = answered
            return copy
          })
          setShown(next)
          setPhase('feedback')
        }}
      />
    </PlayScreen>
  )
}
