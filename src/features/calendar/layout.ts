import type { Entry } from './calendarStore.ts'
import { addDays, startOfDay } from './model.ts'

/** A timed entry placed in a day column: minutes from midnight, and its lane among overlaps. */
export interface Placed {
  entry: Entry
  top: number
  bottom: number
  lane: number
  lanes: number
}

/** Short entries still get room for their title. */
const MIN_MINUTES = 20

/**
 * Places the timed entries of one day side by side where they overlap, like calendar apps do:
 * each group of overlapping entries shares the column in equal lanes.
 */
export function placeDay(entries: readonly Entry[], day: Date): Placed[] {
  const from = startOfDay(day).getTime()
  const to = addDays(day, 1).getTime()
  const items = entries
    .filter((e) => !e.allDay && e.start.getTime() < to && e.end.getTime() > from)
    .map((entry) => {
      // By the clock, not by elapsed time: a day with a clock change has 23 or 25 hours.
      const clock = (d: Date) => d.getHours() * 60 + d.getMinutes()
      const top = entry.start.getTime() <= from ? 0 : clock(entry.start)
      const end = Math.max(entry.end.getTime(), entry.start.getTime())
      const bottom = end >= to ? 1440 : clock(new Date(end))
      return {
        entry,
        top,
        bottom: Math.max(bottom, Math.min(1440, top + MIN_MINUTES)),
        lane: 0,
        lanes: 1,
      }
    })
    .sort((a, b) => a.top - b.top || b.bottom - a.bottom)
  let group: Placed[] = []
  let groupEnd = -1
  const close = () => {
    const lanes = Math.max(1, ...group.map((p) => p.lane + 1))
    for (const p of group) p.lanes = lanes
    group = []
  }
  for (const item of items) {
    if (item.top >= groupEnd) {
      close()
      groupEnd = -1
    }
    const used = new Set(group.filter((p) => p.bottom > item.top).map((p) => p.lane))
    let lane = 0
    while (used.has(lane)) lane++
    item.lane = lane
    group.push(item)
    groupEnd = Math.max(groupEnd, item.bottom)
  }
  close()
  return items
}

/** All-day entries (and entries spanning whole days) shown on a day. */
export function allDayOn(entries: readonly Entry[], day: Date): Entry[] {
  const from = startOfDay(day).getTime()
  const to = addDays(day, 1).getTime()
  return entries.filter((e) => e.allDay && e.start.getTime() < to && e.end.getTime() > from)
}

export const TIME_FORMAT = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })

export function timeRange(e: Entry): string {
  if (e.allDay) return 'All day'
  return `${TIME_FORMAT.format(e.start)}–${TIME_FORMAT.format(e.end)}`
}
