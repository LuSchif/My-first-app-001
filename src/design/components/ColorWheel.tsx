import { useRef, useState } from 'react'
import { parseHex } from '../../engine/model/fill.ts'
import { hexToHsv, hsvToHex, type Hsv } from '../../lib/color.ts'
import { Slider } from './Slider.tsx'

const SIZE = 152

/**
 * Pick any color: hue around the wheel, saturation from the middle outwards, brightness below,
 * or type a hex code.
 */
export function ColorWheel({
  value,
  onChange,
  onCommit,
}: {
  value: string
  onChange: (hex: string) => void
  /** Called when a choice is finished: the pen lifts from the wheel or the slider. */
  onCommit?: () => void
}) {
  // The wheel keeps its own HSV so hue survives at zero saturation; a new value from outside
  // (e.g. a recent color was chosen) replaces it.
  const [state, setState] = useState<{ hsv: Hsv; source: string }>(() => ({
    hsv: hexToHsv(value),
    source: value,
  }))
  let hsv = state.hsv
  if (value !== state.source && value !== hsvToHex(state.hsv)) {
    hsv = hexToHsv(value)
    setState({ hsv, source: value })
  }
  const [draft, setDraft] = useState<string | null>(null)
  const disc = useRef<HTMLDivElement>(null)

  const commit = (next: Hsv) => {
    const out = hsvToHex(next)
    setState({ hsv: next, source: out })
    onChange(out)
  }

  const pick = (e: React.PointerEvent) => {
    const rect = disc.current!.getBoundingClientRect()
    const dx = e.clientX - (rect.left + rect.width / 2)
    const dy = e.clientY - (rect.top + rect.height / 2)
    const h = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360
    const s = Math.min(1, Math.hypot(dx, dy) / (rect.width / 2))
    // Picking a hue from a near-black color should show that hue, not more black.
    commit({ h, s, v: hsv.v < 0.35 ? 0.9 : hsv.v })
  }

  const angle = (hsv.h * Math.PI) / 180
  const radius = (SIZE / 2) * hsv.s

  return (
    <div className="grid justify-items-center gap-3">
      <div
        ref={disc}
        role="slider"
        aria-label="Hue and saturation"
        aria-valuetext={hsvToHex(hsv)}
        tabIndex={0}
        className="relative touch-none rounded-full shadow-[inset_0_0_0_1px_rgb(62_45_37/0.12)]"
        style={{
          width: SIZE,
          height: SIZE,
          background:
            'radial-gradient(circle closest-side, #fff, rgb(255 255 255 / 0)), conic-gradient(from 90deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          pick(e)
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) pick(e)
        }}
        onPointerUp={() => onCommit?.()}
      >
        <span className="absolute inset-0 rounded-full bg-black" style={{ opacity: 1 - hsv.v }} />
        <span
          className="absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white shadow-raised"
          style={{
            left: SIZE / 2 + Math.cos(angle) * radius,
            top: SIZE / 2 + Math.sin(angle) * radius,
            background: hsvToHex(hsv),
          }}
        />
      </div>
      <div className="w-full">
        <Slider
          label="Brightness"
          value={Math.round(hsv.v * 100)}
          min={0}
          max={100}
          onChange={(v) => commit({ ...hsv, v: v / 100 })}
          onCommit={() => onCommit?.()}
          format={(v) => `${v}%`}
        />
      </div>
      <label className="flex w-full items-center gap-2 text-sm">
        <span className="font-medium">Hex</span>
        <input
          value={draft ?? hsvToHex(hsv)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const parsed = draft === null ? null : parseHex(draft)
            setDraft(null)
            if (parsed) {
              commit(hexToHsv(parsed))
              onCommit?.()
            }
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          spellCheck={false}
          autoCapitalize="off"
          className="h-10 min-w-0 flex-1 rounded-control bg-surface-raised px-3 font-mono uppercase ring-1 ring-line ring-inset focus:ring-2 focus:ring-accent focus:outline-none"
        />
      </label>
    </div>
  )
}
