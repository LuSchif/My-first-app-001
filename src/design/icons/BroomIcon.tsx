import type { SVGProps } from 'react'

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
      {/* handle */}
      <path d="M20.5 3.5 13 11" />
      {/* binding */}
      <path d="m10.6 9.4 4 4" />
      {/* head */}
      <path d="M10.6 9.4 5.2 12a2 2 0 0 0-.6.4L3 14l7 7 1.6-1.6a2 2 0 0 0 .4-.6l2.6-5.4" />
      {/* bristles */}
      <path d="m7 17.5 2-2M9.6 19.4l1.6-1.6M4.6 15.4 6.2 13.8" />
    </svg>
  )
}
