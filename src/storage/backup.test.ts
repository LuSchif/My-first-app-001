import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { createNotebook } from '../engine/model/factory.ts'
import { BackupError, backupFileName, createBackup, parseBackup, restoreBackup } from './backup.ts'
import { BroomitDatabase } from './db.ts'
import {
  createNotebookRecord,
  getAssetBlob,
  listNotebooks,
  loadNotebook,
  putAsset,
} from './notebooks.ts'

let dbCount = 0
const freshDb = () => new BroomitDatabase(`backup-${++dbCount}`)
const notebook = (title: string) =>
  createNotebook({ title, paper: 'grid', cover: { type: 'solid', color: '#795a46' } })

describe('backup', () => {
  it('restores everything into an empty database', async () => {
    const source = freshDb()
    const a = notebook('Physics')
    const b = notebook('Drawing')
    await createNotebookRecord(a.notebook, a.pages, source)
    await createNotebookRecord(b.notebook, b.pages, source)

    const text = JSON.stringify(await createBackup(source))
    const target = freshDb()
    expect(await restoreBackup(parseBackup(text), target)).toBe(2)
    expect((await listNotebooks(target)).map((n) => n.title).sort()).toEqual(['Drawing', 'Physics'])
    expect((await loadNotebook(a.notebook.id, target))?.pages).toHaveLength(1)
  })

  it('carries pictures along', async () => {
    const source = freshDb()
    const a = notebook('Photos')
    await createNotebookRecord(a.notebook, a.pages, source)
    const blob = new Blob([new Uint8Array([137, 80, 78, 71, 1, 2, 3])], { type: 'image/png' })
    await putAsset({ id: 'pic', notebookId: a.notebook.id, blob, width: 4, height: 3 }, source)
    const text = JSON.stringify(await createBackup(source))
    const target = freshDb()
    await restoreBackup(parseBackup(text), target)
    const restored = await getAssetBlob('pic', target)
    expect(restored?.type).toBe('image/png')
    expect([...new Uint8Array(await restored!.arrayBuffer())]).toEqual([137, 80, 78, 71, 1, 2, 3])
  })

  it('keeps notebooks that are not in the backup', async () => {
    const database = freshDb()
    const a = notebook('Kept')
    await createNotebookRecord(a.notebook, a.pages, database)
    const other = freshDb()
    const b = notebook('Restored')
    await createNotebookRecord(b.notebook, b.pages, other)
    await restoreBackup(await createBackup(other), database)
    expect(await listNotebooks(database)).toHaveLength(2)
  })

  it('rejects files that are not backups without changing anything', () => {
    expect(() => parseBackup('hello')).toThrow(BackupError)
    expect(() => parseBackup('{"format":"other"}')).toThrow(BackupError)
    expect(() =>
      parseBackup(
        '{"format":"broomit-backup","version":1,"folders":[],"notebooks":[{}],"pages":[]}',
      ),
    ).toThrow('damaged')
  })

  it('names files by date', () => {
    expect(backupFileName(new Date(2026, 9, 3))).toBe('broomit-backup-2026-10-03.json')
  })
})
