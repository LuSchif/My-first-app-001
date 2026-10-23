import { setPageObjects } from '../commands/commands.ts'
import type { Point } from '../geometry/camera.ts'
import type { Rect } from '../geometry/rect.ts'
import { newId } from '../model/ids.ts'
import type { CanvasObject, Id, TextObject } from '../model/types.ts'
import { pageOrigin } from '../render/layout.ts'
import { paintObject } from '../render/objects.ts'
import { applyCamera } from '../render/SceneRenderer.ts'
import type { EditorContext } from './context.ts'
import {
  boundsOf,
  hitsObject,
  IDENTITY,
  lassoCatches,
  transformObject,
  transformRect,
  type Transform,
} from './selection.ts'

/** Screen-pixel sizes, so handles stay easy to hit at any zoom. */
const HANDLE_RADIUS = 9
const HANDLE_HIT = 26
const ROTATE_OFFSET = 34
const FRAME_PAD = 6
const TAP_PX = 6
const PASTE_OFFSET = 16

export interface SelectionInfo {
  count: number
  /** Screen rectangle of the selection, for placing the selection menu. */
  rect: { x: number; y: number; width: number; height: number }
  /** The single selected text box, if that is all that is selected. */
  textId: Id | null
}

type Handle = 'nw' | 'ne' | 'se' | 'sw' | 'rotate'

interface Selection {
  pageId: Id
  ids: Id[]
  /** Page coordinates of the selection at rest. */
  bounds: Rect
}

interface Drag {
  pointerId: number
  mode: 'move' | 'scale' | 'rotate'
  start: Point
  originals: CanvasObject[]
  transform: Transform
  /** For scaling: distance from the center to the grabbed corner at the start. */
  startDist: number
  startAngle: number
}

interface Lasso {
  pointerId: number
  pageIndex: number
  /** Page coordinates. */
  points: number[]
  screenLength: number
  lastScreen: Point
}

/** Objects copied or cut, shared by all notebooks while the app is open. */
let clipboard: { objects: CanvasObject[]; sourcePageId: Id } | null = null

/**
 * The lasso tool: draw a loop around objects or tap one to select it, then drag to move, pull a
 * corner to resize, or the round handle to rotate. Copy, cut, duplicate and delete act on the
 * selection. Only the active layer is selectable, like the broom.
 */
export class SelectionController {
  private readonly ctx: EditorContext
  private selection: Selection | null = null
  private drag: Drag | null = null
  private lasso: Lasso | null = null

  constructor(ctx: EditorContext) {
    this.ctx = ctx
  }

  get active(): boolean {
    return this.selection !== null || this.lasso !== null
  }

  get busy(): boolean {
    return this.drag !== null || this.lasso !== null
  }

  get hasClipboard(): boolean {
    return clipboard !== null
  }

  info(): SelectionInfo | null {
    const sel = this.selection
    if (!sel || this.drag) return null
    const index = this.ctx.pageIndexOf(sel.pageId)
    if (index < 0) return null
    const a = this.ctx.toScreen(index, sel.bounds.minX, sel.bounds.minY)
    const b = this.ctx.toScreen(index, sel.bounds.maxX, sel.bounds.maxY)
    const objects = this.selectedObjects()
    const only = objects.length === 1 ? objects[0] : undefined
    return {
      count: sel.ids.length,
      rect: { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y },
      textId: only?.type === 'text' ? only.id : null,
    }
  }

  // ---------- Pointer input ----------

  pointerDown(e: PointerEvent): void {
    const screen = this.ctx.screenPos(e)
    const sel = this.selection
    if (sel) {
      const handle = this.handleAt(screen)
      if (handle) {
        this.startDrag(e, handle === 'rotate' ? 'rotate' : 'scale', screen)
        return
      }
      if (this.insideFrame(screen)) {
        this.startDrag(e, 'move', screen)
        return
      }
      this.clear()
    }
    const hit = this.ctx.pageAt(screen)
    if (!hit) return
    this.lasso = {
      pointerId: e.pointerId,
      pageIndex: hit.index,
      points: [hit.x, hit.y],
      screenLength: 0,
      lastScreen: screen,
    }
    this.draw()
  }

  pointerMove(e: PointerEvent): boolean {
    const drag = this.drag
    if (drag && e.pointerId === drag.pointerId) {
      this.updateDrag(drag, this.ctx.screenPos(e))
      return true
    }
    const lasso = this.lasso
    if (lasso && e.pointerId === lasso.pointerId) {
      const events = e.getCoalescedEvents?.() ?? []
      for (const ev of events.length ? events : [e]) {
        const screen = this.ctx.screenPos(ev)
        lasso.screenLength += Math.hypot(
          screen.x - lasso.lastScreen.x,
          screen.y - lasso.lastScreen.y,
        )
        lasso.lastScreen = screen
        const local = this.toLocal(lasso.pageIndex, screen)
        lasso.points.push(local.x, local.y)
      }
      this.draw()
      return true
    }
    return false
  }

  pointerUp(e: PointerEvent): boolean {
    if (this.drag && e.pointerId === this.drag.pointerId) {
      this.finishDrag(this.drag)
      return true
    }
    const lasso = this.lasso
    if (lasso && e.pointerId === lasso.pointerId) {
      this.lasso = null
      this.finishLasso(lasso)
      return true
    }
    return false
  }

  // ---------- Commands ----------

  clear(): void {
    if (!this.selection && !this.lasso) return
    this.selection = null
    this.lasso = null
    this.drag = null
    this.ctx.setHidden(new Set())
    this.draw()
    this.ctx.changed()
  }

  /** Selects specific objects, e.g. after pasting. */
  select(pageId: Id, ids: Id[]): void {
    const page = this.ctx.doc.page(pageId)
    const objects = page?.objects.filter((o) => ids.includes(o.id)) ?? []
    const bounds = boundsOf(objects)
    this.selection = bounds ? { pageId, ids: objects.map((o) => o.id), bounds } : null
    this.draw()
    this.ctx.changed()
  }

  deleteSelection(): void {
    const sel = this.selection
    const page = sel && this.ctx.doc.page(sel.pageId)
    if (!sel || !page) return
    const ids = new Set(sel.ids)
    const after = page.objects.filter((o) => !ids.has(o.id))
    this.selection = null
    this.ctx.history.execute(setPageObjects('Delete', page.id, page.objects, after))
    this.draw()
    this.ctx.changed()
  }

  copy(): void {
    const sel = this.selection
    if (!sel) return
    clipboard = { objects: this.selectedObjects(), sourcePageId: sel.pageId }
    this.ctx.changed()
  }

  cut(): void {
    this.copy()
    this.deleteSelection()
  }

  duplicate(): void {
    const sel = this.selection
    if (!sel) return
    this.insertCopies(sel.pageId, this.selectedObjects(), PASTE_OFFSET, 'Duplicate')
  }

  /** Pastes onto the given page: at the same spot, or slightly offset over the originals. */
  paste(pageId: Id): void {
    if (!clipboard) return
    const page = this.ctx.doc.page(pageId)
    if (!page) return
    const originalsHere = clipboard.objects.some((o) => page.objects.some((p) => p.id === o.id))
    const offset = clipboard.sourcePageId === pageId && originalsHere ? PASTE_OFFSET : 0
    this.insertCopies(pageId, clipboard.objects, offset, 'Paste')
  }

  private insertCopies(pageId: Id, objects: CanvasObject[], offset: number, label: string): void {
    const page = this.ctx.doc.page(pageId)
    const layer = this.ctx.activeLayer()
    if (!page || !layer || layer.locked) return
    const shift: Transform = { ...IDENTITY, cx: 0, cy: 0, dx: offset, dy: offset }
    const copies = objects.map((o) => ({
      ...transformObject(o, shift),
      id: newId(),
      layerId: layer.id,
    }))
    this.ctx.history.execute(
      setPageObjects(label, page.id, page.objects, [...page.objects, ...copies]),
    )
    this.select(
      page.id,
      copies.map((c) => c.id),
    )
  }

  // ---------- Keeping in sync ----------

  /** Drops objects that no longer exist (after undo, erase or page deletion). */
  onDocumentChange(): void {
    const sel = this.selection
    if (!sel || this.drag) return
    const page = this.ctx.doc.page(sel.pageId)
    const present = page && this.ctx.pageIndexOf(sel.pageId) >= 0 ? page.objects : []
    const objects = present.filter((o) => sel.ids.includes(o.id))
    const bounds = boundsOf(objects)
    this.selection = bounds ? { ...sel, ids: objects.map((o) => o.id), bounds } : null
    this.draw()
    this.ctx.changed()
  }

  /** Redraws the frame after the camera moved. */
  draw(): void {
    const ctx = this.ctx.overlay
    const { width, height, dpr } = this.ctx.view()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, width * dpr, height * dpr)

    const lasso = this.lasso
    if (lasso) {
      this.enterPageSpace(lasso.pageIndex)
      const zoom = this.ctx.camera().zoom
      ctx.beginPath()
      for (let i = 0; i < lasso.points.length; i += 2) {
        ctx.lineTo(lasso.points[i]!, lasso.points[i + 1]!)
      }
      ctx.closePath()
      ctx.fillStyle = 'rgba(185, 139, 101, 0.08)'
      ctx.fill()
      ctx.lineWidth = 1.5 / zoom
      ctx.setLineDash([5 / zoom, 5 / zoom])
      ctx.strokeStyle = 'rgba(121, 90, 70, 0.9)'
      ctx.stroke()
      ctx.setLineDash([])
    }

    const sel = this.selection
    if (!sel) return
    const index = this.ctx.pageIndexOf(sel.pageId)
    if (index < 0) return
    const t = this.drag?.transform ?? { ...IDENTITY, cx: 0, cy: 0 }

    // While dragging, the selected objects are hidden in the scene and drawn here, transformed.
    if (this.drag) {
      this.enterPageSpace(index)
      ctx.save()
      ctx.translate(t.cx + t.dx, t.cy + t.dy)
      ctx.rotate(t.angle)
      ctx.scale(t.scale, t.scale)
      ctx.translate(-t.cx, -t.cy)
      for (const object of this.drag.originals) paintObject(ctx, object)
      ctx.restore()
    }

    const corners = this.frameCorners(index, t).map((p) => p)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.beginPath()
    corners.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
    ctx.closePath()
    ctx.lineWidth = 1.5
    ctx.setLineDash([6, 4])
    ctx.strokeStyle = '#795a46'
    ctx.stroke()
    ctx.setLineDash([])

    const rotate = this.rotateHandle(corners)
    ctx.beginPath()
    ctx.moveTo(rotate.base.x, rotate.base.y)
    ctx.lineTo(rotate.handle.x, rotate.handle.y)
    ctx.lineWidth = 1.5
    ctx.stroke()
    for (const p of [...corners, rotate.handle]) {
      ctx.beginPath()
      ctx.arc(p.x, p.y, HANDLE_RADIUS, 0, Math.PI * 2)
      ctx.fillStyle = '#fffcf7'
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = '#3e2d25'
      ctx.stroke()
    }
  }

  // ---------- Internals ----------

  private selectedObjects(): CanvasObject[] {
    const sel = this.selection
    if (!sel) return []
    const page = this.ctx.doc.page(sel.pageId)
    const ids = new Set(sel.ids)
    return page?.objects.filter((o) => ids.has(o.id)) ?? []
  }

  private finishLasso(lasso: Lasso): void {
    const page = this.ctx.doc.pageList[lasso.pageIndex]
    const layer = this.ctx.activeLayer()
    if (!page || !layer || layer.locked || !layer.visible) {
      this.clear()
      return
    }
    const candidates = page.objects.filter((o) => o.layerId === layer.id)
    let ids: Id[]
    if (lasso.screenLength < TAP_PX) {
      // A tap selects the topmost object under the pen.
      const zoom = this.ctx.camera().zoom
      const [x, y] = [lasso.points[0]!, lasso.points[1]!]
      const hit = [...candidates].reverse().find((o) => hitsObject(o, x, y, 8 / zoom))
      ids = hit ? [hit.id] : []
    } else {
      ids = candidates.filter((o) => lassoCatches(o, lasso.points)).map((o) => o.id)
    }
    if (ids.length === 0) {
      this.clear()
      return
    }
    this.select(page.id, ids)
  }

  private startDrag(e: PointerEvent, mode: Drag['mode'], screen: Point): void {
    const sel = this.selection!
    const index = this.ctx.pageIndexOf(sel.pageId)
    const start = this.toLocal(index, screen)
    const cx = (sel.bounds.minX + sel.bounds.maxX) / 2
    const cy = (sel.bounds.minY + sel.bounds.maxY) / 2
    const originals = this.selectedObjects()
    this.drag = {
      pointerId: e.pointerId,
      mode,
      start,
      originals,
      transform: { ...IDENTITY, cx, cy },
      startDist: Math.max(1, Math.hypot(start.x - cx, start.y - cy)),
      startAngle: Math.atan2(start.y - cy, start.x - cx),
    }
    this.ctx.host.setPointerCapture(e.pointerId)
    this.ctx.setHidden(new Set(sel.ids))
    this.draw()
    this.ctx.changed()
  }

  private updateDrag(drag: Drag, screen: Point): void {
    const index = this.ctx.pageIndexOf(this.selection!.pageId)
    const p = this.toLocal(index, screen)
    const t = drag.transform
    if (drag.mode === 'move') {
      drag.transform = { ...t, dx: p.x - drag.start.x, dy: p.y - drag.start.y }
    } else if (drag.mode === 'scale') {
      const dist = Math.hypot(p.x - t.cx, p.y - t.cy)
      drag.transform = { ...t, scale: Math.max(0.05, dist / drag.startDist) }
    } else {
      let angle = Math.atan2(p.y - t.cy, p.x - t.cx) - drag.startAngle
      // Snap to right angles when close, for straightening.
      const quarter = Math.PI / 2
      const snapped = Math.round(angle / quarter) * quarter
      if (Math.abs(angle - snapped) < 0.06) angle = snapped
      drag.transform = { ...t, angle }
    }
    this.draw()
  }

  private finishDrag(drag: Drag): void {
    this.drag = null
    const sel = this.selection!
    const page = this.ctx.doc.page(sel.pageId)
    this.ctx.setHidden(new Set())
    const t = drag.transform
    const changed = t.dx !== 0 || t.dy !== 0 || t.scale !== 1 || t.angle !== 0
    if (page && changed) {
      const moved = new Map(drag.originals.map((o) => [o.id, transformObject(o, t)]))
      const after = page.objects.map((o) => moved.get(o.id) ?? o)
      const label = drag.mode === 'move' ? 'Move' : drag.mode === 'scale' ? 'Resize' : 'Rotate'
      this.ctx.history.execute(setPageObjects(label, page.id, page.objects, after))
    }
    this.onDocumentChange()
    this.ctx.requestRender()
  }

  private toLocal(pageIndex: number, screen: Point): Point {
    const c = this.ctx.camera()
    const o = pageOrigin(pageIndex)
    return { x: (screen.x - c.offsetX) / c.zoom - o.x, y: (screen.y - c.offsetY) / c.zoom - o.y }
  }

  private enterPageSpace(pageIndex: number): void {
    const ctx = this.ctx.overlay
    applyCamera(ctx, this.ctx.camera(), this.ctx.view().dpr)
    const o = pageOrigin(pageIndex)
    ctx.translate(o.x, o.y)
  }

  /** Frame corners on screen, padded so thin selections stay grabbable. */
  private frameCorners(pageIndex: number, t: Transform): Point[] {
    const b = this.selection!.bounds
    const pad = FRAME_PAD / this.ctx.camera().zoom
    const padded = {
      minX: b.minX - pad,
      minY: b.minY - pad,
      maxX: b.maxX + pad,
      maxY: b.maxY + pad,
    }
    return transformRect(t, padded).map((p) => this.ctx.toScreen(pageIndex, p.x, p.y))
  }

  private rotateHandle(corners: Point[]): { base: Point; handle: Point } {
    const [nw, ne, , sw] = corners as [Point, Point, Point, Point]
    const base = { x: (nw.x + ne.x) / 2, y: (nw.y + ne.y) / 2 }
    // "Up" for the frame: from the bottom edge towards the top edge.
    const ux = nw.x - sw.x
    const uy = nw.y - sw.y
    const len = Math.hypot(ux, uy) || 1
    return {
      base,
      handle: { x: base.x + (ux / len) * ROTATE_OFFSET, y: base.y + (uy / len) * ROTATE_OFFSET },
    }
  }

  private handleAt(screen: Point): Handle | null {
    const sel = this.selection
    if (!sel) return null
    const corners = this.frameCorners(this.ctx.pageIndexOf(sel.pageId), {
      ...IDENTITY,
      cx: 0,
      cy: 0,
    })
    const near = (p: Point) => Math.hypot(p.x - screen.x, p.y - screen.y) <= HANDLE_HIT
    if (near(this.rotateHandle(corners).handle)) return 'rotate'
    const names: Handle[] = ['nw', 'ne', 'se', 'sw']
    const i = corners.findIndex(near)
    return i >= 0 ? names[i]! : null
  }

  private insideFrame(screen: Point): boolean {
    const info = this.info()
    if (!info) return false
    const { x, y, width, height } = info.rect
    const pad = FRAME_PAD + 4
    return (
      screen.x >= x - pad &&
      screen.x <= x + width + pad &&
      screen.y >= y - pad &&
      screen.y <= y + height + pad
    )
  }
}

export function isText(object: CanvasObject | undefined): object is TextObject {
  return object?.type === 'text'
}
