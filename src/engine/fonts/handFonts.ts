import type { HandFont } from '../geometry/handFont.ts'

/**
 * The hands that text can be written in (single-line fonts by Sheldon B. Michaels and Windell
 * H. Oskay, Evil Mad Scientist Laboratories, under the SIL Open Font License; see OFL.md).
 * Each loads only when first used.
 */
export type HandStyle = 'cursive' | 'lettering' | 'print' | 'casual'

export const HAND_STYLES: { id: HandStyle; label: string }[] = [
  { id: 'cursive', label: 'Cursive' },
  { id: 'lettering', label: 'Lettering' },
  { id: 'print', label: 'Print' },
  { id: 'casual', label: 'Casual' },
]

const loaded = new Map<HandStyle, Promise<HandFont>>()

export function loadHandFont(style: HandStyle): Promise<HandFont> {
  let font = loaded.get(style)
  if (!font) {
    const load =
      style === 'cursive'
        ? import('./cursive.json')
        : style === 'lettering'
          ? import('./lettering.json')
          : style === 'print'
            ? import('./print.json')
            : import('./casual.json')
    font = load.then((m) => m.default as unknown as HandFont)
    loaded.set(style, font)
  }
  return font
}
