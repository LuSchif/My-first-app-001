import type { Addon, AddonKind } from '../../../engine/addons/types.ts'
import { newId } from '../../../engine/model/ids.ts'

/** What the addon browser offers: one entry per kind, with a fresh copy of its defaults. */
export interface CatalogEntry {
  kind: AddonKind
  name: string
  description: string
  make: () => Addon
}

export const CATALOG: readonly CatalogEntry[] = [
  {
    kind: 'dateTime',
    name: 'Date and time',
    description: 'Today’s date and the time at the top of every page.',
    make: () => ({
      id: newId(),
      kind: 'dateTime',
      name: 'Date and time',
      always: false,
      settings: {
        showDate: true,
        showTime: true,
        dateSpot: 'top-right',
        timeSpot: 'top-right',
        dateStyle: 'long',
        color: '#795a46',
        size: 12,
        marked: false,
        markColor: '#f2cf4a',
      },
    }),
  },
  {
    kind: 'pageNumbers',
    name: 'Page numbers',
    description: 'A number on every page, where you want it and from the page you choose.',
    make: () => ({
      id: newId(),
      kind: 'pageNumbers',
      name: 'Page numbers',
      always: false,
      settings: {
        spot: 'bottom-center',
        startPage: 1,
        firstNumber: 1,
        style: 'plain',
        color: '#795a46',
        size: 12,
        marked: false,
        markColor: '#f2cf4a',
      },
    }),
  },
  {
    kind: 'autoRotate',
    name: 'Turn what you add',
    description:
      'Pages, pictures and elements you add are turned by an angle, e.g. a scan that came in crooked.',
    make: () => ({
      id: newId(),
      kind: 'autoRotate',
      name: 'Turn 45° clockwise',
      always: false,
      settings: { angle: 45, pages: true, pictures: true, elements: true },
    }),
  },
  {
    kind: 'textCommand',
    name: 'Text command',
    description:
      'Type a short word in a text box, and it becomes something else: e.g. /date becomes today’s date.',
    make: () => ({
      id: newId(),
      kind: 'textCommand',
      name: 'Today’s date',
      always: false,
      settings: { trigger: '/date', replacement: '{date}', matchCase: false },
    }),
  },
  {
    kind: 'gesture',
    name: 'Draw a command',
    description:
      'Draw something, and it becomes something else: e.g. two brackets become a highlight.',
    make: () => ({
      id: newId(),
      kind: 'gesture',
      name: 'My command',
      always: false,
      settings: { before: [], after: [], keepBefore: false, tolerance: 0.5 },
    }),
  },
]

export function catalogEntry(kind: AddonKind): CatalogEntry {
  return CATALOG.find((c) => c.kind === kind)!
}
