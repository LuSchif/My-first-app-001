import type { SVGProps } from 'react'
import { GLYPHS, paintFor, type GlyphName } from './glyphs.tsx'

/**
 * One of Broomit's icons: lines only, or in color when `colored` (a tool in use). Pens show
 * `tip`, their current ink, at the tip.
 */
export function BroomitIcon({
  name,
  size = 24,
  colored = false,
  tip,
  strokeWidth = 1.6,
  style,
  ...props
}: SVGProps<SVGSVGElement> & {
  name: GlyphName
  size?: number
  colored?: boolean
  tip?: string
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      // A colored icon keeps its dark lines in every theme.
      style={colored ? { color: 'var(--color-icon-line)', ...style } : style}
      {...props}
    >
      {GLYPHS[name](paintFor(colored, tip))}
    </svg>
  )
}
