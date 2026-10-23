import Dexie, { type Table } from 'dexie'
import type { Folder, Notebook, Page } from '../engine/model/types.ts'

/**
 * Local storage for everything the user creates. Each page is its own record, so a stroke on one
 * page writes only that page. Schema changes get a new `version()` block with an upgrade function;
 * existing data is never dropped.
 */
export class BroomitDatabase extends Dexie {
  folders!: Table<Folder, string>
  notebooks!: Table<Notebook, string>
  pages!: Table<Page, string>

  constructor(name = 'broomit') {
    super(name)
    this.version(1).stores({
      folders: 'id, parentId, order',
      notebooks: 'id, folderId, updatedAt',
      pages: 'id, notebookId',
    })
  }
}

export const db = new BroomitDatabase()

/**
 * Asks the browser not to evict our data under storage pressure. On iPadOS this matters most
 * for installed web apps; without it, Safari may clear site data after 7 days without use.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (await navigator.storage?.persisted?.()) return true
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}
