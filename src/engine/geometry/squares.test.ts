import { expect, it } from 'vitest'
import { recognizeShape } from './shapes.ts'
let seed = 7
const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647
// A hand-drawn square: rounded corners, slight tilt, wobble, start anywhere, overshoot.
function square(side: number, round: number, tilt: number, jitter: number) {
  const pts: [number, number][] = []
  const h = side / 2,
    rr = side * round
  const path: [number, number][] = []
  const corners = [
    [h, -h],
    [h, h],
    [-h, h],
    [-h, -h],
  ] as const
  for (let c = 0; c < 4; c++) {
    const [x, y] = corners[c]!
    const [nx, ny] = corners[(c + 1) % 4]!
    for (let k = 0; k < 24; k++) {
      const t = k / 24
      path.push([x + (nx - x) * t, y + (ny - y) * t])
    }
  }
  // round corners by averaging neighbours
  const n = path.length,
    w = Math.max(1, Math.round((rr / side) * 24))
  for (let i = 0; i < n; i++) {
    let sx = 0,
      sy = 0
    for (let k = -w; k <= w; k++) {
      const q = path[(i + k + n) % n]!
      sx += q[0]
      sy += q[1]
    }
    pts.push([sx / (2 * w + 1), sy / (2 * w + 1)])
  }
  const start = Math.floor(r() * n),
    over = Math.floor((r() - 0.3) * 10)
  const seq = Array.from({ length: n + over }, (_, i) => pts[(start + i + n) % n]!)
  const ph = r() * 6
  return seq.flatMap(([x, y], i) => {
    const u = x * Math.cos(tilt) - y * Math.sin(tilt),
      v = x * Math.sin(tilt) + y * Math.cos(tilt)
    return [
      300 + u + Math.sin(i / 9 + ph) * jitter + (r() - 0.5) * jitter,
      300 + v + Math.cos(i / 11 + ph) * jitter + (r() - 0.5) * jitter,
    ]
  })
}
// Squares as people draw them: rounded corners, a slight tilt, wobble, any starting point.
it('recognizes hand-drawn squares, also with rounded corners', () => {
  for (const round of [0.03, 0.1, 0.18]) {
    const got: Record<string, number> = {}
    for (let k = 0; k < 40; k++) {
      const kind =
        recognizeShape(square(80 + r() * 100, round, (r() - 0.5) * 0.3, 1 + r() * 2.5))?.kind ??
        'none'
      got[kind] = (got[kind] ?? 0) + 1
    }
    expect(got.square ?? 0, `round ${round}: ${JSON.stringify(got)}`).toBeGreaterThanOrEqual(36)
  }
})
