import { Icon, type IconProps } from './Icon.tsx'

/** The laser pointer: a slim pointer with its button, sending a beam to a glowing dot. */
export function LaserBroomIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <g transform="rotate(40 12 12)">
        {/* Body with its button */}
        <rect x="9.6" y="0.8" width="4.8" height="12.4" rx="2.4" />
        <path d="M12 4.4v1.6" />
        {/* Tip and beam */}
        <path d="M10.6 13.2 11.2 15h1.6l.6-1.8" />
        <path d="M12 16.8v2.4" strokeDasharray="1.4 1.6" />
      </g>
      {/* The dot it points at, glowing */}
      <circle cx="5.2" cy="20" r="1.8" fill="currentColor" stroke="none" />
      <path d="M2 20h.6M5.2 16.8v.6M2.9 17.7l.45.45" />
    </Icon>
  )
}
