/**
 * Builds the drawn path of a stroke: quadratic curves through the midpoints between samples.
 * This is the only place the curve shape is defined, so live ink, saved strokes and exports
 * always match.
 */
export interface PathSink {
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void
}

export function traceStroke(sink: PathSink, points: readonly number[]): void {
  const n = points.length / 2
  if (n === 0) return
  sink.moveTo(points[0]!, points[1]!)
  if (n === 1) {
    // A zero-length segment draws a round dot with round caps.
    sink.lineTo(points[0]! + 0.001, points[1]!)
    return
  }
  for (let i = 1; i < n - 1; i++) {
    const x0 = points[i * 2]!
    const y0 = points[i * 2 + 1]!
    const x1 = points[i * 2 + 2]!
    const y1 = points[i * 2 + 3]!
    sink.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
  }
  sink.lineTo(points[(n - 1) * 2]!, points[(n - 1) * 2 + 1]!)
}
