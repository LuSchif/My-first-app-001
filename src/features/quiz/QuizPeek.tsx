import { Pencil, Play, Users } from 'lucide-react'
import { useState } from 'react'
import { navigate } from '../../app/router.ts'
import { Button, Dialog } from '../../design/index.ts'
import { cloudAvailable } from '../../storage/cloud/client.ts'
import { fillToCss } from '../../engine/model/fill.ts'
import { playable, QUESTION_KINDS, questionProblem } from '../../engine/model/quiz.ts'
import type { Notebook } from '../../engine/model/types.ts'
import { formatEdited } from '../../lib/time.ts'
import { openPeek } from '../library/peek.ts'
import { BackToFolder, Contents, Side } from '../library/PeekParts.tsx'
import type { Library } from '../library/useLibrary.ts'
import { KIND_ICONS } from './quizLook.ts'
import { QuizCover } from './QuizCover.tsx'
import { PlayWithFriendsDialog } from './together/PlayWithFriendsDialog.tsx'

/** A quiz in its peek: the cover, its questions and the best runs; play or edit it. */
export function QuizPeek({ quiz, library }: { quiz: Notebook; library: Library }) {
  const data = quiz.quiz ?? { questions: [] }
  const ready = playable(data).length
  const results = data.results ?? []
  const best = results.length ? Math.max(...results.map((r) => r.score)) : null
  const parent = library.folders.find((f) => f.id === quiz.folderId)
  const [friends, setFriends] = useState(false)
  const go = (name: 'quiz' | 'play') => {
    openPeek(null)
    navigate({ name, id: quiz.id })
  }
  return (
    <>
      <Side>
        <BackToFolder folder={parent} />
        <div className="grid flex-1 place-items-center py-4">
          <QuizCover
            color={fillToCss(quiz.cover)}
            title={quiz.title}
            count={data.questions.length}
            className="w-60"
          />
        </div>
        <div className="grid gap-1">
          <p className="truncate text-lg font-bold">{quiz.title}</p>
          <p className="text-sm text-ink-muted">
            Edited {formatEdited(quiz.updatedAt)} · {data.questions.length}{' '}
            {data.questions.length === 1 ? 'question' : 'questions'}
            {best !== null ? ` · best ${best} points` : ''}
          </p>
        </div>
        <div className="grid gap-2">
          <Button icon={<Pencil size={18} />} onClick={() => go('quiz')}>
            Edit quiz
          </Button>
          <Button
            variant="primary"
            icon={<Play size={18} />}
            disabled={ready === 0}
            onClick={() => go('play')}
          >
            Play
          </Button>
          {cloudAvailable() ? (
            <Button
              icon={<Users size={18} />}
              disabled={ready === 0}
              onClick={() => setFriends(true)}
            >
              Play with friends
            </Button>
          ) : null}
          <Dialog open={friends} onOpenChange={setFriends}>
            {friends ? (
              <PlayWithFriendsDialog
                quiz={quiz}
                onDone={() => {
                  setFriends(false)
                  openPeek(null)
                }}
              />
            ) : null}
          </Dialog>
        </div>
      </Side>
      <Contents title="Questions">
        <ol className="grid gap-2">
          {data.questions.map((q, i) => {
            const Icon = KIND_ICONS[q.kind]
            const problem = questionProblem(q)
            return (
              <li
                key={q.id}
                className="flex items-center gap-3 rounded-card bg-surface p-3 ring-1 ring-line"
              >
                <span className="w-6 text-center text-sm font-bold text-ink-muted tabular-nums">
                  {i + 1}
                </span>
                <Icon size={18} className="shrink-0 text-accent" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {q.text.trim() || 'Empty question'}
                  </span>
                  <span className="block text-xs text-ink-muted">
                    {QUESTION_KINDS.find((k) => k.kind === q.kind)?.label} · {q.time} s
                    {problem ? ` · ${problem}` : ''}
                  </span>
                </span>
              </li>
            )
          })}
        </ol>
        {results.length ? (
          <div className="mt-6 grid gap-2">
            <h3 className="text-xs font-semibold tracking-[0.14em] text-ink-muted uppercase">
              Your runs
            </h3>
            <ul className="grid gap-1">
              {results.slice(0, 5).map((r) => (
                <li key={r.at} className="flex justify-between text-sm">
                  <span className="text-ink-muted">{formatEdited(r.at)}</span>
                  <span className="font-semibold tabular-nums">
                    {r.score} points · {r.correct}/{r.total} right
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Contents>
    </>
  )
}
