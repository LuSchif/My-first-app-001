import { useState } from 'react'
import { Slider, Switch } from '../../design/index.ts'
import type { Editor } from '../../engine/editor/Editor.ts'
import { DEFAULT_TRANSITION } from '../../engine/model/animation.ts'
import type { ObjectAnimation, SlideTransition } from '../../engine/model/types.ts'

const EFFECTS: [ObjectAnimation['effect'], string][] = [
  ['fade', 'Fade'],
  ['rise', 'Rise'],
  ['fly-left', 'Fly in left'],
  ['fly-right', 'Fly in right'],
  ['zoom', 'Zoom'],
  ['wipe', 'Wipe'],
]

const STARTS: [ObjectAnimation['start'], string][] = [
  ['tap', 'On tap'],
  ['with', 'With previous'],
  ['after', 'After previous'],
]

const TRANSITIONS: [SlideTransition['effect'], string][] = [
  ['fade', 'Fade'],
  ['push', 'Push'],
  ['cover', 'Cover'],
  ['zoom', 'Zoom'],
]

const choice =
  'min-h-11 rounded-control px-2 text-sm font-semibold ring-1 ring-line aria-pressed:bg-ink aria-pressed:text-ink-inverse aria-pressed:ring-ink disabled:opacity-40'

/** Picks one of a few options, as a grid of buttons. */
function Choices<T extends string>({
  label,
  options,
  value,
  columns,
  onChange,
}: {
  label: string
  options: [T, string][]
  value: T | null
  columns: number
  onChange: (value: T | null) => void
}) {
  return (
    <div role="group" aria-label={label} className="grid gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {options.map(([key, text]) => (
          <button
            key={key || 'none'}
            type="button"
            aria-pressed={value === key}
            className={choice}
            onClick={() => onChange(key)}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}

/** A duration in seconds, applied when the slider is let go (one undo step). */
function Duration({ value, onCommit }: { value: number; onCommit: (ms: number) => void }) {
  const [drag, setDrag] = useState<number | null>(null)
  return (
    <Slider
      label="Duration"
      value={drag ?? value}
      min={200}
      max={2000}
      step={100}
      onChange={setDrag}
      onCommit={(ms) => {
        setDrag(null)
        onCommit(ms)
      }}
      format={(ms) => `${(ms / 1000).toFixed(1)} s`}
    />
  )
}

/** How the selected objects come onto the slide when presenting, and when. */
export function AnimationControls({
  editor,
  animation,
  place,
}: {
  editor: Editor
  animation: ObjectAnimation | null
  place: { index: number; count: number } | null
}) {
  const set = (patch: Partial<ObjectAnimation> | null) => editor.setSelectedAnimation(patch)
  return (
    <>
      <Choices
        label="Entrance"
        columns={3}
        options={[['', 'None'] as [string, string], ...EFFECTS]}
        value={animation?.effect ?? ''}
        onChange={(effect) => set(effect ? { effect: effect as ObjectAnimation['effect'] } : null)}
      />
      {animation ? (
        <>
          <Choices
            label="Start"
            columns={3}
            options={STARTS}
            value={animation.start}
            onChange={(start) => start && set({ start })}
          />
          <Duration value={animation.duration} onCommit={(duration) => set({ duration })} />
          {place ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-ink-muted tabular-nums">
                Plays {place.index + 1} of {place.count}
              </span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  className={choice}
                  disabled={place.index === 0}
                  onClick={() => editor.moveSelectedAnimation(-1)}
                >
                  Earlier
                </button>
                <button
                  type="button"
                  className={choice}
                  disabled={place.index >= place.count - 1}
                  onClick={() => editor.moveSelectedAnimation(1)}
                >
                  Later
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-xs text-ink-muted">
          Animated objects appear one after another while presenting: each “On tap” waits for a tap
          or the arrow key.
        </p>
      )}
    </>
  )
}

/** How a slide comes in when presenting. */
export function TransitionControls({
  editor,
  index,
  transition,
}: {
  editor: Editor
  index: number
  transition: SlideTransition | undefined
}) {
  const [all, setAll] = useState(false)
  const set = (next: SlideTransition | null) => editor.setTransition(index, next, all)
  return (
    <>
      <Choices
        label="Transition"
        columns={3}
        options={[['', 'None'] as [string, string], ...TRANSITIONS]}
        value={transition?.effect ?? ''}
        onChange={(effect) =>
          set(
            effect
              ? {
                  ...(transition ?? DEFAULT_TRANSITION),
                  effect: effect as SlideTransition['effect'],
                }
              : null,
          )
        }
      />
      {transition ? (
        <Duration
          value={transition.duration}
          onCommit={(duration) => set({ ...transition, duration })}
        />
      ) : null}
      <Switch
        label="Apply to all slides"
        hint="Changes made here set every slide's transition"
        checked={all}
        onChange={(on) => {
          setAll(on)
          if (on) editor.setTransition(index, transition ?? null, true)
        }}
      />
    </>
  )
}
