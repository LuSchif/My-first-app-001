import type { SVGProps } from 'react'
import { BROOM_PATHS } from '../../engine/render/broomGlyph.ts'

/** The laser pointer: the broom pictogram with a glowing dot at its bristles. */
export function LaserBroomIcon({
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
        <path key={d} d={d} opacity={0.55} />
      ))}
      <circle cx="19" cy="19" r="2.4" fill="currentColor" stroke="none" />
      <path d="M19 13.6v1.2M24.4 19h-1.2M22.8 15.2l-.85.85" />
    </svg>
  )
}
