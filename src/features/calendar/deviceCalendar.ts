import { CapacitorCalendar } from '@ebarooni/capacitor-calendar'
import { isNativeApp } from '../../lib/install.ts'

/**
 * The iPad's own calendars (iCloud, Google, Outlook, subscribed timetables… everything set up
 * in the Calendar app), read through the system once Broomit is allowed to. Only in the App
 * Store app; a web page cannot reach them.
 */

export interface DeviceCalendar {
  id: string
  title: string
  color: string
  /** The account it belongs to, e.g. "iCloud" or a Google address. */
  account: string
}

export interface DeviceEvent {
  id: string
  calendarId: string
  title: string
  start: number
  end: number
  allDay: boolean
  location?: string
  description?: string
}

export function deviceCalendarsAvailable(): boolean {
  return isNativeApp()
}

/** Asks once for access to the calendars; true when allowed. */
export async function requestDeviceAccess(): Promise<boolean> {
  const { result } = await CapacitorCalendar.requestFullCalendarAccess()
  return result === 'granted'
}

/** Whether access was given before (asking again is not needed). */
export async function hasDeviceAccess(): Promise<boolean> {
  try {
    const { result } = await CapacitorCalendar.checkAllPermissions()
    return result.readCalendar === 'granted'
  } catch {
    return false
  }
}

export async function listDeviceCalendars(): Promise<DeviceCalendar[]> {
  const { result } = await CapacitorCalendar.listCalendars()
  return result.map((c) => ({
    id: c.id,
    title: c.title ?? 'Calendar',
    color: c.color ?? '#4a80c0',
    account: c.source?.title ?? c.accountName ?? '',
  }))
}

export async function listDeviceEvents(from: Date, to: Date): Promise<DeviceEvent[]> {
  const { result } = await CapacitorCalendar.listEventsInRange({
    from: from.getTime(),
    to: to.getTime(),
  })
  return result.map((e) => ({
    id: `${e.id}@${e.startDate}`,
    calendarId: e.calendarId ?? '',
    title: e.title || 'Untitled',
    start: e.startDate,
    end: e.endDate,
    allDay: e.isAllDay,
    ...(e.location ? { location: e.location } : {}),
    ...(e.description ? { description: e.description } : {}),
  }))
}

/** Opens the iPad's Settings for Broomit, where calendar access can be turned on again. */
export function openAppSettings(): void {
  window.location.href = 'app-settings:'
}
