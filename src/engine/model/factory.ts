import type { Fill } from './fill.ts'
import { newId } from './ids.ts'
import {
  SCHEMA_VERSION,
  type LayerDef,
  type Notebook,
  type Page,
  type PaperKind,
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

/** A new notebook with one empty page and one layer. */
export function createNotebook(options: {
  title: string
  paper: PaperKind
  cover: Fill
  folderId?: string | null
}): { notebook: Notebook; pages: Page[] } {
  const now = Date.now()
  const id = newId()
  const page = createPage(id, options.paper)
  const notebook: Notebook = {
    id,
    schemaVersion: SCHEMA_VERSION,
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

/** The same stroke along new points; a vector path no longer matches them and is dropped. */
export function withPoints(stroke: StrokeObject, points: number[]): StrokeObject {
  const { path: _path, ...rest } = stroke
  return { ...rest, points }
}
