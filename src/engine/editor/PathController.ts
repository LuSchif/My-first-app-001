import { setPageObjects } from '../commands/commands.ts'
import type { Point } from '../geometry/camera.ts'
import { samplePath } from '../geometry/fitCurve.ts'
import {
  anchorCount,
  anchorIndex,
  deleteAnchor,
  editablePath,
  handleIndex,
  insertAnchor,
  isClosedPath,
  isSmooth,
  moveAnchor,
  moveHandle,
  nearestOnPath,
  type HandleSide,
} from '../geometry/pathEdit.ts'
import type { Id, StrokeObject } from '../model/types.ts'
import { pageOrigin } from '../render/layout.ts'
import { applyCamera } from '../render/SceneRenderer.ts'
import { paintStroke } from '../render/strokes.ts'
import type { EditorContext } from './context.ts'
import { hitsObject } from './selection.ts'

/** Screen-pixel sizes, so points stay easy to hit at any zoom. */
const ANCHOR_SIZE = 11
const HANDLE_RADIUS = 5.5
const HIT_PX = 22
const CURVE_HIT_PX = 14
const ACCENT = '#b98b65'
const INK = '#3e2d25'

export interface PathEditInfo {
  /** Screen position of the selected anchor, for placing its menu. */
  anchor: Point | null
  smooth: boolean
  canDelete: boolean
}

interface Editing {
  pageId: Id
  stroke: StrokeObject
  path: number[]
  /** The selected anchor, whose handles are shown. */
  anchor: number | null
}

interface Drag {
  pointerId: number
  target: { kind: 'anchor'; index: number } | { kind: 'handle'; index: number; side: HandleSide }
  last: Point
  smooth: boolean
  moved: boolean
}

/**
 * The path tool: tap a stroke to see its anchor points, then drag anchors and their handles,
 * tap the line to add a point, or remove the selected one. Each finished drag is one undo step.
 */
export class PathController {
  private readonly ctx: EditorContext
  private editing: Editing | null = null
  private drag: Drag | null = null

  constructor(ctx: EditorContext) {
    this.ctx = ctx
  }

  get active(): boolean {
    return this.editing !== null
  }

  info(): PathEditInfo | null {
    const e = this.editing
    if (!e || this.drag) return null
    const index = this.ctx.pageIndexOf(e.pageId)
    if (index < 0) return null
    const n = anchorCount(e.path)
    const closed = isClosedPath(e.path)
    const anchor =
      e.anchor === null
        ? null
        : this.ctx.toScreen(
            index,
            e.path[anchorIndex(e.anchor)]!,
            e.path[anchorIndex(e.anchor) + 1]!,
          )
    return {
      anchor,
      smooth: e.anchor !== null && isSmooth(e.path, e.anchor),
      canDelete: e.anchor !== null && n > (closed ? 4 : 2),
    }
  }

  pointerDown(e: PointerEvent): void {
    const screen = this.ctx.screenPos(e)
    const hit = this.ctx.pageAt(screen)
    const editing = this.editing
    if (editing) {
      const target = this.targetAt(screen)
      if (target) {
        if (target.kind === 'anchor') editing.anchor = target.index
        this.drag = {
          pointerId: e.pointerId,
          target,
          last: this.local(screen),
          smooth: isSmooth(editing.path, target.index),
          moved: false,
        }
        this.draw()
        this.ctx.changed()
        return
      }
      // A tap on the line adds an anchor there, ready to drag.
      const p = this.local(screen)
      const near = nearestOnPath(editing.path, p.x, p.y)
      const zoom = this.ctx.camera().zoom
      if (near && near.distance * zoom < CURVE_HIT_PX) {
        editing.path = insertAnchor(editing.path, near.segment, near.t)
        editing.anchor = near.segment + 1
        this.drag = {
          pointerId: e.pointerId,
          target: { kind: 'anchor', index: near.segment + 1 },
          last: p,
          smooth: true,
          moved: true,
        }
        this.draw()
        return
      }
    }
    // Otherwise: start editing the stroke under the pen, or stop editing.
    const layer = this.ctx.activeLayer()
    const page = hit?.page
    const zoom = this.ctx.camera().zoom
    const stroke =
      page && layer
        ? [...page.objects]
            .reverse()
            .find(
              (o): o is StrokeObject =>
                o.type === 'stroke' &&
                o.layerId === layer.id &&
                hitsObject(o, hit.x, hit.y, 10 / zoom),
            )
        : undefined
    if (stroke && page) this.edit(page.id, stroke)
    else this.clear()
  }

  /** Whether a touch here lands on an anchor or handle (so a finger can drag it too). */
  grabs(screen: Point): boolean {
    return this.editing !== null && this.targetAt(screen) !== null
  }

  pointerMove(e: PointerEvent): boolean {
    const drag = this.drag
    const editing = this.editing
    if (!drag || !editing || e.pointerId !== drag.pointerId) return false
    const p = this.local(this.ctx.screenPos(e))
    if (drag.target.kind === 'anchor') {
      editing.path = moveAnchor(
        editing.path,
        drag.target.index,
        p.x - drag.last.x,
        p.y - drag.last.y,
      )
    } else {
      editing.path = moveHandle(
        editing.path,
        drag.target.index,
        drag.target.side,
        p.x,
        p.y,
        drag.smooth,
      )
    }
    drag.last = p
    drag.moved = true
    this.draw()
    return true
  }

  pointerUp(e: PointerEvent): boolean {
    const drag = this.drag
    if (!drag || e.pointerId !== drag.pointerId) return false
    this.drag = null
    if (drag.moved) this.commit('Edit path')
    this.draw()
    this.ctx.changed()
    return true
  }

  deleteSelectedAnchor(): void {
    const e = this.editing
    if (!e || e.anchor === null) return
    e.path = deleteAnchor(e.path, e.anchor)
    e.anchor = null
    this.commit('Delete point')
  }

  /** Turns the selected anchor into a smooth point, or a corner without handles. */
  toggleSmooth(): void {
    const e = this.editing
    if (!e || e.anchor === null) return
    const i = e.anchor
    const a = anchorIndex(i)
    const [ax, ay] = [e.path[a]!, e.path[a + 1]!]
    const neighbour = (j: number) => {
      const k = anchorIndex(Math.max(0, Math.min(anchorCount(e.path) - 1, j)))
      return [e.path[k]!, e.path[k + 1]!] as const
    }
    let path = [...e.path]
    if (isSmooth(path, i)) {
      // A corner: both handles sit on the anchor.
      for (const side of ['in', 'out'] as const) {
        const k = handleIndex(path, i, side)
        if (k >= 0) [path[k], path[k + 1]] = [ax, ay]
      }
    } else {
      const closed = isClosedPath(path)
      const last = anchorCount(path) - 1
      const prev = neighbour(i === 0 && closed ? last - 1 : i - 1)
      const next = neighbour(i === last && closed ? 1 : i + 1)
      const dx = next[0] - prev[0]
      const dy = next[1] - prev[1]
      const d = Math.hypot(dx, dy) || 1
      const reach = d / 6
      const kOut = handleIndex(path, i, 'out')
      const kIn = handleIndex(path, i, 'in')
      if (kOut >= 0)
        path = moveHandle(path, i, 'out', ax + (dx / d) * reach, ay + (dy / d) * reach, false)
      if (kIn >= 0)
        path = moveHandle(path, i, 'in', ax - (dx / d) * reach, ay - (dy / d) * reach, false)
      if (closed && (i === 0 || i === last)) {
        path = moveHandle(path, 0, 'out', ax + (dx / d) * reach, ay + (dy / d) * reach, false)
        path = moveHandle(path, last, 'in', ax - (dx / d) * reach, ay - (dy / d) * reach, false)
      }
    }
    e.path = path
    this.commit('Edit path')
  }

  clear(): void {
    if (!this.editing) return
    this.editing = null
    this.drag = null
    this.ctx.setHidden(new Set())
    this.draw()
    this.ctx.changed()
  }

  /** Follows undo and other changes to the stroke being edited. */
  onDocumentChange(): void {
    const e = this.editing
    if (!e || this.drag) return
    const stroke = this.ctx.doc.page(e.pageId)?.objects.find((o) => o.id === e.stroke.id)
    if (stroke?.type !== 'stroke') {
      this.clear()
      return
    }
    if (stroke !== e.stroke) {
      e.stroke = stroke
      e.path = editablePath(stroke)
      if (e.anchor !== null && e.anchor >= anchorCount(e.path)) e.anchor = null
    }
    this.draw()
    this.ctx.changed()
  }

  draw(): void {
    const ctx = this.ctx.overlay
    const { width, height, dpr } = this.ctx.view()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, width * dpr, height * dpr)
    const e = this.editing
    if (!e) return
    const index = this.ctx.pageIndexOf(e.pageId)
    if (index < 0) return

    // The stroke as it will look, then its skeleton.
    this.enterPageSpace(index)
    paintStroke(ctx, this.current())
    const s = (x: number, y: number) => this.ctx.toScreen(index, x, y)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.beginPath()
    const start = s(e.path[0]!, e.path[1]!)
    ctx.moveTo(start.x, start.y)
    for (let i = 2; i + 5 < e.path.length; i += 6) {
      const c1 = s(e.path[i]!, e.path[i + 1]!)
      const c2 = s(e.path[i + 2]!, e.path[i + 3]!)
      const p = s(e.path[i + 4]!, e.path[i + 5]!)
      ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, p.x, p.y)
    }
    ctx.lineWidth = 1.25
    ctx.strokeStyle = ACCENT
    ctx.stroke()

    // Handles of the selected anchor.
    if (e.anchor !== null) {
      const a = anchorIndex(e.anchor)
      const anchor = s(e.path[a]!, e.path[a + 1]!)
      for (const k of this.handlesOf(e.anchor)) {
        const h = s(e.path[k]!, e.path[k + 1]!)
        ctx.beginPath()
        ctx.moveTo(anchor.x, anchor.y)
        ctx.lineTo(h.x, h.y)
        ctx.lineWidth = 1
        ctx.strokeStyle = INK
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(h.x, h.y, HANDLE_RADIUS, 0, Math.PI * 2)
        ctx.fillStyle = '#fffcf7'
        ctx.fill()
        ctx.lineWidth = 1.5
        ctx.stroke()
      }
    }

    const n = anchorCount(e.path)
    const closed = isClosedPath(e.path)
    for (let i = 0; i < n; i++) {
      if (closed && i === n - 1) continue
      const a = anchorIndex(i)
      const p = s(e.path[a]!, e.path[a + 1]!)
      const selected = i === e.anchor || (closed && e.anchor === n - 1 && i === 0)
      ctx.beginPath()
      ctx.rect(p.x - ANCHOR_SIZE / 2, p.y - ANCHOR_SIZE / 2, ANCHOR_SIZE, ANCHOR_SIZE)
      ctx.fillStyle = selected ? INK : '#fffcf7'
      ctx.fill()
      ctx.lineWidth = 1.5
      ctx.strokeStyle = INK
      ctx.stroke()
    }
  }

  private edit(pageId: Id, stroke: StrokeObject): void {
    this.editing = { pageId, stroke, path: editablePath(stroke), anchor: null }
    this.ctx.setHidden(new Set([stroke.id]))
    this.draw()
    this.ctx.changed()
  }

  /** The stroke with the path as edited so far. */
  private current(): StrokeObject {
    const e = this.editing!
    const { straight: _straight, ...rest } = e.stroke
    return {
      ...rest,
      path: e.path,
      points: samplePath(e.path),
      ...(isClosedPath(e.path) ? { closed: true } : {}),
    }
  }

  private commit(label: string): void {
    const e = this.editing
    const page = e && this.ctx.doc.page(e.pageId)
    if (!e || !page) return
    const next = this.current()
    const after = page.objects.map((o) => (o.id === next.id ? next : o))
    e.stroke = next
    this.ctx.history.execute(setPageObjects(label, page.id, page.objects, after))
  }

  /** Handles shown for an anchor, including the joined ends of a closed path. */
  private handlesOf(i: number): number[] {
    const e = this.editing!
    const closed = isClosedPath(e.path)
    const last = anchorCount(e.path) - 1
    const anchors = closed && (i === 0 || i === last) ? [0, last] : [i]
    const out: number[] = []
    for (const a of anchors) {
      for (const side of ['in', 'out'] as const) {
        const k = handleIndex(e.path, a, side)
        if (k >= 0) out.push(k)
      }
    }
    return out
  }

  private targetAt(screen: Point): Drag['target'] | null {
    const e = this.editing!
    const index = this.ctx.pageIndexOf(e.pageId)
    const dist = (k: number) => {
      const p = this.ctx.toScreen(index, e.path[k]!, e.path[k + 1]!)
      return Math.hypot(p.x - screen.x, p.y - screen.y)
    }
    // Handles of the selected anchor win over anchors underneath them.
    if (e.anchor !== null) {
      const closed = isClosedPath(e.path)
      const last = anchorCount(e.path) - 1
      const anchors = closed && (e.anchor === 0 || e.anchor === last) ? [0, last] : [e.anchor]
      let best: { k: number; a: number; side: HandleSide } | null = null
      for (const a of anchors) {
        for (const side of ['in', 'out'] as const) {
          const k = handleIndex(e.path, a, side)
          if (k >= 0 && dist(k) < HIT_PX && (!best || dist(k) < dist(best.k))) best = { k, a, side }
        }
      }
      if (best) return { kind: 'handle', index: best.a, side: best.side }
    }
    let bestAnchor = -1
    for (let i = 0; i < anchorCount(e.path); i++) {
      const k = anchorIndex(i)
      if (dist(k) < HIT_PX && (bestAnchor < 0 || dist(k) < dist(anchorIndex(bestAnchor)))) {
        bestAnchor = i
      }
    }
    return bestAnchor >= 0 ? { kind: 'anchor', index: bestAnchor } : null
  }

  private local(screen: Point): Point {
    const e = this.editing!
    const index = this.ctx.pageIndexOf(e.pageId)
    const c = this.ctx.camera()
    const o = pageOrigin(index)
    return { x: (screen.x - c.offsetX) / c.zoom - o.x, y: (screen.y - c.offsetY) / c.zoom - o.y }
  }

  private enterPageSpace(pageIndex: number): void {
    const ctx = this.ctx.overlay
    applyCamera(ctx, this.ctx.camera(), this.ctx.view().dpr)
    const o = pageOrigin(pageIndex)
    ctx.translate(o.x, o.y)
  }
}
