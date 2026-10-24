import {
  ArrowDown,
  ArrowUp,
  CornerLeftDown,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  Plus,
  TextCursorInput,
  Trash2,
  Type,
} from 'lucide-react'
import { useState } from 'react'
import type { Editor, EditorState } from '../../engine/editor/Editor.ts'
import type { LayerDef } from '../../engine/model/types.ts'
import {
  Button,
  ColorPicker,
  ColorSwatch,
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Slider,
  Switch,
  TextField,
  useClosePopover,
} from '../../design/index.ts'
import { PAPER_STYLE } from '../../engine/render/paper.ts'
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
        <BackgroundRow editor={editor} color={state.background ?? PAPER_STYLE.paper} />
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

/** The background below all layers, like in Procreate: a color you can change at any time. */
function BackgroundRow({ editor, color }: { editor: Editor; color: string }) {
  return (
    <li className="flex items-center gap-2 rounded-control py-1 pr-1 pl-3 ring-1 ring-line">
      <span className="flex-1 text-sm font-semibold">Background</span>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Background color"
            className="grid size-11 place-items-center rounded-control hover:bg-hover"
          >
            <span
              className="size-7 rounded-md ring-1 ring-line-strong"
              style={{ background: color }}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="grid w-80 gap-3">
          <p className="text-sm font-semibold">Background color</p>
          <ColorSwatch
            label="White"
            fill={{ type: 'solid', color: '#ffffff' }}
            selected={color === '#ffffff'}
            onSelect={() => editor.setBackground('#ffffff', true)}
          />
          <ColorPicker
            value={color}
            onChange={(next) => editor.setBackground(next, false)}
            onCommit={() => editor.commitBackground()}
          />
        </PopoverContent>
      </Popover>
    </li>
  )
}

/** Opens the text of a text layer on the page, ready to type. */
function EditTextButton({
  editor,
  layer,
  active,
}: {
  editor: Editor
  layer: LayerDef
  active: boolean
}) {
  const close = useClosePopover()
  return (
    <IconButton
      label={`Edit text: ${layer.name}`}
      icon={<TextCursorInput size={18} />}
      className={cn(active && 'text-ink-inverse hover:bg-white/10')}
      onClick={() => {
        close()
        editor.editLayerText(layer.id)
      }}
    />
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
        {layer.kind === 'text' ? (
          <Type size={16} aria-label="Text layer" className="mr-1.5 shrink-0 opacity-75" />
        ) : null}
        {layer.clip ? (
          <CornerLeftDown
            size={16}
            aria-label="Clipped to the layer below"
            className="mr-1.5 shrink-0 opacity-75"
          />
        ) : null}
        <span className={cn('truncate text-sm font-semibold', !layer.visible && 'opacity-55')}>
          {layer.name}
        </span>
      </button>
      {layer.kind === 'text' ? (
        <EditTextButton editor={editor} layer={layer} active={active} />
      ) : null}
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
      {isBottom ? null : (
        <Switch
          label="Clipping mask"
          hint="Show this layer only where the layer below has content"
          checked={Boolean(layer.clip)}
          onChange={(clip) => editor.updateLayer(layer.id, { clip })}
        />
      )}
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
