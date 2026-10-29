import { describe, expect, it } from 'vitest'
import {
  addGroup,
  arrange,
  emptyTab,
  MAX_PINS,
  moveToGroup,
  orderedGroups,
  removeGroup,
  togglePin,
  updateGroup,
  type HomeTab,
} from './homeTabs.ts'

const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => ({ id }))
const withGroup = (): HomeTab =>
  addGroup(emptyTab('notebooks'), {
    id: 'school',
    name: 'School',
    itemIds: [],
    collapsed: false,
    ownTab: false,
  })

describe('home tabs', () => {
  it('pins up to the maximum, and unpins', () => {
    let tab = emptyTab('notebooks')
    for (const { id } of items.slice(0, MAX_PINS)) tab = togglePin(tab, id)!
    expect(tab.pins).toHaveLength(MAX_PINS)
    expect(togglePin(tab, 'g')).toBeNull()
    expect(togglePin(tab, 'a')!.pins).not.toContain('a')
  })

  it('keeps an item in one group at a time', () => {
    let tab = addGroup(withGroup(), {
      id: 'work',
      name: 'Work',
      itemIds: [],
      collapsed: false,
      ownTab: false,
    })
    tab = moveToGroup(tab, 'a', 'school')
    tab = moveToGroup(tab, 'a', 'work')
    expect(tab.groups.map((g) => g.itemIds)).toEqual([[], ['a']])
    expect(moveToGroup(tab, 'a', null).groups.every((g) => g.itemIds.length === 0)).toBe(true)
  })

  it('keeps pins on the page and in a group apart', () => {
    let tab = moveToGroup(withGroup(), 'b', 'school')
    tab = moveToGroup(tab, 'c', 'school')
    tab = togglePin(tab, 'c')!
    tab = togglePin(tab, 'e')!
    tab = togglePin(tab, 'b', 'school')!
    const { pinned, groups, rest } = arrange(tab, items)
    expect(pinned.map((i) => i.id)).toEqual(['c', 'e'])
    // In the group: its own pin first; the page's pin on "c" does not take it out.
    expect(groups[0]!.pinned.map((i) => i.id)).toEqual(['b'])
    expect(groups[0]!.items.map((i) => i.id)).toEqual(['c'])
    expect(rest.map((i) => i.id)).toEqual(['a', 'd', 'f', 'g'])
    expect(tab.pins).toEqual(['c', 'e'])
  })

  it('puts pinned groups first', () => {
    let tab = addGroup(withGroup(), {
      id: 'work',
      name: 'Work',
      itemIds: [],
      collapsed: false,
      ownTab: false,
    })
    tab = updateGroup(tab, 'work', { pinned: true })
    expect(orderedGroups(tab).map((g) => g.id)).toEqual(['work', 'school'])
  })

  it('ignores items that no longer exist, and frees items of a removed group', () => {
    let tab = moveToGroup(withGroup(), 'gone', 'school')
    tab = moveToGroup(tab, 'a', 'school')
    expect(arrange(tab, items).groups[0]!.items.map((i) => i.id)).toEqual(['a'])
    expect(arrange(removeGroup(tab, 'school'), items).rest).toHaveLength(items.length)
  })
})
