import { describe, expect, it } from 'vitest'
import { History } from '../commands/History.ts'
import { NotebookDocument } from '../document/NotebookDocument.ts'
import { createNotebook } from '../model/factory.ts'
import type { StrokeObject } from '../model/types.ts'
import { addLayer, moveLayer, nextLayerName, removeLayer } from './layers.ts'

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
