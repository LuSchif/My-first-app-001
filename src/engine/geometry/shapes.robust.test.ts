import { expect, it } from 'vitest'
import { recognizeShape } from './shapes.ts'
let seed = 5
const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647
const noise = (a: number) => (r() - 0.5) * a
function wobble(pts: [number, number][], jitter: number) {
  // low-frequency hand wobble plus jitter
  const ph = r() * 6
  return pts.flatMap(([x, y], i) => [
    x + Math.sin(i / 7 + ph) * jitter + noise(jitter),
    y + Math.cos(i / 9 + ph) * jitter + noise(jitter),
  ])
}
function poly(n: number, size: number, rot: number, aspect = 1): [number, number][] {
  // Corners on a stretched circle, then rotated, so a 4-gon is a true rectangle.
  const c = Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2 + (n === 4 ? Math.PI / 4 : 0)
    const u = size * Math.cos(t) * aspect
    const v = size * Math.sin(t)
    return [
      200 + u * Math.cos(rot) - v * Math.sin(rot),
      200 + u * Math.sin(rot) + v * Math.cos(rot),
    ] as [number, number]
  })
  const out: [number, number][] = []
  const start = Math.floor(r() * n)
  for (let k = 0; k < n; k++) {
    const [x0, y0] = c[(start + k) % n]!
    const [x1, y1] = c[(start + k + 1) % n]!
    for (let j = 0; j < 20; j++) out.push([x0 + ((x1 - x0) * j) / 20, y0 + ((y1 - y0) * j) / 20])
  }
  const end = c[start]!
  const overshoot = (r() - 0.4) * 0.25
  const nx = c[(start + 1) % n]!
  out.push([end[0] + (nx[0] - end[0]) * overshoot, end[1] + (nx[1] - end[1]) * overshoot])
  return out
}
function ellipse(a: number, b: number, rot: number): [number, number][] {
  const start = r() * 6
  const sweep = Math.PI * 2 * (0.93 + r() * 0.12)
  return Array.from({ length: 90 }, (_, i) => {
    const t = start + (i / 89) * sweep
    const u = a * Math.cos(t),
      v = b * Math.sin(t)
    return [
      200 + u * Math.cos(rot) - v * Math.sin(rot),
      200 + u * Math.sin(rot) + v * Math.cos(rot),
    ] as [number, number]
  })
}
function parabola(w: number, rot: number): [number, number][] {
  const k = 0.5 + r() * 1.2
  return Array.from({ length: 60 }, (_, i) => {
    const x = -w + (2 * w * i) / 59
    const y = ((x * x) / w) * k
    return [
      200 + x * Math.cos(rot) - y * Math.sin(rot),
      200 + x * Math.sin(rot) + y * Math.cos(rot),
    ] as [number, number]
  })
}
// Hand-drawn shapes vary a lot; this draws each kind 70 times with random size, rotation,
// shaky lines and a start that overshoots or falls short, and expects nearly all recognized.
it('recognizes shaky hand-drawn shapes reliably', () => {
  const cases: [string, () => [number, number][]][] = [
    ['circle', () => ellipse(60, 60 * (0.93 + r() * 0.07), r() * 6)],
    ['ellipse', () => ellipse(80, 40, r() * 6)],
    ['triangle', () => poly(3, 70, r() * 6)],
    ['square', () => poly(4, 70, r() * 6, 1 + r() * 0.08)],
    ['rectangle', () => poly(4, 70, r() * 6, 1.3 + r() * 0.5)],
    ['pentagon', () => poly(5, 70, r() * 6)],
    ['parabola', () => parabola(60, r() * 6)],
  ]
  const rows: string[] = []
  for (const [want, make] of cases) {
    const got: Record<string, number> = {}
    for (let k = 0; k < 70; k++) {
      const jitter = 0.5 + r() * 3
      const kind = recognizeShape(wobble(make(), jitter))?.kind ?? 'none'
      got[kind] = (got[kind] ?? 0) + 1
    }
    rows.push(`${want}: ${JSON.stringify(got)}`)
    expect(got[want] ?? 0, `${want}: ${JSON.stringify(got)}`).toBeGreaterThanOrEqual(66)
  }
})
