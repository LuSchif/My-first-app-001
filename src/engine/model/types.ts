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
  /** Drawing order within each layer: later objects are drawn on top. */
  objects: CanvasObject[]
  updatedAt: number
}

export type CanvasObject = StrokeObject | TextObject

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
}

/** A4 in PostScript points. */
export const PAGE_SIZE = { width: 595, height: 842 } as const
