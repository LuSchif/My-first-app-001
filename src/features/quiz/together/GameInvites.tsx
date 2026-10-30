import { Gamepad2 } from 'lucide-react'
import { navigate } from '../../../app/router.ts'
import { Button } from '../../../design/index.ts'
import { useMyGames, waitsForMe, type MyGame } from '../../../storage/cloud/games.ts'
import { Avatar } from '../../profile/Avatar.tsx'

function describe({ game, me, host }: MyGame): string {
  const who = host?.name || 'A friend'
  if (me.status === 'invited') {
    return game.mode === 'live' ? `${who} invites you to play live` : `${who} challenges you`
  }
  return 'Your challenge is waiting'
}

/** On the home screen: games friends invited you to, and challenges still to play. */
export function GameInvites() {
  const waiting = useMyGames().filter(waitsForMe).slice(0, 3)
  if (!waiting.length) return null
  return (
    <section aria-label="Invitations" className="grid gap-2">
      {waiting.map((item) => (
        <div
          key={item.game.id}
          className="flex animate-pop-in items-center gap-3 rounded-panel bg-surface-raised p-3 pr-4 shadow-soft ring-1 ring-line"
        >
          {item.host ? (
            <Avatar profile={item.host} size={40} />
          ) : (
            <Gamepad2 size={24} className="mx-2 text-accent" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{describe(item)}</span>
            <span className="block truncate text-sm text-ink-muted">
              {item.game.title} · {item.game.questionCount}{' '}
              {item.game.questionCount === 1 ? 'question' : 'questions'}
            </span>
          </span>
          <Button variant="primary" onClick={() => navigate({ name: 'game', id: item.game.id })}>
            {item.me.status === 'invited' ? 'Open' : 'Play'}
          </Button>
        </div>
      ))}
    </section>
  )
}
