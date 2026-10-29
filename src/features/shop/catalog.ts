import type { DesignPackId } from '../../design/packs.ts'

/**
 * What the Broomit shop offers: free and paid things, from design packs that restyle the
 * whole app to planners, templates and design elements. Items not ready yet are listed as
 * "Coming soon" and cannot be bought.
 */

export type ProductKind = 'design-pack' | 'planner' | 'template' | 'elements'

export interface Product {
  id: string
  kind: ProductKind
  name: string
  description: string
  /** In euro cents; 0 for free. */
  price: number
  status: 'available' | 'coming-soon'
  /** A design pack's look. */
  pack?: DesignPackId
  /** What the item's card shows when it has no picture: an icon name and two colors. */
  art?: {
    icon: 'calendar' | 'notebook' | 'sticker' | 'tape' | 'target' | 'clock' | 'layout'
    from: string
    to: string
  }
}

/** A bought (or free, taken) item, kept on the device and in backups. */
export interface Purchase {
  productId: string
  at: number
  /** Unlocked while no payment provider was connected: nothing was charged. */
  test: boolean
}

export const CATEGORIES: [ProductKind | 'all', string][] = [
  ['all', 'All'],
  ['design-pack', 'Design packs'],
  ['planner', 'Planners'],
  ['template', 'Templates'],
  ['elements', 'Design elements'],
]

export const PRODUCTS: Product[] = [
  {
    id: 'pack.sakura-dusk',
    kind: 'design-pack',
    name: 'Sakura Dusk',
    description:
      'Cherry blossoms over a quiet lake at sunset. The wallpaper sits behind the whole app, and every button, panel, menu and the calendar take on its soft pinks and warm browns.',
    price: 499,
    status: 'available',
    pack: 'sakura-dusk',
  },
  {
    id: 'pack.golden-hour',
    kind: 'design-pack',
    name: 'Golden Hour',
    description:
      'A cozy lofi study at dusk: lamplight, plants and a sky turning to night. Dark panels in deep night blue with warm orange light, across the whole app and the calendar.',
    price: 499,
    status: 'available',
    pack: 'golden-hour',
  },
  {
    id: 'pack.nebula-night',
    kind: 'design-pack',
    name: 'Nebula Night',
    description:
      'Deep space with a glowing planet edge and violet nebulae. Clean, futuristic dark panels with Broomit blue accents, across the whole app and the calendar.',
    price: 499,
    status: 'available',
    pack: 'nebula-night',
  },
  {
    id: 'planner.weekly-2026',
    kind: 'planner',
    name: 'Weekly Planner 2026',
    description: 'A week on every spread, with tabs for months and room for notes.',
    price: 0,
    status: 'coming-soon',
    art: { icon: 'calendar', from: '#e8d9c5', to: '#b98b65' },
  },
  {
    id: 'planner.daily-focus',
    kind: 'planner',
    name: 'Daily Focus Planner',
    description: 'Top three tasks, a time grid and an evening review for every day.',
    price: 299,
    status: 'coming-soon',
    art: { icon: 'clock', from: '#f7b1c8', to: '#7d3a5b' },
  },
  {
    id: 'planner.habits',
    kind: 'planner',
    name: 'Habit & Mood Tracker',
    description: 'Track habits and moods across a month at a glance.',
    price: 199,
    status: 'coming-soon',
    art: { icon: 'target', from: '#b9e2c8', to: '#3d9687' },
  },
  {
    id: 'template.cornell',
    kind: 'template',
    name: 'Cornell Notes',
    description: 'The classic layout for lectures: cues, notes and a summary on every page.',
    price: 0,
    status: 'coming-soon',
    art: { icon: 'layout', from: '#dbe7ff', to: '#4a80c0' },
  },
  {
    id: 'template.exam-kit',
    kind: 'template',
    name: 'Exam Prep Kit',
    description: 'Study plan, topic checklist and a countdown to the exam.',
    price: 199,
    status: 'coming-soon',
    art: { icon: 'notebook', from: '#ffd7b3', to: '#e07a5f' },
  },
  {
    id: 'elements.study-stickers',
    kind: 'elements',
    name: 'Study Stickers',
    description: 'Hand-drawn stickers for notes: arrows, banners, icons and doodles.',
    price: 199,
    status: 'coming-soon',
    art: { icon: 'sticker', from: '#fde9e6', to: '#e08aa8' },
  },
  {
    id: 'elements.washi',
    kind: 'elements',
    name: 'Washi Tape Collection',
    description: 'Patterned tapes to frame and decorate your pages.',
    price: 149,
    status: 'coming-soon',
    art: { icon: 'tape', from: '#e9e2ff', to: '#8063b4' },
  },
]

/** "4,99 €", or "Free". */
export function priceLabel(cents: number): string {
  if (cents === 0) return 'Free'
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}
