import { Plus, Star } from 'lucide-react'
import { useState } from 'react'
import { Button, ColorSwatch, DialogContent, Switch, TextField } from '../../design/index.ts'
import { setDayMark, type Entry } from './calendarStore.ts'
import { timeRange } from './layout.ts'
import { dayKey, EVENT_COLORS, type DayMark } from './model.ts'

const TITLE = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

/** One day: mark it as important (with a color and a word), see its entries, add one. */
export function DayDialog({
  day,
  mark,
  entries,
  onEntryTap,
  onNewEvent,
  onDone,
}: {
  day: Date
  mark: DayMark | undefined
  entries: Entry[]
  onEntryTap: (entry: Entry) => void
  onNewEvent: () => void
  onDone: () => void
}) {
  const [marked, setMarked] = useState(Boolean(mark))
  const [label, setLabel] = useState(mark?.label ?? '')
  const [color, setColor] = useState(mark?.color ?? EVENT_COLORS[1][1])
  const save = async () => {
    const date = dayKey(day)
    await setDayMark(marked ? { date, color, label: label.trim() } : null, date)
    onDone()
  }
  return (
    <DialogContent title={TITLE.format(day)} className="w-[min(28rem,calc(100%-2rem))]">
      <div className="grid gap-4">
        <div className="grid gap-1">
          {entries.length ? (
            entries.map((e) => (
              <button
                key={e.key}
                type="button"
                onClick={() => onEntryTap(e)}
                className="flex items-center gap-2 rounded-control px-2 py-1.5 text-left hover:bg-hover"
              >
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: e.color }} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{e.title}</span>
                <span className="text-xs text-ink-muted tabular-nums">{timeRange(e)}</span>
              </button>
            ))
          ) : (
            <p className="px-2 text-sm text-ink-muted">Nothing planned.</p>
          )}
          <Button
            variant="ghost"
            icon={<Plus size={16} />}
            className="justify-start"
            onClick={onNewEvent}
          >
            New event on this day
          </Button>
        </div>
        <div className="grid gap-3 border-t border-line pt-3">
          <Switch
            label="Important day"
            hint="Highlighted in the calendar and on the home screen"
            checked={marked}
            onChange={setMarked}
          />
          {marked ? (
            <>
              <TextField
                label="Label"
                placeholder="e.g. Exam, Birthday"
                value={label}
                maxLength={30}
                onChange={(e) => setLabel(e.target.value)}
              />
              <div role="group" aria-label="Highlight color" className="-m-1 flex flex-wrap">
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
            </>
          ) : null}
        </div>
        <div className="flex justify-end gap-2">
          <Button onClick={onDone}>Cancel</Button>
          <Button variant="primary" icon={<Star size={16} />} onClick={() => void save()}>
            Save
          </Button>
        </div>
      </div>
    </DialogContent>
  )
}
