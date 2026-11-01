import { Icon, type IconProps } from './Icon.tsx'

/** Tape: a roll with a strip pulled off to the right, its end torn. */
export function TapeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="10.5" r="6.5" />
      <circle cx="9" cy="10.5" r="2.4" />
      <path d="M9 17h12.5l-1-1.15 1-1.15-1-1.15 1-1.15H15.1" />
    </Icon>
  )
}
