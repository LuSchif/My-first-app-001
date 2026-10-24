/**
 * Features that can be switched off in the control center. Everything defaults to on, so a
 * new user sees all of Broomit; the choice is kept on the device by the app.
 */
export interface Features {
  /** Offer Auto shape, Auto fill, tables and clefs after drawing. */
  suggestions: boolean
  /** Resting the pen after drawing a shape makes it perfect. */
  holdToShape: boolean
  /** Double tap with two fingers to undo, with three to redo. */
  gestureUndo: boolean
  /** A harder press draws a wider line with the fountain pen. */
  pressure: boolean
  /** Dust flies off where the broom sweeps. */
  broomDust: boolean
  /** A highlighter stroke over typed text becomes a neat text highlight. */
  smartHighlight: boolean
  /** New text on ruled paper sits on the lines. */
  textAutoAlign: boolean
  /** The bar of recently used colors at the edge. */
  recentColors: boolean
  /** Tools shown in the toolbar. */
  laser: boolean
  tape: boolean
  eyedropper: boolean
  magnifier: boolean
  pathTool: boolean
}

export const DEFAULT_FEATURES: Features = {
  suggestions: true,
  holdToShape: true,
  gestureUndo: true,
  pressure: true,
  broomDust: true,
  textAutoAlign: true,
  smartHighlight: true,
  recentColors: true,
  laser: true,
  tape: true,
  eyedropper: true,
  magnifier: true,
  pathTool: true,
}

/** Stored features, with defaults for anything missing or malformed. */
export function readFeatures(value: unknown): Features {
  const out = { ...DEFAULT_FEATURES }
  if (value && typeof value === 'object') {
    for (const key of Object.keys(out) as (keyof Features)[]) {
      const v = (value as Record<string, unknown>)[key]
      if (typeof v === 'boolean') out[key] = v
    }
  }
  return out
}
