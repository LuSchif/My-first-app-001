import type { Fill } from '../engine/model/fill.ts'

/**
 * Colors users can pick for folders, covers, ink and objects. Each row is one hue family,
 * light to dark, so the palette reads as a calm grid instead of a rainbow.
 */
export const SWATCH_ROWS: readonly { name: string; colors: readonly string[] }[] = [
  { name: 'Browns', colors: ['#f7f2ea', '#e8d9c5', '#d8c1a5', '#b98b65', '#795a46', '#3e2d25'] },
  { name: 'Greys', colors: ['#ffffff', '#e4e2df', '#b8b4ae', '#86817a', '#4f4b46', '#1f1d1b'] },
  { name: 'Reds', colors: ['#f8dcd6', '#efada1', '#e0715f', '#c4473a', '#952f27', '#5e1d18'] },
  { name: 'Oranges', colors: ['#fbe3cc', '#f6c08f', '#ee9a52', '#d9772b', '#a8561c', '#6b3611'] },
  { name: 'Yellows', colors: ['#fcf1c7', '#f8e08a', '#f2cf4a', '#d8ae22', '#a68316', '#6a540f'] },
  { name: 'Greens', colors: ['#e1efd6', '#bcdca6', '#8fc172', '#5f9a4a', '#3f7034', '#264621'] },
  { name: 'Teals', colors: ['#d7eeea', '#a5d8cf', '#6bbcae', '#3d9687', '#2a6e63', '#19453e'] },
  { name: 'Blues', colors: ['#dbe8f6', '#adcbec', '#76a7dc', '#4a80c0', '#2f5d95', '#1c3a60'] },
  { name: 'Purples', colors: ['#e8e0f3', '#cbb9e6', '#a68bd2', '#8063b4', '#5d468a', '#3a2c58'] },
  { name: 'Pinks', colors: ['#f9dfe8', '#f2b6ca', '#e787a8', '#cf5f88', '#a14266', '#652941'] },
]

/** Ready-made gradients for folders and covers. */
export const GRADIENT_PRESETS: readonly { name: string; fill: Fill }[] = [
  linear('Latte', 135, '#f7f2ea', '#b98b65'),
  linear('Espresso', 160, '#795a46', '#3e2d25'),
  linear('Sunrise', 135, '#f8e08a', '#e0715f'),
  linear('Meadow', 135, '#e1efd6', '#5f9a4a'),
  linear('Lagoon', 135, '#a5d8cf', '#2f5d95'),
  linear('Lavender', 135, '#f9dfe8', '#8063b4'),
  linear('Ember', 135, '#ee9a52', '#952f27'),
  {
    name: 'Dusk',
    fill: {
      type: 'linear',
      angle: 180,
      stops: [
        { offset: 0, color: '#f6c08f' },
        { offset: 0.5, color: '#cf5f88' },
        { offset: 1, color: '#3a2c58' },
      ],
    },
  },
]

function linear(name: string, angle: number, from: string, to: string) {
  return {
    name,
    fill: {
      type: 'linear',
      angle,
      stops: [
        { offset: 0, color: from },
        { offset: 1, color: to },
      ],
    } satisfies Fill,
  }
}

/** The everyday colors; anything else comes from the wheel. */
export const PRIMARY_COLORS: readonly [string, string][] = [
  ['Espresso', '#3e2d25'],
  ['Black', '#1f1d1b'],
  ['Grey', '#86817a'],
  ['Red', '#c4473a'],
  ['Orange', '#ee9a52'],
  ['Yellow', '#f2cf4a'],
  ['Green', '#5f9a4a'],
  ['Teal', '#3d9687'],
  ['Blue', '#4a80c0'],
  ['Navy', '#1c3a60'],
  ['Purple', '#8063b4'],
  ['Pink', '#e787a8'],
]
