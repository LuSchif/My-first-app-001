/**
 * The calendar's stored data: events made in Broomit, days marked as important, and calendars
 * subscribed to by link (WebUntis, Google, iCloud…), with their last loaded content so they show
 * offline too.
 */

export type RepeatKind = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface OwnEvent {
  id: string
  title: string
  /** Start and end as times (ms). All-day events start at local midnight. */
  start: number
  end: number
  allDay: boolean
  color: string
  location?: string
  note?: string
  /** Minutes before the start to remind; absent for none. */
  reminder?: number
  repeat?: RepeatKind
}

/** A day marked as important. */
export interface DayMark {
  /** 'YYYY-MM-DD' in the device's zone. */
  date: string
  color: string
  label: string
}

export interface CalendarSource {
  id: string
  name: string
  url: string
  color: string
  enabled: boolean
  /** The last loaded calendar file; imported files have only this. */
  ics?: string
  fetchedAt?: number
  /** Why the last update failed, in words for the user. */
  error?: string
}

export const EVENT_COLORS = [
  ['Caramel', '#b98b65'],
  ['Red', '#d0574a'],
  ['Orange', '#e39545'],
  ['Yellow', '#d9b43c'],
  ['Green', '#5f9a4a'],
  ['Teal', '#3c9a8f'],
  ['Blue', '#4a80c0'],
  ['Purple', '#8063b4'],
] as const

export function dayKey(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

/** The first Monday on or before the 1st of `month`'s month. */
export function monthGridStart(month: Date): Date {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  return addDays(first, -((first.getDay() + 6) % 7))
}
