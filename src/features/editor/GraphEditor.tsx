import { ChartSpline, X } from 'lucide-react'
import { useState } from 'react'
import type { Editor, EditorState } from '../../engine/editor/Editor.ts'
import { fitGraphFrame } from '../../engine/model/graph.ts'
import type { GraphObject } from '../../engine/model/types.ts'
import { Button, Dialog, DialogContent, Slider, Switch, TextField } from '../../design/index.ts'
import { ObjectPreview } from './ObjectPreview.tsx'

const CHIP_HEIGHT = 48
const GAP = 12

/**
 * Edits a graph: ticks along each axis with their own spacing, the axes' names and a title.
 * Changes are kept as a draft and saved together, as one undo step.
 */
export function GraphEditor({
  editor,
  graph,
  open,
  onOpenChange,
}: {
  editor: Editor
  graph: GraphObject
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <GraphEditorContent editor={editor} graph={graph} onDone={() => onOpenChange(false)} />
      ) : null}
    </Dialog>
  )
}

/** A graph opened for the first time starts with ticks and the usual axis names. */
function startingDraft(graph: GraphObject): GraphObject {
  const untouched =
    !graph.ticks.show && !graph.labels.x && !graph.labels.y && !graph.labels.z && !graph.title
  if (!untouched) return graph
  return {
    ...graph,
    ticks: { ...graph.ticks, show: true },
    labels: { x: 'x', y: 'y', z: graph.depth ? 'z' : '' },
  }
}

function GraphEditorContent({
  editor,
  graph,
  onDone,
}: {
  editor: Editor
  graph: GraphObject
  onDone: () => void
}) {
  const [draft, setDraft] = useState(() => startingDraft(graph))
  const shown = fitGraphFrame(draft)
  const depthLength = draft.depth ? Math.hypot(draft.depth.toX, draft.depth.toY) : 0
  // Spacing from a few points up to half the axis.
  const most = (length: number) => Math.max(8, Math.round(length / 2))
  const spacing = (axis: 'x' | 'y' | 'z', label: string, length: number) => (
    <Slider
      label={label}
      value={Math.round(draft.ticks[axis])}
      min={4}
      max={most(length)}
      onChange={(v) => setDraft((g) => ({ ...g, ticks: { ...g.ticks, [axis]: v } }))}
      format={(v) => `${v} pt`}
    />
  )
  const name = (axis: 'x' | 'y' | 'z', label: string) => (
    <TextField
      label={label}
      value={draft.labels[axis]}
      placeholder="No name"
      onChange={(e) => {
        const value = e.target.value
        setDraft((g) => ({ ...g, labels: { ...g.labels, [axis]: value } }))
      }}
    />
  )

  return (
    <DialogContent title="Edit graph" className="w-[min(46rem,calc(100%-2rem))]">
      <div className="grid gap-5">
        <ObjectPreview object={shown} height={260} />
        <TextField
          label="Title"
          value={draft.title}
          placeholder="No title"
          onChange={(e) => {
            const title = e.target.value
            setDraft((g) => ({ ...g, title }))
          }}
        />
        <section className="grid gap-4">
          <Switch
            label="Ticks"
            hint="Evenly spaced marks along the axes"
            checked={draft.ticks.show}
            onChange={(show) => setDraft((g) => ({ ...g, ticks: { ...g.ticks, show } }))}
          />
          {draft.ticks.show ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {spacing('x', 'X spacing', Math.max(draft.right, -draft.left))}
              {spacing('y', 'Y spacing', Math.max(-draft.top, draft.bottom))}
              {draft.depth ? spacing('z', 'Z spacing', depthLength) : null}
            </div>
          ) : null}
        </section>
        <section className="grid gap-3 sm:grid-cols-3">
          {name('x', 'X axis name')}
          {name('y', 'Y axis name')}
          {draft.depth ? name('z', 'Z axis name') : null}
        </section>
        <Slider
          label="Text size"
          value={Math.round(draft.fontSize)}
          min={8}
          max={48}
          onChange={(fontSize) => setDraft((g) => ({ ...g, fontSize }))}
          format={(v) => `${v} pt`}
        />
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            editor.updateObject(fitGraphFrame(draft), 'Edit graph')
            onDone()
          }}
        >
          Done
        </Button>
      </div>
    </DialogContent>
  )
}

/** Right after a graph was recognized: says so, and opens its editor. */
export function GraphOfferChip({ editor, state }: { editor: Editor; state: EditorState }) {
  const [editing, setEditing] = useState<GraphObject | null>(null)
  const offer = state.graphOffer
  const found = offer ? editor.findObject(offer.id) : null
  const graph = found?.object.type === 'graph' ? found.object : null
  return (
    <>
      {offer && graph && !state.selection ? (
        <div
          className="absolute z-10 flex w-max -translate-x-1/2 animate-pop-in items-center gap-0.5 rounded-panel bg-ink p-1 text-ink-inverse shadow-overlay"
          style={{
            top:
              offer.rect.y - CHIP_HEIGHT - GAP > 72
                ? offer.rect.y - CHIP_HEIGHT - GAP
                : offer.rect.y + offer.rect.height + GAP,
            left: `clamp(10rem, ${offer.rect.x + offer.rect.width / 2}px, calc(100% - 10rem))`,
          }}
        >
          <button
            type="button"
            onClick={() => {
              setEditing(graph)
              editor.dismissGraphOffer()
            }}
            className="flex h-10 items-center gap-2 rounded-control px-3 text-sm font-semibold hover:bg-white/10 active:bg-white/15"
          >
            <ChartSpline size={18} />
            Graph recognized · Edit
          </button>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => editor.dismissGraphOffer()}
            className="grid size-10 place-items-center rounded-control text-ink-inverse/70 hover:bg-white/10"
          >
            <X size={16} />
          </button>
        </div>
      ) : null}
      {editing ? (
        <GraphEditor
          editor={editor}
          graph={editing}
          open
          onOpenChange={(open) => !open && setEditing(null)}
        />
      ) : null}
    </>
  )
}
