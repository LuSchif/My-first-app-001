import type { ImgHTMLAttributes } from 'react'
import { BROOM_URL } from '../../engine/render/broomGlyph.ts'

/** Broomit's broom, as in the logo: the eraser in the toolbar. */
export function BroomIcon({
  size = 24,
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & { size?: number }) {
  return (
    <img
      src={BROOM_URL}
      alt=""
      aria-hidden="true"
      draggable={false}
      width={size}
      height={size}
      className="pointer-events-none object-contain select-none"
      {...props}
    />
  )
}
