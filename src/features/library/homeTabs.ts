import type { Id } from '../../engine/model/types.ts'

/**
 * Each page of the home screen (folders, notebooks, presentations, flashcards) can pin a few of
 * its items, shown apart at the top, and keep its own groups ("School", "Work", …): named,
 * collapsible sections that items are dropped into. A group can also be shown as a page of its
 * own in the carousel. This is only how the home screen shows things; folders are untouched.
 */

export const HOME_TABS = ['folders', 'notebooks', 'presentations', 'flashcards', 'quizzes'] as const
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
  /** Pinned inside the group: independent of the page's own pins. (Older groups have none.) */
  pins?: Id[]
  /** A pinned group comes first among the groups. */
  pinned?: boolean
}

export interface HomeTab {
  tab: HomeTabKey
  pins: Id[]
  groups: HomeGroup[]
}

export function emptyTab(tab: HomeTabKey): HomeTab {
  return { tab, pins: [], groups: [] }
}

/** The pins of the page, or of one of its groups. */
export function pinsOf(tab: HomeTab, groupId: Id | null = null): Id[] {
  if (groupId === null) return tab.pins
  return tab.groups.find((g) => g.id === groupId)?.pins ?? []
}

/**
 * Pins an item (last), or unpins it: on the page, or inside one of its groups; the two are
 * independent. Returns null when that place already has its maximum.
 */
export function togglePin(tab: HomeTab, id: Id, groupId: Id | null = null): HomeTab | null {
  const pins = pinsOf(tab, groupId)
  let next: Id[]
  if (pins.includes(id)) next = pins.filter((p) => p !== id)
  else if (pins.length >= MAX_PINS) return null
  else next = [...pins, id]
  return groupId === null ? { ...tab, pins: next } : updateGroup(tab, groupId, { pins: next })
}

/** Groups in the order shown: pinned ones first, otherwise as made. */
export function orderedGroups(tab: HomeTab): HomeGroup[] {
  return [...tab.groups.filter((g) => g.pinned), ...tab.groups.filter((g) => !g.pinned)]
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
 * Splits a page's items (already sorted) into the page's pinned ones (in pinning order), each
 * group's (its own pinned ones first) and the rest: what is neither pinned on the page nor in
 * a group. Pins on the page and in a group are independent, so an item can show in both.
 */
export function arrange<T extends { id: Id }>(
  tab: HomeTab,
  items: readonly T[],
): {
  pinned: T[]
  groups: { group: HomeGroup; pinned: T[]; items: T[] }[]
  rest: T[]
} {
  const byId = new Map(items.map((item) => [item.id, item]))
  const pinned = tab.pins.flatMap((id) => byId.get(id) ?? [])
  const pinnedIds = new Set(pinned.map((item) => item.id))
  const grouped = new Set<Id>()
  const groups = orderedGroups(tab).map((group) => {
    const members = new Set(group.itemIds)
    const inside = items.filter((item) => members.has(item.id))
    for (const item of inside) grouped.add(item.id)
    const own = (group.pins ?? []).flatMap((id) => (members.has(id) ? (byId.get(id) ?? []) : []))
    const ownIds = new Set(own.map((item) => item.id))
    return { group, pinned: own, items: inside.filter((item) => !ownIds.has(item.id)) }
  })
  const rest = items.filter((item) => !pinnedIds.has(item.id) && !grouped.has(item.id))
  return { pinned, groups, rest }
}
