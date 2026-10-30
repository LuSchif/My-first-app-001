import { Radio, Send, Timer } from 'lucide-react'
import { useState } from 'react'
import { navigate } from '../../../app/router.ts'
import { Button, DialogContent, DialogFooter } from '../../../design/index.ts'
import { playable } from '../../../engine/model/quiz.ts'
import type { Notebook } from '../../../engine/model/types.ts'
import { cn } from '../../../lib/cn.ts'
import { showNotice } from '../../../lib/notices.ts'
import { useAccount } from '../../../storage/cloud/account.ts'
import { cloudError } from '../../../storage/cloud/client.ts'
import { useFriends } from '../../../storage/cloud/friends.ts'
import { createGame, type GameMode } from '../../../storage/cloud/games.ts'
import { Avatar } from '../../profile/Avatar.tsx'

const MODES: { mode: GameMode; icon: typeof Radio; label: string; hint: string }[] = [
  {
    mode: 'live',
    icon: Radio,
    label: 'Live, all at once',
    hint: 'Everyone answers at the same time; you move on to the next question.',
  },
  {
    mode: 'challenge',
    icon: Timer,
    label: 'Challenge',
    hint: 'Each friend plays when they like; the standings fill up as they finish.',
  },
]

/** Inviting friends to a quiz: live or as a challenge. Open inside a Dialog. */
export function PlayWithFriendsDialog({ quiz, onDone }: { quiz: Notebook; onDone: () => void }) {
  const account = useAccount()
  const friends = useFriends()
  const [mode, setMode] = useState<GameMode>('live')
  const [chosen, setChosen] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const mine = friends?.filter((f) => f.status === 'friend') ?? []

  if (account.status !== 'signedIn') {
    return (
      <DialogContent
        title="Play with friends"
        description="Sign in to your Broomit account first; then add friends by their Broomit ID."
      >
        <DialogFooter>
          <Button
            variant="primary"
            onClick={() => {
              onDone()
              navigate({ name: 'profile' })
            }}
          >
            Open your profile
          </Button>
        </DialogFooter>
      </DialogContent>
    )
  }

  const start = () => {
    const questions = playable(quiz.quiz ?? { questions: [] })
    setBusy(true)
    createGame(mode, quiz.title, quiz.cover, questions, chosen)
      .then((id) => {
        onDone()
        if (mode === 'challenge') showNotice('Challenge sent. Play it too!')
        navigate({ name: 'game', id })
      })
      .catch((err: unknown) => showNotice(cloudError(err)))
      .finally(() => setBusy(false))
  }

  return (
    <DialogContent title="Play with friends" description={quiz.title}>
      <div className="grid gap-5">
        <div role="radiogroup" aria-label="How to play" className="grid gap-2 sm:grid-cols-2">
          {MODES.map(({ mode: m, icon: Icon, label, hint }) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className="grid gap-1 rounded-card p-3 text-left ring-1 ring-line hover:bg-hover aria-checked:ring-2 aria-checked:ring-selected"
            >
              <span className="flex items-center gap-2 font-semibold">
                <Icon size={18} className="text-accent" />
                {label}
              </span>
              <span className="text-sm text-ink-muted">{hint}</span>
            </button>
          ))}
        </div>
        <div className="grid gap-2">
          <h3 className="text-sm font-semibold">Invite</h3>
          {friends === null ? (
            <p className="text-sm text-ink-muted">Loading your friends…</p>
          ) : null}
          {friends !== null && mine.length === 0 ? (
            <p className="text-sm text-ink-muted">
              You have no friends in Broomit yet. Add them by Broomit ID in your profile.
            </p>
          ) : null}
          <ul className="grid gap-1">
            {mine.map((f) => {
              const on = chosen.includes(f.id)
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() =>
                      setChosen((list) => (on ? list.filter((x) => x !== f.id) : [...list, f.id]))
                    }
                    className={cn(
                      'flex w-full items-center gap-3 rounded-control p-2 text-left hover:bg-hover',
                      on && 'bg-surface-sunken',
                    )}
                  >
                    <Avatar profile={f} size={36} />
                    <span className="min-w-0 flex-1 truncate font-semibold">
                      {f.name || f.broomitId}
                    </span>
                    <span
                      className={cn(
                        'size-5 rounded-md ring-2',
                        on ? 'bg-accent ring-accent' : 'ring-line-strong',
                      )}
                    />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
      <DialogFooter>
        {mine.length === 0 ? (
          <Button
            onClick={() => {
              onDone()
              navigate({ name: 'profile' })
            }}
          >
            Add friends
          </Button>
        ) : null}
        <Button
          variant="primary"
          icon={<Send size={18} />}
          disabled={busy || chosen.length === 0}
          onClick={start}
        >
          {mode === 'live' ? 'Invite and open the game' : 'Send the challenge'}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
