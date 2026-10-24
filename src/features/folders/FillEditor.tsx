import { ArrowUp, Minus, Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import { fillToCss, parseHex, type Fill, type GradientStop } from '../../engine/model/fill.ts'
import {
  ColorSwatch,
  ColorWheel,
  GRADIENT_PRESETS,
  Slider,
  SwatchGrid,
} from '../../design/index.ts'
import { cn } from '../../lib/cn.ts'

type Mode = Fill['type']

const MODES: [Mode, string][] = [
  ['solid', 'Color'],
  ['linear', 'Linear'],
  ['radial', 'Radial'],
]

const DIRECTIONS = [0, 45, 90, 135, 180, 225, 270, 315]

/**
 * Designs a fill: one color, or a linear or radial gradient with as many color stops as wanted
 * and, for linear ones, a direction. Used for folders and notebook covers.
 */
export function FillEditor({ value, onChange }: { value: Fill; onChange: (fill: Fill) => void }) {
  const [selected, setSelected] = useState(0)
  const stops = value.type === 'solid' ? [] : sorted(value.stops)
  const stopIndex = Math.min(selected, Math.max(0, stops.length - 1))

  const setMode = (mode: Mode) => {
    if (mode === value.type) return
    if (mode === 'solid') {
      onChange({ type: 'solid', color: stops[0]?.color ?? '#b98b65' })
      return
    }
    const nextStops =
      value.type === 'solid'
        ? [
            { offset: 0, color: value.color },
            { offset: 1, color: mix(value.color, '#3e2d25', 0.45) },
          ]
        : value.stops
    onChange(
      mode === 'linear'
        ? { type: 'linear', angle: value.type === 'linear' ? value.angle : 135, stops: nextStops }
        : { type: 'radial', stops: nextStops },
    )
  }

  const setStops = (next: GradientStop[]) => {
    if (value.type === 'solid') return
    onChange({ ...value, stops: next })
  }
  const setStopColor = (color: string) =>
    setStops(stops.map((s, i) => (i === stopIndex ? { ...s, color } : s)))

  const addStop = () => {
    // In the middle of the widest gap, in the color between its neighbours.
    let at = 0
    for (let i = 1; i < stops.length - 1; i++) {
      if (stops[i + 1]!.offset - stops[i]!.offset > stops[at + 1]!.offset - stops[at]!.offset)
        at = i
    }
    const a = stops[at]!
    const b = stops[at + 1]!
    const stop = { offset: (a.offset + b.offset) / 2, color: mix(a.color, b.color, 0.5) }
    const next = sorted([...stops, stop])
    setStops(next)
    setSelected(next.indexOf(stop))
  }
  const removeStop = () => {
    if (stops.length <= 2) return
    setStops(stops.filter((_, i) => i !== stopIndex))
    setSelected(Math.max(0, stopIndex - 1))
  }

  const color = value.type === 'solid' ? value.color : (stops[stopIndex]?.color ?? '#000000')

  return (
    <div className="grid gap-4">
      <div
        role="radiogroup"
        aria-label="Fill"
        className="flex gap-1 rounded-control bg-surface-sunken p-1"
      >
        {MODES.map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={value.type === mode}
            onClick={() => setMode(mode)}
            className={cn(
              'h-9 flex-1 rounded-[10px] text-sm font-semibold transition-colors',
              value.type === mode
                ? 'bg-surface-raised shadow-soft'
                : 'text-ink-muted hover:bg-hover',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {value.type !== 'solid' ? (
        <>
          <div role="group" aria-label="Gradient presets" className="flex flex-wrap">
            {GRADIENT_PRESETS.map((preset) => (
              <ColorSwatch
                key={preset.name}
                size="sm"
                label={preset.name}
                fill={
                  preset.fill.type === 'linear' && value.type === 'radial'
                    ? { type: 'radial', stops: preset.fill.stops }
                    : preset.fill
                }
                selected={false}
                onSelect={() => {
                  if (preset.fill.type === 'solid') return
                  setSelected(0)
                  onChange(
                    value.type === 'radial'
                      ? { type: 'radial', stops: preset.fill.stops }
                      : { ...preset.fill, type: 'linear', angle: value.angle },
                  )
                }}
              />
            ))}
          </div>
          <StopBar
            stops={stops}
            selected={stopIndex}
            onSelect={setSelected}
            onMove={(i, offset) => {
              const next = stops.map((s, j) => (j === i ? { ...s, offset } : s))
              const moved = next[i]!
              const order = sorted(next)
              setStops(order)
              setSelected(order.indexOf(moved))
            }}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-ink-muted">
              Stop {stopIndex + 1} of {stops.length}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={removeStop}
                disabled={stops.length <= 2}
                className="flex h-9 items-center gap-1 rounded-control px-3 text-sm font-semibold hover:bg-hover disabled:text-ink-subtle"
              >
                <Minus size={16} /> Remove stop
              </button>
              <button
                type="button"
                onClick={addStop}
                className="flex h-9 items-center gap-1 rounded-control px-3 text-sm font-semibold hover:bg-hover"
              >
                <Plus size={16} /> Add stop
              </button>
            </div>
          </div>
          {value.type === 'linear' ? (
            <div className="grid gap-2">
              <Slider
                label="Direction"
                value={Math.round(value.angle)}
                min={0}
                max={359}
                onChange={(angle) => onChange({ ...value, angle })}
                format={(v) => `${v}°`}
              />
              <div role="group" aria-label="Directions" className="flex flex-wrap gap-1">
                {DIRECTIONS.map((angle) => (
                  <button
                    key={angle}
                    type="button"
                    aria-label={`${angle}°`}
                    aria-pressed={Math.round(value.angle) === angle}
                    onClick={() => onChange({ ...value, angle })}
                    className="grid size-9 place-items-center rounded-control hover:bg-hover aria-pressed:bg-ink aria-pressed:text-ink-inverse"
                  >
                    <ArrowUp size={16} style={{ transform: `rotate(${angle}deg)` }} />
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      <SwatchGrid
        value={color}
        onChange={(c) =>
          value.type === 'solid' ? onChange({ type: 'solid', color: c }) : setStopColor(c)
        }
      />
      <ColorWheel
        value={color}
        onChange={(c) => {
          const hex = parseHex(c)
          if (!hex) return
          if (value.type === 'solid') onChange({ type: 'solid', color: hex })
          else setStopColor(hex)
        }}
      />
    </div>
  )
}

/** The gradient from left to right with a handle per stop; drag a handle to move its stop. */
function StopBar({
  stops,
  selected,
  onSelect,
  onMove,
}: {
  stops: GradientStop[]
  selected: number
  onSelect: (index: number) => void
  onMove: (index: number, offset: number) => void
}) {
  const bar = useRef<HTMLDivElement>(null)
  const dragging = useRef<{ pointerId: number; index: number } | null>(null)
  const offsetAt = (clientX: number) => {
    const r = bar.current!.getBoundingClientRect()
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width))
  }
  return (
    <div className="px-3 py-2">
      <div
        ref={bar}
        className="relative h-9 rounded-control ring-1 ring-line"
        style={{ background: fillToCss({ type: 'linear', angle: 90, stops }) }}
      >
        {stops.map((stop, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Color stop ${i + 1} at ${Math.round(stop.offset * 100)}%`}
            aria-pressed={i === selected}
            onPointerDown={(e) => {
              e.preventDefault()
              e.currentTarget.setPointerCapture?.(e.pointerId)
              dragging.current = { pointerId: e.pointerId, index: i }
              onSelect(i)
            }}
            onPointerMove={(e) => {
              const d = dragging.current
              if (!d || d.pointerId !== e.pointerId) return
              onMove(d.index, offsetAt(e.clientX))
            }}
            onPointerUp={() => (dragging.current = null)}
            onPointerCancel={() => (dragging.current = null)}
            className={cn(
              'absolute top-1/2 size-7 -translate-x-1/2 -translate-y-1/2 touch-none rounded-full shadow-raised ring-surface-raised',
              i === selected ? 'ring-4 outline-2 outline-ink' : 'ring-3',
            )}
            style={{ left: `${stop.offset * 100}%`, background: stop.color }}
          />
        ))}
      </div>
    </div>
  )
}

function sorted(stops: readonly GradientStop[]): GradientStop[] {
  return [...stops].sort((a, b) => a.offset - b.offset)
}

/** The color `t` of the way from `a` to `b`. */
function mix(a: string, b: string, t: number): string {
  const pa = parseHex(a) ?? '#000000'
  const pb = parseHex(b) ?? '#000000'
  const channel = (i: number) => {
    const va = parseInt(pa.slice(i, i + 2), 16)
    const vb = parseInt(pb.slice(i, i + 2), 16)
    return Math.round(va + (vb - va) * t)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${channel(1)}${channel(3)}${channel(5)}`
}
