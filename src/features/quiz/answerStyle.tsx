/** Triangle, diamond, circle, square, pentagon, hexagon. */
export function AnswerShape({ index, size = 22 }: { index: number; size?: number }) {
  const shapes = [
    'M12 3 L22 20 L2 20 Z',
    'M12 2 L22 12 L12 22 L2 12 Z',
    'M12 3 A9 9 0 1 1 11.99 3 Z',
    'M4 4 H20 V20 H4 Z',
    'M12 2 L22 9.5 L18 21 H6 L2 9.5 Z',
    'M7 3 H17 L22 12 L17 21 H7 L2 12 Z',
  ]
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <path d={shapes[index % shapes.length]} fill="currentColor" />
    </svg>
  )
}
