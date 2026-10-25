import { describe, expect, it } from 'vitest'
import type { Entry } from './calendarStore.ts'
import { placeDay } from './layout.ts'

const day = new Date(2026, 9, 26)
const at = (h: number, m = 0) => new Date(2026, 9, 26, h, m)
const entry = (key: string, s: Date, e: Date): Entry => ({
  key,
  title: key,
  start: s,
  end: e,
  allDay: false,
  color: '#000',
})

describe('calendar layout', () => {
  it('puts overlapping entries side by side', () => {
    const placed = placeDay(
      [entry('a', at(8), at(10)), entry('b', at(9), at(11)), entry('c', at(12), at(13))],
      day,
    )
    const by = Object.fromEntries(placed.map((p) => [p.entry.key, p]))
    expect(by.a!.lanes).toBe(2)
    expect(by.b!.lane).toBe(1)
    expect(by.c!.lanes).toBe(1)
    expect(by.a!.top).toBe(480)
  })

  it('cuts entries at the day edges', () => {
    const placed = placeDay([entry('night', new Date(2026, 9, 25, 22), at(2))], day)
    expect(placed[0]!.top).toBe(0)
    expect(placed[0]!.bottom).toBe(120)
  })

  it('places entries by the clock on the day the clocks change', () => {
    const sunday = new Date(2026, 9, 25)
    const placed = placeDay(
      [entry('m', new Date(2026, 9, 25, 8), new Date(2026, 9, 25, 9))],
      sunday,
    )
    expect(placed[0]!.top).toBe(480)
  })
})
