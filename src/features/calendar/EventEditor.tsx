import { Bell, MapPin, Repeat, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button, ColorSwatch, DialogContent, Switch, TextField } from '../../design/index.ts'
import { deleteEvent, saveEvent, type Entry } from './calendarStore.ts'
import { timeRange } from './layout.ts'
import {
  addDays,
  dayKey,
  EVENT_COLORS,
  startOfDay,
  type OwnEvent,
  type RepeatKind,
} from './model.ts'
import { allowNotifications } from './reminders.ts'

const REMINDERS: [string, number | undefined][] = [
  ['None', undefined],
  ['At start', 0],
  ['5 min before', 5],
  ['15 min before', 15],
  ['30 min before', 30],
  ['1 hour before', 60],
  ['1 day before', 1440],
]

const REPEATS: [string, RepeatKind | undefined][] = [
  ['Never', undefined],
  ['Every day', 'daily'],
  ['Every week', 'weekly'],
  ['Every month', 'monthly'],
  ['Every year', 'yearly'],
]

const DATE_LABEL = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const pad = (n: number) => String(n).padStart(2, '0')
const timeValue = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

function combine(date: string, time: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  return new Date(y!, m! - 1, d!, h ?? 0, mi ?? 0)
}

/** Making or changing a Broomit event: title, time, color, repeat, reminder and a note. */
export function EventEditor({
  event,
  onDone,
}: {
  /** The event to change, or a new one's defaults. */
  event: OwnEvent
  onDone: () => void
}) {
  const isNew = !event.title
  const [title, setTitle] = useState(event.title)
  const [allDay, setAllDay] = useState(event.allDay)
  const [date, setDate] = useState(dayKey(new Date(event.start)))
  const [start, setStart] = useState(timeValue(new Date(event.start)))
  const [end, setEnd] = useState(timeValue(new Date(event.end)))
  const [endDate, setEndDate] = useState(dayKey(new Date(event.allDay ? event.end - 1 : event.end)))
  const [color, setColor] = useState(event.color)
  const [location, setLocation] = useState(event.location ?? '')
  const [note, setNote] = useState(event.note ?? '')
  const [reminder, setReminder] = useState(event.reminder)
  const [repeat, setRepeat] = useState(event.repeat)

  const save = async () => {
    let from = allDay ? combine(date, '00:00') : combine(date, start)
    let to = allDay
      ? addDays(combine(endDate < date ? date : endDate, '00:00'), 1)
      : combine(date, end)
    if (!allDay && to <= from) to = new Date(from.getTime() + 60 * 60000)
    if (allDay) from = startOfDay(from)
    const next: OwnEvent = {
      id: event.id,
      title: title.trim() || 'New event',
      start: from.getTime(),
      end: to.getTime(),
      allDay,
      color,
      ...(location.trim() ? { location: location.trim() } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(reminder !== undefined ? { reminder } : {}),
      ...(repeat ? { repeat } : {}),
    }
    if (reminder !== undefined) void allowNotifications()
    await saveEvent(next)
    onDone()
  }

  const select =
    'h-11 w-full rounded-control bg-surface-raised px-3 text-base ring-1 ring-line ring-inset'
  return (
    <DialogContent
      title={isNew ? 'New event' : 'Edit event'}
      className="w-[min(30rem,calc(100%-2rem))]"
    >
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <TextField
          label="Title"
          value={title}
          placeholder="e.g. Math test"
          onChange={(e) => setTitle(e.target.value)}
        />
        <Switch label="All day" checked={allDay} onChange={setAllDay} />
        <div className="grid grid-cols-[1fr_auto_auto] items-end gap-2">
          <label className="grid gap-1.5 text-sm font-medium">
            {allDay ? 'From' : 'Date'}
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={select}
            />
          </label>
          {allDay ? (
            <label className="col-span-2 grid gap-1.5 text-sm font-medium">
              To
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={select}
              />
            </label>
          ) : (
            <>
              <label className="grid gap-1.5 text-sm font-medium">
                Start
                <input
                  type="time"
                  required
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className={select}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                End
                <input
                  type="time"
                  required
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className={select}
                />
              </label>
            </>
          )}
        </div>
        <div role="group" aria-label="Color" className="-m-1 flex flex-wrap">
          {EVENT_COLORS.map(([name, c]) => (
            <ColorSwatch
              key={c}
              label={name}
              fill={{ type: 'solid', color: c }}
              selected={color === c}
              onSelect={() => setColor(c)}
            />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1.5 text-sm font-medium">
            <span className="flex items-center gap-1.5">
              <Repeat size={14} /> Repeat
            </span>
            <select
              value={repeat ?? ''}
              onChange={(e) => setRepeat((e.target.value || undefined) as RepeatKind | undefined)}
              className={select}
            >
              {REPEATS.map(([label, v]) => (
                <option key={label} value={v ?? ''}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            <span className="flex items-center gap-1.5">
              <Bell size={14} /> Reminder
            </span>
            <select
              value={reminder ?? ''}
              onChange={(e) =>
                setReminder(e.target.value === '' ? undefined : Number(e.target.value))
              }
              className={select}
            >
              {REMINDERS.map(([label, v]) => (
                <option key={label} value={v ?? ''}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <TextField
          label="Place"
          value={location}
          placeholder="Optional"
          onChange={(e) => setLocation(e.target.value)}
        />
        <TextField
          label="Note"
          value={note}
          placeholder="Optional"
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex justify-between gap-2">
          {isNew ? (
            <span />
          ) : (
            <Button
              variant="ghost"
              icon={<Trash2 size={16} />}
              onClick={async () => {
                await deleteEvent(event.id)
                onDone()
              }}
            >
              Delete
            </Button>
          )}
          <div className="flex gap-2">
            <Button onClick={onDone}>Cancel</Button>
            <Button variant="primary" type="submit">
              Save
            </Button>
          </div>
        </div>
      </form>
    </DialogContent>
  )
}

/** A subscribed calendar's entry: shown, not changed (it belongs to its calendar). */
export function EntryDetails({ entry, onDone }: { entry: Entry; onDone: () => void }) {
  return (
    <DialogContent title={entry.title} className="w-[min(28rem,calc(100%-2rem))]">
      <div className="grid gap-3">
        <p className="flex items-center gap-2 text-sm">
          <span className="size-3 shrink-0 rounded-full" style={{ background: entry.color }} />
          {DATE_LABEL.format(entry.start)} · {timeRange(entry)}
        </p>
        {entry.location ? (
          <p className="flex items-center gap-2 text-sm text-ink-muted">
            <MapPin size={14} /> {entry.location}
          </p>
        ) : null}
        {entry.description ? (
          <p className="text-sm whitespace-pre-line text-ink-muted">{entry.description}</p>
        ) : null}
        {entry.source ? <p className="text-xs text-ink-subtle">From {entry.source}</p> : null}
        <div className="flex justify-end">
          <Button variant="primary" onClick={onDone}>
            Done
          </Button>
        </div>
      </div>
    </DialogContent>
  )
}
