import { compound, setLayers, setPageObjects, type Command } from '../commands/commands.ts'
import type { NotebookDocument } from '../document/NotebookDocument.ts'
import { createLayer } from '../model/factory.ts'
import { newId } from '../model/ids.ts'
import type { CanvasObject, Id, LayerDef } from '../model/types.ts'

/** The next free "Layer n" name. */
export function nextLayerName(layers: readonly LayerDef[]): string {
  let n = layers.length + 1
  const names = new Set(layers.map((l) => l.name))
  while (names.has(`Layer ${n}`)) n++
  return `Layer ${n}`
}

/** A new empty layer placed directly above `aboveId` (or on top). */
export function addLayer(doc: NotebookDocument, aboveId: Id | null): { command: Command; id: Id } {
  const before = doc.notebook.layers
  const layer = createLayer(nextLayerName(before))
  const index = before.findIndex((l) => l.id === aboveId)
  const after = [...before]
  after.splice(index < 0 ? after.length : index + 1, 0, layer)
  return { command: setLayers('Add layer', before, after), id: layer.id }
}

/** Removes a layer and everything on it, on every page, as one undoable step. */
export function removeLayer(doc: NotebookDocument, id: Id): Command | null {
  const before = doc.notebook.layers
  if (before.length <= 1 || !before.some((l) => l.id === id)) return null
  const commands: Command[] = [
    setLayers(
      'Delete layer',
      before,
      before.filter((l) => l.id !== id),
    ),
  ]
  for (const page of doc.pageList) {
    if (!page.objects.some((o) => o.layerId === id)) continue
    const kept = page.objects.filter((o) => o.layerId !== id)
    commands.push(setPageObjects('Delete layer', page.id, page.objects, kept))
  }
  return compound('Delete layer', commands)
}

/** Moves a layer one step up (toward the top, +1) or down (-1) in the drawing order. */
export function moveLayer(doc: NotebookDocument, id: Id, step: 1 | -1): Command | null {
  const before = doc.notebook.layers
  const index = before.findIndex((l) => l.id === id)
  const target = index + step
  if (index < 0 || target < 0 || target >= before.length) return null
  const after = [...before]
  after.splice(index, 1)
  after.splice(target, 0, before[index]!)
  return setLayers('Reorder layers', before, after)
}

/** Moves a layer to a place in the drawing order (0 is the bottom layer). */
export function placeLayer(doc: NotebookDocument, id: Id, index: number): Command | null {
  const before = doc.notebook.layers
  const from = before.findIndex((l) => l.id === id)
  const to = Math.max(0, Math.min(before.length - 1, index))
  if (from < 0 || from === to) return null
  const after = [...before]
  after.splice(from, 1)
  after.splice(to, 0, before[from]!)
  return setLayers('Reorder layers', before, after)
}

export type LayerPatch = Partial<Pick<LayerDef, 'name' | 'visible' | 'locked' | 'opacity' | 'clip'>>

export function patchLayer(layers: readonly LayerDef[], id: Id, patch: LayerPatch): LayerDef[] {
  return layers.map((l) => (l.id === id ? { ...l, ...patch } : l))
}

/** Whether objects on this layer may be drawn, erased, selected or typed. */
export function layerBlock(layer: LayerDef | undefined): 'hidden' | 'locked' | null {
  if (!layer) return null
  if (!layer.visible) return 'hidden'
  if (layer.locked) return 'locked'
  return null
}

/** Why a layer cannot be merged into the one below it, or null if it can. */
export function mergeDownBlock(
  layers: readonly LayerDef[],
  id: Id,
): 'bottom' | 'clip' | 'locked' | 'hidden' | null {
  const index = layers.findIndex((l) => l.id === id)
  const layer = layers[index]
  const below = layers[index - 1]
  if (!layer || !below) return 'bottom'
  // A clipping layer shows only over the one below; merged, it would spill out.
  if (layer.clip) return 'clip'
  if (layer.locked || below.locked) return 'locked'
  if (!layer.visible || !below.visible) return 'hidden'
  return null
}

/** An object drawn `factor` as opaque as before, where it has an opacity of its own. */
function fade(object: CanvasObject, factor: number): CanvasObject {
  if (factor >= 1) return object
  switch (object.type) {
    case 'stroke':
    case 'fill':
    case 'image':
      return { ...object, opacity: object.opacity * factor }
    case 'text':
      return { ...object, style: { ...object.style, opacity: object.style.opacity * factor } }
    default:
      return object
  }
}

/**
 * Merges a layer into the one below it, on every page: its content moves onto that layer, on
 * top of what is there, and the layer goes away. Content keeps its look as far as possible: a
 * layer fainter than the one below passes its opacity on to its objects. One undoable step.
 */
export function mergeLayerDown(doc: NotebookDocument, id: Id): Command | null {
  const before = doc.notebook.layers
  if (mergeDownBlock(before, id)) return null
  const index = before.findIndex((l) => l.id === id)
  const upper = before[index]!
  const lower = before[index - 1]!
  const factor = lower.opacity > 0 ? Math.min(1, upper.opacity / lower.opacity) : 1
  const commands: Command[] = [
    setLayers(
      'Merge layers',
      before,
      before.filter((l) => l.id !== id),
    ),
  ]
  for (const page of doc.pageList) {
    const moving = page.objects.filter((o) => o.layerId === id)
    if (!moving.length) continue
    // Later in the list draws on top within a layer: the merged objects come last.
    const after = [
      ...page.objects.filter((o) => o.layerId !== id),
      ...moving.map((o) => fade({ ...o, layerId: lower.id }, factor)),
    ]
    commands.push(setPageObjects('Merge layers', page.id, page.objects, after))
  }
  return compound('Merge layers', commands)
}

/**
 * A copy of a layer right above it, with copies of everything on it on every page. Returns the
 * command and the copy's id.
 */
export function duplicateLayer(doc: NotebookDocument, id: Id): { command: Command; id: Id } | null {
  const before = doc.notebook.layers
  const index = before.findIndex((l) => l.id === id)
  const source = before[index]
  if (!source) return null
  const copy: LayerDef = { ...source, id: newId(), name: `${source.name} copy` }
  const layers = [...before]
  layers.splice(index + 1, 0, copy)
  const commands: Command[] = [setLayers('Duplicate layer', before, layers)]
  for (const page of doc.pageList) {
    const copies = page.objects
      .filter((o) => o.layerId === id)
      .map((o) => ({ ...o, id: newId(), layerId: copy.id }))
    if (!copies.length) continue
    commands.push(
      setPageObjects('Duplicate layer', page.id, page.objects, [...page.objects, ...copies]),
    )
  }
  return { command: compound('Duplicate layer', commands), id: copy.id }
}
