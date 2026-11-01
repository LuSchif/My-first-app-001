import { Icon, type IconProps } from './Icon.tsx'

/** Editing paths: a curved line with three anchor points and the handle of the middle one. */
export function AnchorPathIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 18.5C6 9 9.5 9 12 12.2S18 15 20 5.5" />
      <path d="M8.2 9.6 15.8 14.8" strokeWidth="1.2" opacity="0.7" />
      <rect x="2.4" y="16.9" width="3.2" height="3.2" rx="0.6" fill="currentColor" stroke="none" />
      <rect x="10.4" y="10.6" width="3.2" height="3.2" rx="0.6" fill="var(--icon-fill, white)" />
      <rect x="18.4" y="3.9" width="3.2" height="3.2" rx="0.6" fill="currentColor" stroke="none" />
    </Icon>
  )
}
