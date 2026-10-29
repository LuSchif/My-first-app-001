/**
 * Design packs: a whole look for the interface, sold in the shop. Each has a wallpaper behind
 * the app and its own color tokens (the same names as tokens.css), taken from its design
 * sheet, so every button, panel, menu and the calendar follow it.
 */

export type DesignPackId = 'sakura-dusk' | 'golden-hour' | 'nebula-night'

export interface DesignPack {
  id: DesignPackId
  name: string
  tagline: string
  /** Dark panels (and the system's dark controls) or light ones. */
  dark: boolean
  /** File names in public/shop. */
  wallpaper: string
  thumb: string
  /** The design sheet's colors, shown in the shop. */
  palette: { color: string; name: string }[]
  /** Laid over the wallpaper so text on it stays readable. */
  veil: string
  /** Color tokens, by name without `--color-`. */
  colors: Record<string, string>
}

const base = import.meta.env.BASE_URL

/**
 * A pack's picture, as an absolute address: in a CSS variable a relative one would be read
 * from the style sheet's folder instead of the page's.
 */
export function packImage(file: string): string {
  return new URL(`${base}shop/${file}`, document.baseURI).href
}

export const DESIGN_PACKS: DesignPack[] = [
  {
    id: 'sakura-dusk',
    name: 'Sakura Dusk',
    tagline: 'Cherry blossoms over a quiet lake at sunset, warm and calm.',
    dark: false,
    wallpaper: 'sakura-dusk.webp',
    thumb: 'sakura-dusk-thumb.webp',
    palette: [
      { color: '#2d1b1e', name: 'Deep brown' },
      { color: '#7d3a5b', name: 'Muted rose' },
      { color: '#e08aa8', name: 'Cherry blossom' },
      { color: '#f7b1c8', name: 'Soft pink' },
      { color: '#ffb37a', name: 'Sunset peach' },
      { color: '#fde9e6', name: 'Warm light' },
    ],
    veil: 'linear-gradient(rgb(253 233 230 / 0.35), rgb(253 233 230 / 0.55))',
    colors: {
      cream: '#fde9e6',
      sand: '#f7b1c8',
      beige: '#f0c3cf',
      caramel: '#e08aa8',
      mocha: '#7d3a5b',
      espresso: '#2d1b1e',
      surface: '#fbe7e6',
      'surface-raised': 'rgb(255 248 246 / 0.88)',
      'surface-sunken': '#f7d9dd',
      desk: '#f3d6da',
      ink: '#2d1b1e',
      'ink-muted': '#6e3f55',
      'ink-subtle': '#b07c92',
      'ink-inverse': '#fdf1ef',
      line: '#efc6d1',
      'line-strong': '#df9db4',
      accent: '#d46a92',
      selected: '#d46a92',
      hover: 'rgb(45 27 30 / 0.06)',
      pressed: 'rgb(45 27 30 / 0.1)',
      scrim: 'rgb(45 27 30 / 0.35)',
    },
  },
  {
    id: 'golden-hour',
    name: 'Golden Hour',
    tagline: 'A lofi study at dusk: lamplight, plants and a sky turning to night.',
    dark: true,
    wallpaper: 'golden-hour.webp',
    thumb: 'golden-hour-thumb.webp',
    palette: [
      { color: '#0b132b', name: 'Deep night' },
      { color: '#1e2a44', name: 'Sky blue' },
      { color: '#6a4c93', name: 'Soft purple' },
      { color: '#e07a5f', name: 'Sunset' },
      { color: '#f4a261', name: 'Warm light' },
      { color: '#fde8d3', name: 'Soft light' },
    ],
    veil: 'linear-gradient(rgb(11 19 43 / 0.35), rgb(11 19 43 / 0.6))',
    colors: {
      cream: '#111a33',
      sand: '#6a4c93',
      beige: '#4a3b6b',
      caramel: '#f4a261',
      mocha: '#e07a5f',
      espresso: '#fde8d3',
      surface: '#111a33',
      'surface-raised': 'rgb(20 29 54 / 0.86)',
      'surface-sunken': '#0b132b',
      desk: '#0e1630',
      ink: '#fde8d3',
      'ink-muted': '#e2c6b2',
      'ink-subtle': '#9a8aa6',
      'ink-inverse': '#0b132b',
      line: '#2a3658',
      'line-strong': '#4a567c',
      accent: '#f4a261',
      selected: '#f4a261',
      hover: 'rgb(255 255 255 / 0.08)',
      pressed: 'rgb(255 255 255 / 0.14)',
      scrim: 'rgb(0 0 0 / 0.5)',
    },
  },
  {
    id: 'nebula-night',
    name: 'Nebula Night',
    tagline: 'Deep space, a glowing planet edge and violet nebulae. Clean and futuristic.',
    dark: true,
    wallpaper: 'nebula-night.webp',
    thumb: 'nebula-night-thumb.webp',
    palette: [
      { color: '#050814', name: 'Deep space' },
      { color: '#0f1b3d', name: 'Midnight blue' },
      { color: '#3b82f6', name: 'Broomit blue' },
      { color: '#a78bfa', name: 'Soft purple' },
      { color: '#e6edff', name: 'Starlight' },
    ],
    veil: 'linear-gradient(rgb(5 8 20 / 0.3), rgb(5 8 20 / 0.55))',
    colors: {
      cream: '#070c1e',
      sand: '#0f1b3d',
      beige: '#1e2d5c',
      caramel: '#3b82f6',
      mocha: '#a78bfa',
      espresso: '#e6edff',
      surface: '#070c1e',
      'surface-raised': 'rgb(12 20 46 / 0.84)',
      'surface-sunken': '#050814',
      desk: '#060a1a',
      ink: '#e6edff',
      'ink-muted': '#a9b6dd',
      'ink-subtle': '#6f7daa',
      'ink-inverse': '#050814',
      line: '#1c2850',
      'line-strong': '#33427a',
      accent: '#3b82f6',
      selected: '#a78bfa',
      hover: 'rgb(255 255 255 / 0.08)',
      pressed: 'rgb(255 255 255 / 0.14)',
      scrim: 'rgb(0 0 0 / 0.55)',
    },
  },
]

export function designPack(id: string | null | undefined): DesignPack | undefined {
  return DESIGN_PACKS.find((p) => p.id === id)
}
