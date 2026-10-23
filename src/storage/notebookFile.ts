import { newId } from '../engine/model/ids.ts'
import { SCHEMA_VERSION, type Notebook, type Page } from '../engine/model/types.ts'
import { decodeAsset, encodeAsset, type BackupAsset } from './backup.ts'
import { db, type BroomitDatabase } from './db.ts'

/**
 * A `.broomit` file: one notebook (or some of its pages) with its pictures, to share or move to
 * another device and keep editing there.
 */
export interface NotebookFile {
  format: 'broomit-notebook'
  version: 1
  exportedAt: number
  notebook: Notebook
  pages: Page[]
  assets: BackupAsset[]
}

export const NOTEBOOK_FILE_EXTENSION = '.broomit'

export async function createNotebookFile(
  notebook: Notebook,
  pages: Page[],
  database: BroomitDatabase = db,
): Promise<Blob> {
  const assetIds = new Set<string>()
  for (const page of pages) {
    for (const o of page.objects) if (o.type === 'image') assetIds.add(o.assetId)
  }
  const assets = (await database.assets.bulkGet([...assetIds])).filter((a) => a !== undefined)
  const file: NotebookFile = {
    format: 'broomit-notebook',
    version: 1,
    exportedAt: Date.now(),
    notebook: { ...notebook, pageIds: pages.map((p) => p.id) },
    pages,
    assets: await Promise.all(assets.map(encodeAsset)),
  }
  return new Blob([JSON.stringify(file)], { type: 'application/json' })
}

export class NotebookFileError extends Error {}

/**
 * Adds the notebook from a `.broomit` file as a new notebook. Everything gets new ids, so the
 * same file can be opened twice without one copy replacing the other.
 */
export async function importNotebookFile(
  text: string,
  database: BroomitDatabase = db,
): Promise<string> {
  let file: Partial<NotebookFile> | null
  try {
    file = JSON.parse(text) as Partial<NotebookFile> | null
  } catch {
    throw new NotebookFileError('This file is not a Broomit notebook.')
  }
  if (!file || file.format !== 'broomit-notebook' || !file.notebook || !Array.isArray(file.pages)) {
    throw new NotebookFileError('This file is not a Broomit notebook.')
  }
  if (file.version !== 1) {
    throw new NotebookFileError('This notebook was made by a newer version of Broomit.')
  }
  const notebookId = newId()
  const pageIds = new Map(file.pages.map((p) => [p.id, newId()]))
  const assetIds = new Map((file.assets ?? []).map((a) => [a.id, newId()]))
  const now = Date.now()
  const pages: Page[] = file.pages.map((page) => ({
    ...page,
    id: pageIds.get(page.id)!,
    notebookId,
    schemaVersion: SCHEMA_VERSION,
    updatedAt: now,
    objects: page.objects.map((o) =>
      o.type === 'image' ? { ...o, assetId: assetIds.get(o.assetId) ?? o.assetId } : o,
    ),
  }))
  const notebook: Notebook = {
    ...file.notebook,
    id: notebookId,
    folderId: null,
    schemaVersion: SCHEMA_VERSION,
    pageIds: pages.map((p) => p.id),
    createdAt: now,
    updatedAt: now,
  }
  const assets = (file.assets ?? []).map((a) =>
    decodeAsset({ ...a, id: assetIds.get(a.id)!, notebookId }),
  )
  await database.transaction(
    'rw',
    [database.notebooks, database.pages, database.assets],
    async () => {
      await database.notebooks.add(notebook)
      await database.pages.bulkAdd(pages)
      await database.assets.bulkAdd(assets)
    },
  )
  return notebookId
}
