import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Plus,
  Settings2,
  TriangleAlert,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button, Dialog, DialogContent } from '../../design/index.ts'
import { cn } from '../../lib/cn.ts'
import { entriesIn, type CalendarData, type Entry } from './calendarStore.ts'
import { AddCalendar, CalendarSources } from './CalendarSources.tsx'
import { DayDialog } from './DayDialog.tsx'
import { EntryDetails, EventEditor } from './EventEditor.tsx'
import { MonthGrid } from './MonthGrid.tsx'
import {
  addDays,
  dayKey,
  EVENT_COLORS,
  monthGridStart,
  startOfDay,
  type OwnEvent,
} from './model.ts'
import { useNow } from './useNow.ts'
import { TimeGrid } from './TimeGrid.tsx'
import { useCalendar } from './useCalendar.ts'

type View = 'day' | '3day' | 'week' | 'month'
type Sheet =
  | { kind: 'event'; event: OwnEvent }
  | { kind: 'entry'; entry: Entry }
  | { kind: 'day'; day: Date }
  | { kind: 'sources' }
  | null

const SETUP_KEY = 'broomit.calendarSetUp'
const TODAY_LABEL = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})
const MONTH_LABEL = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' })
const SHORT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })

function readSetUp(): boolean {
  try {
    return localStorage.getItem(SETUP_KEY) === '1'
  } catch {
    return false
  }
}

/** A new Broomit event at `at` (or the next full hour today), one hour long. */
function draftEvent(at?: Date): OwnEvent {
  const start = at ? new Date(at) : new Date()
  if (!at) start.setHours(start.getHours() + 1, 0, 0, 0)
  return {
    id: crypto.randomUUID(),
    title: '',
    start: start.getTime(),
    end: start.getTime() + 3600000,
    allDay: false,
    color: EVENT_COLORS[0][1],
  }
}

/**
 * The calendar on the home screen: yesterday, today and tomorrow at a glance, scrollable
 * through the day and to other days. A tap opens the whole calendar.
 */
export function CalendarHome() {
  const data = useCalendar()
  const [setUp, setSetUp] = useState(readSetUp)
  const [open, setOpen] = useState(false)
  const [sheet, setSheet] = useState<Sheet>(null)
  const configured =
    setUp || data.sources.length > 0 || data.events.length > 0 || data.days.length > 0

  const markSetUp = () => {
    setSetUp(true)
    try {
      localStorage.setItem(SETUP_KEY, '1')
    } catch {
      // Shown again next time; nothing is lost.
    }
  }

  const openEntry = (entry: Entry) => {
    const own = entry.ownId && data.events.find((e) => e.id === entry.ownId)
    setSheet(own ? { kind: 'event', event: own } : { kind: 'entry', entry })
  }

  if (!data.loaded) return <div className="h-72 rounded-panel bg-surface-raised shadow-soft" />

  return (
    <>
      <section
        aria-label="Calendar"
        className="overflow-hidden rounded-panel bg-surface-raised shadow-soft ring-1 ring-line"
      >
        {configured ? (
          <Widget
            data={data}
            onOpen={() => setOpen(true)}
            onEntry={openEntry}
            onDay={(day) => setSheet({ kind: 'day', day })}
            onSources={() => setSheet({ kind: 'sources' })}
          />
        ) : (
          <Setup onOwn={markSetUp} />
        )}
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        {open ? (
          <FullCalendar
            data={data}
            onEntry={openEntry}
            onDay={(day) => setSheet({ kind: 'day', day })}
            onNew={(at) => setSheet({ kind: 'event', event: draftEvent(at) })}
            onSources={() => setSheet({ kind: 'sources' })}
          />
        ) : null}
      </Dialog>

      <Dialog open={sheet !== null} onOpenChange={(o) => !o && setSheet(null)}>
        {sheet?.kind === 'event' ? (
          <EventEditor key={sheet.event.id} event={sheet.event} onDone={() => setSheet(null)} />
        ) : sheet?.kind === 'entry' ? (
          <EntryDetails entry={sheet.entry} onDone={() => setSheet(null)} />
        ) : sheet?.kind === 'day' ? (
          <DayDialog
            key={dayKey(sheet.day)}
            day={sheet.day}
            mark={data.days.find((m) => m.date === dayKey(sheet.day))}
            entries={entriesIn(data, startOfDay(sheet.day), addDays(sheet.day, 1))}
            onEntryTap={openEntry}
            onNewEvent={() => {
              const at = startOfDay(sheet.day)
              at.setHours(9)
              setSheet({ kind: 'event', event: draftEvent(at) })
            }}
            onDone={() => setSheet(null)}
          />
        ) : sheet?.kind === 'sources' ? (
          <CalendarSources sources={data.sources} onDone={() => setSheet(null)} />
        ) : null}
      </Dialog>
    </>
  )
}

function Setup({ onOwn }: { onOwn: () => void }) {
  return (
    <div className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:items-center sm:gap-8">
      <div className="grid gap-2">
        <p className="flex items-center gap-2 text-lg font-bold">
          <CalendarDays size={20} /> Your calendar
        </p>
        <p className="text-sm text-ink-muted">
          See today, yesterday and tomorrow right here. Add your timetable or calendar by its link,
          or simply use the Broomit calendar for events, reminders and important days.
        </p>
        <Button variant="primary" className="justify-self-start" onClick={onOwn}>
          Use the Broomit calendar
        </Button>
      </div>
      <AddCalendar />
    </div>
  )
}

function Widget({
  data,
  onOpen,
  onEntry,
  onDay,
  onSources,
}: {
  data: CalendarData
  onOpen: () => void
  onEntry: (entry: Entry) => void
  onDay: (day: Date) => void
  onSources: () => void
}) {
  const now = useNow()
  const todayKey = dayKey(now)
  const today = useMemo(() => new Date(`${todayKey}T00:00`), [todayKey])
  const days = useMemo(() => Array.from({ length: 29 }, (_, i) => addDays(today, i - 7)), [today])
  const entries = useMemo(
    () => entriesIn(data, days[0]!, addDays(days[days.length - 1]!, 1)),
    [data, days],
  )
  const failing = data.sources.filter((s) => s.enabled && s.error)
  const header = (e: React.MouseEvent) => e.stopPropagation()
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Open the calendar"
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      className="grid cursor-pointer"
    >
      <div className="flex items-center gap-2 border-b border-line px-4 py-2" onClick={header}>
        <CalendarDays size={18} className="shrink-0 text-ink-muted" />
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">
          Today · {TODAY_LABEL.format(today)}
        </p>
        {failing.length ? (
          <button
            type="button"
            onClick={onSources}
            className="flex items-center gap-1 rounded-control px-2 py-1 text-xs font-semibold text-danger hover:bg-hover"
          >
            <TriangleAlert size={14} /> Not updated
          </button>
        ) : null}
        <button
          type="button"
          aria-label="Calendars"
          onClick={onSources}
          className="grid size-9 place-items-center rounded-control text-ink-muted hover:bg-hover"
        >
          <Settings2 size={18} />
        </button>
        <button
          type="button"
          aria-label="Open the calendar"
          onClick={onOpen}
          className="grid size-9 place-items-center rounded-control text-ink-muted hover:bg-hover"
        >
          <Maximize2 size={18} />
        </button>
      </div>
      <TimeGrid
        days={days}
        visibleDays={3}
        firstVisible={addDays(today, -1)}
        entries={entries}
        marks={data.days}
        hourHeight={40}
        onEntryTap={onEntry}
        onDayTap={onDay}
        className="h-64"
      />
    </div>
  )
}

const VIEWS: [View, string][] = [
  ['day', 'Day'],
  ['3day', '3 days'],
  ['week', 'Week'],
  ['month', 'Month'],
]

function FullCalendar({
  data,
  onEntry,
  onDay,
  onNew,
  onSources,
}: {
  data: CalendarData
  onEntry: (entry: Entry) => void
  onDay: (day: Date) => void
  onNew: (at?: Date) => void
  onSources: () => void
}) {
  const [view, setView] = useState<View>('3day')
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()))

  const days = useMemo(() => {
    if (view === 'day') return [anchor]
    if (view === '3day') return [addDays(anchor, -1), anchor, addDays(anchor, 1)]
    const monday = addDays(anchor, -((anchor.getDay() + 6) % 7))
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  }, [view, anchor])
  const entries = useMemo(() => {
    const from = view === 'month' ? monthGridStart(anchor) : days[0]!
    const to = view === 'month' ? addDays(from, 42) : addDays(days[days.length - 1]!, 1)
    return entriesIn(data, from, to)
  }, [data, view, anchor, days])

  const step = (dir: number) => {
    if (view === 'month') setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1))
    else setAnchor(addDays(anchor, dir * (view === 'day' ? 1 : view === '3day' ? 3 : 7)))
  }
  const label =
    view === 'month'
      ? MONTH_LABEL.format(anchor)
      : view === 'day'
        ? TODAY_LABEL.format(anchor)
        : `${SHORT.format(days[0]!)} – ${SHORT.format(days[days.length - 1]!)}`

  return (
    <DialogContent
      title="Calendar"
      className="flex h-[min(56rem,calc(100dvh-2rem))] w-[min(76rem,calc(100%-2rem))] flex-col"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setAnchor(startOfDay(new Date()))}>Today</Button>
          <div className="flex">
            <button
              type="button"
              aria-label="Back"
              onClick={() => step(-1)}
              className="grid size-11 place-items-center rounded-control hover:bg-hover"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              aria-label="Forward"
              onClick={() => step(1)}
              className="grid size-11 place-items-center rounded-control hover:bg-hover"
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <p className="min-w-0 flex-1 truncate font-semibold">{label}</p>
          <div
            role="group"
            aria-label="View"
            className="flex rounded-control bg-surface-sunken p-1"
          >
            {VIEWS.map(([v, name]) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={cn(
                  'h-9 rounded-[calc(var(--radius-control)-4px)] px-3 text-sm font-semibold text-ink-muted',
                  'aria-pressed:bg-surface-raised aria-pressed:text-ink aria-pressed:shadow-soft',
                )}
              >
                {name}
              </button>
            ))}
          </div>
          <Button icon={<Settings2 size={16} />} onClick={onSources}>
            Calendars
          </Button>
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => onNew()}>
            New event
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden rounded-card ring-1 ring-line">
          {view === 'month' ? (
            <MonthGrid
              month={anchor}
              entries={entries}
              marks={data.days}
              onDayTap={onDay}
              onEntryTap={onEntry}
            />
          ) : (
            <TimeGrid
              key={view}
              days={days}
              visibleDays={days.length}
              firstVisible={days[0]}
              entries={entries}
              marks={data.days}
              hourHeight={56}
              onEntryTap={onEntry}
              onDayTap={onDay}
              onSlotTap={onNew}
              className="h-full"
            />
          )}
        </div>
      </div>
    </DialogContent>
  )
}
