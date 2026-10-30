import { ChevronRight } from 'lucide-react'
import { navigate } from '../../app/router.ts'
import { useAccount } from '../../storage/cloud/account.ts'
import { useMyGames, type MyGame } from '../../storage/cloud/games.ts'
import { formatEdited } from '../../lib/time.ts'
import { ProfileCard } from './ProfileCard.tsx'

function state({ game, me }: MyGame): string {
  if (me.status === 'invited') return 'Invitation'
  if (me.status === 'declined') return 'Declined'
  if (game.state === 'closed') return 'Closed'
  if (game.state === 'done') return `Over · ${me.score} points`
  if (game.mode === 'challenge') {
    return me.status === 'finished' ? `Played · ${me.score} points` : 'To play'
  }
  return game.state === 'lobby' ? 'Waiting to start' : 'Playing now'
}

/** The quizzes played with friends, newest first. */
export function GamesCard() {
  const account = useAccount()
  const games = useMyGames()
  if (account.status !== 'signedIn' || games.length === 0) return null
  return (
    <ProfileCard title="Games with friends">
      <ul className="grid divide-y divide-line">
        {games.map((item) => (
          <li key={item.game.id}>
            <button
              type="button"
              onClick={() => navigate({ name: 'game', id: item.game.id })}
              className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-hover"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{item.game.title}</span>
                <span className="block text-sm text-ink-muted">
                  {item.game.mode === 'live' ? 'Live' : 'Challenge'} ·{' '}
                  {formatEdited(Date.parse(item.game.createdAt))}
                  {item.game.host === account.profile.id ? ' · you host' : ''}
                </span>
              </span>
              <span className="text-sm font-semibold text-ink-muted">{state(item)}</span>
              <ChevronRight size={18} className="text-ink-subtle" />
            </button>
          </li>
        ))}
      </ul>
    </ProfileCard>
  )
}
