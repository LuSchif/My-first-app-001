import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  alternativesOf,
  groupLines,
  lineRequest,
  parseResponse,
  recognizeHandwriting,
} from './handwriting.ts'

const stroke = (x: number, y: number, w: number, h: number) => ({
  points: [x, y, x + w, y + h],
})

describe('handwriting', () => {
  it('keeps dots, commas and descenders in their line', () => {
    const letters = [stroke(0, 100, 10, 30), stroke(20, 110, 10, 20), stroke(40, 100, 10, 30)]
    const iDot = stroke(25, 102, 1, 1)
    const comma = stroke(55, 128, 2, 8)
    const descender = stroke(60, 110, 8, 32)
    const line = [letters[0]!, letters[1]!, iDot, letters[2]!, comma, descender]
    expect(groupLines(line)).toEqual([line])
  })

  it('keeps lines apart when a descender reaches into the next line', () => {
    const first = [stroke(0, 100, 10, 30), stroke(20, 110, 10, 20)]
    const y = stroke(40, 110, 10, 75) // tail far down, into the next line
    const second = [stroke(0, 160, 10, 30), stroke(20, 170, 10, 20)]
    expect(groupLines([...first, y, ...second])).toEqual([[...first, y], second])
  })

  it('groups strokes into lines, top to bottom, keeping their order', () => {
    const a = stroke(10, 100, 10, 30)
    const dot = stroke(40, 92, 1, 1)
    const b = stroke(30, 102, 10, 28)
    const second = stroke(10, 200, 50, 30)
    const lines = groupLines([second, a, dot, b])
    expect(lines).toEqual([[a, dot, b], [second]])
  })

  it('sends a line relative to its box, with rising times', () => {
    const req = lineRequest([stroke(100, 50, 20, 10), stroke(130, 50, 10, 10)], 'de') as {
      writing_guide: { writing_area_width: number; writing_area_height: number }
      ink: number[][][]
      language: string
    }
    expect(req.writing_guide).toEqual({ writing_area_width: 40, writing_area_height: 10 })
    expect(req.ink[0]![0]).toEqual([0, 20])
    expect(req.ink[1]![0]).toEqual([30, 40])
    expect(req.ink[1]![2]![0]).toBeGreaterThan(req.ink[0]![2]![1]!)
    expect(req.language).toBe('de')
  })

  it('reads the best candidate and rejects failures', () => {
    expect(parseResponse(['SUCCESS', [['id', ['Test24', 'Tesl24'], [], {}]]])).toEqual([
      ['Test24', 'Tesl24'],
    ])
    expect(() => parseResponse(['FAILED_TO_PARSE_REQUEST_BODY'])).toThrow()
  })

  it('offers whole-text alternatives, one line changed at a time', () => {
    const lines = [['In einer Suppe sich klini', 'In einer Suppe sich kleine'], ['Fleisch']]
    expect(alternativesOf(lines)).toEqual([
      'In einer Suppe sich klini\nFleisch',
      'In einer Suppe sich kleine\nFleisch',
    ])
  })

  afterEach(() => vi.unstubAllGlobals())

  it('reads every line with the text before it, and joins them', async () => {
    const answers = ['Hallo', 'Welt']
    const bodies: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { body: string }) => ({
        ok: (bodies.push(init.body), true),
        json: async () => ['SUCCESS', [['id', [answers.shift()]]]],
      })),
    )
    const text = await recognizeHandwriting([stroke(0, 0, 50, 20), stroke(0, 60, 50, 20)])
    expect(text).toBe('Hallo\nWelt')
    expect(JSON.parse(bodies[1]!).requests[0].pre_context).toBe('Hallo')
  })
})
