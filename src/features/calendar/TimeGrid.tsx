import { useLayoutEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn.ts'
import type { Entry } from './calendarStore.ts'
import { allDayOn, placeDay, TIME_FORMAT } from './layout.ts'
import { dayKey, startOfDay, type DayMark } from './model.ts'
import { useNow } from './useNow.ts'

const TIME_COLUMN = 48
const HEADER = 44
const WEEKDAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short' })

/**
 * Days side by side with the hours of the day running down, as calendar apps show them. The
 * grid scrolls up and down through the day, and sideways when there are more days than fit
 * (`visibleDays`). Day names and hours stay in view while scrolling.
 */
export function TimeGrid({
  days,
  visibleDays,
  entries,
  marks,
  hourHeight,
  firstVisible,
  onEntryTap,
  onSlotTap,
  onDayTap,
  className,
}: {
  days: Date[]
  /** How many day columns fit across. */
  visibleDays: number
  entries: Entry[]
  marks: DayMark[]
  hourHeight: number
  /** The day scrolled to first. */
  firstVisible?: Date
  onEntryTap?: (entry: Entry) => void
  /** A tap on an empty spot, with the time there (to the quarter hour). */
  onSlotTap?: (at: Date) => void
  onDayTap?: (day: Date) => void
  className?: string
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const now = useNow()
  const dayWidth = width ? (width - TIME_COLUMN) / visibleDays : 0
  const allDayRows = Math.min(3, Math.max(0, ...days.map((d) => allDayOn(entries, d).length)))
  const allDayHeight = allDayRows ? allDayRows * 24 + 6 : 0

  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    const measure = () => setWidth(el.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // First view: the chosen day at the left, an hour before now (or 7:00) at the top.
  const firstKey = firstVisible ? dayKey(firstVisible) : ''
  const firstIndex = Math.max(
    0,
    days.findIndex((d) => dayKey(d) === firstKey),
  )
  // The first hour shown: the earliest entry of the days in view, or an hour before now.
  const shownDays = days.slice(firstIndex, firstIndex + visibleDays)
  const earliest = Math.min(
    ...shownDays.flatMap((d) => placeDay(entries, d).map((p) => Math.floor(p.top / 60))),
    now.getHours() - 1,
  )
  const startHour = Math.min(16, Math.max(0, earliest))
  const scrolledFor = useRef('')
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el || !dayWidth) return
    // Once per set of days and size, so new entries never move the view under the finger.
    const key = `${firstIndex}:${dayWidth}:${hourHeight}`
    if (scrolledFor.current === key) return
    scrolledFor.current = key
    el.scrollLeft = firstIndex * dayWidth
    el.scrollTop = startHour * hourHeight
  }, [firstIndex, dayWidth, hourHeight, startHour])

  const markOf = (d: Date) => marks.find((m) => m.date === dayKey(d))
  const today = dayKey(now)

  return (
    <div
      ref={scroller}
      className={cn('relative overflow-auto overscroll-contain [scrollbar-width:thin]', className)}
      style={{ scrollSnapType: visibleDays < days.length ? 'x proximity' : undefined }}
    >
      <div
        className="relative"
        style={{
          width: TIME_COLUMN + dayWidth * days.length,
          height: HEADER + allDayHeight + hourHeight * 24,
        }}
      >
        {/* Day names, with all-day entries under them. */}
        <div
          className="sticky top-0 z-20 flex bg-surface-raised/95 backdrop-blur"
          style={{ height: HEADER + allDayHeight }}
        >
          <div
            className="sticky left-0 z-10 shrink-0 bg-surface-raised"
            style={{ width: TIME_COLUMN }}
          />
          {days.map((d) => {
            const mark = markOf(d)
            const isToday = dayKey(d) === today
            return (
              <div
                key={dayKey(d)}
                className="shrink-0 border-l border-line px-1"
                style={{ width: dayWidth, scrollSnapAlign: 'start', scrollMarginLeft: TIME_COLUMN }}
              >
                <button
                  type="button"
                  onClick={(ev) => {
                    if (!onDayTap) return
                    ev.stopPropagation()
                    onDayTap(d)
                  }}
                  className={cn(
                    'flex h-11 w-full items-center gap-1.5 rounded-control px-1.5 text-left',
                    onDayTap && 'hover:bg-hover',
                  )}
                  style={mark ? { boxShadow: `inset 0 -3px 0 ${mark.color}` } : undefined}
                >
                  <span className="text-xs font-semibold text-ink-muted uppercase">
                    {WEEKDAY.format(d)}
                  </span>
                  <span
                    className={cn(
                      'grid size-7 place-items-center rounded-full text-sm font-bold tabular-nums',
                      isToday && 'bg-ink text-ink-inverse',
                    )}
                  >
                    {d.getDate()}
                  </span>
                  {mark?.label ? (
                    <span
                      className="min-w-0 truncate text-xs font-semibold"
                      style={{ color: mark.color }}
                    >
                      {mark.label}
                    </span>
                  ) : null}
                </button>
                {allDayOn(entries, d)
                  .slice(0, 3)
                  .map((e) => (
                    <button
                      key={e.key}
                      type="button"
                      onClick={(ev) => {
                        if (!onEntryTap) return
                        ev.stopPropagation()
                        onEntryTap(e)
                      }}
                      className="mb-0.5 block h-[22px] w-full truncate rounded-md px-1.5 text-left text-xs font-semibold text-white"
                      style={{ background: e.color }}
                    >
                      {e.title}
                    </button>
                  ))}
              </div>
            )
          })}
        </div>

        {/* Hours. */}
        <div
          className="sticky left-0 z-10 bg-surface-raised"
          style={{ width: TIME_COLUMN, height: hourHeight * 24 }}
        >
          {Array.from({ length: 23 }, (_, i) => (
            <span
              key={i}
              className="absolute right-2 -translate-y-1/2 text-[11px] text-ink-subtle tabular-nums"
              style={{ top: (i + 1) * hourHeight }}
            >
              {String(i + 1).padStart(2, '0')}:00
            </span>
          ))}
        </div>

        {/* Day columns. */}
        <div
          className="absolute flex"
          style={{ left: TIME_COLUMN, top: HEADER + allDayHeight, height: hourHeight * 24 }}
        >
          {days.map((d) => (
            <DayColumn
              key={dayKey(d)}
              day={d}
              width={dayWidth}
              hourHeight={hourHeight}
              entries={entries}
              mark={markOf(d)}
              now={dayKey(d) === today ? now : null}
              onEntryTap={onEntryTap}
              onSlotTap={onSlotTap}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function DayColumn({
  day,
  width,
  hourHeight,
  entries,
  mark,
  now,
  onEntryTap,
  onSlotTap,
}: {
  day: Date
  width: number
  hourHeight: number
  entries: Entry[]
  mark: DayMark | undefined
  now: Date | null
  onEntryTap?: (entry: Entry) => void
  onSlotTap?: (at: Date) => void
}) {
  const placed = placeDay(entries, day)
  const scale = hourHeight / 60
  return (
    <div
      className="relative shrink-0 border-l border-line"
      style={{
        width,
        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 ${hourHeight - 1}px, var(--color-line) ${hourHeight - 1}px ${hourHeight}px)`,
        backgroundColor: mark ? `color-mix(in srgb, ${mark.color} 7%, transparent)` : undefined,
      }}
      onClick={(e) => {
        if (!onSlotTap || e.target !== e.currentTarget) return
        const y = e.nativeEvent.offsetY
        const minutes = Math.max(0, Math.min(1425, Math.floor(y / scale / 15) * 15))
        const at = startOfDay(day)
        at.setMinutes(minutes)
        onSlotTap(at)
      }}
    >
      {placed.map((p) => {
        const height = (p.bottom - p.top) * scale
        return (
          <button
            key={p.entry.key}
            type="button"
            onClick={(ev) => {
              if (!onEntryTap) return
              ev.stopPropagation()
              onEntryTap(p.entry)
            }}
            className="absolute overflow-hidden rounded-md px-1.5 py-0.5 text-left text-xs leading-tight text-white shadow-soft ring-1 ring-surface-raised"
            style={{
              top: p.top * scale,
              height: Math.max(16, height - 1),
              left: `calc(${(p.lane / p.lanes) * 100}% + 2px)`,
              width: `calc(${100 / p.lanes}% - 4px)`,
              background: p.entry.color,
            }}
          >
            <span className="block truncate font-semibold">{p.entry.title}</span>
            {height > 30 ? (
              <span className="block truncate opacity-85">
                {TIME_FORMAT.format(p.entry.start)}
                {p.entry.location ? ` · ${p.entry.location}` : ''}
              </span>
            ) : null}
          </button>
        )
      })}
      {now ? (
        <div
          className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-danger"
          style={{ top: (now.getHours() * 60 + now.getMinutes()) * scale }}
        >
          <span className="absolute -top-1 -left-1 size-2.5 rounded-full bg-danger" />
        </div>
      ) : null}
    </div>
  )
}
