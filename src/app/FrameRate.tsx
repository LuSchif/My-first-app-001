import { useEffect, useRef } from 'react'
import { inkDiagnostics } from '../engine/input/inkDiagnostics.ts'
import { showNotice } from '../lib/notices.ts'
import { useFrameRateShown } from '../lib/frameRateSetting.ts'

/**
 * The frame rate, measured each second, in a corner of the screen: 60 (or 120) is smooth; about
 * 30 means the iPad is limiting the app, e.g. in Low Power Mode. While the pencil writes, also
 * how many pen samples per second reach the app (Apple Pencil measures 240; a browser that
 * hands over only one per frame gives 60, and the line has less to follow).
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
    let samples = 0
    let firstPen = 0
    let lastPen = 0
    let penHz = 0
    let coalesced = true
    let distinct = 0
    let distinctHz = 0
    let px = NaN
    let py = NaN
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'pen' || e.buttons === 0) return
      coalesced = typeof e.getCoalescedEvents === 'function'
      const list = coalesced ? e.getCoalescedEvents() : []
      const all = list.length ? list : [e]
      // Safari delivers each move twice; the repeat is not counted.
      const newest = all[all.length - 1]!
      if (e.timeStamp === lastPen && newest.clientX === px && newest.clientY === py) return
      const count = all.length
      // Samples at a new position: a browser may repeat positions, which add nothing to follow.
      for (const s of all) {
        if (s.clientX !== px || s.clientY !== py) distinct++
        px = s.clientX
        py = s.clientY
      }
      // The first event of a second only starts the clock; later ones count their samples.
      if (samples === 0) {
        firstPen = e.timeStamp
        samples = 1
      } else {
        samples += count
      }
      lastPen = e.timeStamp
    }
    window.addEventListener('pointermove', onMove, { capture: true, passive: true })
    const tick = (now: number) => {
      frames++
      worst = Math.max(worst, now - last)
      last = now
      if (now - start >= 1000) {
        const fps = Math.round((frames * 1000) / (now - start))
        // Written directly: a React update every second would itself cost a frame.
        if (samples > 1 && lastPen - firstPen > 100) {
          penHz = Math.round(((samples - 1) * 1000) / (lastPen - firstPen))
          distinctHz = Math.round((distinct * 1000) / (lastPen - firstPen))
        }
        samples = 0
        distinct = 0
        if (label.current) {
          const pen = penHz
            ? ` · pen ${penHz} Hz, ${distinctHz} new${coalesced ? '' : ' (no coalesced)'}`
            : ''
          const d = inkDiagnostics.last
          const kept = d
            ? ` · kept ${d.kept}/${d.received} (late ${d.late}, same ${d.repeats}, close ${d.tooClose})`
            : ''
          label.current.textContent = `${fps} fps · slowest ${Math.round(worst)} ms${pen}${kept}`
          const host = label.current.parentElement ?? label.current
          host.dataset.state = fps >= 55 ? 'good' : fps >= 40 ? 'fair' : 'poor'
        }
        frames = 0
        worst = 0
        start = now
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onMove, { capture: true })
    }
  }, [shown])
  if (!shown) return null
  // Tapping copies the last stroke's samples, to send along when writing looks wrong.
  const copy = () => {
    const d = inkDiagnostics.last
    if (!d) return
    navigator.clipboard
      .writeText(JSON.stringify(d))
      .then(() => showNotice('The last stroke’s pen samples are copied.'))
      .catch(() => showNotice('Copying is not allowed here.'))
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="fixed bottom-[calc(8px+env(safe-area-inset-bottom))] left-2 z-[90] rounded-full bg-ink px-2.5 py-1 font-mono text-[11px] font-semibold text-ink-inverse tabular-nums data-[state=fair]:bg-accent data-[state=poor]:bg-danger"
    >
      <span ref={label} role="status">
        … fps
      </span>
    </button>
  )
}
