import { cn } from '../../lib/cn.ts'
import type { Entry } from './calendarStore.ts'
import { addDays, dayKey, monthGridStart, startOfDay, type DayMark } from './model.ts'
import { useNow } from './useNow.ts'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Six weeks around a month: entries as small bars, marked days tinted with their label. */
export function MonthGrid({
  month,
  entries,
  marks,
  onDayTap,
  onEntryTap,
}: {
  month: Date
  entries: Entry[]
  marks: DayMark[]
  onDayTap: (day: Date) => void
  onEntryTap: (entry: Entry) => void
}) {
  const start = monthGridStart(month)
  const today = dayKey(useNow())
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i))
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_1fr]">
      <div className="grid grid-cols-7 border-b border-line">
        {WEEKDAYS.map((d) => (
          <span key={d} className="px-2 py-1.5 text-xs font-semibold text-ink-muted uppercase">
            {d}
          </span>
        ))}
      </div>
      <div className="grid min-h-0 grid-cols-7 grid-rows-6">
        {cells.map((day) => {
          const key = dayKey(day)
          const from = startOfDay(day).getTime()
          const to = addDays(day, 1).getTime()
          const list = entries.filter((e) => e.start.getTime() < to && e.end.getTime() > from)
          const mark = marks.find((m) => m.date === key)
          const inMonth = day.getMonth() === month.getMonth()
          return (
            <div
              key={key}
              role="button"
              tabIndex={0}
              onClick={() => onDayTap(day)}
              onKeyDown={(e) => e.key === 'Enter' && onDayTap(day)}
              className={cn(
                'min-h-0 overflow-hidden border-r border-b border-line p-1 text-left hover:bg-hover',
                !inMonth && 'opacity-45',
              )}
              style={
                mark
                  ? { background: `color-mix(in srgb, ${mark.color} 14%, transparent)` }
                  : undefined
              }
            >
              <div className="flex items-center gap-1">
                <span
                  className={cn(
                    'grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold tabular-nums',
                    key === today && 'bg-ink text-ink-inverse',
                  )}
                >
                  {day.getDate()}
                </span>
                {mark?.label ? (
                  <span
                    className="truncate text-[11px] font-semibold"
                    style={{ color: mark.color }}
                  >
                    {mark.label}
                  </span>
                ) : null}
              </div>
              {list.slice(0, 3).map((e) => (
                <button
                  key={e.key}
                  type="button"
                  onClick={(ev) => {
                    ev.stopPropagation()
                    onEntryTap(e)
                  }}
                  className="mt-0.5 block w-full truncate rounded px-1 text-left text-[11px] leading-[18px] font-semibold text-white"
                  style={{ background: e.color }}
                >
                  {e.title}
                </button>
              ))}
              {list.length > 3 ? (
                <span className="block px-1 text-[11px] text-ink-muted">
                  +{list.length - 3} more
                </span>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
