import type { ReactNode, SVGProps } from 'react'

export type IconProps = SVGProps<SVGSVGElement> & { size?: number }

/** An icon on the 24 px grid with round lines, like the Lucide icons used elsewhere. */
export function Icon({
  size = 24,
  strokeWidth = 1.75,
  children,
  ...props
}: IconProps & { children: ReactNode }) {
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
      {children}
    </svg>
  )
}
