import { db } from '../../storage/db.ts'
import { occurrences, parseIcs, wallOf, type CalendarEvent, type Repeat } from './ics.ts'
import {
  EVENT_COLORS,
  type CalendarSource,
  type DayMark,
  type OwnEvent,
  type RepeatKind,
} from './model.ts'

/**
 * The calendar's data for the whole app: Broomit's own events and marked days, and the
 * subscribed calendars. Components read a snapshot and are told when it changes.
 */

export interface CalendarData {
  events: OwnEvent[]
  days: DayMark[]
  sources: CalendarSource[]
  loaded: boolean
}

/** One entry on the calendar, from Broomit's own events or a subscribed calendar. */
export interface Entry {
  key: string
  title: string
  start: Date
  end: Date
  allDay: boolean
  color: string
  location?: string
  description?: string
  /** The Broomit event it comes from; absent for subscribed calendars (read only). */
  ownId?: string
  source?: string
}

let data: CalendarData = { events: [], days: [], sources: [], loaded: false }
const listeners = new Set<() => void>()

function set(next: Partial<CalendarData>): void {
  data = { ...data, ...next }
  for (const fn of listeners) fn()
}

export function subscribeCalendar(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function calendarSnapshot(): CalendarData {
  return data
}

let loading: Promise<void> | null = null

/** Loads the calendar once, then brings subscribed calendars up to date. */
export function loadCalendar(): Promise<void> {
  loading ??= (async () => {
    try {
      const [events, days, sources] = await Promise.all([
        db.calendarEvents.toArray(),
        db.calendarDays.toArray(),
        db.calendarSources.toArray(),
      ])
      set({ events, days, sources, loaded: true })
    } catch (err) {
      console.error(err)
      set({ loaded: true })
    }
    void refreshAll()
  })()
  return loading
}

// ---------- Broomit's own events and marked days ----------

export async function saveEvent(event: OwnEvent): Promise<void> {
  await db.calendarEvents.put(event)
  set({ events: [...data.events.filter((e) => e.id !== event.id), event] })
}

export async function deleteEvent(id: string): Promise<void> {
  await db.calendarEvents.delete(id)
  set({ events: data.events.filter((e) => e.id !== id) })
}

export async function setDayMark(mark: DayMark | null, date: string): Promise<void> {
  if (mark) await db.calendarDays.put(mark)
  else await db.calendarDays.delete(date)
  set({ days: [...data.days.filter((d) => d.date !== date), ...(mark ? [mark] : [])] })
}

// ---------- Subscribed calendars ----------

/** Where to load calendars through when a site does not let the browser read them directly. */
const PROXY_KEY = 'broomit.calendarProxy'

export function calendarProxy(): string {
  try {
    return localStorage.getItem(PROXY_KEY) ?? ''
  } catch {
    return ''
  }
}

export function setCalendarProxy(url: string): void {
  try {
    if (url.trim()) localStorage.setItem(PROXY_KEY, url.trim())
    else localStorage.removeItem(PROXY_KEY)
  } catch {
    // Without storage the proxy applies until the app closes.
  }
}

/** Calendar apps hand out webcal:// links; they are plain https underneath. */
export function normalizeUrl(url: string): string {
  return url.trim().replace(/^webcals?:\/\//i, 'https://')
}

export class CalendarLoadError extends Error {}

/**
 * Loads a calendar file. Directly when the site allows it; otherwise through the proxy, if one
 * is set. In the installed app (later), calendars load directly from the device.
 */
export async function fetchCalendar(url: string): Promise<string> {
  const target = normalizeUrl(url)
  if (!/^https?:\/\//i.test(target)) {
    throw new CalendarLoadError(
      'This is not a calendar link. It starts with https:// or webcal://.',
    )
  }
  const attempts = [target]
  const proxy = calendarProxy()
  if (proxy)
    attempts.push(
      proxy.includes('{url}')
        ? proxy.replace('{url}', encodeURIComponent(target))
        : `${proxy}${encodeURIComponent(target)}`,
    )
  let lastError: unknown = null
  for (const url of attempts) {
    try {
      const response = await fetch(url, { cache: 'no-store' })
      if (!response.ok) {
        lastError = new CalendarLoadError(
          response.status === 401 || response.status === 403 || response.status === 404
            ? 'The calendar refused the link. Copy a fresh link from your calendar app.'
            : `The calendar could not be loaded (error ${response.status}).`,
        )
        continue
      }
      const text = await response.text()
      if (!text.includes('BEGIN:VCALENDAR')) {
        throw new CalendarLoadError('The link does not lead to a calendar (iCal) file.')
      }
      return text
    } catch (err) {
      if (err instanceof CalendarLoadError) throw err
      lastError = err
    }
  }
  if (lastError instanceof CalendarLoadError) throw lastError
  throw new CalendarLoadError(
    proxy
      ? 'The calendar could not be reached, also not through the relay. Check the link and your connection.'
      : 'Your browser may not load this calendar directly. Import its .ics file instead, or set a relay in the calendar settings. The installed app will load it directly.',
  )
}

const SOURCE_COLORS = EVENT_COLORS.map(([, c]) => c)
  .slice(6)
  .concat(EVENT_COLORS.map(([, c]) => c))

function nextColor(): string {
  return SOURCE_COLORS[data.sources.length % SOURCE_COLORS.length]!
}

/** Subscribes to a calendar by link; it is kept even when the first load fails. */
export async function addSource(url: string, name: string): Promise<CalendarSource> {
  const source: CalendarSource = {
    id: crypto.randomUUID(),
    name: name.trim() || guessName(url),
    url: normalizeUrl(url),
    color: nextColor(),
    enabled: true,
  }
  await db.calendarSources.put(source)
  set({ sources: [...data.sources, source] })
  return refreshSource(source.id)
}

/** Adds a calendar from a file (exported from WebUntis, Google…); it does not update. */
export async function importCalendarFile(file: File): Promise<CalendarSource> {
  const text = await file.text()
  if (!text.includes('BEGIN:VCALENDAR')) {
    throw new CalendarLoadError('This file is not a calendar (.ics) file.')
  }
  const source: CalendarSource = {
    id: crypto.randomUUID(),
    name: file.name.replace(/\.ics$/i, '') || 'Imported calendar',
    url: '',
    color: nextColor(),
    enabled: true,
    ics: text,
    fetchedAt: Date.now(),
  }
  await db.calendarSources.put(source)
  set({ sources: [...data.sources, source] })
  return source
}

function guessName(url: string): string {
  const u = url.toLowerCase()
  if (u.includes('untis')) return 'Timetable'
  if (u.includes('google')) return 'Google Calendar'
  if (u.includes('icloud')) return 'iCloud Calendar'
  if (u.includes('outlook') || u.includes('office')) return 'Outlook Calendar'
  return 'Calendar'
}

export async function updateSource(id: string, patch: Partial<CalendarSource>): Promise<void> {
  const source = data.sources.find((s) => s.id === id)
  if (!source) return
  const next = { ...source, ...patch }
  await db.calendarSources.put(next)
  set({ sources: data.sources.map((s) => (s.id === id ? next : s)) })
}

export async function removeSource(id: string): Promise<void> {
  await db.calendarSources.delete(id)
  set({ sources: data.sources.filter((s) => s.id !== id) })
}

/** Loads a subscribed calendar again; on failure, the last loaded version stays. */
export async function refreshSource(id: string): Promise<CalendarSource> {
  const source = data.sources.find((s) => s.id === id)
  if (!source) throw new CalendarLoadError('This calendar is gone.')
  if (!source.url) return source
  try {
    const ics = await fetchCalendar(source.url)
    const { error: _error, ...rest } = source
    const next = { ...rest, ics, fetchedAt: Date.now() }
    await db.calendarSources.put(next)
    set({ sources: data.sources.map((s) => (s.id === id ? next : s)) })
    return next
  } catch (err) {
    const error = err instanceof Error ? err.message : 'The calendar could not be loaded.'
    const next = { ...source, error }
    await db.calendarSources.put(next)
    set({ sources: data.sources.map((s) => (s.id === id ? next : s)) })
    return next
  }
}

let refreshing = false

export async function refreshAll(): Promise<void> {
  if (refreshing) return
  refreshing = true
  try {
    await Promise.all(
      data.sources.filter((s) => s.url && s.enabled).map((s) => refreshSource(s.id)),
    )
  } finally {
    refreshing = false
  }
}

// ---------- Entries in a range ----------

const parsed = new Map<string, CalendarEvent[]>()

function eventsOf(source: CalendarSource): CalendarEvent[] {
  if (!source.ics) return []
  const cacheKey = `${source.id}:${source.fetchedAt ?? 0}`
  let events = parsed.get(cacheKey)
  if (!events) {
    for (const key of parsed.keys()) if (key.startsWith(`${source.id}:`)) parsed.delete(key)
    events = parseIcs(source.ics)
    parsed.set(cacheKey, events)
  }
  return events
}

const REPEAT: Record<RepeatKind, Repeat['freq']> = {
  daily: 'DAILY',
  weekly: 'WEEKLY',
  monthly: 'MONTHLY',
  yearly: 'YEARLY',
}

export function ownAsEvent(e: OwnEvent): CalendarEvent {
  return {
    uid: e.id,
    title: e.title,
    allDay: e.allDay,
    start: wallOf(new Date(e.start)),
    zone: 'local',
    duration: Math.max(0, e.end - e.start),
    ...(e.repeat ? { repeat: { freq: REPEAT[e.repeat], interval: 1 } } : {}),
    ...(e.location ? { location: e.location } : {}),
    ...(e.note ? { description: e.note } : {}),
  }
}

/** Every entry overlapping the range, from Broomit and the calendars shown. */
export function entriesIn(d: CalendarData, from: Date, to: Date): Entry[] {
  const out: Entry[] = []
  for (const o of occurrences(d.events.map(ownAsEvent), from, to)) {
    const own = d.events.find((e) => e.id === o.uid)
    out.push({ ...o, color: own?.color ?? EVENT_COLORS[0][1], ownId: o.uid })
  }
  for (const source of d.sources) {
    if (!source.enabled) continue
    for (const o of occurrences(eventsOf(source), from, to)) {
      out.push({ ...o, key: `${source.id}:${o.key}`, color: source.color, source: source.name })
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime())
}
