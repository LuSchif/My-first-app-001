import type { SVGProps } from 'react'

/** The laser pointer: a pointer held at an angle, its beam, and the glowing dot it makes. */
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
      <path d="M12.6 11.4l6.7-6.7a2 2 0 0 1 2.8 2.8l-6.7 6.7a2 2 0 0 1-2.8-2.8z" />
      <path d="M17.8 7.6l.6-.6" />
      <path d="M11.2 12.8 8.6 15.4" />
      <circle cx="6.2" cy="17.8" r="2.1" fill="currentColor" stroke="none" />
      <path d="M3 15.2 2.2 14.6M6.2 21.4v1M3.4 20.6l-.7.7" />
    </svg>
  )
}
