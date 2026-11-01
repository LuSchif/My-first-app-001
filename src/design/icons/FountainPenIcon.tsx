import { Icon, type IconProps } from './Icon.tsx'

/**
 * The fountain pen: a pointed nib with its slit and breather hole, the grip and the barrel,
 * leaning with the tip down to the left as when writing.
 */
export function FountainPenIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <g transform="rotate(40 12 12)">
        {/* Nib */}
        <path d="M12 23 7.6 15.2c-.5-.9-.3-2 .5-2.6L9.4 11.6h5.2l1.3 1c.8.6 1 1.7.5 2.6Z" />
        {/* Slit and breather hole */}
        <path d="M12 23v-6.2" />
        <circle cx="12" cy="15.6" r="1" />
        {/* Grip and barrel */}
        <path d="M9.4 11.6V8.4h5.2v3.2" />
        <path d="M9 8.4 9.8 1.5h4.4L15 8.4" />
      </g>
    </Icon>
  )
}
