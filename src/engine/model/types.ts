import type { Fill, LinearGradientFill, RadialGradientFill } from './fill.ts'

/**
 * The Broomit document model. Everything here is plain, serializable data with stable ids, so it
 * can be stored in IndexedDB, undone, exported and later synced. Objects are treated as
 * immutable: a change replaces the object instead of mutating it.
 */

export type Id = string

/** Bump when the stored shape changes, and add a migration in storage/db.ts. */
export const SCHEMA_VERSION = 1

export type PaperKind = 'lined' | 'grid' | 'dotted' | 'music' | 'blank'

export interface Folder {
  id: Id
  name: string
  fill: Fill
  icon: string
  parentId: Id | null
  order: number
  createdAt: number
  updatedAt: number
}

/** Layers belong to the notebook: name, order, visibility and lock apply to every page. */
export interface LayerDef {
  id: Id
  name: string
  visible: boolean
  locked: boolean
  opacity: number
  /** A clipping mask: shows only where the layer below has content. */
  clip?: boolean
  /** A layer made for one text box; it is named after the text and goes away with it. */
  kind?: 'text'
}

export interface Notebook {
  id: Id
  schemaVersion: number
  /** A notebook when absent. */
  kind?: DocumentKind
  /** Flashcards: how well each card is known, by the id of its front page. */
  study?: Record<Id, CardStudy>
  /** The size of every page; A4 (PAGE_SIZE) when absent. */
  pageSize?: PageSize
  title: string
  folderId: Id | null
  cover: Fill
  /** The paper new pages get; each page keeps its own. */
  paper: PaperKind
  pageIds: Id[]
  /** Bottom to top. */
  layers: LayerDef[]
  /** Color of the background layer below all others; the paper color when absent. */
  background?: string
  createdAt: number
  updatedAt: number
}

export interface Page {
  id: Id
  notebookId: Id
  schemaVersion: number
  paper: PaperKind
  /** Paper color; the default paper white when absent. */
  background?: string
  /** Drawing order within each layer: later objects are drawn on top. */
  objects: CanvasObject[]
  /** Presentations: what the speaker wants to say on this slide; never shown while presenting. */
  notes?: string
  /** Presentations: how this slide comes in when presenting. */
  transition?: SlideTransition
  updatedAt: number
}

export type CanvasObject = StrokeObject | TextObject | FillObject | BoxObject

/** How a slide replaces the one before it. */
export interface SlideTransition {
  effect: 'fade' | 'push' | 'cover' | 'zoom'
  /** In milliseconds. */
  duration: number
}

/**
 * Presentations: how an object appears while presenting. Objects with an animation appear in
 * the order of `order`; each starts on a tap, together with the one before, or after it.
 */
export interface ObjectAnimation {
  effect: 'fade' | 'rise' | 'fly-left' | 'fly-right' | 'zoom' | 'wipe'
  start: 'tap' | 'with' | 'after'
  order: number
  /** In milliseconds. */
  duration: number
}

/** Anything placed on a page can be animated in a presentation. */
interface Animatable {
  animation?: ObjectAnimation
}

/** Objects that sit in a rectangle on the page: pictures, tables and charts. */
export type BoxObject = ImageObject | TableObject | ChartObject

/**
 * A rectangle on the page: (x, y) is its top-left corner before rotation, and rotation (in
 * radians) turns it around its center.
 */
export interface BoxFrame {
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

/** A picture. The image data lives in the asset store; `assetId` refers to it. */
export interface ImageObject extends BoxFrame, Animatable {
  id: Id
  type: 'image'
  layerId: Id
  assetId: Id
  opacity: number
  /** Mirrored left to right, or top to bottom. */
  flipX?: boolean
  flipY?: boolean
  outline?: Outline
}

/**
 * A table. Column widths and row heights are in points and add up to the frame's width and
 * height; they keep the spacing of a hand-drawn table it was made from.
 */
export interface TableObject extends BoxFrame, Animatable {
  id: Id
  type: 'table'
  layerId: Id
  columns: number[]
  rows: number[]
  /** Cell text by row, then column. */
  cells: string[][]
  style: TableStyle
  outline?: Outline
}

export interface TableStyle {
  lineColor: string
  /** In points. */
  lineWidth: number
  /** The first row is a header: filled, with bold text. */
  header: boolean
  headerFill: string
  textColor: string
  /** In points. */
  fontSize: number
  font: FontFamily
}

export type ChartKind = 'bar' | 'line' | 'pie' | 'donut'

/** A chart drawn from its own small data table. */
export interface ChartObject extends BoxFrame, Animatable {
  id: Id
  type: 'chart'
  layerId: Id
  kind: ChartKind
  title: string
  /** One label per category (bar group, line point or pie slice). */
  labels: string[]
  /** Pie and donut charts show the first series only. */
  series: ChartSeries[]
  legend: boolean
  grid: boolean
  /** Show each value next to its bar, point or slice. */
  values: boolean
  /** Bars of all series stacked on each other instead of side by side. */
  stacked?: boolean
  /** A dashed line at each series' average. */
  average?: boolean
  textColor: string
  /** In points. */
  fontSize: number
  outline?: Outline
}

export interface ChartSeries {
  name: string
  color: string
  values: number[]
}

/** Image data for pictures, stored once and referred to by id. */
export interface Asset {
  id: Id
  /** The notebook the asset belongs to, so it is deleted with it. */
  notebookId: Id
  blob: Blob
  width: number
  height: number
}

/** A contour drawn around an object: around a line, the edge of an area, or each letter. */
export interface Outline {
  color: string
  /** Thickness in points. */
  width: number
  /** Where the contour sits on the edge; outside when absent. */
  position?: 'outside' | 'center' | 'inside'
}

/** A gradient an object can be painted with. */
export type GradientPaint = LinearGradientFill | RadialGradientFill

/** Tape is a straight band that covers what is below until it is tapped open. */
export type InkTool = 'pen' | 'highlighter' | 'tape'

export interface StrokeObject extends Animatable {
  id: Id
  type: 'stroke'
  layerId: Id
  tool: InkTool
  color: string
  /** Line width in points; constant along the stroke unless `widths` is set. */
  width: number
  opacity: number
  /** Flat list of page coordinates in points: x0, y0, x1, y1, … */
  points: number[]
  /**
   * The line width at each point (fountain pen, pressure); when present it replaces `width`
   * for drawing, and `width` stays the pen's base width.
   */
  widths?: number[]
  /**
   * How the stroke was written, one value per point of `points`: kept so a stroke can be
   * redrawn or re-evaluated later exactly as it was input. Shapes and edited paths have none.
   */
  input?: StrokeInput
  /** The last point connects back to the first (shapes made with Auto shape). */
  closed?: boolean
  /** Straight lines between the points instead of a smooth curve (polygons). */
  straight?: boolean
  /**
   * The stroke as a vector path of cubic Bézier segments (see geometry/fitCurve.ts), drawn
   * instead of a curve through `points`. `points` then follows the path, for hit tests and the
   * broom.
   */
  path?: number[]
  /** A dashed or dotted line instead of a solid one. */
  dash?: StrokeDash
  outline?: Outline
  /** Paints the object with a gradient instead of its color (which stays as a fallback). */
  gradient?: GradientPaint
  /** Tape only: pulled back, so what it covers shows through. */
  revealed?: boolean
}

export type StrokeDash = 'dashed' | 'dotted'

/** The recorded input of a handwritten stroke; every array has one value per point. */
export interface StrokeInput {
  device: 'pen' | 'touch' | 'mouse'
  /** Milliseconds since the stroke began. */
  t: number[]
  /** Pressure from 0 to 1 (0.5 where the device reports none). */
  p: number[]
  /** Apple Pencil only, where the browser reports it: altitude (90 = upright) and azimuth, in degrees. */
  altitude?: number[]
  azimuth?: number[]
}

/** A filled area, e.g. the inside of a drawn circle. Drawn below its outline. */
export interface FillObject extends Animatable {
  id: Id
  type: 'fill'
  layerId: Id
  color: string
  opacity: number
  /** Outline of the area in page coordinates: x0, y0, x1, y1, … */
  points: number[]
  /** Whether the outline is a smooth curve through the points or straight edges. */
  smooth: boolean
  outline?: Outline
  /** Paints the object with a gradient instead of its color (which stays as a fallback). */
  gradient?: GradientPaint
}

export type FontFamily = 'sans' | 'serif' | 'hand' | 'mono'

export interface TextStyle {
  font: FontFamily
  /** In points. */
  size: number
  color: string
  opacity: number
  bold: boolean
  italic: boolean
  underline: boolean
  align: 'left' | 'center' | 'right'
  /** Multiple of the font size. */
  lineHeight: number
  /** A marker color behind the letters, like a highlighter pen. */
  highlight?: string
}

/**
 * A text box. (x, y) is its top-left corner before rotation; the height follows from the text,
 * width and style. Rotation is in radians around the box center.
 */
/** The parts of a text style that can differ inside one text box. */
export type SpanStyle = Partial<
  Pick<TextStyle, 'font' | 'size' | 'color' | 'bold' | 'italic' | 'underline' | 'highlight'>
>

/** Formatting for the characters from `start` up to (not including) `end`. */
export interface TextSpan {
  start: number
  end: number
  style: SpanStyle
}

export interface TextObject extends Animatable {
  id: Id
  type: 'text'
  layerId: Id
  x: number
  y: number
  width: number
  rotation: number
  text: string
  /** The style of the whole box. */
  style: TextStyle
  /** Parts formatted differently from `style`: sorted, not overlapping. */
  spans?: TextSpan[]
  /** The box is as wide as its text and grows while typing, up to the page's edge. */
  autoWidth?: boolean
  outline?: Outline
  /** Paints the object with a gradient instead of its color (which stays as a fallback). */
  gradient?: GradientPaint
}

/** A4 in PostScript points. */
export const PAGE_SIZE = { width: 595, height: 842 } as const

/** The size of a document's pages, in points. */
export interface PageSize {
  width: number
  height: number
}

/** Slides of a presentation: 16:9 or 4:3. */
export const SLIDE_SIZES = {
  wide: { width: 960, height: 540 },
  standard: { width: 800, height: 600 },
} as const

/**
 * What a document is: a notebook of pages, a presentation of slides, or a deck of flashcards
 * (pages in pairs: each card's front, then its back).
 */
export type DocumentKind = 'notebook' | 'presentation' | 'deck'

/** A flashcard's size: a landscape index card. */
export const CARD_SIZE: PageSize = { width: 640, height: 400 }

/** How well a flashcard is known: its box (0 = learning) and when it is next due. */
export interface CardStudy {
  box: number
  /** Milliseconds since the epoch. */
  due: number
  /** How often it was answered. */
  reviews: number
}
