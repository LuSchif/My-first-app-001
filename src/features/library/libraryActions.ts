import type { Folder, Notebook } from '../../engine/model/types.ts'
import { moveFolder, moveNotebook, reorderFolders, withDescendants } from '../../storage/folders.ts'
import type { DragItem, DropTarget } from './dragDrop.ts'

/**
 * What a drop does: a notebook goes into the folder (or out of all folders); a folder goes into
 * the folder, or before or after it among the same folders.
 */
export async function applyDrop(item: DragItem, target: DropTarget, folders: Folder[]) {
  // The trash is handled by `makeDrop`; pages only go there.
  if (target.kind === 'trash' || target.kind === 'group' || item.kind === 'page') return
  if (item.kind === 'notebook') {
    await moveNotebook(item.id, target.kind === 'root' ? null : target.id)
    return
  }
  if (target.kind === 'root') {
    await moveFolder(item.id, null)
    return
  }
  if (target.place === 'inside') {
    if (withDescendants(folders, item.id).has(target.id)) return
    await moveFolder(item.id, target.id)
    return
  }
  const over = folders.find((f) => f.id === target.id)
  const moving = folders.find((f) => f.id === item.id)
  if (!over || !moving) return
  if (over.parentId !== moving.parentId) {
    if (over.parentId && withDescendants(folders, item.id).has(over.parentId)) return
    await moveFolder(item.id, over.parentId)
  }
  const siblings = folders
    .filter((f) => f.parentId === over.parentId && f.id !== item.id)
    .sort((a, b) => a.order - b.order)
    .map((f) => f.id)
  const at = siblings.indexOf(over.id) + (target.place === 'after' ? 1 : 0)
  siblings.splice(at, 0, item.id)
  await reorderFolders(siblings)
}

/** Folders as a tree, depth first, for pickers: each with its depth. */
export function folderTree(folders: readonly Folder[]): { folder: Folder; depth: number }[] {
  const out: { folder: Folder; depth: number }[] = []
  const walk = (parentId: string | null, depth: number) => {
    for (const folder of folders
      .filter((f) => f.parentId === parentId)
      .sort((a, b) => a.order - b.order)) {
      out.push({ folder, depth })
      walk(folder.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
}

/** The notebooks in a folder (not its subfolders), most recently edited first. */
export function notebooksIn(notebooks: readonly Notebook[], folderId: string | null): Notebook[] {
  return notebooks.filter((n) => n.folderId === folderId).sort((a, b) => b.updatedAt - a.updatedAt)
}

/** How many notebooks a folder holds, at any depth. */
export function countNotebooks(
  folders: readonly Folder[],
  notebooks: readonly Notebook[],
  folderId: string,
): number {
  const ids = withDescendants(folders, folderId)
  return notebooks.filter((n) => n.folderId && ids.has(n.folderId)).length
}

/** The path from the top level down to a folder. */
export function folderPath(folders: readonly Folder[], id: string): Folder[] {
  const path: Folder[] = []
  let current = folders.find((f) => f.id === id)
  while (current && path.length < 50) {
    path.unshift(current)
    const parentId = current.parentId
    current = parentId ? folders.find((f) => f.id === parentId) : undefined
  }
  return path
}
