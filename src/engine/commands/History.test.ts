import { describe, expect, it } from 'vitest'
import { NotebookDocument } from '../document/NotebookDocument.ts'
import { createNotebook, createPage } from '../model/factory.ts'
import type { StrokeObject } from '../model/types.ts'
import { insertPages, removePage, setPageObjects } from './commands.ts'
import { History } from './History.ts'

function setup() {
  const { notebook, pages } = createNotebook({
    title: 'Biology',
    paper: 'lined',
    cover: { type: 'solid', color: '#b98b65' },
  })
  const doc = new NotebookDocument(notebook, pages)
  return { doc, history: new History(doc), pageId: pages[0]!.id, layerId: notebook.layers[0]!.id }
}

function stroke(layerId: string, id: string): StrokeObject {
  return {
    id,
    type: 'stroke',
    layerId,
    tool: 'pen',
    color: '#000000',
    width: 2,
    opacity: 1,
    points: [0, 0, 10, 10],
  }
}

describe('History', () => {
  it('undoes and redoes object changes', () => {
    const { doc, history, pageId, layerId } = setup()
    const before = doc.page(pageId)!.objects
    history.execute(setPageObjects('Draw', pageId, before, [stroke(layerId, 'a')]))
    expect(doc.page(pageId)!.objects).toHaveLength(1)
    history.undo()
    expect(doc.page(pageId)!.objects).toHaveLength(0)
    history.redo()
    expect(doc.page(pageId)!.objects[0]!.id).toBe('a')
  })

  it('clears redo after a new change', () => {
    const { history, pageId, layerId } = setup()
    history.execute(setPageObjects('Draw', pageId, [], [stroke(layerId, 'a')]))
    history.undo()
    history.execute(setPageObjects('Draw', pageId, [], [stroke(layerId, 'b')]))
    expect(history.canRedo).toBe(false)
  })

  it('adds and removes pages reversibly', () => {
    const { doc, history, pageId } = setup()
    const extra = createPage(doc.notebook.id, 'grid')
    history.execute(insertPages('Add page', 1, [extra]))
    expect(doc.notebook.pageIds).toEqual([pageId, extra.id])
    history.execute(removePage('Delete page', pageId))
    expect(doc.pageList.map((p) => p.id)).toEqual([extra.id])
    history.undo()
    history.undo()
    expect(doc.notebook.pageIds).toEqual([pageId])
  })
})

describe('NotebookDocument unsaved changes', () => {
  it('reports changed pages once and can restore them after a failed save', () => {
    const { doc, history, pageId, layerId } = setup()
    expect(doc.takeUnsaved()).toBeNull()
    history.execute(setPageObjects('Draw', pageId, [], [stroke(layerId, 'a')]))
    const changes = doc.takeUnsaved()!
    expect(changes.pages.map((p) => p.id)).toEqual([pageId])
    expect(doc.takeUnsaved()).toBeNull()
    doc.restoreDirty(changes)
    expect(doc.hasUnsavedChanges()).toBe(true)
  })

  it('saves the new page order after a page is removed', () => {
    const { doc, history, pageId } = setup()
    const extra = createPage(doc.notebook.id, 'lined')
    history.execute(insertPages('Add page', 1, [extra]))
    doc.takeUnsaved()
    history.execute(removePage('Delete page', extra.id))
    const changes = doc.takeUnsaved()!
    expect(changes.notebook.pageIds).toEqual([pageId])
    expect(changes.pages).toEqual([])
  })
})
