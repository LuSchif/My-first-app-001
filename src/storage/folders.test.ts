import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { createFolder, createNotebook } from '../engine/model/factory.ts'
import { BroomitDatabase } from './db.ts'
import {
  createFolderRecord,
  deleteFolder,
  duplicateFolder,
  listFolders,
  moveFolder,
  moveNotebook,
  reorderFolders,
} from './folders.ts'
import { createNotebookRecord, listNotebooks } from './notebooks.ts'

let dbCount = 0
const freshDb = () => new BroomitDatabase(`folders-${++dbCount}`)
const fill = { type: 'solid', color: '#b98b65' } as const

async function setup() {
  const database = freshDb()
  const school = createFolder({ name: 'School', fill, icon: 'GraduationCap', order: 0 })
  const math = createFolder({
    name: 'Math',
    fill,
    icon: 'Calculator',
    parentId: school.id,
    order: 0,
  })
  const home = createFolder({ name: 'Home', fill, icon: 'House', order: 1 })
  for (const f of [school, math, home]) await createFolderRecord(f, database)
  const algebra = createNotebook({
    title: 'Algebra',
    paper: 'grid',
    cover: fill,
    folderId: math.id,
  })
  const notes = createNotebook({ title: 'Notes', paper: 'lined', cover: fill, folderId: school.id })
  await createNotebookRecord(algebra.notebook, algebra.pages, database)
  await createNotebookRecord(notes.notebook, notes.pages, database)
  return { database, school, math, home, algebra: algebra.notebook, notes: notes.notebook }
}

describe('folders', () => {
  it('orders folders and moves notebooks and folders', async () => {
    const { database, school, math, home, notes } = await setup()
    await reorderFolders([home.id, school.id], database)
    expect((await listFolders(database)).filter((f) => !f.parentId).map((f) => f.name)).toEqual([
      'Home',
      'School',
    ])
    await moveNotebook(notes.id, home.id, database)
    expect((await database.notebooks.get(notes.id))?.folderId).toBe(home.id)
    await expect(moveFolder(school.id, math.id, database)).rejects.toThrow()
    await moveFolder(math.id, null, database)
    expect((await database.folders.get(math.id))?.parentId).toBeNull()
  })

  it('deletes a folder keeping its contents, or with everything in it', async () => {
    const a = await setup()
    await deleteFolder(a.school.id, true, a.database)
    expect((await a.database.notebooks.get(a.notes.id))?.folderId).toBeNull()
    expect((await a.database.folders.get(a.math.id))?.parentId).toBeNull()

    const b = await setup()
    await deleteFolder(b.school.id, false, b.database)
    expect((await listNotebooks(b.database)).map((n) => n.title)).toEqual([])
    expect((await listFolders(b.database)).map((f) => f.name)).toEqual(['Home'])
    expect(await b.database.pages.count()).toBe(0)
  })

  it('duplicates a folder with its folders and notebooks, right after it', async () => {
    const { database, school } = await setup()
    const copyId = await duplicateFolder(school.id, database)
    const folders = await listFolders(database)
    expect(folders.filter((f) => !f.parentId).map((f) => f.name)).toEqual([
      'School',
      'School copy',
      'Home',
    ])
    const sub = folders.find((f) => f.parentId === copyId)
    expect(sub?.name).toBe('Math')
    const notebooks = await listNotebooks(database)
    expect(notebooks.filter((n) => n.folderId === sub?.id).map((n) => n.title)).toEqual(['Algebra'])
    expect(notebooks).toHaveLength(4)
    expect(await database.pages.count()).toBe(4)
  })
})
