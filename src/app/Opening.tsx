import broom from '../assets/opening-broom.png'
import icon from '../assets/opening-icon.png'

/** Dust behind the bristles: where each puff starts (from the sweeping edge) and when. */
const DUST = [
  { left: -96, bottom: 6, delay: 0 },
  { left: -72, bottom: 18, delay: 130 },
  { left: -118, bottom: 14, delay: 260 },
  { left: -84, bottom: 2, delay: 390 },
] as const

/**
 * The opening: on white, a broom sweeps from left to right and uncovers the Broomit logo behind
 * it, with a little dust; then everything fades into the app. A tap skips it.
 */
export function Opening({ onDone }: { onDone: () => void }) {
  return (
    <div
      aria-hidden="true"
      onClick={onDone}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) onDone()
      }}
      className="fixed inset-0 z-[100] grid animate-opening-out place-items-center bg-splash select-none"
    >
      <div className="relative animate-opening-settle">
        {/* The logo, uncovered from the left as the broom passes. */}
        <div className="grid animate-opening-reveal justify-items-center gap-4">
          <img src={icon} alt="" className="size-32 drop-shadow-xl" draggable={false} />
          <p className="text-5xl font-bold tracking-tight text-ink">Broomit</p>
        </div>
        {/* The broom: its sweeping edge stays on the edge of what is uncovered. */}
        <div className="pointer-events-none absolute inset-0 animate-opening-sweep">
          <div className="absolute -bottom-3 left-0">
            {DUST.map((d) => (
              <span
                key={d.delay}
                className="absolute size-3 animate-opening-dust rounded-full bg-sand"
                style={{ left: d.left, bottom: d.bottom, animationDelay: `${d.delay}ms` }}
              />
            ))}
            <img
              src={broom}
              alt=""
              draggable={false}
              className="relative -left-[100px] w-[150px] max-w-none origin-[85%_5%] animate-opening-brush"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
