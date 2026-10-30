import { cn } from '../../../lib/cn.ts'
import { standings, type Player } from '../../../storage/cloud/games.ts'
import { Avatar } from '../../profile/Avatar.tsx'

const STATUS: Record<Player['status'], string> = {
  invited: 'Invited',
  joined: 'Playing',
  declined: 'Declined',
  finished: 'Finished',
}

/** The players, best score first, with their place. */
export function Standings({
  players,
  me,
  title = 'Standings',
  showStatus = false,
  answeredNow,
}: {
  players: Player[]
  me: string
  title?: string
  /** Shows whether each player is still playing, finished or only invited. */
  showStatus?: boolean
  /** Players who answered the current question. */
  answeredNow?: Set<string>
}) {
  const list = standings(players)
  return (
    <section className="grid w-full max-w-xl gap-2 rounded-card bg-surface-raised p-4 shadow-soft ring-1 ring-line">
      <h2 className="text-xs font-semibold tracking-[0.14em] text-ink-muted uppercase">{title}</h2>
      <ol className="grid gap-1">
        {list.map((p, i) => {
          const out = p.status === 'invited' || p.status === 'declined'
          return (
            <li
              key={p.id}
              className={cn(
                'flex items-center gap-3 rounded-control px-2 py-1.5',
                p.id === me && 'bg-surface-sunken',
                out && 'opacity-60',
              )}
            >
              <span className="w-6 text-center text-sm font-bold text-ink-muted tabular-nums">
                {out ? '–' : i + 1}
              </span>
              <Avatar profile={p} size={32} />
              <span className="min-w-0 flex-1 truncate font-semibold">
                {p.name || 'A friend'}
                {p.id === me ? <span className="font-normal text-ink-muted"> (you)</span> : null}
              </span>
              {answeredNow?.has(p.id) ? (
                <span className="text-xs font-semibold text-correct">Answered</span>
              ) : null}
              {showStatus ? (
                <span className="text-xs font-semibold text-ink-muted">{STATUS[p.status]}</span>
              ) : null}
              {out ? null : <span className="font-bold tabular-nums">{p.score}</span>}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
