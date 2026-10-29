import type { Id } from '../../engine/model/types.ts'

/**
 * Each page of the home screen (folders, notebooks, presentations, flashcards) can pin a few of
 * its items, shown apart at the top, and keep its own groups ("School", "Work", …): named,
 * collapsible sections that items are dropped into. A group can also be shown as a page of its
 * own in the carousel. This is only how the home screen shows things; folders are untouched.
 */

export const HOME_TABS = ['folders', 'notebooks', 'presentations', 'flashcards'] as const
export type HomeTabKey = (typeof HOME_TABS)[number]

/** At most this many items are pinned on one page. */
export const MAX_PINS = 5

export interface HomeGroup {
  id: Id
  name: string
  /** In the order they were added. */
  itemIds: Id[]
  collapsed: boolean
  /** Also shown as a page of its own in the carousel, after its page. */
  ownTab: boolean
}

export interface HomeTab {
  tab: HomeTabKey
  pins: Id[]
  groups: HomeGroup[]
}

export function emptyTab(tab: HomeTabKey): HomeTab {
  return { tab, pins: [], groups: [] }
}

/** Pins an item (last), or unpins it. Returns null when the page already has its maximum. */
export function togglePin(tab: HomeTab, id: Id): HomeTab | null {
  if (tab.pins.includes(id)) return { ...tab, pins: tab.pins.filter((p) => p !== id) }
  if (tab.pins.length >= MAX_PINS) return null
  return { ...tab, pins: [...tab.pins, id] }
}

export function addGroup(tab: HomeTab, group: HomeGroup): HomeTab {
  return { ...tab, groups: [...tab.groups, group] }
}

export function updateGroup(tab: HomeTab, id: Id, patch: Partial<Omit<HomeGroup, 'id'>>): HomeTab {
  return { ...tab, groups: tab.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)) }
}

/** Removes a group; its items go back to the rest of the page. */
export function removeGroup(tab: HomeTab, id: Id): HomeTab {
  return { ...tab, groups: tab.groups.filter((g) => g.id !== id) }
}

/** Puts an item into a group (out of any other one), or out of all groups (`null`). */
export function moveToGroup(tab: HomeTab, itemId: Id, groupId: Id | null): HomeTab {
  return {
    ...tab,
    groups: tab.groups.map((g) => {
      const rest = g.itemIds.filter((i) => i !== itemId)
      return { ...g, itemIds: g.id === groupId ? [...rest, itemId] : rest }
    }),
  }
}

export function groupOf(tab: HomeTab, itemId: Id): HomeGroup | null {
  return tab.groups.find((g) => g.itemIds.includes(itemId)) ?? null
}

/**
 * Splits a page's items (already sorted) into the pinned ones (in pinning order), each group's
 * (in the page's order) and the rest. A pinned item shows only with the pins.
 */
export function arrange<T extends { id: Id }>(
  tab: HomeTab,
  items: readonly T[],
): { pinned: T[]; groups: { group: HomeGroup; items: T[] }[]; rest: T[] } {
  const byId = new Map(items.map((item) => [item.id, item]))
  const pinned = tab.pins.flatMap((id) => byId.get(id) ?? [])
  const pinnedIds = new Set(pinned.map((item) => item.id))
  const grouped = new Set<Id>()
  const groups = tab.groups.map((group) => {
    const members = new Set(group.itemIds)
    const list = items.filter((item) => members.has(item.id) && !pinnedIds.has(item.id))
    for (const item of list) grouped.add(item.id)
    return { group, items: list }
  })
  const rest = items.filter((item) => !pinnedIds.has(item.id) && !grouped.has(item.id))
  return { pinned, groups, rest }
}
