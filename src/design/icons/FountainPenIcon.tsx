import type { SVGProps } from 'react'

/**
 * The fountain pen: a nib with its slit and breather hole, below the barrel. Drawn on the same
 * 24 px grid and stroke as the Lucide icons, so it can stand in for the pen in the toolbar.
 */
export function FountainPenIcon({
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
      {/* Nib */}
      <path d="M3.5 20.5 6 13l3-3 5 5-3 3Z" />
      {/* Slit and breather hole */}
      <path d="M3.5 20.5 7.6 16.4" />
      <circle cx="8.6" cy="15.4" r="1" />
      {/* Barrel */}
      <path d="m9 10 5-5 5 5-5 5" />
      <path d="m16.5 7.5 3-3" />
    </svg>
  )
}
