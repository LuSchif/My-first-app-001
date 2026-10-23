import { ArrowDown, ArrowUp, Eye, EyeOff, Lock, LockOpen, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { Editor, EditorState } from '../../engine/editor/Editor.ts'
import type { LayerDef } from '../../engine/model/types.ts'
import { Button, IconButton, Slider, TextField } from '../../design/index.ts'
import { cn } from '../../lib/cn.ts'

/**
 * The notebook's layers, top layer first. Tapping a row makes it the active layer: new ink, text
 * and selections go there. Its settings (name, opacity, order, delete) show below the list.
 */
export function LayersPanel({ editor, state }: { editor: Editor; state: EditorState }) {
  const topFirst = [...state.layers].reverse()
  const index = state.layers.findIndex((l) => l.id === state.activeLayerId)
  const active = state.layers[index]
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Layers</p>
        <Button variant="ghost" icon={<Plus size={16} />} onClick={() => editor.addLayer()}>
          New layer
        </Button>
      </div>
      <ul className="grid max-h-[40vh] gap-1 overflow-y-auto" aria-label="Layers, top first">
        {topFirst.map((layer) => (
          <LayerRow
            key={layer.id}
            editor={editor}
            layer={layer}
            active={layer.id === state.activeLayerId}
          />
        ))}
      </ul>
      {active ? (
        <ActiveLayerSettings
          // A new key starts the name field and delete confirmation over for another layer.
          key={`${active.id}:${active.name}`}
          editor={editor}
          layer={active}
          isTop={index === state.layers.length - 1}
          isBottom={index === 0}
          only={state.layers.length <= 1}
        />
      ) : null}
    </div>
  )
}

function LayerRow({ editor, layer, active }: { editor: Editor; layer: LayerDef; active: boolean }) {
  return (
    <li
      className={cn(
        'flex items-center gap-1 rounded-control pr-1 ring-1 ring-line',
        active && 'bg-ink text-ink-inverse ring-ink',
      )}
    >
      <button
        type="button"
        aria-pressed={active}
        onClick={() => editor.setActiveLayer(layer.id)}
        className="flex min-h-11 min-w-0 flex-1 items-center px-3 text-left"
      >
        <span className={cn('truncate text-sm font-semibold', !layer.visible && 'opacity-55')}>
          {layer.name}
        </span>
      </button>
      <IconButton
        label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
        icon={layer.visible ? <Eye size={18} /> : <EyeOff size={18} />}
        className={cn(active && 'text-ink-inverse hover:bg-white/10')}
        onClick={() => editor.updateLayer(layer.id, { visible: !layer.visible })}
      />
      <IconButton
        label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
        icon={layer.locked ? <Lock size={18} /> : <LockOpen size={18} className="opacity-55" />}
        className={cn(active && 'text-ink-inverse hover:bg-white/10')}
        onClick={() => editor.updateLayer(layer.id, { locked: !layer.locked })}
      />
    </li>
  )
}

function ActiveLayerSettings({
  editor,
  layer,
  isTop,
  isBottom,
  only,
}: {
  editor: Editor
  layer: LayerDef
  isTop: boolean
  isBottom: boolean
  only: boolean
}) {
  const [name, setName] = useState(layer.name)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const rename = () => {
    const trimmed = name.trim()
    if (trimmed && trimmed !== layer.name) editor.updateLayer(layer.id, { name: trimmed })
    else setName(layer.name)
  }

  return (
    <div className="grid gap-3 border-t border-line pt-3">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          rename()
          ;(document.activeElement as HTMLElement | null)?.blur()
        }}
      >
        <TextField
          label="Name"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          onBlur={rename}
          enterKeyHint="done"
        />
      </form>
      <Slider
        label="Opacity"
        value={Math.round(layer.opacity * 100)}
        min={0}
        max={100}
        onChange={(v) => editor.setLayerOpacity(layer.id, v / 100, false)}
        onCommit={(v) => editor.setLayerOpacity(layer.id, v / 100, true)}
        format={(v) => `${v}%`}
      />
      <div className="flex flex-wrap gap-1">
        <Button
          variant="ghost"
          icon={<ArrowUp size={16} />}
          disabled={isTop}
          onClick={() => editor.moveLayer(layer.id, 1)}
        >
          Move up
        </Button>
        <Button
          variant="ghost"
          icon={<ArrowDown size={16} />}
          disabled={isBottom}
          onClick={() => editor.moveLayer(layer.id, -1)}
        >
          Move down
        </Button>
      </div>
      {confirmDelete ? (
        <Button
          variant="danger"
          icon={<Trash2 size={18} />}
          onClick={() => editor.deleteLayer(layer.id)}
        >
          Delete {layer.name} and its content
        </Button>
      ) : (
        <Button
          variant="ghost"
          className="justify-start text-danger"
          icon={<Trash2 size={18} />}
          disabled={only}
          onClick={() => setConfirmDelete(true)}
        >
          Delete layer…
        </Button>
      )}
      {only ? <p className="text-xs text-ink-muted">A notebook keeps at least one layer.</p> : null}
    </div>
  )
}
