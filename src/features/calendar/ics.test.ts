import { describe, expect, it } from 'vitest'
import { occurrences, parseIcs, toDate } from './ics.ts'

const wrap = (body: string) =>
  `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body
    .trim()
    .replace(/\n\s*/g, '\r\n')
    // A folded line continues on the next line, which starts with a space.
    .replaceAll('|FOLD|', '\r\n ')}\r\nEND:VCALENDAR\r\n`

describe('ics', () => {
  it('reads a timed event in a named zone', () => {
    const [e] = parseIcs(
      wrap(`BEGIN:VEVENT
        UID:1
        SUMMARY:Mathe\\, Raum 2
        LOCATION:R 2
        DTSTART;TZID=Europe/Berlin:20261026T080000
        DTEND;TZID=Europe/Berlin:20261026T084500
        END:VEVENT`),
    )
    expect(e!.title).toBe('Mathe, Raum 2')
    expect(e!.duration).toBe(45 * 60000)
    // 8:00 in Berlin after the clock change is 7:00 UTC.
    expect(toDate(e!.start, e!.zone).toISOString()).toBe('2026-10-26T07:00:00.000Z')
  })

  it('unfolds long lines and skips alarms', () => {
    const [e] = parseIcs(
      wrap(`BEGIN:VEVENT
        UID:2
        SUMMARY:A long|FOLD|title
        DTSTART:20261026T090000Z
        DURATION:PT1H30M
        BEGIN:VALARM
        DESCRIPTION:Not the event
        END:VALARM
        END:VEVENT`),
    )
    expect(e!.title).toBe('A longtitle')
    expect(e!.duration).toBe(90 * 60000)
    expect(e!.description).toBeUndefined()
  })

  it('expands weekly series with exceptions and changed occurrences', () => {
    const events = parseIcs(
      wrap(`BEGIN:VEVENT
        UID:s
        SUMMARY:Bio
        DTSTART;TZID=Europe/Berlin:20261005T100000
        DTEND;TZID=Europe/Berlin:20261005T110000
        RRULE:FREQ=WEEKLY;BYDAY=MO,TH;COUNT=6
        EXDATE;TZID=Europe/Berlin:20261008T100000
        END:VEVENT
        BEGIN:VEVENT
        UID:s
        RECURRENCE-ID;TZID=Europe/Berlin:20261012T100000
        SUMMARY:Bio (moved)
        DTSTART;TZID=Europe/Berlin:20261012T140000
        DTEND;TZID=Europe/Berlin:20261012T150000
        END:VEVENT`),
    )
    const list = occurrences(events, new Date('2026-10-01'), new Date('2026-11-01'))
    expect(list.map((o) => o.title)).toEqual(['Bio', 'Bio (moved)', 'Bio', 'Bio', 'Bio'])
    // The series keeps 10:00 local time across the clock change on 25 October.
    const last = list[list.length - 1]!
    expect(last.start.toISOString()).toBe('2026-10-22T08:00:00.000Z')
  })

  it('reads all-day events and monthly rules', () => {
    const events = parseIcs(
      wrap(`BEGIN:VEVENT
        UID:h
        SUMMARY:Holiday
        DTSTART;VALUE=DATE:20261003
        DTEND;VALUE=DATE:20261004
        END:VEVENT
        BEGIN:VEVENT
        UID:m
        SUMMARY:Meeting
        DTSTART:20260101T120000Z
        DURATION:PT1H
        RRULE:FREQ=MONTHLY;BYDAY=-1FR
        END:VEVENT`),
    )
    const list = occurrences(events, new Date(2026, 9, 1), new Date(2026, 10, 1))
    const holiday = list.find((o) => o.title === 'Holiday')!
    expect(holiday.allDay).toBe(true)
    expect(holiday.start.getDate()).toBe(3)
    const meeting = list.find((o) => o.title === 'Meeting')!
    expect(meeting.start.toISOString()).toBe('2026-10-30T12:00:00.000Z')
  })
})
