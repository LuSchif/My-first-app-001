import { ClipboardPaste } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Editor, EditorState, ToolId } from '../../engine/editor/Editor.ts'
import { cn } from '../../lib/cn.ts'
import { wheelTools, type WheelTool } from './wheelTools.tsx'

/** Ring of tools, its hole, and the arc of choices above a tool (in CSS pixels). */
const OUTER = 150
const INNER = 70
const ARC = 214
const MARGIN = 12

type Target = { tool: ToolId } | { variant: string } | null

/** Points on a circle, with 0° at the top and angles growing clockwise. */
function polar(r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180
  return [r * Math.cos(a), r * Math.sin(a)]
}

/** A ring segment between two radii and two angles, as an SVG path around (0, 0). */
function sector(r0: number, r1: number, from: number, to: number): string {
  const [ax, ay] = polar(r1, from)
  const [bx, by] = polar(r1, to)
  const [cx, cy] = polar(r0, to)
  const [dx, dy] = polar(r0, from)
  const large = to - from > 180 ? 1 : 0
  return `M${ax} ${ay}A${r1} ${r1} 0 ${large} 1 ${bx} ${by}L${cx} ${cy}A${r0} ${r0} 0 ${large} 0 ${dx} ${dy}Z`
}

/**
 * The tool wheel: an inventory of tools that pops up where a pen or finger is held on the page.
 * It does not turn. Slide to a tool and lift, or tap one; a tool with choices (pen or fountain
 * pen) shows them on an arc above it. The chosen tool also goes to the toolbar. The wheel stays
 * until the page is tapped again.
 */
export function ToolWheel({
  editor,
  state,
  onPick,
}: {
  editor: Editor
  state: EditorState
  onPick: (tool: ToolId) => void
}) {
  const wheel = state.wheel
  const tools = wheelTools(state.features)
  const step = 360 / tools.length
  const from = (i: number) => i * step - step / 2
  // The tool whose choices are shown: the one in use if it is in the wheel.
  const [open, setOpen] = useState<ToolId | null>(() =>
    tools.some((t) => t.tool === state.tool) ? state.tool : null,
  )
  const [hover, setHover] = useState<Target>(null)
  // The press that opened the wheel is still down: sliding and lifting chooses.
  const held = useRef(true)

  // Kept on screen, with room for the arc of choices.
  const width = window.innerWidth
  const height = window.innerHeight
  const cx = wheel ? Math.min(width - ARC - MARGIN, Math.max(ARC + MARGIN, wheel.x)) : 0
  const cy = wheel ? Math.min(height - OUTER - MARGIN, Math.max(ARC + MARGIN, wheel.y)) : 0

  const openIndex = tools.findIndex((t) => t.tool === open)
  const variants = openIndex >= 0 ? (tools[openIndex]!.variants ?? []) : []
  const variantStep = variants.length ? step / variants.length : 0

  const targetAt = (clientX: number, clientY: number): Target => {
    const x = clientX - cx
    const y = clientY - cy
    const r = Math.hypot(x, y)
    const deg = ((((Math.atan2(y, x) * 180) / Math.PI + 90) % 360) + 360) % 360
    if (r >= INNER && r <= OUTER) {
      const i = Math.floor(((((deg + step / 2) % 360) + 360) % 360) / step)
      const t = tools[i]
      return t ? { tool: t.tool } : null
    }
    if (r > OUTER && r <= ARC && variants.length) {
      const start = from(openIndex)
      const rel = (((deg - start) % 360) + 360) % 360
      if (rel < step) return { variant: variants[Math.floor(rel / variantStep)]!.id }
    }
    return null
  }

  const choose = (target: Target) => {
    if (!target) return
    if ('tool' in target) {
      editor.setTool(target.tool)
      onPick(target.tool)
      setOpen(target.tool)
      return
    }
    const variant = variants.find((v) => v.id === target.variant)
    if (!variant) return
    variant.choose(editor)
    if (open && state.tool !== open) {
      editor.setTool(open)
      onPick(open)
    }
  }

  // Follows the press that opened the wheel, wherever the pointer goes.
  const latest = useRef({ targetAt, choose })
  useEffect(() => {
    latest.current = { targetAt, choose }
  })
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (held.current) setHover(latest.current.targetAt(e.clientX, e.clientY))
    }
    const up = (e: PointerEvent) => {
      if (!held.current) return
      held.current = false
      setHover(null)
      latest.current.choose(latest.current.targetAt(e.clientX, e.clientY))
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [])

  if (!wheel) return null
  const same = (a: Target, b: Target) => JSON.stringify(a) === JSON.stringify(b)
  const centerLabel =
    hover && 'tool' in hover
      ? tools.find((t) => t.tool === hover.tool)?.label(state)
      : hover && 'variant' in hover
        ? variants.find((v) => v.id === hover.variant)?.label
        : tools.find((t) => t.tool === state.tool)?.label(state)

  return (
    <>
      {/* A tap anywhere else (the page) closes the wheel. */}
      <div
        className="fixed inset-0 z-30"
        data-tool-wheel-backdrop=""
        onPointerDown={(e) => {
          if (held.current) return
          e.preventDefault()
          editor.closeWheel()
        }}
      />
      <div
        role="menu"
        aria-label="Tools"
        className="fixed z-30 animate-pop-in"
        style={{ left: cx - ARC, top: cy - ARC, width: ARC * 2, height: ARC * 2 }}
        onPointerDown={(e) => {
          // Buttons act on their own click; elsewhere on a ring, the spot decides.
          if ((e.target as Element).closest('button') || held.current) return
          e.preventDefault()
          const target = targetAt(e.clientX, e.clientY)
          if (target) choose(target)
          else if (Math.hypot(e.clientX - cx, e.clientY - cy) > OUTER) editor.closeWheel()
        }}
      >
        <svg
          width={ARC * 2}
          height={ARC * 2}
          viewBox={`${-ARC} ${-ARC} ${ARC * 2} ${ARC * 2}`}
          className="pointer-events-none absolute inset-0 overflow-visible drop-shadow-[0_8px_24px_rgb(62_45_37/0.18)]"
          aria-hidden="true"
        >
          {variants.length ? (
            <g>
              {variants.map((v, i) => {
                const a = from(openIndex) + i * variantStep
                const on = v.active(state)
                return (
                  <path
                    key={v.id}
                    d={sector(OUTER + 4, ARC, a + 0.6, a + variantStep - 0.6)}
                    className={cn(
                      'stroke-line transition-colors',
                      on
                        ? 'fill-ink'
                        : same(hover, { variant: v.id })
                          ? 'fill-surface-sunken'
                          : 'fill-surface-raised',
                    )}
                    strokeWidth={1}
                  />
                )
              })}
            </g>
          ) : null}
          {tools.map((t, i) => {
            const on = state.tool === t.tool
            return (
              <path
                key={t.tool}
                d={sector(INNER, OUTER, from(i) + 0.5, from(i) + step - 0.5)}
                className={cn(
                  'stroke-line transition-colors',
                  on
                    ? 'fill-ink'
                    : same(hover, { tool: t.tool })
                      ? 'fill-surface-sunken'
                      : 'fill-surface-raised',
                )}
                strokeWidth={1}
              />
            )
          })}
        </svg>

        {tools.map((t, i) => (
          <WheelButton
            key={t.tool}
            tool={t}
            state={state}
            at={polar((INNER + OUTER) / 2, from(i) + step / 2)}
            onChoose={() => choose({ tool: t.tool })}
          />
        ))}
        {variants.map((v, i) => {
          const [x, y] = polar((OUTER + ARC) / 2 + 2, from(openIndex) + (i + 0.5) * variantStep)
          const on = v.active(state)
          return (
            <button
              key={v.id}
              type="button"
              role="menuitemradio"
              aria-checked={on}
              aria-label={v.label}
              onClick={() => choose({ variant: v.id })}
              className={cn(
                'absolute grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full',
                on ? 'text-ink-inverse' : 'text-ink',
              )}
              style={{ left: ARC + x, top: ARC + y }}
            >
              {v.icon}
            </button>
          )
        })}

        {/* The middle names the tool under the finger, and offers to paste what was copied. */}
        <div
          className="absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-surface-raised/95 text-center shadow-soft ring-1 ring-line"
          style={{ left: ARC, top: ARC, width: INNER * 2 - 12, height: INNER * 2 - 12 }}
        >
          {wheel.canPaste && !hover ? (
            <button
              type="button"
              onClick={() => editor.pasteHere()}
              className="grid place-items-center gap-0.5 rounded-full p-3 text-xs font-semibold hover:bg-hover"
            >
              <ClipboardPaste size={20} />
              Paste
            </button>
          ) : (
            <span className="px-2 text-xs leading-tight font-semibold text-ink-muted">
              {centerLabel ?? 'Tools'}
            </span>
          )}
        </div>
      </div>
    </>
  )
}

function WheelButton({
  tool,
  state,
  at,
  onChoose,
}: {
  tool: WheelTool
  state: EditorState
  at: [number, number]
  onChoose: () => void
}) {
  const on = state.tool === tool.tool
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={on}
      aria-label={tool.label(state)}
      onClick={onChoose}
      className={cn(
        'absolute grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full',
        on ? 'text-ink-inverse' : 'text-ink',
      )}
      style={{ left: ARC + at[0], top: ARC + at[1] }}
    >
      {tool.icon(state, 26)}
    </button>
  )
}
