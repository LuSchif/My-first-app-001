import type { Asset, Folder, Notebook, Page } from '../engine/model/types.ts'
import type { CalendarSource, DayMark, OwnEvent } from '../features/calendar/model.ts'
import type { HomeTab } from '../features/library/homeTabs.ts'
import type { Purchase } from '../features/shop/catalog.ts'
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
  /** Pictures, with their data as base64. Older backups have none. */
  assets?: BackupAsset[]
  /** The calendar. Older backups have none. */
  calendar?: { events: OwnEvent[]; days: DayMark[]; sources: CalendarSource[] }
  /** What is pinned and grouped on the home screen. Older backups have none. */
  home?: HomeTab[]
  /** What was bought in the shop. Older backups have none. */
  purchases?: Purchase[]
}

export interface BackupAsset extends Omit<Asset, 'blob'> {
  mime: string
  data: string
}

export async function createBackup(database: BroomitDatabase = db): Promise<Backup> {
  return database
    .transaction(
      'r',
      [
        database.folders,
        database.notebooks,
        database.pages,
        database.assets,
        database.calendarEvents,
        database.calendarDays,
        database.calendarSources,
        database.homeTabs,
        database.purchases,
      ],
      async () => ({
        format: 'broomit-backup' as const,
        version: 1 as const,
        exportedAt: Date.now(),
        folders: await database.folders.toArray(),
        notebooks: await database.notebooks.toArray(),
        pages: await database.pages.toArray(),
        assets: await database.assets.toArray(),
        calendar: {
          events: await database.calendarEvents.toArray(),
          days: await database.calendarDays.toArray(),
          sources: await database.calendarSources.toArray(),
        },
        home: await database.homeTabs.toArray(),
        purchases: await database.purchases.toArray(),
      }),
    )
    .then(async ({ assets, ...rest }) => ({
      ...rest,
      assets: await Promise.all(assets.map(encodeAsset)),
    }))
}

export async function encodeAsset({ blob, ...rest }: Asset): Promise<BackupAsset> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return { ...rest, mime: blob.type, data: btoa(binary) }
}

export function decodeAsset({ mime, data, ...rest }: BackupAsset): Asset {
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return { ...rest, blob: new Blob([bytes], { type: mime }) }
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
    b.folders.every((f) => isRecord(f) && typeof f.id === 'string') &&
    (b.assets === undefined ||
      (Array.isArray(b.assets) &&
        b.assets.every(
          (a) => isRecord(a) && typeof a.id === 'string' && typeof a.data === 'string',
        )))
  if (!valid) throw new BackupError('This backup is damaged.')
  return b as Backup
}

/** Adds everything from the backup in one transaction; returns how many notebooks it held. */
export async function restoreBackup(
  backup: Backup,
  database: BroomitDatabase = db,
): Promise<number> {
  const assets = (backup.assets ?? []).map(decodeAsset)
  await database.transaction(
    'rw',
    [
      database.folders,
      database.notebooks,
      database.pages,
      database.assets,
      database.calendarEvents,
      database.calendarDays,
      database.calendarSources,
      database.homeTabs,
      database.purchases,
    ],
    async () => {
      await database.assets.bulkPut(assets)
      if (Array.isArray(backup.purchases)) await database.purchases.bulkPut(backup.purchases)
      if (Array.isArray(backup.home)) await database.homeTabs.bulkPut(backup.home)
      if (backup.calendar) {
        await database.calendarEvents.bulkPut(backup.calendar.events ?? [])
        await database.calendarDays.bulkPut(backup.calendar.days ?? [])
        await database.calendarSources.bulkPut(backup.calendar.sources ?? [])
      }
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
