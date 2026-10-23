import { setPageObjects } from '../commands/commands.ts'
import type { Point } from '../geometry/camera.ts'
import type { Rect } from '../geometry/rect.ts'
import { newId } from '../model/ids.ts'
import type { CanvasObject, Id } from '../model/types.ts'
import { pageOrigin } from '../render/layout.ts'
import { paintObject } from '../render/objects.ts'
import { applyCamera } from '../render/SceneRenderer.ts'
import type { EditorContext } from './context.ts'
import {
  boundsOf,
  flipObject,
  hitsObject,
  IDENTITY,
  lassoCatches,
  recolor,
  transformObject,
  transformRect,
  type Transform,
} from './selection.ts'

/** Screen-pixel sizes, so handles stay easy to hit at any zoom. */
const HANDLE_RADIUS = 9
const ROTATE_RADIUS = 14
const HANDLE_HIT = 30
const ROTATE_OFFSET = 46
/** Below this screen height the rotate handle would sit under the toolbar; it moves below. */
const TOP_SAFE = 100
/** With snapping on, rotation moves in steps of 45°: 0, 45, 90, 135, 180 … */
const SNAP_STEP = Math.PI / 4
const DEGREE = Math.PI / 180
const FRAME_PAD = 6
const TAP_PX = 6
const PASTE_OFFSET = 16

export interface SelectionInfo {
  count: number
  /** Screen rectangle of the selection, for placing the selection menu. */
  rect: { x: number; y: number; width: number; height: number }
  /** The single selected text box, if that is all that is selected. */
  textId: Id | null
  /** Whether the corner handles for resizing are shown. */
  scaling: boolean
  /** Color of the first selected object, for the color menu. */
  color: string | null
  /** The rotate handle sits below the frame (near the top of the screen). */
  handleBelow: boolean
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
  pointerType: string
  /** 'pinch' is a two-finger move and rotate (and resize when Scale is on). */
  mode: 'move' | 'scale' | 'rotate' | 'pinch'
  start: Point
  /** Where the rotate handle sits during this drag. */
  handleSide: 'top' | 'bottom'
  /** For a pinch: both fingers in page coordinates, and the gesture at its start. */
  fingers?: Map<number, Point>
  pinchStart?: { cx: number; cy: number; angle: number; dist: number; base: Transform }
  originals: CanvasObject[]
  transform: Transform
  /** For scaling: distance from the center to the grabbed corner at the start. */
  startDist: number
  startAngle: number
}

export type LassoMode = 'freehand' | 'rect'

interface Lasso {
  pointerId: number
  pageIndex: number
  /** Where the drag began, in page coordinates; the rectangle lasso spans from here. */
  start: Point
  /** The loop in page coordinates. */
  points: number[]
  screenLength: number
  lastScreen: Point
}

/** Objects copied or cut, shared by all notebooks while the app is open. */
let clipboard: { objects: CanvasObject[]; sourcePageId: Id } | null = null

/**
 * The lasso tool: draw a loop (or a rectangle) touching objects, or tap one, to select it. Then
 * drag to move, pull a corner to resize, or the round handle to rotate freely. Copy, cut,
 * duplicate, flip and delete act on the selection. Only the active layer is selectable, like the
 * broom.
 */
export class SelectionController {
  mode: LassoMode = 'freehand'
  /** Rotation moves in 45° steps (0, 45, 90, 135, 180 …) instead of single degrees. */
  snapRotation = false
  /**
   * Resizing is opt-in: a selection only moves and rotates until "Scale" is turned on, so a drag
   * on a small selection never grabs a corner by accident.
   */
  private scaling = false
  private readonly ctx: EditorContext
  private selection: Selection | null = null
  private drag: Drag | null = null
  private lasso: Lasso | null = null
  /** Last position of the finger dragging the selection, for starting a pinch from it. */
  private lastFinger: Point | null = null
  private readonly lateFingers = new Set<number>()

  constructor(ctx: EditorContext) {
    this.ctx = ctx
  }

  get active(): boolean {
    return this.selection !== null || this.lasso !== null
  }

  get busy(): boolean {
    return this.drag !== null || this.lasso !== null
  }

  /** The selected objects' page and ids, if anything is selected. */
  get current(): { pageId: Id; ids: Id[] } | null {
    return this.selection ? { pageId: this.selection.pageId, ids: this.selection.ids } : null
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
      scaling: this.scaling,
      color: objects[0] ? colorOf(objects[0]) : null,
      handleBelow: this.handleSide() === 'bottom',
    }
  }

  // ---------- Pointer input ----------

  pointerDown(e: PointerEvent): void {
    const screen = this.ctx.screenPos(e)
    const sel = this.selection
    if (sel) {
      // Corners first when resizing is on; otherwise anything inside the frame moves it.
      const handle = this.handleAt(screen)
      if (handle && handle !== 'rotate') {
        this.startDrag(e, 'scale', screen)
        return
      }
      if (this.insideFrame(screen)) {
        this.startDrag(e, 'move', screen)
        return
      }
      if (handle === 'rotate') {
        this.startDrag(e, 'rotate', screen)
        return
      }
      this.clear()
    }
    const hit = this.ctx.pageAt(screen)
    if (!hit) return
    this.lasso = {
      pointerId: e.pointerId,
      pageIndex: hit.index,
      start: { x: hit.x, y: hit.y },
      points: [hit.x, hit.y],
      screenLength: 0,
      lastScreen: screen,
    }
    this.draw()
  }

  pointerMove(e: PointerEvent): boolean {
    const drag = this.drag
    if (drag?.fingers?.has(e.pointerId)) {
      drag.fingers.set(e.pointerId, this.toLocal(this.pageIndex(), this.ctx.screenPos(e)))
      this.updatePinch(drag)
      return true
    }
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
        if (this.mode === 'rect') {
          const a = lasso.start
          lasso.points = [a.x, a.y, local.x, a.y, local.x, local.y, a.x, local.y]
        } else {
          lasso.points.push(local.x, local.y)
        }
      }
      this.draw()
      return true
    }
    return false
  }

  pointerUp(e: PointerEvent): boolean {
    const drag = this.drag
    if (drag && (e.pointerId === drag.pointerId || drag.fingers?.has(e.pointerId))) {
      this.finishDrag(drag)
      return true
    }
    // The other finger of a finished pinch lifts later; it belongs to no gesture.
    if (this.lateFingers.delete(e.pointerId)) return true
    const lasso = this.lasso
    if (lasso && e.pointerId === lasso.pointerId) {
      this.lasso = null
      this.finishLasso(lasso)
      return true
    }
    return false
  }

  // ---------- Commands ----------

  setScaling(on: boolean): void {
    this.scaling = on
    this.draw()
    this.ctx.changed()
  }

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
    if (this.selection?.pageId !== pageId || this.selection.ids.join() !== ids.join()) {
      this.scaling = false
    }
    const page = this.ctx.doc.page(pageId)
    const objects = page?.objects.filter((o) => ids.includes(o.id)) ?? []
    const bounds = boundsOf(objects)
    this.selection = bounds ? { pageId, ids: objects.map((o) => o.id), bounds } : null
    this.draw()
    this.ctx.changed()
  }

  recolor(color: string): void {
    const sel = this.selection
    const page = sel && this.ctx.doc.page(sel.pageId)
    if (!sel || !page) return
    const ids = new Set(sel.ids)
    const after = page.objects.map((o) => (ids.has(o.id) ? recolor(o, color) : o))
    this.ctx.history.execute(setPageObjects('Color', page.id, page.objects, after))
  }

  /** Moves the selected objects onto another layer, on top of what is already there. */
  moveToLayer(layerId: Id): void {
    const sel = this.selection
    const page = sel && this.ctx.doc.page(sel.pageId)
    if (!sel || !page) return
    const ids = new Set(sel.ids)
    const moved = page.objects.filter((o) => ids.has(o.id)).map((o) => ({ ...o, layerId }))
    const after = [...page.objects.filter((o) => !ids.has(o.id)), ...moved]
    this.ctx.history.execute(setPageObjects('Move to layer', page.id, page.objects, after))
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

  /** Mirrors the selection in place, around its center. */
  flip(axis: 'horizontal' | 'vertical'): void {
    const sel = this.selection
    const page = sel && this.ctx.doc.page(sel.pageId)
    if (!sel || !page) return
    const cx = (sel.bounds.minX + sel.bounds.maxX) / 2
    const cy = (sel.bounds.minY + sel.bounds.maxY) / 2
    const ids = new Set(sel.ids)
    const after = page.objects.map((o) => (ids.has(o.id) ? flipObject(o, axis, cx, cy) : o))
    const label = axis === 'horizontal' ? 'Flip horizontally' : 'Flip vertically'
    this.ctx.history.execute(setPageObjects(label, page.id, page.objects, after))
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
    for (const p of this.scaling ? corners : []) {
      ctx.beginPath()
      ctx.arc(p.x, p.y, HANDLE_RADIUS, 0, Math.PI * 2)
      ctx.fillStyle = '#fffcf7'
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = '#3e2d25'
      ctx.stroke()
    }
    drawRotateHandle(ctx, rotate.handle.x, rotate.handle.y)

    // While rotating, show the angle next to the handle.
    if (this.drag?.mode === 'rotate') {
      let degrees = Math.round((t.angle * 180) / Math.PI) % 360
      if (degrees > 180) degrees -= 360
      if (degrees <= -180) degrees += 360
      const label = `${degrees}°`
      ctx.font = '600 13px "Plus Jakarta Sans Variable", system-ui, sans-serif'
      const w = ctx.measureText(label).width + 16
      const x = rotate.handle.x + 18
      const y = rotate.handle.y - 14
      ctx.fillStyle = '#3e2d25'
      ctx.beginPath()
      ctx.roundRect(x, y, w, 28, 14)
      ctx.fill()
      ctx.fillStyle = '#f7f2ea'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, x + 8, y + 14)
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

  /** Whether a finger is moving the selection, so a second finger can join for a pinch. */
  get touchDragging(): boolean {
    return this.drag?.pointerType === 'touch' && !this.drag.fingers
  }

  /**
   * A second finger joins a one-finger drag: from now on both fingers move, rotate (and, with
   * Scale on, resize) the selection, like turning a sheet of paper on a desk.
   */
  addFinger(e: PointerEvent): void {
    const drag = this.drag
    if (!drag || drag.fingers) return
    const index = this.pageIndex()
    const first = this.lastFinger ?? drag.start
    const second = this.toLocal(index, this.ctx.screenPos(e))
    drag.fingers = new Map([
      [drag.pointerId, first],
      [e.pointerId, second],
    ])
    drag.mode = 'pinch'
    drag.pinchStart = {
      cx: (first.x + second.x) / 2,
      cy: (first.y + second.y) / 2,
      angle: Math.atan2(second.y - first.y, second.x - first.x),
      dist: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
      base: drag.transform,
    }
    this.ctx.host.setPointerCapture(e.pointerId)
  }

  private updatePinch(drag: Drag): void {
    const [a, b] = [...drag.fingers!.values()] as [Point, Point]
    const s = drag.pinchStart!
    const cx = (a.x + b.x) / 2
    const cy = (a.y + b.y) / 2
    const angle = this.snap(
      s.base.angle + Math.atan2(b.y - a.y, b.x - a.x) - s.angle,
      drag.originals,
    )
    const scale = this.scaling
      ? Math.max(0.05, s.base.scale * (Math.hypot(b.x - a.x, b.y - a.y) / s.dist))
      : s.base.scale
    drag.transform = {
      ...s.base,
      dx: s.base.dx + cx - s.cx,
      dy: s.base.dy + cy - s.cy,
      angle,
      scale,
    }
    this.draw()
  }

  /** Whole degrees, or 45° steps with snapping on (absolute for text boxes, which know their angle). */
  private snap(angle: number, originals: CanvasObject[]): number {
    if (!this.snapRotation) return Math.round(angle / DEGREE) * DEGREE
    const base = commonTextRotation(originals)
    return Math.round((base + angle) / SNAP_STEP) * SNAP_STEP - base
  }

  private pageIndex(): number {
    return this.selection ? this.ctx.pageIndexOf(this.selection.pageId) : -1
  }

  private handleSide(): 'top' | 'bottom' {
    const sel = this.selection
    if (!sel) return 'top'
    const index = this.ctx.pageIndexOf(sel.pageId)
    const top = this.ctx.toScreen(index, sel.bounds.minX, sel.bounds.minY).y
    return top - FRAME_PAD - ROTATE_OFFSET < TOP_SAFE ? 'bottom' : 'top'
  }

  private startDrag(e: PointerEvent, mode: Drag['mode'], screen: Point): void {
    const sel = this.selection!
    const index = this.ctx.pageIndexOf(sel.pageId)
    const start = this.toLocal(index, screen)
    const cx = (sel.bounds.minX + sel.bounds.maxX) / 2
    const cy = (sel.bounds.minY + sel.bounds.maxY) / 2
    const originals = this.selectedObjects()
    this.lastFinger = start
    this.drag = {
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      mode,
      start,
      handleSide: this.handleSide(),
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
    this.lastFinger = p
    const t = drag.transform
    if (drag.mode === 'move') {
      drag.transform = { ...t, dx: p.x - drag.start.x, dy: p.y - drag.start.y }
    } else if (drag.mode === 'scale') {
      const dist = Math.hypot(p.x - t.cx, p.y - t.cy)
      drag.transform = { ...t, scale: Math.max(0.05, dist / drag.startDist) }
    } else {
      const angle = Math.atan2(p.y - t.cy, p.x - t.cx) - drag.startAngle
      drag.transform = { ...t, angle: this.snap(angle, drag.originals) }
    }
    this.draw()
  }

  private finishDrag(drag: Drag): void {
    this.drag = null
    if (drag.fingers) {
      for (const id of drag.fingers.keys()) if (id !== drag.pointerId) this.lateFingers.add(id)
      this.lateFingers.add(drag.pointerId)
    }
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

  private rotateHandle(
    corners: Point[],
    side = this.drag?.handleSide ?? this.handleSide(),
  ): { base: Point; handle: Point } {
    const [nw, ne, se, sw] = corners as [Point, Point, Point, Point]
    const [a, b] = side === 'top' ? [nw, ne] : [sw, se]
    const base = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    // Away from the frame: up from the top edge, or down from the bottom edge.
    const ux = side === 'top' ? nw.x - sw.x : sw.x - nw.x
    const uy = side === 'top' ? nw.y - sw.y : sw.y - nw.y
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
    const names: Handle[] = ['nw', 'ne', 'se', 'sw']
    const i = this.scaling ? corners.findIndex(near) : -1
    if (i >= 0) return names[i]!
    return near(this.rotateHandle(corners).handle) ? 'rotate' : null
  }

  /** Whether a pointer at this spot would move, rotate or resize the selection. */
  grabs(screen: Point): boolean {
    return this.selection !== null && (this.handleAt(screen) !== null || this.insideFrame(screen))
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

function colorOf(object: CanvasObject): string {
  return object.type === 'text' ? object.style.color : object.color
}

function commonTextRotation(objects: CanvasObject[]): number {
  const first = objects[0]
  if (first?.type !== 'text') return 0
  return objects.every((o) => o.type === 'text' && o.rotation === first.rotation)
    ? first.rotation
    : 0
}

/** A filled round button with a turning arrow, so it reads as "rotate". */
function drawRotateHandle(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.beginPath()
  ctx.arc(x, y, ROTATE_RADIUS, 0, Math.PI * 2)
  ctx.fillStyle = '#3e2d25'
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = '#fffcf7'
  ctx.stroke()
  const r = 6
  const end = Math.PI * 1.65
  ctx.beginPath()
  ctx.arc(x, y, r, Math.PI * -0.35, end)
  ctx.lineWidth = 1.75
  ctx.lineCap = 'round'
  ctx.stroke()
  // Arrow head at the end of the arc.
  const ex = x + r * Math.cos(end)
  const ey = y + r * Math.sin(end)
  ctx.beginPath()
  ctx.moveTo(ex + 3.2, ey - 0.6)
  ctx.lineTo(ex, ey)
  ctx.lineTo(ex + 0.6, ey + 3.4)
  ctx.stroke()
}
