import type { Fill } from './fill.ts'

/**
 * The Broomit document model. Everything here is plain, serializable data with stable ids, so it
 * can be stored in IndexedDB, undone, exported and later synced. Objects are treated as
 * immutable: a change replaces the object instead of mutating it.
 */

export type Id = string

/** Bump when the stored shape changes, and add a migration in storage/db.ts. */
export const SCHEMA_VERSION = 1

export type PaperKind = 'lined' | 'grid' | 'dotted' | 'blank'

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
}

export interface Notebook {
  id: Id
  schemaVersion: number
  title: string
  folderId: Id | null
  cover: Fill
  paper: PaperKind
  pageIds: Id[]
  /** Bottom to top. */
  layers: LayerDef[]
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
  updatedAt: number
}

export type CanvasObject = StrokeObject | TextObject | FillObject

/** A contour drawn around an object: around a line, the edge of an area, or each letter. */
export interface Outline {
  color: string
  /** Thickness in points, outside the object. */
  width: number
}

export type InkTool = 'pen' | 'highlighter'

export interface StrokeObject {
  id: Id
  type: 'stroke'
  layerId: Id
  tool: InkTool
  color: string
  /** Line width in points; constant along the stroke. */
  width: number
  opacity: number
  /** Flat list of page coordinates in points: x0, y0, x1, y1, … */
  points: number[]
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
}

export type StrokeDash = 'dashed' | 'dotted'

/** A filled area, e.g. the inside of a drawn circle. Drawn below its outline. */
export interface FillObject {
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
}

/**
 * A text box. (x, y) is its top-left corner before rotation; the height follows from the text,
 * width and style. Rotation is in radians around the box center.
 */
export interface TextObject {
  id: Id
  type: 'text'
  layerId: Id
  x: number
  y: number
  width: number
  rotation: number
  text: string
  style: TextStyle
  outline?: Outline
}

/** A4 in PostScript points. */
export const PAGE_SIZE = { width: 595, height: 842 } as const
