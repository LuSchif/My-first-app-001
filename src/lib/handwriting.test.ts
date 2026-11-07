import { afterEach, describe, expect, it, vi } from 'vitest'
import { groupLines, lineRequest, parseResponse, recognizeHandwriting } from './handwriting.ts'

const stroke = (x: number, y: number, w: number, h: number) => ({
  points: [x, y, x + w, y + h],
})

describe('handwriting', () => {
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
    expect(parseResponse(['SUCCESS', [['id', ['Test24', 'Tesl24'], [], {}]]])).toEqual(['Test24'])
    expect(() => parseResponse(['FAILED_TO_PARSE_REQUEST_BODY'])).toThrow()
  })

  afterEach(() => vi.unstubAllGlobals())

  it('reads every line and joins them', async () => {
    const answers = ['Hallo', 'Welt']
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ['SUCCESS', [['id', [answers.shift()]]]],
      })),
    )
    const text = await recognizeHandwriting([stroke(0, 0, 50, 20), stroke(0, 60, 50, 20)])
    expect(text).toBe('Hallo\nWelt')
  })
})
