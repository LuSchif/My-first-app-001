import { compound, setLayers, setPageObjects, type Command } from '../commands/commands.ts'
import type { NotebookDocument } from '../document/NotebookDocument.ts'
import { createLayer } from '../model/factory.ts'
import type { Id, LayerDef } from '../model/types.ts'

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

export type LayerPatch = Partial<Pick<LayerDef, 'name' | 'visible' | 'locked' | 'opacity'>>

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
