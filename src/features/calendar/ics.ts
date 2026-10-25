/**
 * Reading iCalendar (.ics) files, as WebUntis, Google Calendar, iCloud and others publish them,
 * and expanding repeating events into the occurrences of a date range.
 *
 * Times keep the zone they were written in: a lesson at 8:00 Europe/Berlin stays at 8:00 in
 * winter and summer, however far the series repeats.
 */

/** A date and wall-clock time as written, before it is placed in a time zone. */
export interface WallTime {
  y: number
  /** 1 to 12. */
  m: number
  d: number
  h: number
  mi: number
  s: number
}

/** 'local' is the device's zone (floating times and all-day dates). */
export type Zone = 'utc' | 'local' | string

export type Weekday = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU'

export interface Repeat {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
  interval: number
  count?: number
  /** The last moment an occurrence may start. */
  until?: Date
  /** Weekdays, with an optional position in the month ("2MO", "-1FR"). */
  byDay?: { day: Weekday; nth?: number }[]
}

export interface CalendarEvent {
  uid: string
  title: string
  location?: string
  description?: string
  allDay: boolean
  start: WallTime
  zone: Zone
  /** Length in milliseconds (for all-day events, whole days). */
  duration: number
  repeat?: Repeat
  /** Starts of occurrences that were removed from the series (as times). */
  except?: number[]
  /** Set on a changed single occurrence: the start it replaces. */
  recurrenceId?: number
}

/** One event on the calendar, at a concrete time. */
export interface Occurrence {
  /** Unique for the occurrence: event uid and start. */
  key: string
  uid: string
  title: string
  location?: string
  description?: string
  allDay: boolean
  start: Date
  end: Date
}

// ---------- Time zones ----------

const offsetFormats = new Map<string, Intl.DateTimeFormat>()

/** The offset of `zone` from UTC at `instant`, in minutes. */
function zoneOffset(zone: string, instant: number): number {
  let f = offsetFormats.get(zone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    })
    offsetFormats.set(zone, f)
  }
  const parts: Record<string, number> = {}
  for (const p of f.formatToParts(new Date(instant))) parts[p.type] = Number(p.value)
  const asUtc = Date.UTC(
    parts.year!,
    parts.month! - 1,
    parts.day!,
    parts.hour!,
    parts.minute!,
    parts.second!,
  )
  return (asUtc - instant) / 60000
}

/** The instant a wall time in `zone` stands for. */
export function toDate(t: WallTime, zone: Zone): Date {
  if (zone === 'local') return new Date(t.y, t.m - 1, t.d, t.h, t.mi, t.s)
  const utc = Date.UTC(t.y, t.m - 1, t.d, t.h, t.mi, t.s)
  if (zone === 'utc') return new Date(utc)
  try {
    // Twice: the offset at the guessed instant may differ near a clock change.
    let instant = utc - zoneOffset(zone, utc) * 60000
    instant = utc - zoneOffset(zone, instant) * 60000
    return new Date(instant)
  } catch {
    // An unknown zone name: read it as the device's own time.
    return new Date(t.y, t.m - 1, t.d, t.h, t.mi, t.s)
  }
}

/** Wall time `days` days later (calendar days, so clock changes do not shift it). */
function addDays(t: WallTime, days: number): WallTime {
  const d = new Date(Date.UTC(t.y, t.m - 1, t.d + days))
  return { ...t, y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }
}

function addMonths(t: WallTime, months: number): WallTime {
  const total = t.y * 12 + (t.m - 1) + months
  return { ...t, y: Math.floor(total / 12), m: (total % 12) + 1 }
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

const WEEKDAYS: Weekday[] = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

function weekday(t: WallTime): number {
  return new Date(Date.UTC(t.y, t.m - 1, t.d)).getUTCDay()
}

// ---------- Parsing ----------

interface Property {
  name: string
  params: Record<string, string>
  value: string
}

/** Lines of the file with folded continuation lines joined. */
function unfold(text: string): string[] {
  const lines: string[] = []
  for (const raw of text.split(/\r?\n/)) {
    if ((raw.startsWith(' ') || raw.startsWith('\t')) && lines.length) {
      lines[lines.length - 1] += raw.slice(1)
    } else if (raw.length) {
      lines.push(raw)
    }
  }
  return lines
}

function parseLine(line: string): Property | null {
  // The value starts after the first colon outside quotes.
  let quoted = false
  let colon = -1
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') quoted = !quoted
    else if (c === ':' && !quoted) {
      colon = i
      break
    }
  }
  if (colon < 0) return null
  const [name, ...rawParams] = line.slice(0, colon).split(';')
  const params: Record<string, string> = {}
  for (const p of rawParams) {
    const eq = p.indexOf('=')
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '')
  }
  return { name: name!.toUpperCase(), params, value: line.slice(colon + 1) }
}

function unescape(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\([,;\\])/g, '$1')
    .trim()
}

/** A DATE or DATE-TIME value with its zone. */
function parseTime(p: Property): { t: WallTime; zone: Zone; date: boolean } | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(p.value.trim())
  if (!m) return null
  const t: WallTime = {
    y: Number(m[1]),
    m: Number(m[2]),
    d: Number(m[3]),
    h: Number(m[4] ?? 0),
    mi: Number(m[5] ?? 0),
    s: Number(m[6] ?? 0),
  }
  const date = p.params.VALUE === 'DATE' || m[4] === undefined
  const zone: Zone = date ? 'local' : m[7] ? 'utc' : (p.params.TZID ?? 'local')
  return { t, zone, date }
}

function parseDuration(value: string): number {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(
    value.trim(),
  )
  if (!m) return 0
  const sign = m[1] === '-' ? -1 : 1
  const [w, d, h, mi, s] = [m[2], m[3], m[4], m[5], m[6]].map((v) => Number(v ?? 0))
  return sign * ((((w! * 7 + d!) * 24 + h!) * 60 + mi!) * 60 + s!) * 1000
}

function parseRepeat(value: string, zone: Zone): Repeat | undefined {
  const parts: Record<string, string> = {}
  for (const kv of value.split(';')) {
    const [k, v] = kv.split('=')
    if (k && v) parts[k.toUpperCase()] = v
  }
  const freq = parts.FREQ as Repeat['freq'] | undefined
  if (!freq || !['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(freq)) return undefined
  const repeat: Repeat = { freq, interval: Math.max(1, Number(parts.INTERVAL ?? 1)) }
  if (parts.COUNT) repeat.count = Number(parts.COUNT)
  if (parts.UNTIL) {
    const u = parseTime({ name: 'UNTIL', params: {}, value: parts.UNTIL })
    if (u) {
      // A date-only UNTIL includes that whole day.
      repeat.until = u.date
        ? new Date(u.t.y, u.t.m - 1, u.t.d, 23, 59, 59)
        : toDate(u.t, u.zone === 'local' ? zone : u.zone)
    }
  }
  if (parts.BYDAY) {
    repeat.byDay = parts.BYDAY.split(',').flatMap((s) => {
      const m = /^([+-]?\d+)?(MO|TU|WE|TH|FR|SA|SU)$/.exec(s.trim())
      return m ? [{ day: m[2] as Weekday, ...(m[1] ? { nth: Number(m[1]) } : {}) }] : []
    })
  }
  return repeat
}

/** All events of an .ics file. Unreadable entries are skipped. */
export function parseIcs(text: string): CalendarEvent[] {
  const events: CalendarEvent[] = []
  let current: Property[] | null = null
  let depth = 0
  for (const line of unfold(text)) {
    const p = parseLine(line)
    if (!p) continue
    if (p.name === 'BEGIN') {
      if (p.value.toUpperCase() === 'VEVENT' && current === null) {
        current = []
        depth = 0
      } else if (current) depth++
      continue
    }
    if (p.name === 'END') {
      if (current && depth > 0) depth--
      else if (current && p.value.toUpperCase() === 'VEVENT') {
        const event = toEvent(current)
        if (event) events.push(event)
        current = null
      }
      continue
    }
    // Properties of alarms and other nested parts are not the event's.
    if (current && depth === 0) current.push(p)
  }
  return events
}

function toEvent(props: Property[]): CalendarEvent | null {
  const get = (name: string) => props.find((p) => p.name === name)
  if (get('STATUS')?.value.toUpperCase() === 'CANCELLED') return null
  const startProp = get('DTSTART')
  const start = startProp && parseTime(startProp)
  if (!start) return null
  const endProp = get('DTEND')
  const end = endProp && parseTime(endProp)
  let duration: number
  if (end) {
    duration =
      toDate(end.t, end.date ? 'local' : end.zone).getTime() - toDate(start.t, start.zone).getTime()
  } else if (get('DURATION')) {
    duration = parseDuration(get('DURATION')!.value)
  } else {
    duration = start.date ? 86400000 : 0
  }
  const event: CalendarEvent = {
    uid:
      get('UID')?.value ?? `${start.t.y}-${start.t.m}-${start.t.d}-${get('SUMMARY')?.value ?? ''}`,
    title: unescape(get('SUMMARY')?.value ?? '') || 'Untitled',
    allDay: start.date,
    start: start.t,
    zone: start.zone,
    duration: Math.max(0, duration),
  }
  const location = get('LOCATION')?.value
  if (location) event.location = unescape(location)
  const description = get('DESCRIPTION')?.value
  if (description) event.description = unescape(description)
  const rule = get('RRULE')
  if (rule) {
    const repeat = parseRepeat(rule.value, start.zone)
    if (repeat) event.repeat = repeat
  }
  const except = props
    .filter((p) => p.name === 'EXDATE')
    .flatMap((p) =>
      p.value.split(',').flatMap((v) => {
        const t = parseTime({ ...p, value: v })
        return t ? [toDate(t.t, t.date ? 'local' : t.zone).getTime()] : []
      }),
    )
  if (except.length) event.except = except
  const rid = get('RECURRENCE-ID')
  const recurrence = rid && parseTime(rid)
  if (recurrence) {
    event.recurrenceId = toDate(recurrence.t, recurrence.date ? 'local' : recurrence.zone).getTime()
  }
  return event
}

// ---------- Occurrences ----------

const MAX_STEPS = 20000

/** Starts of a series, in wall time, in order, until `to` (or the series ends). */
function* starts(event: CalendarEvent, to: number): Generator<WallTime> {
  const r = event.repeat
  if (!r) {
    yield event.start
    return
  }
  let produced = 0
  const done = (t: WallTime) => {
    const at = toDate(t, event.zone).getTime()
    return at > to || (r.until !== undefined && at > r.until.getTime())
  }
  const emit = function* (t: WallTime): Generator<WallTime, boolean> {
    if (done(t)) return true
    if (r.count !== undefined && produced >= r.count) return true
    produced++
    yield t
    return false
  }
  const s = event.start
  for (let step = 0; step < MAX_STEPS; step++) {
    if (r.freq === 'DAILY') {
      if (yield* emit(addDays(s, step * r.interval))) return
    } else if (r.freq === 'WEEKLY') {
      const days = r.byDay?.length ? r.byDay.map((b) => WEEKDAYS.indexOf(b.day)) : [weekday(s)]
      // The week of the start, Monday first, as most calendars write it.
      const monday = addDays(s, -((weekday(s) + 6) % 7))
      const week = addDays(monday, step * 7 * r.interval)
      const inWeek = days.map((d) => addDays(week, (d + 6) % 7)).sort(compareWall)
      for (const t of inWeek) {
        if (compareWall(t, s) < 0) continue
        if (yield* emit(t)) return
      }
    } else if (r.freq === 'MONTHLY') {
      const month = addMonths({ ...s, d: 1 }, step * r.interval)
      const list = r.byDay?.length ? monthDays(month, r.byDay) : [{ ...month, d: s.d }]
      for (const t of list) {
        if (t.d > daysInMonth(t.y, t.m) || compareWall(t, s) < 0) continue
        if (yield* emit(t)) return
      }
    } else {
      const t = { ...s, y: s.y + step * r.interval }
      if (t.d > daysInMonth(t.y, t.m)) continue
      if (yield* emit(t)) return
    }
  }
}

/** The days of a month matching weekday rules like "2MO" or "-1FR" (or every Monday). */
function monthDays(month: WallTime, rules: { day: Weekday; nth?: number }[]): WallTime[] {
  const out: WallTime[] = []
  const n = daysInMonth(month.y, month.m)
  for (const rule of rules) {
    const want = WEEKDAYS.indexOf(rule.day)
    const matches: WallTime[] = []
    for (let d = 1; d <= n; d++) {
      const t = { ...month, d }
      if (weekday(t) === want) matches.push(t)
    }
    if (rule.nth === undefined) out.push(...matches)
    else {
      const t = rule.nth > 0 ? matches[rule.nth - 1] : matches[matches.length + rule.nth]
      if (t) out.push(t)
    }
  }
  return out.sort(compareWall)
}

function compareWall(a: WallTime, b: WallTime): number {
  return a.y - b.y || a.m - b.m || a.d - b.d || a.h - b.h || a.mi - b.mi || a.s - b.s
}

/** Every occurrence that overlaps the range from `from` to `to`, sorted by start. */
export function occurrences(events: readonly CalendarEvent[], from: Date, to: Date): Occurrence[] {
  const lo = from.getTime()
  const hi = to.getTime()
  // Changed single occurrences replace the ones the series would have had.
  const replaced = new Set<string>()
  for (const e of events)
    if (e.recurrenceId !== undefined) replaced.add(`${e.uid}@${e.recurrenceId}`)
  const out: Occurrence[] = []
  for (const e of events) {
    for (const t of starts(e, hi)) {
      const start = toDate(t, e.zone)
      const at = start.getTime()
      if (e.recurrenceId === undefined) {
        if (e.except?.includes(at) || replaced.has(`${e.uid}@${at}`)) continue
      }
      const end = e.allDay
        ? toDate(addDays(t, Math.round(e.duration / 86400000) || 1), 'local')
        : new Date(at + e.duration)
      if (end.getTime() <= lo && !(at >= lo && e.duration === 0)) continue
      if (at >= hi) continue
      out.push({
        key: `${e.uid}@${at}`,
        uid: e.uid,
        title: e.title,
        allDay: e.allDay,
        start,
        end,
        ...(e.location ? { location: e.location } : {}),
        ...(e.description ? { description: e.description } : {}),
      })
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime())
}

/** Wall time of a Date in the device's zone. */
export function wallOf(date: Date): WallTime {
  return {
    y: date.getFullYear(),
    m: date.getMonth() + 1,
    d: date.getDate(),
    h: date.getHours(),
    mi: date.getMinutes(),
    s: date.getSeconds(),
  }
}
