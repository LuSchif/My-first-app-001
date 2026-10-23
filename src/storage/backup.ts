import type { Folder, Notebook, Page } from '../engine/model/types.ts'
import { db, type BroomitDatabase } from './db.ts'

/**
 * A backup is one JSON file with everything Broomit stores: folders, notebooks and pages. It is
 * the user's safety net against lost devices and cleared browser data, so restoring never deletes
 * anything: items from the backup are added, and items with the same id are replaced.
 */
export interface Backup {
  format: 'broomit-backup'
  version: 1
  exportedAt: number
  folders: Folder[]
  notebooks: Notebook[]
  pages: Page[]
}

export async function createBackup(database: BroomitDatabase = db): Promise<Backup> {
  return database.transaction(
    'r',
    database.folders,
    database.notebooks,
    database.pages,
    async () => ({
      format: 'broomit-backup' as const,
      version: 1 as const,
      exportedAt: Date.now(),
      folders: await database.folders.toArray(),
      notebooks: await database.notebooks.toArray(),
      pages: await database.pages.toArray(),
    }),
  )
}

export function backupFileName(date = new Date()): string {
  const day = [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((n) => String(n).padStart(2, '0'))
    .join('-')
  return `broomit-backup-${day}.json`
}

export class BackupError extends Error {}

/** Checks a parsed file before anything is written, so a wrong file changes nothing. */
export function parseBackup(text: string): Backup {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new BackupError('This file is not a Broomit backup.')
  }
  const b = data as Partial<Backup> | null
  if (!b || b.format !== 'broomit-backup') {
    throw new BackupError('This file is not a Broomit backup.')
  }
  if (b.version !== 1) {
    throw new BackupError('This backup was made by a newer version of Broomit.')
  }
  if (!Array.isArray(b.notebooks) || !Array.isArray(b.pages) || !Array.isArray(b.folders)) {
    throw new BackupError('This backup is incomplete.')
  }
  const isRecord = (v: unknown): v is { id: unknown } => typeof v === 'object' && v !== null
  const valid =
    b.notebooks.every(
      (n) =>
        isRecord(n) &&
        typeof n.id === 'string' &&
        Array.isArray(n.pageIds) &&
        Array.isArray(n.layers),
    ) &&
    b.pages.every(
      (p) =>
        isRecord(p) &&
        typeof p.id === 'string' &&
        typeof p.notebookId === 'string' &&
        Array.isArray(p.objects),
    ) &&
    b.folders.every((f) => isRecord(f) && typeof f.id === 'string')
  if (!valid) throw new BackupError('This backup is damaged.')
  return b as Backup
}

/** Adds everything from the backup in one transaction; returns how many notebooks it held. */
export async function restoreBackup(
  backup: Backup,
  database: BroomitDatabase = db,
): Promise<number> {
  await database.transaction(
    'rw',
    database.folders,
    database.notebooks,
    database.pages,
    async () => {
      await database.folders.bulkPut(backup.folders)
      await database.notebooks.bulkPut(backup.notebooks)
      // A restored notebook gets exactly its backed-up pages, not a mix with newer local ones.
      for (const notebook of backup.notebooks) {
        await database.pages.where('notebookId').equals(notebook.id).delete()
      }
      await database.pages.bulkPut(backup.pages)
    },
  )
  return backup.notebooks.length
}
