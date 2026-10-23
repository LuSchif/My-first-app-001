import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { createNotebook } from '../engine/model/factory.ts'
import { BroomitDatabase } from './db.ts'
import { createNotebookFile, importNotebookFile, NotebookFileError } from './notebookFile.ts'
import {
  createNotebookRecord,
  getAssetBlob,
  listNotebooks,
  loadNotebook,
  putAsset,
} from './notebooks.ts'

describe('.broomit files', () => {
  it('round-trips a notebook with a picture as a new copy', async () => {
    const database = new BroomitDatabase('file-1')
    const { notebook, pages } = createNotebook({
      title: 'Trip',
      paper: 'dotted',
      cover: { type: 'solid', color: '#4a80c0' },
    })
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' })
    await putAsset({ id: 'a1', notebookId: notebook.id, blob, width: 1, height: 1 }, database)
    pages[0]!.objects.push({
      id: 'img',
      type: 'image',
      layerId: notebook.layers[0]!.id,
      assetId: 'a1',
      opacity: 1,
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      rotation: 0,
    })
    await createNotebookRecord(notebook, pages, database)

    const file = await createNotebookFile(notebook, pages, database)
    const id = await importNotebookFile(await file.text(), database)
    expect(id).not.toBe(notebook.id)
    expect(await listNotebooks(database)).toHaveLength(2)
    const copy = await loadNotebook(id, database)
    const image = copy!.pages[0]!.objects[0]!
    expect(image.type === 'image' && image.assetId).not.toBe('a1')
    const restored = image.type === 'image' ? await getAssetBlob(image.assetId, database) : null
    expect(restored?.type).toBe('image/jpeg')
  })

  it('rejects other files', async () => {
    await expect(
      importNotebookFile('{"format":"x"}', new BroomitDatabase('file-2')),
    ).rejects.toThrow(NotebookFileError)
  })
})
