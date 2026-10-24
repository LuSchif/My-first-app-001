/**
 * A text field whose text has parts in other styles (the page's text box) tells the app's
 * on-screen keyboard about them here, so the keyboard's mirror of the field draws them as on
 * the page.
 */

export type StyledCss = Partial<
  Record<
    | 'fontFamily'
    | 'fontSize'
    | 'fontWeight'
    | 'fontStyle'
    | 'textDecoration'
    | 'color'
    | 'backgroundColor',
    string
  >
>

/** Characters from `start` up to `end` in this style. */
export interface StyledRange {
  start: number
  end: number
  css: StyledCss
}

const providers = new WeakMap<Element, () => StyledRange[] | null>()

export function setStyledRanges(field: Element, provider: () => StyledRange[] | null): void {
  providers.set(field, provider)
}

/** The field's styled ranges, or null when all of its text has the field's own style. */
export function styledRanges(field: Element): StyledRange[] | null {
  return providers.get(field)?.() ?? null
}
