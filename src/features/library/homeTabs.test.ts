import { describe, expect, it } from 'vitest'
import {
  addGroup,
  arrange,
  emptyTab,
  MAX_PINS,
  moveToGroup,
  removeGroup,
  togglePin,
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

  it('shows pinned items only with the pins, grouped ones only in their group', () => {
    let tab = moveToGroup(withGroup(), 'b', 'school')
    tab = moveToGroup(tab, 'c', 'school')
    tab = togglePin(tab, 'c')!
    tab = togglePin(tab, 'e')!
    const { pinned, groups, rest } = arrange(tab, items)
    expect(pinned.map((i) => i.id)).toEqual(['c', 'e'])
    expect(groups[0]!.items.map((i) => i.id)).toEqual(['b'])
    expect(rest.map((i) => i.id)).toEqual(['a', 'd', 'f', 'g'])
  })

  it('ignores items that no longer exist, and frees items of a removed group', () => {
    let tab = moveToGroup(withGroup(), 'gone', 'school')
    tab = moveToGroup(tab, 'a', 'school')
    expect(arrange(tab, items).groups[0]!.items.map((i) => i.id)).toEqual(['a'])
    expect(arrange(removeGroup(tab, 'school'), items).rest).toHaveLength(items.length)
  })
})
