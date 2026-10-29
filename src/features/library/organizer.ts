import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { Id } from '../../engine/model/types.ts'
import { showNotice } from '../../lib/notices.ts'
import { listHomeTabs, saveHomeTab } from '../../storage/homeTabs.ts'
import {
  emptyTab,
  groupOf,
  HOME_TABS,
  MAX_PINS,
  moveToGroup,
  pinsOf,
  togglePin,
  type HomeGroup,
  type HomeTab,
  type HomeTabKey,
} from './homeTabs.ts'

/** The pins and groups of every home screen page, and a way to change one page's. */
export function useHomeTabs(): {
  tabs: Record<HomeTabKey, HomeTab>
  change: (key: HomeTabKey, next: HomeTab) => void
} {
  const [tabs, setTabs] = useState<Record<HomeTabKey, HomeTab>>(
    () =>
      Object.fromEntries(HOME_TABS.map((key) => [key, emptyTab(key)])) as Record<
        HomeTabKey,
        HomeTab
      >,
  )
  useEffect(() => {
    let alive = true
    listHomeTabs()
      .then((list) => {
        if (alive) setTabs(Object.fromEntries(list.map((t) => [t.tab, t])) as typeof tabs)
      })
      .catch((err: unknown) => console.error(err))
    return () => {
      alive = false
    }
  }, [])
  const change = useCallback((key: HomeTabKey, next: HomeTab) => {
    setTabs((all) => ({ ...all, [key]: next }))
    saveHomeTab(next).catch((err: unknown) => {
      console.error(err)
      showNotice('This change could not be saved.')
    })
  }, [])
  return { tabs, change }
}

/** What a card on a home screen page can do with its page's pins and groups. */
export interface Organizer {
  tab: HomeTab
  /** Where pins go: the page (null) or the group the card is shown in. */
  scope: Id | null
  isPinned: (id: Id) => boolean
  togglePin: (id: Id, label: string) => void
  groupOf: (id: Id) => HomeGroup | null
  moveToGroup: (id: Id, groupId: Id | null, label: string) => void
  /** Several items at once; `what` names them in the notice, e.g. "3 items". */
  moveManyToGroup: (ids: Id[], groupId: Id | null, what: string) => void
}

export function makeOrganizer(
  tab: HomeTab,
  change: (next: HomeTab) => void,
  scope: Id | null = null,
): Organizer {
  const where = scope ? tab.groups.find((g) => g.id === scope)?.name : null
  return {
    tab,
    scope,
    isPinned: (id) => pinsOf(tab, scope).includes(id),
    togglePin: (id, label) => {
      const next = togglePin(tab, id, scope)
      if (!next) {
        showNotice(`Up to ${MAX_PINS} can be pinned here. Unpin one first.`)
        return
      }
      change(next)
      if (pinsOf(next, scope).includes(id)) {
        showNotice(where ? `Pinned “${label}” in “${where}”.` : `Pinned “${label}”.`)
      }
    },
    groupOf: (id) => groupOf(tab, id),
    moveManyToGroup: (ids, groupId, what) => {
      const next = ids.reduce((t, id) => moveToGroup(t, id, groupId), tab)
      change(next)
      const group = tab.groups.find((g) => g.id === groupId)
      showNotice(group ? `Added ${what} to “${group.name}”.` : `Took ${what} out of their group.`, {
        label: 'Undo',
        run: () => change(tab),
      })
    },
    moveToGroup: (id, groupId, label) => {
      const before = groupOf(tab, id)
      if ((before?.id ?? null) === groupId) return
      change(moveToGroup(tab, id, groupId))
      const group = tab.groups.find((g) => g.id === groupId)
      showNotice(
        group ? `Added “${label}” to “${group.name}”.` : `Took “${label}” out of its group.`,
        {
          label: 'Undo',
          run: () => change(tab),
        },
      )
    },
  }
}

const OrganizerContext = createContext<Organizer | null>(null)
export const OrganizerProvider = OrganizerContext.Provider

/** The pins and groups of the home screen page a card is on; null elsewhere (e.g. in a folder). */
export function useOrganizer(): Organizer | null {
  return useContext(OrganizerContext)
}
