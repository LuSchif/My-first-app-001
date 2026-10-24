import { describe, expect, it } from 'vitest'
import { History } from '../commands/History.ts'
import { NotebookDocument } from '../document/NotebookDocument.ts'
import { createNotebook } from '../model/factory.ts'
import type { StrokeObject } from '../model/types.ts'
import { layerGroups } from '../render/layers.ts'
import { setLayers, setPageObjects } from '../commands/commands.ts'
import {
  addLayer,
  duplicateLayer,
  mergeDownBlock,
  mergeLayerDown,
  moveLayer,
  nextLayerName,
  removeLayer,
} from './layers.ts'

function setup() {
  const { notebook, pages } = createNotebook({
    title: 'Test',
    paper: 'blank',
    cover: { type: 'solid', color: '#b98b65' },
  })
  const doc = new NotebookDocument(notebook, pages)
  return { doc, history: new History(doc), pageId: pages[0]!.id }
}

const stroke = (id: string, layerId: string): StrokeObject => ({
  id,
  type: 'stroke',
  layerId,
  tool: 'pen',
  color: '#000000',
  width: 2,
  opacity: 1,
  points: [0, 0, 10, 10],
})

describe('layers', () => {
  it('adds a layer above the given one with the next free name', () => {
    const { doc, history } = setup()
    const bottom = doc.notebook.layers[0]!.id
    history.execute(addLayer(doc, bottom).command)
    history.execute(addLayer(doc, bottom).command)
    expect(doc.notebook.layers.map((l) => l.name)).toEqual(['Layer 1', 'Layer 3', 'Layer 2'])
    expect(nextLayerName(doc.notebook.layers)).toBe('Layer 4')
  })

  it('reorders and undoes', () => {
    const { doc, history } = setup()
    const { command, id } = addLayer(doc, null)
    history.execute(command)
    history.execute(moveLayer(doc, id, -1)!)
    expect(doc.notebook.layers[0]!.id).toBe(id)
    expect(moveLayer(doc, id, -1)).toBeNull()
    history.undo()
    expect(doc.notebook.layers[1]!.id).toBe(id)
  })

  it('removes a layer with its content on every page in one undo step', () => {
    const { doc, history, pageId } = setup()
    const first = doc.notebook.layers[0]!.id
    const { command, id } = addLayer(doc, null)
    history.execute(command)
    doc.setObjects(pageId, [stroke('a', first), stroke('b', id)])

    history.execute(removeLayer(doc, id)!)
    expect(doc.notebook.layers.map((l) => l.id)).toEqual([first])
    expect(doc.page(pageId)!.objects.map((o) => o.id)).toEqual(['a'])

    history.undo()
    expect(doc.notebook.layers).toHaveLength(2)
    expect(doc.page(pageId)!.objects.map((o) => o.id)).toEqual(['a', 'b'])
  })

  it('keeps the last layer', () => {
    const { doc } = setup()
    expect(removeLayer(doc, doc.notebook.layers[0]!.id)).toBeNull()
  })
})

describe('clipping masks', () => {
  it('groups clipped layers with the nearest unclipped layer below', () => {
    const layer = (id: string, clip = false) => ({
      id,
      name: id,
      visible: true,
      locked: false,
      opacity: 1,
      clip,
    })
    const groups = layerGroups([
      layer('a', true),
      layer('b'),
      layer('c', true),
      layer('d', true),
      layer('e'),
    ])
    expect(groups.map((g) => [g.base.id, g.clipped.map((l) => l.id)])).toEqual([
      ['a', []],
      ['b', ['c', 'd']],
      ['e', []],
    ])
  })

  it('merges a layer into the one below, on top of its content, and undoes', () => {
    const { doc, history, pageId } = setup()
    const bottom = doc.notebook.layers[0]!.id
    const { command, id: top } = addLayer(doc, bottom)
    history.execute(command)
    const page = doc.page(pageId)!
    history.execute(
      setPageObjects('Draw', pageId, page.objects, [
        stroke('a', top),
        stroke('b', bottom),
        stroke('c', top),
      ]),
    )
    // Half as opaque as the layer below: the merged strokes take that on.
    history.execute(
      setLayers(
        'Layer',
        doc.notebook.layers,
        doc.notebook.layers.map((l) => (l.id === top ? { ...l, opacity: 0.5 } : l)),
      ),
    )
    history.execute(mergeLayerDown(doc, top)!)
    expect(doc.notebook.layers.map((l) => l.id)).toEqual([bottom])
    const merged = doc.page(pageId)!.objects as StrokeObject[]
    expect(merged.map((o) => [o.id, o.layerId, o.opacity])).toEqual([
      ['b', bottom, 1],
      ['a', bottom, 0.5],
      ['c', bottom, 0.5],
    ])
    history.undo()
    expect(doc.notebook.layers).toHaveLength(2)
    expect(doc.page(pageId)!.objects.map((o) => o.layerId)).toEqual([top, bottom, top])
  })

  it('does not merge the bottom layer, a clipping layer, or into a locked layer', () => {
    const { doc, history } = setup()
    const bottom = doc.notebook.layers[0]!.id
    const { command, id: top } = addLayer(doc, bottom)
    history.execute(command)
    expect(mergeDownBlock(doc.notebook.layers, bottom)).toBe('bottom')
    const clipped = doc.notebook.layers.map((l) => (l.id === top ? { ...l, clip: true } : l))
    expect(mergeDownBlock(clipped, top)).toBe('clip')
    const locked = doc.notebook.layers.map((l) => (l.id === bottom ? { ...l, locked: true } : l))
    expect(mergeDownBlock(locked, top)).toBe('locked')
    expect(mergeDownBlock(doc.notebook.layers, top)).toBeNull()
  })

  it('duplicates a layer with copies of its content right above it', () => {
    const { doc, history, pageId } = setup()
    const bottom = doc.notebook.layers[0]!.id
    const page = doc.page(pageId)!
    history.execute(setPageObjects('Draw', pageId, page.objects, [stroke('a', bottom)]))
    const result = duplicateLayer(doc, bottom)!
    history.execute(result.command)
    expect(doc.notebook.layers.map((l) => l.name)).toEqual(['Layer 1', 'Layer 1 copy'])
    const objects = doc.page(pageId)!.objects
    expect(objects).toHaveLength(2)
    expect(objects[1]!.layerId).toBe(result.id)
    expect(objects[1]!.id).not.toBe('a')
  })
})
