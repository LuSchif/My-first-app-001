import { CalendarPlus, FileUp, LoaderCircle, RefreshCw, Trash2, TriangleAlert } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button, ColorSwatch, DialogContent, Switch, TextField } from '../../design/index.ts'
import { formatEdited } from '../../lib/time.ts'
import {
  addSource,
  calendarProxy,
  importCalendarFile,
  refreshSource,
  removeSource,
  setCalendarProxy,
  updateSource,
} from './calendarStore.ts'
import { EVENT_COLORS, type CalendarSource } from './model.ts'

/**
 * Adding a calendar by link (WebUntis, Google, iCloud, Outlook…) or from an .ics file. Used on
 * the home screen before any calendar is set up, and in the calendar settings.
 */
export function AddCalendar({ onAdded }: { onAdded?: (source: CalendarSource) => void }) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const file = useRef<HTMLInputElement>(null)

  const add = async () => {
    if (!url.trim() || busy) return
    setBusy(true)
    setMessage(null)
    try {
      const source = await addSource(url, '')
      setUrl('')
      if (source.error) setMessage(source.error)
      onAdded?.(source)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-2">
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void add()
        }}
      >
        <div className="min-w-0 flex-1">
          <TextField
            label="Calendar link"
            placeholder="Paste an iCal link (WebUntis, Google, iCloud …)"
            value={url}
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        <Button
          variant="primary"
          type="submit"
          disabled={!url.trim() || busy}
          icon={
            busy ? <LoaderCircle size={16} className="animate-spin" /> : <CalendarPlus size={16} />
          }
        >
          Add
        </Button>
      </form>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" icon={<FileUp size={16} />} onClick={() => file.current?.click()}>
          Import .ics file
        </Button>
        <input
          ref={file}
          type="file"
          accept=".ics,text/calendar"
          className="hidden"
          onChange={async (e) => {
            const input = e.target
            const f = input.files?.[0]
            if (!f) return
            try {
              const source = await importCalendarFile(f)
              onAdded?.(source)
            } catch (err) {
              setMessage(err instanceof Error ? err.message : 'The file could not be read.')
            } finally {
              // Cleared only once read: choosing the same file again then works too.
              input.value = ''
            }
          }}
        />
      </div>
      {message ? (
        <p className="flex gap-2 text-sm text-danger">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" /> {message}
        </p>
      ) : null}
    </div>
  )
}

/** The subscribed calendars: show or hide, color, update, remove; and adding more. */
export function CalendarSources({
  sources,
  onDone,
}: {
  sources: CalendarSource[]
  onDone: () => void
}) {
  const [proxy, setProxy] = useState(calendarProxy)
  const [busy, setBusy] = useState<string | null>(null)
  return (
    <DialogContent title="Calendars" className="w-[min(36rem,calc(100%-2rem))]">
      <div className="grid max-h-[70dvh] gap-5 overflow-y-auto pr-1">
        <section className="grid gap-2">
          {sources.length ? null : (
            <p className="text-sm text-ink-muted">
              No calendar added yet. Your Broomit calendar works without one.
            </p>
          )}
          {sources.map((s) => (
            <div key={s.id} className="grid gap-2 rounded-card p-3 ring-1 ring-line">
              <div className="flex items-center gap-2">
                <span className="size-3 shrink-0 rounded-full" style={{ background: s.color }} />
                <input
                  aria-label="Calendar name"
                  value={s.name}
                  onChange={(e) => void updateSource(s.id, { name: e.target.value })}
                  className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
                />
                {s.url ? (
                  <button
                    type="button"
                    aria-label="Update now"
                    onClick={async () => {
                      setBusy(s.id)
                      await refreshSource(s.id)
                      setBusy(null)
                    }}
                    className="grid size-9 place-items-center rounded-control hover:bg-hover"
                  >
                    <RefreshCw size={16} className={busy === s.id ? 'animate-spin' : ''} />
                  </button>
                ) : null}
                <button
                  type="button"
                  aria-label={`Remove ${s.name}`}
                  onClick={() => void removeSource(s.id)}
                  className="grid size-9 place-items-center rounded-control text-danger hover:bg-hover"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <p className="text-xs text-ink-muted">
                {s.url ? 'Updates by itself' : 'Imported from a file'}
                {s.fetchedAt ? ` · loaded ${formatEdited(s.fetchedAt)}` : ' · not loaded yet'}
              </p>
              {s.error ? (
                <p className="flex gap-2 text-xs text-danger">
                  <TriangleAlert size={14} className="mt-0.5 shrink-0" /> {s.error}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div role="group" aria-label="Color" className="-m-1 flex flex-wrap">
                  {EVENT_COLORS.map(([name, c]) => (
                    <ColorSwatch
                      key={c}
                      size="sm"
                      label={name}
                      fill={{ type: 'solid', color: c }}
                      selected={s.color === c}
                      onSelect={() => void updateSource(s.id, { color: c })}
                    />
                  ))}
                </div>
                <div className="w-28">
                  <Switch
                    label="Show"
                    checked={s.enabled}
                    onChange={(on) => void updateSource(s.id, { enabled: on })}
                  />
                </div>
              </div>
            </div>
          ))}
        </section>
        <section className="grid gap-2">
          <h3 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
            Add a calendar
          </h3>
          <AddCalendar />
          <p className="text-xs text-ink-muted">
            In WebUntis, open your timetable and choose the share or subscribe button to copy its
            link. In Google Calendar, use “Secret address in iCal format” in the calendar’s
            settings.
          </p>
        </section>
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold">Advanced: relay</summary>
          <div className="mt-2 grid gap-2">
            <p className="text-xs text-ink-muted">
              Some calendar sites do not let a web page read them. A relay you run yourself (for
              example a small Cloudflare Worker) can load them instead. Put {'{url}'} where the
              calendar link goes, or the link is added at the end.
            </p>
            <TextField
              label="Relay address"
              placeholder="https://my-relay.example.workers.dev/?url={url}"
              value={proxy}
              autoCapitalize="off"
              spellCheck={false}
              onChange={(e) => {
                setProxy(e.target.value)
                setCalendarProxy(e.target.value)
              }}
            />
          </div>
        </details>
        <div className="flex justify-end">
          <Button variant="primary" onClick={onDone}>
            Done
          </Button>
        </div>
      </div>
    </DialogContent>
  )
}
