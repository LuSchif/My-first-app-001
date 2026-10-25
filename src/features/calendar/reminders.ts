import { occurrences } from './ics.ts'
import { calendarSnapshot, ownAsEvent } from './calendarStore.ts'

/**
 * Reminders for Broomit's own events. A website can only remind while it is open, so they are
 * checked every half minute while Broomit runs, shown in the app and, when allowed, as a system
 * notification. The installed app will schedule them with the system, so they also come when
 * Broomit is closed.
 */

export interface Reminder {
  key: string
  title: string
  start: Date
}

const FIRED_KEY = 'broomit.remindersFired'
/** A reminder missed by more than this (Broomit was closed) is not shown late. */
const LATE_MS = 10 * 60 * 1000

let shown: Reminder[] = []
const listeners = new Set<() => void>()

export function subscribeReminders(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function currentReminders(): Reminder[] {
  return shown
}

export function dismissReminder(key: string): void {
  shown = shown.filter((r) => r.key !== key)
  listeners.forEach((fn) => fn())
}

function fired(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(FIRED_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

function remember(keys: Set<string>): void {
  try {
    // Only recent ones are needed to avoid showing a reminder twice.
    localStorage.setItem(FIRED_KEY, JSON.stringify([...keys].slice(-200)))
  } catch {
    // Without storage a reminder may come again after a reload.
  }
}

/** Asks for permission to show reminders as notifications; does nothing where unsupported. */
export async function allowNotifications(): Promise<void> {
  try {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
  } catch {
    // Some browsers (iPad Safari outside the Home Screen app) have no notifications.
  }
}

function check(): void {
  const now = Date.now()
  const events = calendarSnapshot().events.filter((e) => e.reminder !== undefined)
  if (!events.length) return
  const done = fired()
  let changed = false
  const ahead = Math.max(...events.map((e) => e.reminder!)) * 60000
  for (const o of occurrences(
    events.map(ownAsEvent),
    new Date(now - LATE_MS),
    new Date(now + ahead + 60000),
  )) {
    const event = events.find((e) => e.id === o.uid)
    if (!event) continue
    const at = o.start.getTime() - event.reminder! * 60000
    if (at > now || now - at > LATE_MS || done.has(o.key)) continue
    done.add(o.key)
    changed = true
    const reminder = { key: o.key, title: o.title, start: o.start }
    shown = [...shown, reminder]
    listeners.forEach((fn) => fn())
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(o.title, { body: reminderText(reminder), tag: o.key })
      }
    } catch {
      // The in-app reminder is enough.
    }
  }
  if (changed) remember(done)
}

export function reminderText(r: Reminder): string {
  const minutes = Math.round((r.start.getTime() - Date.now()) / 60000)
  const time = r.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (minutes <= 0) return `Now, ${time}`
  if (minutes < 60) return `In ${minutes} min, at ${time}`
  return `${r.start.toLocaleDateString([], { weekday: 'long' })}, ${time}`
}

let timer: ReturnType<typeof setInterval> | null = null

export function startReminders(): void {
  if (timer) return
  check()
  timer = setInterval(check, 30_000)
}
