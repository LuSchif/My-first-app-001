/**
 * Addons: small building blocks that change how the workspace behaves. Each one the person adds
 * to their library is an `Addon`: a kind, its settings, a name of their own, and whether it is
 * always on. The engine only sees the addons that are on right now (see `Editor.setAddons`).
 */
export type AddonKind = 'dateTime' | 'pageNumbers' | 'autoRotate' | 'gesture' | 'textCommand'

/** Where on the page a label sits. */
export type Spot =
  'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'

export const SPOTS: readonly Spot[] = [
  'top-left',
  'top-center',
  'top-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
]

/** Today's date and the time, shown on every page. */
export interface DateTimeSettings {
  showDate: boolean
  showTime: boolean
  dateSpot: Spot
  timeSpot: Spot
  /** long: Thursday, 5 November 2026; short: 5 Nov 2026; numeric: 05.11.2026 */
  dateStyle: 'long' | 'short' | 'numeric'
  color: string
  /** Text size in points. */
  size: number
  /** Drawn on a marker-colored band. */
  marked: boolean
  markColor: string
}

/** Page numbers. */
export interface PageNumberSettings {
  spot: Spot
  /** The first page (1 = the first page of the notebook) that gets a number. */
  startPage: number
  /** The number it gets. */
  firstNumber: number
  /** plain: 3; page: Page 3; of: 3 / 12; dashes: – 3 – */
  style: 'plain' | 'page' | 'of' | 'dashes'
  color: string
  size: number
  marked: boolean
  markColor: string
}

/** Turns what is added to the notebook by an angle. */
export interface AutoRotateSettings {
  /** Degrees, clockwise. */
  angle: number
  /** Pages added from another notebook. */
  pages: boolean
  /** Pictures and photos. */
  pictures: boolean
  /** Shapes, stickers, tables, charts and elements taken from other notebooks. */
  elements: boolean
}

/** A stroke drawn in an addon's editor, in the editor's own coordinates. */
export interface GestureStroke {
  tool: 'pen' | 'highlighter'
  color: string
  width: number
  points: number[]
  /** A closed stroke filled with this color (dropped onto it in the addon's editor). */
  fill?: string
}

/**
 * Draw a command: whenever the strokes drawn on a page look like `before`, they are replaced by
 * `after`, fitted to where they were drawn (e.g. two brackets become a highlight between them).
 */
export interface GestureSettings {
  before: GestureStroke[]
  after: GestureStroke[]
  /** Keep the strokes that triggered it instead of replacing them. */
  keepBefore: boolean
  /** How loosely a drawing may match, from 0 (strict) to 1 (loose). */
  tolerance: number
}

/**
 * A text command: typing `trigger` in a text box (or writing it there with Scribble) replaces
 * it with `replacement`, in which {date}, {time} and {page} stand for today's date, the time
 * and the page number.
 */
export interface TextCommandSettings {
  trigger: string
  replacement: string
  matchCase: boolean
}

export type Addon =
  | AddonBase<'dateTime', DateTimeSettings>
  | AddonBase<'pageNumbers', PageNumberSettings>
  | AddonBase<'autoRotate', AutoRotateSettings>
  | AddonBase<'gesture', GestureSettings>
  | AddonBase<'textCommand', TextCommandSettings>

interface AddonBase<K extends AddonKind, S> {
  id: string
  kind: K
  name: string
  settings: S
  /** On in every notebook, without switching it on. */
  always: boolean
}

export type AddonOf<K extends AddonKind> = Extract<Addon, { kind: K }>
