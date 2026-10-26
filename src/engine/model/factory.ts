import type { Fill } from './fill.ts'
import { newId } from './ids.ts'
import {
  SCHEMA_VERSION,
  type Folder,
  type LayerDef,
  type DocumentKind,
  type Notebook,
  type PageSize,
  type Page,
  type PaperKind,
  type StrokeInput,
  type StrokeObject,
} from './types.ts'

export function createLayer(name: string): LayerDef {
  return { id: newId(), name, visible: true, locked: false, opacity: 1 }
}

export function createPage(notebookId: string, paper: PaperKind): Page {
  return {
    id: newId(),
    notebookId,
    schemaVersion: SCHEMA_VERSION,
    paper,
    objects: [],
    updatedAt: Date.now(),
  }
}

/** A new folder at the end of its parent's folders. */
export function createFolder(options: {
  name: string
  fill: Fill
  icon: string
  parentId?: string | null
  order?: number
}): Folder {
  const now = Date.now()
  return {
    id: newId(),
    name: options.name,
    fill: options.fill,
    icon: options.icon,
    parentId: options.parentId ?? null,
    order: options.order ?? now,
    createdAt: now,
    updatedAt: now,
  }
}

/** A new notebook with one empty page and one layer. */
export function createNotebook(options: {
  title: string
  paper: PaperKind
  cover: Fill
  folderId?: string | null
  /** A presentation has slides of `pageSize` instead of A4 pages. */
  kind?: DocumentKind
  pageSize?: PageSize
}): { notebook: Notebook; pages: Page[] } {
  const now = Date.now()
  const id = newId()
  const page = createPage(id, options.paper)
  const notebook: Notebook = {
    id,
    schemaVersion: SCHEMA_VERSION,
    ...(options.kind && options.kind !== 'notebook' ? { kind: options.kind } : {}),
    ...(options.pageSize ? { pageSize: options.pageSize } : {}),
    title: options.title,
    folderId: options.folderId ?? null,
    cover: options.cover,
    paper: options.paper,
    pageIds: [page.id],
    layers: [createLayer('Layer 1')],
    background: '#ffffff',
    createdAt: now,
    updatedAt: now,
  }
  return { notebook, pages: [page] }
}

/**
 * The same stroke along new points; a vector path and per-point values no longer match them
 * and are dropped, unless new ones are given.
 */
export function withPoints(
  stroke: StrokeObject,
  points: number[],
  widths?: number[],
  input?: StrokeInput,
): StrokeObject {
  const { path: _path, widths: _widths, input: _input, ...rest } = stroke
  return { ...rest, points, ...(widths ? { widths } : {}), ...(input ? { input } : {}) }
}
