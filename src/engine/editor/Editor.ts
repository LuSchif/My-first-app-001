import { compound, insertPages, removePage, setPageObjects } from '../commands/commands.ts'
import type { History } from '../commands/History.ts'
import type { NotebookDocument } from '../document/NotebookDocument.ts'
import { eraseFromPoints, strokeTouchesCircle } from '../geometry/erase.ts'
import { intersects } from '../geometry/rect.ts'
import type { Camera, Point } from '../geometry/camera.ts'
import { StrokeSampler } from '../input/StrokeSampler.ts'
import { createPage } from '../model/factory.ts'
import { newId } from '../model/ids.ts'
import {
  PAGE_SIZE,
  type CanvasObject,
  type Id,
  type StrokeObject,
  type TextStyle,
} from '../model/types.ts'
import { contentHeight, PAGE_PITCH, pageIndexAt, pageOrigin } from '../render/layout.ts'
import { enterPage, renderScene, type View } from '../render/SceneRenderer.ts'
import { paintStroke, setInkStyle, strokeBounds } from '../render/strokes.ts'
import { smoothedAt, smoothPoints, traceSegments } from '../geometry/strokePath.ts'
import { invalidateTextLayouts } from '../render/text.ts'
import type { EditorContext } from './context.ts'
import { hitsObject } from './selection.ts'
import { SelectionController, type SelectionInfo } from './SelectionController.ts'
import { DEFAULT_TEXT_STYLE, TextController } from './TextController.ts'

export type ToolId = 'pen' | 'highlighter' | 'broom' | 'lasso' | 'text'
export type BroomMode = 'precise' | 'stroke'

export interface EditorState {
  tool: ToolId
  pen: { color: string; width: number; opacity: number }
  highlighter: { color: string; width: number }
  broom: { size: number; mode: BroomMode }
  canUndo: boolean
  canRedo: boolean
  pageIndex: number
  pageCount: number
  /** Style for new text boxes, or of the box being edited. */
  textStyle: TextStyle
  editingText: boolean
  selection: SelectionInfo | null
  hasClipboard: boolean
}

const HIGHLIGHTER_OPACITY = 0.45
/** Space kept free above the first page for the floating toolbar. */
const TOP_INSET = 84
const SIDE_MARGIN = 24
const TWO_FINGER_TAP_MS = 280
const TAP_SLOP_PX = 12

interface InkSession {
  kind: 'ink'
  pointerId: number
  pointerType: string
  pageIndex: number
  pageId: Id
  stroke: Omit<StrokeObject, 'points'>
  sampler: StrokeSampler
  /** Filtered pen points in page coordinates, before curve smoothing. */
  local: number[]
  /** Smoothed points that can no longer change (see smoothedAt). */
  smooth: number[]
  /** Curve segments already drawn on the wet layer. */
  drawnSegments: number
  wetDirty: DeviceRect | null
  predicted: Point | null
}

interface EraseSession {
  kind: 'erase'
  pointerId: number
  pointerType: string
  last: Point
  /** Objects of each touched page before the drag began, for undo. */
  before: Map<Id, CanvasObject[]>
}

type Session = InkSession | EraseSession

interface DeviceRect {
  x: number
  y: number
  w: number
  h: number
}

/**
 * The notebook editor: renders the pages and turns pointer input into document changes.
 * It owns three canvases inside `host`: the scene (paper and finished ink), and two layers for
 * the stroke in progress ("wet" grows, "tip" holds the short end that still changes), so each
 * input event draws only a few pixels however long the stroke gets.
 */
export class Editor {
  private readonly host: HTMLElement
  private readonly doc: NotebookDocument
  private readonly history: History
  private readonly sceneCanvas: HTMLCanvasElement
  private readonly inkLayer: HTMLDivElement
  private readonly wetCanvas: HTMLCanvasElement
  private readonly tipCanvas: HTMLCanvasElement
  private readonly overlayCanvas: HTMLCanvasElement
  private readonly scene: CanvasRenderingContext2D
  private readonly wet: CanvasRenderingContext2D
  private readonly tip: CanvasRenderingContext2D
  private readonly selection: SelectionController
  private readonly text: TextController
  private hidden: ReadonlySet<Id> = new Set()
  private textTap: { pointerId: number; x: number; y: number } | null = null

  private camera: Camera = { offsetX: 0, offsetY: TOP_INSET, zoom: 1 }
  private view: View = { width: 0, height: 0, dpr: 1 }
  private hostRect: DOMRect
  private renderQueued = false
  private paintedByEditor = false
  private session: Session | null = null
  private tipDirty: DeviceRect | null = null

  private penSeen = false
  private readonly touches = new Map<number, Point>()
  private gesture: { cx: number; cy: number; dist: number; count: number } | null = null
  private panning = false
  private tap: { start: number; maxTouches: number; moved: number } | null = null
  private momentum: { vx: number; vy: number; last: number } | null = null
  private velocity: { vx: number; vy: number; t: number } = { vx: 0, vy: 0, t: 0 }
  private mousePan: { id: number; x: number; y: number } | null = null
  private frameIntervals: number[] = []
  private lastFrameAt = 0

  private _state: EditorState
  private readonly listeners = new Set<() => void>()
  private readonly cleanups: (() => void)[] = []

  constructor(host: HTMLElement, doc: NotebookDocument, history: History) {
    this.host = host
    this.doc = doc
    this.history = history
    this._state = {
      tool: 'pen',
      pen: { color: '#3e2d25', width: 2, opacity: 1 },
      highlighter: { color: '#f2cf4a', width: 14 },
      broom: { size: 16, mode: 'precise' },
      canUndo: history.canUndo,
      canRedo: history.canRedo,
      pageIndex: 0,
      pageCount: doc.notebook.pageIds.length,
      textStyle: DEFAULT_TEXT_STYLE,
      editingText: false,
      selection: null,
      hasClipboard: false,
    }

    // The canvases are positioned inside the host; keep the host's own positioning if it has one.
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative'
    host.style.touchAction = 'none'
    host.style.overscrollBehavior = 'none'
    host.style.userSelect = 'none'
    host.style.setProperty('-webkit-user-select', 'none')
    host.style.setProperty('-webkit-touch-callout', 'none')

    this.sceneCanvas = makeCanvas()
    this.inkLayer = document.createElement('div')
    Object.assign(this.inkLayer.style, { position: 'absolute', inset: '0', pointerEvents: 'none' })
    this.wetCanvas = makeCanvas()
    this.tipCanvas = makeCanvas()
    this.inkLayer.append(this.wetCanvas, this.tipCanvas)
    // Selection frames and the lasso path draw above the ink.
    this.overlayCanvas = makeCanvas()
    this.overlayCanvas.style.pointerEvents = 'none'
    host.append(this.sceneCanvas, this.inkLayer, this.overlayCanvas)

    this.scene = this.sceneCanvas.getContext('2d', { alpha: false })!
    // desynchronized asks for a low-latency path where the browser has one.
    this.wet = this.wetCanvas.getContext('2d', { desynchronized: true })!
    this.tip = this.tipCanvas.getContext('2d', { desynchronized: true })!
    this.hostRect = host.getBoundingClientRect()
    const context = this.createContext(this.overlayCanvas.getContext('2d')!)
    this.selection = new SelectionController(context)
    this.text = new TextController(context)

    this.listen(host, 'pointerdown', (e) => this.onPointerDown(e))
    this.listen(host, 'pointermove', (e) => this.onPointerMove(e))
    this.listen(host, 'pointerup', (e) => this.onPointerEnd(e))
    this.listen(host, 'pointercancel', (e) => this.onPointerEnd(e))
    this.listen(host, 'lostpointercapture', (e) => this.onPointerEnd(e))
    this.listen(host, 'pointerleave', () => this.clearTip())
    this.listen(host, 'wheel', (e) => this.onWheel(e), { passive: false })
    // iPadOS runs its own touch handling (scrolling, Scribble) unless touch events are cancelled,
    // and that delays the first pen samples of a stroke.
    for (const type of ['touchstart', 'touchmove'] as const) {
      this.listen(
        host,
        type,
        (e) => {
          if (e.target !== this.text.element) e.preventDefault()
        },
        { passive: false },
      )
    }
    // Text drawn before the web fonts arrive used fallback metrics; lay it out again.
    if (document.fonts) {
      this.listen(document.fonts as unknown as HTMLElement, 'loadingdone', () => {
        invalidateTextLayouts()
        this.requestRender()
      })
      for (const family of ['Lora Variable', 'Caveat Variable', 'JetBrains Mono Variable']) {
        void document.fonts.load(`16px "${family}"`)
      }
      void document.fonts.load('16px "Plus Jakarta Sans Variable"')
    }
    for (const type of ['gesturestart', 'gesturechange'] as const) {
      this.listen(document, type, (e) => e.preventDefault())
    }
    this.listen(window, 'keydown', (e) => this.onKeyDown(e))

    const observer = new ResizeObserver(() => this.resize())
    observer.observe(host)
    this.cleanups.push(() => observer.disconnect())
    this.cleanups.push(doc.subscribe(() => this.onDocumentChange()))
    this.cleanups.push(history.subscribe(() => this.syncHistory()))
    this.resize()
  }

  // ---------- Public API ----------

  get state(): EditorState {
    return this._state
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  setTool(tool: ToolId): void {
    if (tool !== 'text') this.text.finish()
    if (tool !== 'lasso') this.selection.clear()
    this.update({ tool })
  }

  /** Changes the box being edited, and the style for the next new box. */
  setTextStyle(patch: Partial<TextStyle>): void {
    this.text.setStyle(patch)
    this.update({ textStyle: { ...(this.text.style ?? this._state.textStyle), ...patch } })
  }

  finishText(): void {
    this.text.finish()
  }

  deleteSelection(): void {
    this.selection.deleteSelection()
  }

  copySelection(): void {
    this.selection.copy()
  }

  cutSelection(): void {
    this.selection.cut()
  }

  duplicateSelection(): void {
    this.selection.duplicate()
  }

  paste(): void {
    const page = this.doc.pageList[this._state.pageIndex]
    if (page) this.selection.paste(page.id)
  }

  /** Opens the selected text box for typing. */
  editSelectedText(): void {
    const id = this.selection.info()?.textId
    const page = this.doc.pageList.find((p) => p.objects.some((o) => o.id === id))
    const object = page?.objects.find((o) => o.id === id)
    if (!page || object?.type !== 'text') return
    this.selection.clear()
    this.update({ tool: 'text' })
    this.text.edit(page.id, object)
  }

  setPen(patch: Partial<EditorState['pen']>): void {
    this.update({ pen: { ...this._state.pen, ...patch } })
  }

  setHighlighter(patch: Partial<EditorState['highlighter']>): void {
    this.update({ highlighter: { ...this._state.highlighter, ...patch } })
  }

  setBroom(patch: Partial<EditorState['broom']>): void {
    this.update({ broom: { ...this._state.broom, ...patch } })
  }

  undo(): void {
    if (this.session || this.selection.busy) return
    this.text.finish()
    this.history.undo()
  }

  redo(): void {
    if (this.session || this.selection.busy) return
    this.text.finish()
    this.history.redo()
  }

  addPageAfterCurrent(): void {
    const index = this._state.pageIndex + 1
    this.history.execute(
      insertPages('Add page', index, [createPage(this.doc.notebook.id, this.doc.notebook.paper)]),
    )
    this.scrollToPage(index)
  }

  duplicateCurrentPage(): void {
    const source = this.doc.pageList[this._state.pageIndex]
    if (!source) return
    const copy = {
      ...createPage(this.doc.notebook.id, source.paper),
      objects: source.objects.map((o) => ({ ...o, id: newId() })),
    }
    const index = this._state.pageIndex + 1
    this.history.execute(insertPages('Duplicate page', index, [copy]))
    this.scrollToPage(index)
  }

  deleteCurrentPage(): void {
    const pages = this.doc.pageList
    const page = pages[this._state.pageIndex]
    if (!page || pages.length <= 1) return
    this.history.execute(removePage('Delete page', page.id))
  }

  scrollToPage(index: number): void {
    const z = this.camera.zoom
    this.setCamera({ ...this.camera, offsetY: TOP_INSET - pageOrigin(index).y * z })
  }

  dispose(): void {
    this.text.finish()
    this.cleanups.forEach((fn) => fn())
    this.sceneCanvas.remove()
    this.inkLayer.remove()
    this.overlayCanvas.remove()
    this.text.element.remove()
    this.listeners.clear()
  }

  // ---------- State ----------

  private update(patch: Partial<EditorState>): void {
    this._state = { ...this._state, ...patch }
    for (const listener of this.listeners) listener()
  }

  private syncHistory(): void {
    const { canUndo, canRedo } = this.history
    if (canUndo !== this._state.canUndo || canRedo !== this._state.canRedo) {
      this.update({ canUndo, canRedo })
    }
  }

  private onDocumentChange(): void {
    const pageCount = this.doc.notebook.pageIds.length
    if (pageCount !== this._state.pageCount) {
      this.update({ pageCount })
      this.setCamera(this.camera)
    }
    // The editor already painted its own new stroke; everything else needs a redraw.
    if (!this.paintedByEditor) this.requestRender()
    this.selection.onDocumentChange()
  }

  /** Shares what the selection and text controllers need, without exposing the whole editor. */
  private createContext(overlay: CanvasRenderingContext2D): EditorContext {
    return {
      doc: this.doc,
      history: this.history,
      host: this.host,
      overlay,
      camera: () => this.camera,
      view: () => this.view,
      screenPos: (e) => this.screenPos(e),
      pageAt: (screen) => {
        const w = this.toWorld(screen)
        const index = pageIndexAt(w.x, w.y, this.doc.notebook.pageIds.length)
        const page = this.doc.pageList[index]
        if (!page) return null
        const o = pageOrigin(index)
        return { index, page, x: w.x - o.x, y: w.y - o.y }
      },
      pageIndexOf: (id) => this.doc.notebook.pageIds.indexOf(id),
      toScreen: (index, x, y) => {
        const o = pageOrigin(index)
        const c = this.camera
        return { x: (x + o.x) * c.zoom + c.offsetX, y: (y + o.y) * c.zoom + c.offsetY }
      },
      activeLayer: () => this.activeLayer(),
      setHidden: (ids) => {
        this.hidden = ids
        this.requestRender()
      },
      requestRender: () => this.requestRender(),
      changed: () => this.syncControllers(),
    }
  }

  private syncControllers(): void {
    this.update({
      selection: this.selection.info(),
      hasClipboard: this.selection.hasClipboard,
      editingText: this.text.isEditing,
      textStyle: this.text.style ?? this._state.textStyle,
    })
  }

  // ---------- Camera and rendering ----------

  private fitZoom(): number {
    return Math.min(1.6, (this.view.width - SIDE_MARGIN * 2) / PAGE_SIZE.width)
  }

  /** Keeps the pages in reach: centered when narrower than the screen, never lost off-screen. */
  private clampCamera(c: Camera): Camera {
    const fit = this.fitZoom()
    const zoom = Math.min(fit * 8, Math.max(fit * 0.5, c.zoom))
    const { width, height } = this.view
    const pagesWidth = PAGE_SIZE.width * zoom
    const offsetX =
      pagesWidth + SIDE_MARGIN * 2 <= width
        ? (width - pagesWidth) / 2
        : Math.min(SIDE_MARGIN, Math.max(width - pagesWidth - SIDE_MARGIN, c.offsetX))
    const pagesHeight = contentHeight(this.doc.notebook.pageIds.length) * zoom
    const minY = Math.min(TOP_INSET, height - pagesHeight - TOP_INSET)
    const offsetY = Math.min(TOP_INSET, Math.max(minY, c.offsetY))
    return { zoom, offsetX, offsetY }
  }

  private setCamera(c: Camera): void {
    this.camera = this.clampCamera(c)
    const center = (this.view.height / 2 - this.camera.offsetY) / this.camera.zoom
    const pageIndex = Math.max(
      0,
      Math.min(this._state.pageCount - 1, Math.floor((center + 14) / PAGE_PITCH)),
    )
    if (pageIndex !== this._state.pageIndex) this.update({ pageIndex })
    this.requestRender()
    // Frames, handles and the text field follow the page.
    if (this.selection.active) {
      this.selection.draw()
      this.syncControllers()
    }
    this.text.position()
  }

  private zoomAt(anchor: Point, factor: number): void {
    const c = this.camera
    const zoom = c.zoom * factor
    const wx = (anchor.x - c.offsetX) / c.zoom
    const wy = (anchor.y - c.offsetY) / c.zoom
    this.setCamera({ zoom, offsetX: anchor.x - wx * zoom, offsetY: anchor.y - wy * zoom })
  }

  private resize(): void {
    const rect = this.host.getBoundingClientRect()
    this.hostRect = rect
    const first = this.view.width === 0
    const dpr = window.devicePixelRatio || 1
    this.view = { width: rect.width, height: rect.height, dpr }
    for (const c of [this.sceneCanvas, this.wetCanvas, this.tipCanvas, this.overlayCanvas]) {
      c.width = Math.round(rect.width * dpr)
      c.height = Math.round(rect.height * dpr)
    }
    this.tipDirty = null
    if (first && rect.width > 0) {
      this.setCamera({ zoom: this.fitZoom(), offsetX: 0, offsetY: TOP_INSET })
    } else {
      this.setCamera(this.camera)
    }
  }

  private requestRender(): void {
    if (this.renderQueued) return
    this.renderQueued = true
    requestAnimationFrame(() => {
      this.renderQueued = false
      renderScene(
        this.scene,
        this.doc.pageList,
        this.doc.notebook.layers,
        this.camera,
        this.view,
        this.hidden,
      )
    })
  }

  // ---------- Pointer input ----------

  private screenPos(e: { clientX: number; clientY: number }): Point {
    return { x: e.clientX - this.hostRect.left, y: e.clientY - this.hostRect.top }
  }

  private toWorld(p: Point): Point {
    const c = this.camera
    return { x: (p.x - c.offsetX) / c.zoom, y: (p.y - c.offsetY) / c.zoom }
  }

  private onPointerDown(e: PointerEvent): void {
    // Taps inside the text field place the caret; leave them to the browser.
    if (e.target === this.text.element) return
    e.preventDefault()
    this.hostRect = this.host.getBoundingClientRect()
    this.momentum = null
    if (e.pointerType === 'pen') this.penSeen = true

    if (e.pointerType === 'touch') {
      this.touches.set(e.pointerId, this.screenPos(e))
      this.host.setPointerCapture(e.pointerId)
      if (this.touches.size === 1) this.tap = { start: e.timeStamp, maxTouches: 1, moved: 0 }
      else if (this.tap) this.tap.maxTouches = Math.max(this.tap.maxTouches, this.touches.size)
      // Fingers pan and zoom once a pen has been used; before that, one finger can write.
      if (this.touches.size > 1 || this.penSeen) {
        if (this.session?.pointerType === 'touch') this.cancelSession()
        this.panning = true
        this.gesture = null
        this.updateGesture()
        return
      }
    }
    if (e.pointerType === 'mouse' && (e.button === 1 || e.button === 2)) {
      this.mousePan = { id: e.pointerId, ...this.screenPos(e) }
      this.host.setPointerCapture(e.pointerId)
      return
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return

    if (this.session) {
      // The pen always wins: a palm that started a stroke must not block it.
      if (e.pointerType !== 'pen') return
      this.endSession()
    }
    if (this.selection.busy || this.textTap) return

    const tool = this._state.tool
    if (tool === 'lasso') {
      this.host.setPointerCapture(e.pointerId)
      this.selection.pointerDown(e)
      return
    }
    if (tool === 'text') {
      this.host.setPointerCapture(e.pointerId)
      this.textTap = { pointerId: e.pointerId, ...this.screenPos(e) }
      return
    }
    this.text.finish()
    if (tool === 'broom') this.beginErase(e)
    else this.beginInk(e)
  }

  /**
   * Text tool taps act on release, because iPadOS only shows the keyboard for a text field
   * focused at the end of a tap. A tap on a text box edits it, a tap elsewhere ends editing,
   * and a tap on empty paper starts a new box.
   */
  private onTextTap(screen: Point): void {
    const wasEditing = this.text.isEditing
    this.text.finish()
    const w = this.toWorld(screen)
    const index = pageIndexAt(w.x, w.y, this.doc.notebook.pageIds.length)
    const page = this.doc.pageList[index]
    const layer = this.activeLayer()
    if (!page || !layer || layer.locked || !layer.visible) return
    const o = pageOrigin(index)
    const x = w.x - o.x
    const y = w.y - o.y
    const hit = [...page.objects]
      .reverse()
      .find((obj) => obj.layerId === layer.id && obj.type === 'text' && hitsObject(obj, x, y, 4))
    if (hit?.type === 'text') this.text.edit(page.id, hit)
    else if (!wasEditing) this.text.create(page.id, x, y, this._state.textStyle)
  }

  private onPointerMove(e: PointerEvent): void {
    if (this.selection.pointerMove(e)) return
    if (this.textTap?.pointerId === e.pointerId) {
      const p = this.screenPos(e)
      if (Math.hypot(p.x - this.textTap.x, p.y - this.textTap.y) > TAP_SLOP_PX) this.textTap = null
      return
    }
    const s = this.session
    if (s && e.pointerId === s.pointerId) {
      if (s.kind === 'ink') this.extendInk(s, e)
      else this.extendErase(s, e)
      return
    }
    if (this.touches.has(e.pointerId)) {
      const prev = this.touches.get(e.pointerId)!
      const p = this.screenPos(e)
      this.touches.set(e.pointerId, p)
      if (this.tap)
        this.tap.moved = Math.max(this.tap.moved, Math.hypot(p.x - prev.x, p.y - prev.y))
      if (!this.panning) return
      // Palm rejection: a hand resting on the screen must not move the page while the pen works.
      if (this.session?.pointerType === 'pen') this.gesture = null
      else this.updateGesture(e.timeStamp)
      return
    }
    if (this.mousePan?.id === e.pointerId) {
      const p = this.screenPos(e)
      this.setCamera({
        ...this.camera,
        offsetX: this.camera.offsetX + p.x - this.mousePan.x,
        offsetY: this.camera.offsetY + p.y - this.mousePan.y,
      })
      this.mousePan = { id: e.pointerId, ...p }
      return
    }
    // A hovering pencil or mouse shows where the broom will sweep.
    if (this._state.tool === 'broom' && e.pointerType !== 'touch' && !this.session) {
      this.drawBroomCursor(this.screenPos(e))
    }
  }

  private onPointerEnd(e: PointerEvent): void {
    this.selection.pointerUp(e)
    if (this.textTap?.pointerId === e.pointerId) {
      const tap = this.textTap
      this.textTap = null
      if (e.type === 'pointerup') this.onTextTap(tap)
    }
    const s = this.session
    if (s && e.pointerId === s.pointerId) this.endSession()
    if (this.touches.delete(e.pointerId)) {
      this.gesture = null
      if (this.touches.size === 0) {
        if (this.panning && this.tap) this.finishTap(e.timeStamp)
        if (this.panning) this.startMomentum(e.timeStamp)
        this.panning = false
        this.tap = null
      } else if (this.panning) {
        this.updateGesture()
      }
    }
    if (this.mousePan?.id === e.pointerId) this.mousePan = null
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault()
    this.hostRect = this.host.getBoundingClientRect()
    if (e.ctrlKey || e.metaKey) {
      // Trackpad pinches arrive as small ctrl+wheel deltas, mouse wheels as large steps.
      const delta = Math.max(-25, Math.min(25, e.deltaY))
      this.zoomAt(this.screenPos(e), Math.exp(-delta * 0.01))
    } else {
      this.setCamera({
        ...this.camera,
        offsetX: this.camera.offsetX - e.deltaX,
        offsetY: this.camera.offsetY - e.deltaY,
      })
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement | null
    if (target?.closest('input, textarea, [contenteditable="true"]')) return
    const mod = e.metaKey || e.ctrlKey
    const key = e.key.toLowerCase()
    const selected = this._state.selection !== null
    if (mod && key === 'c' && selected) {
      e.preventDefault()
      this.copySelection()
    } else if (mod && key === 'x' && selected) {
      e.preventDefault()
      this.cutSelection()
    } else if (mod && key === 'd' && selected) {
      e.preventDefault()
      this.duplicateSelection()
    } else if (mod && key === 'v' && this._state.hasClipboard) {
      e.preventDefault()
      this.setTool('lasso')
      this.paste()
    } else if ((key === 'backspace' || key === 'delete') && selected) {
      e.preventDefault()
      this.deleteSelection()
    } else if (key === 'escape') {
      this.selection.clear()
    } else if (mod && key === 'z') {
      e.preventDefault()
      if (e.shiftKey) this.redo()
      else this.undo()
    } else if (mod && key === 'y') {
      e.preventDefault()
      this.redo()
    } else if (!mod && !e.altKey) {
      if (key === 'p') this.setTool('pen')
      else if (key === 'h') this.setTool('highlighter')
      else if (key === 'e' || key === 'b') this.setTool('broom')
      else if (key === 'l') this.setTool('lasso')
      else if (key === 't') this.setTool('text')
    }
  }

  // ---------- Touch gestures ----------

  private updateGesture(time?: number): void {
    const pts = [...this.touches.values()]
    const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length
    const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length
    const a = pts[0]
    const b = pts[1]
    const dist = a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
    const next = { cx, cy, dist, count: pts.length }
    const prev = this.gesture
    if (prev && prev.count === next.count) {
      const dx = next.cx - prev.cx
      const dy = next.cy - prev.cy
      let camera = {
        ...this.camera,
        offsetX: this.camera.offsetX + dx,
        offsetY: this.camera.offsetY + dy,
      }
      if (next.count > 1 && prev.dist > 0) {
        const factor = next.dist / prev.dist
        const wx = (cx - camera.offsetX) / camera.zoom
        const wy = (cy - camera.offsetY) / camera.zoom
        const zoom = camera.zoom * factor
        camera = { zoom, offsetX: cx - wx * zoom, offsetY: cy - wy * zoom }
      }
      this.setCamera(camera)
      if (time !== undefined) {
        const dt = Math.max(1, time - this.velocity.t)
        // Smoothed velocity in px/ms for momentum scrolling after release.
        this.velocity = {
          vx: this.velocity.vx * 0.6 + (dx / dt) * 0.4,
          vy: this.velocity.vy * 0.6 + (dy / dt) * 0.4,
          t: time,
        }
      }
    } else {
      this.velocity = { vx: 0, vy: 0, t: time ?? performance.now() }
    }
    this.gesture = next
  }

  /** A quick two-finger tap undoes, a three-finger tap redoes, as in other note apps. */
  private finishTap(time: number): void {
    const tap = this.tap
    if (!tap || time - tap.start > TWO_FINGER_TAP_MS || tap.moved > TAP_SLOP_PX) return
    if (tap.maxTouches === 2) this.undo()
    else if (tap.maxTouches === 3) this.redo()
  }

  private startMomentum(time: number): void {
    const { vx, vy, t } = this.velocity
    if (time - t > 80 || Math.hypot(vx, vy) < 0.3) return
    this.momentum = { vx, vy, last: performance.now() }
    const step = (now: number) => {
      const m = this.momentum
      if (!m) return
      const dt = Math.min(32, now - m.last)
      m.last = now
      const before = this.camera
      this.setCamera({
        ...before,
        offsetX: before.offsetX + m.vx * dt,
        offsetY: before.offsetY + m.vy * dt,
      })
      const decay = Math.pow(0.995, dt)
      m.vx *= decay
      m.vy *= decay
      const stuck = this.camera.offsetX === before.offsetX && this.camera.offsetY === before.offsetY
      if (Math.hypot(m.vx, m.vy) < 0.02 || stuck) this.momentum = null
      else requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }

  // ---------- Ink ----------

  private activeLayer() {
    const layers = this.doc.notebook.layers
    return layers[layers.length - 1]
  }

  private beginInk(e: PointerEvent): void {
    const layer = this.activeLayer()
    if (!layer || layer.locked || !layer.visible) return
    const world = this.toWorld(this.screenPos(e))
    const pageIndex = pageIndexAt(world.x, world.y, this.doc.notebook.pageIds.length)
    const page = this.doc.pageList[pageIndex]
    if (!page) return

    const highlighter = this._state.tool === 'highlighter'
    const settings = highlighter ? this._state.highlighter : this._state.pen
    const session: InkSession = {
      kind: 'ink',
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      pageIndex,
      pageId: page.id,
      stroke: {
        id: newId(),
        type: 'stroke',
        layerId: layer.id,
        tool: highlighter ? 'highlighter' : 'pen',
        color: settings.color,
        width: settings.width,
        opacity: highlighter ? HIGHLIGHTER_OPACITY : this._state.pen.opacity,
      },
      sampler: new StrokeSampler(),
      local: [],
      smooth: [],
      drawnSegments: 0,
      wetDirty: null,
      predicted: null,
    }
    this.session = session
    this.host.setPointerCapture(e.pointerId)
    // The ink layers show the stroke exactly as it will look once finished.
    this.inkLayer.style.opacity = String(session.stroke.opacity)
    this.inkLayer.style.mixBlendMode = highlighter ? 'multiply' : 'normal'

    this.addInkSample(session, e)
    this.drawInk(session)
    this.lastFrameAt = 0
    requestAnimationFrame((t) => this.trackFrames(t))
  }

  private addInkSample(s: InkSession, e: PointerEvent): void {
    const p = this.screenPos(e)
    if (!s.sampler.add(p.x, p.y, e.timeStamp)) return
    const last = s.sampler.points[s.sampler.points.length - 1]!
    const local = this.toPageLocal(last, s.pageIndex)
    s.local.push(local.x, local.y)
  }

  private toPageLocal(p: Point, pageIndex: number): Point {
    const w = this.toWorld(p)
    const o = pageOrigin(pageIndex)
    return { x: w.x - o.x, y: w.y - o.y }
  }

  private extendInk(s: InkSession, e: PointerEvent): void {
    const coalesced = e.getCoalescedEvents?.() ?? []
    for (const ev of coalesced.length ? coalesced : [e]) this.addInkSample(s, ev)
    const predicted = e.getPredictedEvents?.()[0]
    s.predicted = predicted ? this.toPageLocal(this.screenPos(predicted), s.pageIndex) : null
    this.drawInk(s)
  }

  /** Draws the stroke in progress inside the input event, so new samples reach the next frame. */
  private drawInk(s: InkSession): void {
    const raw = s.local
    const n = raw.length / 2
    const { dpr } = this.view

    // A smoothed point is final once the two raw points after it exist.
    while (s.smooth.length / 2 <= n - 3) {
      s.smooth.push(...smoothedAt(raw, s.smooth.length / 2))
    }
    // A curve segment is final once the two smoothed points after its start are final.
    const settled = s.smooth.length / 2 - 2
    if (settled > s.drawnSegments) {
      const from = s.drawnSegments
      const path = new Path2D()
      path.moveTo(s.smooth[from * 2]!, s.smooth[from * 2 + 1]!)
      traceSegments(path, s.smooth, from, settled)
      this.wet.save()
      enterPage(this.wet, this.camera, dpr, s.pageIndex)
      setInkStyle(this.wet, s.stroke)
      this.wet.stroke(path)
      this.wet.restore()
      const covered = s.smooth.slice(Math.max(0, from - 1) * 2, (settled + 2) * 2)
      s.wetDirty = unionDevice(s.wetDirty, this.deviceRect(covered, s.pageIndex, s.stroke.width))
      s.drawnSegments = settled
    }

    // Unsettled end: on to the latest point, the pen tip, and one display frame beyond it.
    const extended = [...raw]
    if (s.sampler.tip) {
      const t = this.toPageLocal(s.sampler.tip, s.pageIndex)
      extended.push(t.x, t.y)
    }
    const ahead = s.predicted ?? this.predictLocal(s)
    if (ahead) extended.push(ahead.x, ahead.y)
    const start = Math.max(0, s.drawnSegments - 1)
    const end: number[] = []
    for (let i = start; i < extended.length / 2; i++) end.push(...smoothedAt(extended, i))

    this.clearTip()
    this.tip.save()
    enterPage(this.tip, this.camera, dpr, s.pageIndex)
    setInkStyle(this.tip, s.stroke)
    const path = new Path2D()
    const first = s.drawnSegments - start
    path.moveTo(end[first * 2]!, end[first * 2 + 1]!)
    if (end.length / 2 - 1 > first) traceSegments(path, end, first, end.length / 2 - 1)
    else path.lineTo(end[first * 2]! + 0.001, end[first * 2 + 1]!)
    this.tip.stroke(path)
    this.tip.restore()
    this.tipDirty = this.deviceRect(end, s.pageIndex, s.stroke.width)
  }

  private predictLocal(s: InkSession): Point | null {
    const p = s.sampler.predict(this.frameInterval())
    return p ? this.toPageLocal(p, s.pageIndex) : null
  }

  private trackFrames(now: number): void {
    if (!this.session) return
    if (this.lastFrameAt && now - this.lastFrameAt < 50) {
      this.frameIntervals.push(now - this.lastFrameAt)
      if (this.frameIntervals.length > 60) this.frameIntervals.shift()
    }
    this.lastFrameAt = now
    requestAnimationFrame((t) => this.trackFrames(t))
  }

  private frameInterval(): number {
    const iv = this.frameIntervals
    return iv.length < 5 ? 1000 / 60 : iv.reduce((a, b) => a + b, 0) / iv.length
  }

  private finishInk(s: InkSession): void {
    const raw: number[] = []
    for (const p of s.sampler.finalPoints()) {
      const local = this.toPageLocal(p, s.pageIndex)
      raw.push(local.x, local.y)
    }
    const points = smoothPoints(raw)
    const page = this.doc.page(s.pageId)
    if (page && points.length >= 2) {
      const stroke: StrokeObject = { ...s.stroke, points }
      const layers = this.doc.notebook.layers.filter((l) => l.visible)
      const onTop = layers[layers.length - 1]?.id === stroke.layerId
      // Paint the finished stroke straight onto the scene, so there is no frame without it.
      if (onTop) {
        this.scene.save()
        enterPage(this.scene, this.camera, this.view.dpr, s.pageIndex)
        paintStroke(this.scene, stroke)
        this.scene.restore()
      }
      this.paintedByEditor = onTop
      this.history.execute(setPageObjects('Draw', page.id, page.objects, [...page.objects, stroke]))
      this.paintedByEditor = false
    }
    this.clearArea(this.wet, s.wetDirty)
    this.clearTip()
  }

  // ---------- Broom ----------

  private beginErase(e: PointerEvent): void {
    const p = this.toWorld(this.screenPos(e))
    const session: EraseSession = {
      kind: 'erase',
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      last: p,
      before: new Map(),
    }
    this.session = session
    this.host.setPointerCapture(e.pointerId)
    this.sweep(session, p)
    this.drawBroomCursor(this.screenPos(e))
  }

  private extendErase(s: EraseSession, e: PointerEvent): void {
    const coalesced = e.getCoalescedEvents?.() ?? []
    for (const ev of coalesced.length ? coalesced : [e]) {
      this.sweep(s, this.toWorld(this.screenPos(ev)))
    }
    this.drawBroomCursor(this.screenPos(e))
  }

  /** Erases along the path from the last broom position to `to`, so fast sweeps leave no gaps. */
  private sweep(s: EraseSession, to: Point): void {
    const radius = this._state.broom.size / 2
    const from = s.last
    const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / (radius / 2)))
    const layer = this.activeLayer()
    if (!layer || layer.locked || !layer.visible) return
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      this.eraseAt(s, layer.id, from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, radius)
    }
    if (steps === 1 && from === to) this.eraseAt(s, layer.id, to.x, to.y, radius)
    s.last = to
  }

  private eraseAt(s: EraseSession, layerId: Id, wx: number, wy: number, radius: number): void {
    const pageCount = this.doc.notebook.pageIds.length
    // The broom can overlap two pages near a gap; check both neighbours.
    const near = Math.floor(wy / PAGE_PITCH)
    for (const index of [near - 1, near, near + 1]) {
      if (index < 0 || index >= pageCount) continue
      const page = this.doc.pageList[index]
      if (!page) continue
      const o = pageOrigin(index)
      const cx = wx - o.x
      const cy = wy - o.y
      const probe = { minX: cx - radius, minY: cy - radius, maxX: cx + radius, maxY: cy + radius }
      let changed = false
      const next: CanvasObject[] = []
      for (const object of page.objects) {
        // The broom sweeps ink; text boxes are removed with the lasso.
        if (
          object.type !== 'stroke' ||
          object.layerId !== layerId ||
          !intersects(strokeBounds(object), probe)
        ) {
          next.push(object)
          continue
        }
        // Reaching half the line width counts as touching the visible ink.
        const reach = radius + object.width / 2
        if (this._state.broom.mode === 'stroke') {
          if (strokeTouchesCircle(object.points, cx, cy, reach)) changed = true
          else next.push(object)
          continue
        }
        const pieces = eraseFromPoints(object.points, cx, cy, reach)
        if (!pieces) {
          next.push(object)
          continue
        }
        changed = true
        for (const points of pieces) next.push({ ...object, id: newId(), points })
      }
      if (!changed) continue
      if (!s.before.has(page.id)) s.before.set(page.id, page.objects)
      this.doc.setObjects(page.id, next)
    }
  }

  private finishErase(s: EraseSession): void {
    this.clearTip()
    if (s.before.size === 0) return
    const commands = [...s.before].map(([pageId, before]) =>
      setPageObjects('Erase', pageId, before, this.doc.page(pageId)?.objects ?? before),
    )
    this.history.record(compound('Erase', commands))
  }

  private drawBroomCursor(screen: Point): void {
    this.clearTip()
    const { dpr } = this.view
    const r = (this._state.broom.size / 2) * this.camera.zoom
    this.inkLayer.style.opacity = '1'
    this.inkLayer.style.mixBlendMode = 'normal'
    this.tip.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.tip.beginPath()
    this.tip.arc(screen.x, screen.y, r, 0, Math.PI * 2)
    this.tip.fillStyle = 'rgba(185, 139, 101, 0.12)'
    this.tip.fill()
    this.tip.lineWidth = 1.5
    this.tip.strokeStyle = 'rgba(62, 45, 37, 0.55)'
    this.tip.stroke()
    const pad = 4
    this.tipDirty = {
      x: Math.floor((screen.x - r - pad) * dpr),
      y: Math.floor((screen.y - r - pad) * dpr),
      w: Math.ceil((r + pad) * 2 * dpr),
      h: Math.ceil((r + pad) * 2 * dpr),
    }
  }

  // ---------- Sessions ----------

  private endSession(): void {
    const s = this.session
    if (!s) return
    this.session = null
    if (s.kind === 'ink') this.finishInk(s)
    else this.finishErase(s)
  }

  private cancelSession(): void {
    const s = this.session
    if (!s) return
    this.session = null
    if (s.kind === 'ink') {
      this.clearArea(this.wet, s.wetDirty)
      this.clearTip()
    } else {
      this.finishErase(s)
    }
  }

  // ---------- Helpers ----------

  private deviceRect(points: number[], pageIndex: number, width: number): DeviceRect {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (let i = 0; i < points.length; i += 2) {
      minX = Math.min(minX, points[i]!)
      maxX = Math.max(maxX, points[i]!)
      minY = Math.min(minY, points[i + 1]!)
      maxY = Math.max(maxY, points[i + 1]!)
    }
    const o = pageOrigin(pageIndex)
    const { zoom, offsetX, offsetY } = this.camera
    const d = this.view.dpr
    const pad = (width / 2) * zoom + 3
    return {
      x: Math.floor(((minX + o.x) * zoom + offsetX - pad) * d),
      y: Math.floor(((minY + o.y) * zoom + offsetY - pad) * d),
      w: Math.ceil(((maxX - minX) * zoom + pad * 2) * d) + 2,
      h: Math.ceil(((maxY - minY) * zoom + pad * 2) * d) + 2,
    }
  }

  private clearArea(ctx: CanvasRenderingContext2D, r: DeviceRect | null): void {
    if (!r) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(r.x, r.y, r.w, r.h)
  }

  private clearTip(): void {
    this.clearArea(this.tip, this.tipDirty)
    this.tipDirty = null
  }

  private listen<K extends string>(
    target: HTMLElement | Document | Window,
    type: K,
    handler: (e: K extends keyof HTMLElementEventMap ? HTMLElementEventMap[K] : Event) => void,
    options?: AddEventListenerOptions,
  ): void {
    const fn = handler as EventListener
    target.addEventListener(type, fn, options)
    this.cleanups.push(() => target.removeEventListener(type, fn, options))
  }
}

function makeCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  Object.assign(canvas.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    display: 'block',
  })
  return canvas
}

function unionDevice(a: DeviceRect | null, b: DeviceRect): DeviceRect {
  if (!a) return b
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y }
}
