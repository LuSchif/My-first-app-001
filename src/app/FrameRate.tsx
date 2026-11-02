import { useEffect, useRef } from 'react'
import { useFrameRateShown } from '../lib/frameRateSetting.ts'

/**
 * The frame rate, measured each second, in a corner of the screen: 60 (or 120) is smooth; about
 * 30 means the iPad is limiting the app, e.g. in Low Power Mode.
 */
export function FrameRate() {
  const shown = useFrameRateShown()
  const label = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!shown) return
    let frame = 0
    let frames = 0
    let worst = 0
    let start = performance.now()
    let last = start
    const tick = (now: number) => {
      frames++
      worst = Math.max(worst, now - last)
      last = now
      if (now - start >= 1000) {
        const fps = Math.round((frames * 1000) / (now - start))
        // Written directly: a React update every second would itself cost a frame.
        if (label.current) {
          label.current.textContent = `${fps} fps · slowest ${Math.round(worst)} ms`
          label.current.dataset.state = fps >= 55 ? 'good' : fps >= 40 ? 'fair' : 'poor'
        }
        frames = 0
        worst = 0
        start = now
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [shown])
  if (!shown) return null
  return (
    <span
      ref={label}
      role="status"
      className="pointer-events-none fixed bottom-[calc(8px+env(safe-area-inset-bottom))] left-2 z-[90] rounded-full bg-ink px-2.5 py-1 font-mono text-[11px] font-semibold text-ink-inverse tabular-nums data-[state=fair]:bg-accent data-[state=poor]:bg-danger"
    >
      … fps
    </span>
  )
}
