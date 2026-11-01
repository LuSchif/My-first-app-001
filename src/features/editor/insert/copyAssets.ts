import { newId } from '../../../engine/model/ids.ts'
import type { CanvasObject, Id, Page } from '../../../engine/model/types.ts'
import { db } from '../../../storage/db.ts'
import { putAsset } from '../../../storage/notebooks.ts'

/**
 * Objects taken from another notebook keep working here: their pictures are copied into this
 * notebook (so deleting the other notebook leaves them), and links to objects that did not come
 * along (a chart following a table) are dropped.
 */
export async function bringObjects(
  objects: readonly CanvasObject[],
  notebookId: Id,
): Promise<CanvasObject[]> {
  const copied = new Map<Id, Id>()
  const ids = new Set(objects.map((o) => o.id))
  const out: CanvasObject[] = []
  for (const object of objects) {
    let next: CanvasObject = object
    if (next.type === 'image') {
      let assetId = copied.get(next.assetId)
      if (!assetId) {
        const asset = await db.assets.get(next.assetId)
        if (asset && asset.notebookId !== notebookId) {
          assetId = newId()
          await putAsset({ ...asset, id: assetId, notebookId })
        } else assetId = next.assetId
        copied.set(next.assetId, assetId)
      }
      next = { ...next, assetId }
    }
    if (next.type === 'chart' && next.sourceTableId && !ids.has(next.sourceTableId)) {
      const { sourceTableId: _link, ...rest } = next
      next = rest
    }
    out.push(next)
  }
  return out
}

/** A page from another notebook, with its pictures copied into this notebook. */
export async function bringPage(page: Page, notebookId: Id): Promise<Page> {
  return { ...page, objects: await bringObjects(page.objects, notebookId) }
}
