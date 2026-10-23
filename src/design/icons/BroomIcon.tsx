import type { SVGProps } from 'react'
import { BROOM_PATHS } from '../../engine/render/broomGlyph.ts'

/**
 * Broomit's eraser. Drawn on the same 24 px grid and stroke as the Lucide icons used elsewhere,
 * so it sits naturally in a toolbar next to them.
 */
export function BroomIcon({
  size = 24,
  strokeWidth = 1.75,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number }) {
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
      {...props}
    >
      {BROOM_PATHS.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}
