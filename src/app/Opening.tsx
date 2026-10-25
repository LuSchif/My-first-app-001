import { useEffect, useState } from 'react'
import broom from '../assets/opening-broom.png'
import icon from '../assets/opening-icon.png'

/** The broom's size on screen (its picture is 420 × 433). */
const BROOM_WIDTH = 150
const BROOM_HEIGHT = Math.round((BROOM_WIDTH * 433) / 420)
/** Where its bristles end, from its left edge: the edge of what is uncovered. */
const BRISTLE_TIP = Math.round(BROOM_WIDTH * 0.67)
/** Starts anyway if the pictures take longer than this to load. */
const LOAD_TIMEOUT_MS = 1200

/** Loads and decodes the pictures, so nothing appears late or out of place. */
function loadPictures(): Promise<unknown> {
  return Promise.all(
    [broom, icon].map((src) => {
      const img = new Image()
      img.src = src
      return img.decode().catch(() => undefined)
    }),
  )
}

/**
 * The opening: on white, the broom flies from left to right and uncovers the Broomit logo
 * behind it; then everything fades into the app. It starts once its pictures are ready. A tap
 * skips it.
 */
export function Opening({ onDone }: { onDone: () => void }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    const start = () => alive && setReady(true)
    const timer = setTimeout(start, LOAD_TIMEOUT_MS)
    void loadPictures().then(start)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [])

  return (
    <div
      aria-hidden="true"
      onClick={onDone}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) onDone()
      }}
      className={`fixed inset-0 z-[100] grid place-items-center bg-splash select-none ${ready ? 'animate-opening-out' : ''}`}
    >
      {ready ? (
        <div className="relative animate-opening-settle">
          {/* The logo, uncovered from the left as the broom passes. */}
          <div className="grid animate-opening-reveal justify-items-center gap-4">
            <img src={icon} alt="" className="size-32 drop-shadow-xl" draggable={false} />
            <p className="text-5xl font-bold tracking-tight text-ink">Broomit</p>
          </div>
          {/* The broom: the tips of its bristles stay on the edge of what is uncovered. */}
          <div className="pointer-events-none absolute inset-0 animate-opening-sweep">
            <img
              src={broom}
              alt=""
              draggable={false}
              className="absolute max-w-none"
              style={{
                width: BROOM_WIDTH,
                height: BROOM_HEIGHT,
                left: -BRISTLE_TIP,
                bottom: -12,
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
