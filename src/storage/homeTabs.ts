import { emptyTab, HOME_TABS, type HomeTab } from '../features/library/homeTabs.ts'
import { db, type BroomitDatabase } from './db.ts'

/** Pins and groups of every home screen page; pages never changed come back empty. */
export async function listHomeTabs(database: BroomitDatabase = db): Promise<HomeTab[]> {
  const stored = await database.homeTabs.toArray()
  return HOME_TABS.map((tab) => stored.find((t) => t.tab === tab) ?? emptyTab(tab))
}

export async function saveHomeTab(tab: HomeTab, database: BroomitDatabase = db): Promise<void> {
  await database.homeTabs.put(tab)
}
