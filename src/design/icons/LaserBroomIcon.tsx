import { BROOM_URL } from '../../engine/render/broomGlyph.ts'

/** The laser pointer: Broomit's broom with a glowing red dot at its bristles. */
export function LaserBroomIcon({ size = 24 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="relative inline-block"
      style={{ width: size, height: size }}
    >
      <img
        src={BROOM_URL}
        alt=""
        draggable={false}
        width={size}
        height={size}
        className="pointer-events-none size-full object-contain opacity-80 select-none"
      />
      <span
        className="absolute rounded-full"
        style={{
          width: size * 0.3,
          height: size * 0.3,
          right: 0,
          bottom: 0,
          background: '#e0533f',
          boxShadow: '0 0 6px 2px rgb(224 83 63 / 0.6)',
        }}
      />
    </span>
  )
}
