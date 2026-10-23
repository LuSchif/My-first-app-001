import {
  compound,
  insertPages,
  removePage,
  setLayers,
  setPageBackground,
  setPageObjects,
} from '../commands/commands.ts'
import type { History } from '../commands/History.ts'
import type { NotebookDocument } from '../document/NotebookDocument.ts'
import { eraseFromPoints, strokeTouchesCircle } from '../geometry/erase.ts'
import { fitPath } from '../geometry/fitCurve.ts'
import { intersects } from '../geometry/rect.ts'
import type { Camera, Point } from '../geometry/camera.ts'
import { StrokeSampler } from '../input/StrokeSampler.ts'
import { createPage, withPoints } from '../model/factory.ts'
import { newId } from '../model/ids.ts'
import {
  PAGE_SIZE,
  type CanvasObject,
  type Id,
  type LayerDef,
  type StrokeDash,
  type StrokeObject,
  type TextStyle,
} from '../model/types.ts'
import { contentHeight, PAGE_PITCH, pageIndexAt, pageOrigin } from '../render/layout.ts'
import { enterPage, renderScene, type View } from '../render/SceneRenderer.ts'
import { paintStroke, setInkStyle, strokeBounds } from '../render/strokes.ts'
import { perfectShape, recognizeShape, regionAt, type Shape } from '../geometry/shapes.ts'
import {
  SMOOTH_RADIUS,
  smoothedAt,
  smoothPoints,
  traceSegments,
  traceStroke,
} from '../geometry/strokePath.ts'
import { boundsOfPoints } from '../geometry/rect.ts'
import { drawBroom } from '../render/broomGlyph.ts'
import { objectBounds, paintObject } from '../render/objects.ts'
import { invalidateTextLayouts } from '../render/text.ts'
import type { EditorContext } from './context.ts'
import { hitsObject, recolor } from './selection.ts'
import {
  applySuggestion,
  around,
  fillFor,
  insertBelow,
  outlineSources,
  suggestFor,
  type Suggestion,
} from './suggestions.ts'
import {
  addLayer,
  layerBlock,
  moveLayer,
  patchLayer,
  removeLayer,
  type LayerPatch,
} from './layers.ts'
import { SelectionController, type LassoMode, type SelectionInfo } from './SelectionController.ts'
import { DEFAULT_TEXT_STYLE, TextController } from './TextController.ts'
import { PathController, type PathEditInfo } from './PathController.ts'

export type ToolId = 'pen' | 'highlighter' | 'broom' | 'lasso' | 'text' | 'path'
export type BroomMode = 'precise' | 'stroke'

export interface EditorState {
  tool: ToolId
  pen: { color: string; width: number; opacity: number; dash: StrokeDash | null }
  highlighter: { color: string; width: number }
  broom: { size: number; mode: BroomMode }
  canUndo: boolean
  canRedo: boolean
  pageIndex: number
  pageCount: number
  /** Style for new text boxes, or of the box being edited. */
  textStyle: TextStyle
  editingText: boolean
  lassoMode: LassoMode
  snapRotation: boolean
  /** The five most recently used colors, newest first. */
  recentColors: string[]
  /** Offer Auto shape and Auto fill after drawing. */
  suggest: boolean
  /** The offer currently shown, placed near what it would change. */
  suggestion: { kind: 'shape' | 'fill'; label: string; rect: ScreenRect } | null
  selection: SelectionInfo | null
  /** The stroke being edited with the path tool. */
  pathEdit: PathEditInfo | null
  hasClipboard: boolean
  /** The notebook's layers, bottom to top. */
  layers: LayerDef[]
  /** The layer new ink, text and selections belong to. */
  activeLayerId: Id
  /** A short message, e.g. why the pen does nothing on a hidden layer. */
  notice: string | null
}

const HIGHLIGHTER_OPACITY = 0.45
/** Space kept free above the first page for the floating toolbar. */
const TOP_INSET = 84
const SIDE_MARGIN = 24
/** Resting the pen this long after drawing a shape turns it into the perfect shape. */
const HOLD_MS = 550
const HOLD_SLOP_PX = 4
/** How closely a finished stroke's vector path follows the pen, in screen pixels. */
const FIT_TOLERANCE_PX = 1.2
const MIN_HOLD_SHAPE = 30

/** Pause after a stroke before looking for shapes to offer. */
const SUGGEST_DELAY_MS = 350
const DEFAULT_RECENT_COLORS = ['#3e2d25', '#4a80c0', '#c4473a', '#5f9a4a', '#f2cf4a']
const RECENT_LIMIT = 5

/** Room kept free above the keyboard for the text format bar. */
const FORMAT_BAR_SPACE = 84
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
  /** Where the pen last moved noticeably, and the timer for "hold to perfect". */
  holdAt: Point
  holdTimer: ReturnType<typeof setTimeout> | null
  /** Set once the pen was held still: the stroke becomes this perfect shape. */
  snapped: Shape | null
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

interface ScreenRect {
  x: number
  y: number
  width: number
  height: number
}

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
  private readonly paths: PathController
  private hidden: ReadonlySet<Id> = new Set()
  private textTap: { pointerId: number; x: number; y: number } | null = null
  /** Screen pixels at the bottom hidden by the keyboard and format bar while typing. */
  private bottomInset = 0
  private pending: { pageId: Id; layerId: Id; suggestion: Suggestion } | null = null
  private suggestTimer: ReturnType<typeof setTimeout> | null = null
  private noticeTimer: ReturnType<typeof setTimeout> | null = null
  /** Layers before an opacity drag started, so the whole drag is one undo step. */
  private opacityBefore: LayerDef[] | null = null

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
      pen: { color: '#3e2d25', width: 2, opacity: 1, dash: null },
      highlighter: { color: '#f2cf4a', width: 14 },
      broom: { size: 16, mode: 'precise' },
      canUndo: history.canUndo,
      canRedo: history.canRedo,
      pageIndex: 0,
      pageCount: doc.notebook.pageIds.length,
      textStyle: DEFAULT_TEXT_STYLE,
      editingText: false,
      lassoMode: 'freehand',
      snapRotation: false,
      recentColors: DEFAULT_RECENT_COLORS,
      suggest: true,
      suggestion: null,
      selection: null,
      pathEdit: null,
      hasClipboard: false,
      layers: doc.notebook.layers,
      activeLayerId: doc.notebook.layers[doc.notebook.layers.length - 1]?.id ?? '',
      notice: null,
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
    this.paths = new PathController(context)

    this.listen(host, 'pointerdown', (e) => this.onPointerDown(e))
    this.listen(host, 'pointermove', (e) => this.onPointerMove(e))
    this.listen(host, 'pointerup', (e) => this.onPointerEnd(e))
    this.listen(host, 'pointercancel', (e) => this.onPointerEnd(e))
    // Only the host losing its capture ends a pointer. iPadOS captures a touch to the element it
    // lands on; moving that capture to the host makes the canvas report a loss, which is no end.
    this.listen(host, 'lostpointercapture', (e) => {
      if (e.target === host) this.onPointerEnd(e)
    })
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
    // iPadOS shows the keyboard only for a field focused during the touch itself; focusing again
    // at touchend makes sure the keyboard opens for a newly created text box.
    this.listen(host, 'touchend', () => this.text.refocus())
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
    // The on-screen keyboard shrinks the visual viewport; keep the text being typed in view.
    const vv = window.visualViewport
    if (vv) {
      this.listen(vv as unknown as HTMLElement, 'resize', () => this.updateBottomInset())
      this.listen(vv as unknown as HTMLElement, 'scroll', () => this.updateBottomInset())
    }

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
    this.dismissSuggestion()
    if (tool !== 'text') this.text.finish()
    if (tool !== 'lasso') this.selection.clear()
    if (tool !== 'path') this.paths.clear()
    this.update({ tool })
  }

  /** Changes the box being edited, and the style for the next new box. */
  setTextStyle(patch: Partial<TextStyle>): void {
    if (patch.color) this.rememberColor(patch.color)
    this.text.setStyle(patch)
    this.update({ textStyle: { ...(this.text.style ?? this._state.textStyle), ...patch } })
  }

  finishText(): void {
    this.text.finish()
  }

  setLassoMode(mode: LassoMode): void {
    this.selection.mode = mode
    this.update({ lassoMode: mode })
  }

  flipSelection(axis: 'horizontal' | 'vertical'): void {
    this.selection.flip(axis)
  }

  recolorSelection(color: string): void {
    this.rememberColor(color)
    this.selection.recolor(color)
  }

  setSelectionScaling(on: boolean): void {
    this.selection.setScaling(on)
  }

  // ---------- Layers ----------

  setActiveLayer(id: Id): void {
    if (id === this._state.activeLayerId) return
    this.text.finish()
    this.selection.clear()
    this.dismissSuggestion()
    this.update({ activeLayerId: id })
  }

  addLayer(): void {
    const { command, id } = addLayer(this.doc, this._state.activeLayerId)
    this.history.execute(command)
    this.setActiveLayer(id)
  }

  deleteLayer(id: Id): void {
    const command = removeLayer(this.doc, id)
    if (!command) return
    if (id === this._state.activeLayerId) {
      const layers = this.doc.notebook.layers
      const index = layers.findIndex((l) => l.id === id)
      this.setActiveLayer((layers[index - 1] ?? layers[index + 1])!.id)
    }
    this.history.execute(command)
  }

  moveLayer(id: Id, step: 1 | -1): void {
    const command = moveLayer(this.doc, id, step)
    if (command) this.history.execute(command)
  }

  /** Renames, shows, hides or locks a layer as one undoable step. */
  updateLayer(id: Id, patch: LayerPatch): void {
    const before = this.doc.notebook.layers
    this.history.execute(setLayers('Layer', before, patchLayer(before, id, patch)))
  }

  /** Shows a new layer opacity while its slider moves; `commit` records it for undo. */
  setLayerOpacity(id: Id, opacity: number, commit: boolean): void {
    this.opacityBefore ??= this.doc.notebook.layers
    const after = patchLayer(this.doc.notebook.layers, id, { opacity })
    if (!commit) {
      this.doc.updateNotebook({ layers: after })
      return
    }
    const before = this.opacityBefore
    this.opacityBefore = null
    this.history.execute(setLayers('Layer opacity', before, after))
  }

  /** Moves the selection onto another layer and keeps it selected there. */
  moveSelectionToLayer(id: Id): void {
    const sel = this.selection.current
    if (!sel) return
    this.selection.moveToLayer(id)
    this.update({ activeLayerId: id })
    this.selection.select(sel.pageId, sel.ids)
  }

  setSnapRotation(on: boolean): void {
    this.selection.snapRotation = on
    this.update({ snapRotation: on })
  }

  /** Path tool: removes the selected anchor point. */
  deletePathPoint(): void {
    this.paths.deleteSelectedAnchor()
  }

  /** Path tool: switches the selected anchor between a smooth point and a corner. */
  togglePathPointSmooth(): void {
    this.paths.toggleSmooth()
  }

  finishPathEdit(): void {
    this.paths.clear()
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

  setSuggest(on: boolean): void {
    if (!on) this.dismissSuggestion()
    this.update({ suggest: on })
  }

  /** Turns the drawn stroke into the recognized shape, or fills the colored-in area. */
  acceptSuggestion(): void {
    const pending = this.pending
    const page = pending && this.doc.page(pending.pageId)
    this.dismissSuggestion()
    if (!pending || !page) return
    const after = applySuggestion(page.objects, pending.suggestion, pending.layerId, newId)
    const label = pending.suggestion.kind === 'shape' ? 'Auto shape' : 'Auto fill'
    this.history.execute(setPageObjects(label, page.id, page.objects, after))
  }

  /**
   * Looks for a shape or fill to offer once the pen has rested briefly, never while writing:
   * the analysis must not delay the next stroke.
   */
  private scheduleSuggestion(pageId: Id, stroke: StrokeObject): void {
    if (this.suggestTimer) clearTimeout(this.suggestTimer)
    this.suggestTimer = setTimeout(() => {
      this.suggestTimer = null
      if (this.session) return
      const objects = this.doc.page(pageId)?.objects
      if (!objects?.some((o) => o.id === stroke.id)) return
      const suggestion = suggestFor(objects, stroke)
      if (suggestion) this.offer(pageId, stroke.layerId, suggestion)
    }, SUGGEST_DELAY_MS)
  }

  dismissSuggestion(): void {
    if (this.suggestTimer) {
      clearTimeout(this.suggestTimer)
      this.suggestTimer = null
    }
    if (!this.pending && !this._state.suggestion) return
    this.pending = null
    this.update({ suggestion: null })
  }

  /** Drops an offer whose strokes changed or disappeared (e.g. erased). */
  private checkSuggestion(): void {
    const pending = this.pending
    if (!pending) return
    const page = this.doc.page(pending.pageId)
    const s = pending.suggestion
    const needed = s.kind === 'shape' ? s.strokeIds : [...s.region.sourceIds, ...s.removeIds]
    if (!page || !needed.every((id) => page.objects.some((o) => o.id === id))) {
      this.dismissSuggestion()
    }
  }

  private offer(pageId: Id, layerId: Id, suggestion: Suggestion): void {
    this.pending = { pageId, layerId, suggestion }
    this.placeSuggestion()
  }

  /** Keeps the offer next to what it changes as the page moves. */
  private placeSuggestion(): void {
    const pending = this.pending
    if (!pending) return
    const index = this.doc.notebook.pageIds.indexOf(pending.pageId)
    const page = this.doc.page(pending.pageId)
    const s = pending.suggestion
    const points = page ? (s.kind === 'fill' ? s.region.points : s.shape.points) : null
    if (index < 0 || !points) {
      this.dismissSuggestion()
      return
    }
    const b = boundsOfPoints(points)
    const o = pageOrigin(index)
    const { zoom, offsetX, offsetY } = this.camera
    const rect = {
      x: (b.minX + o.x) * zoom + offsetX,
      y: (b.minY + o.y) * zoom + offsetY,
      width: (b.maxX - b.minX) * zoom,
      height: (b.maxY - b.minY) * zoom,
    }
    const label = s.kind === 'shape' ? `Auto shape · ${s.shape.label}` : 'Auto fill'
    this.update({ suggestion: { kind: s.kind, label, rect } })
  }

  setRecentColors(colors: string[]): void {
    if (colors.length > 0) this.update({ recentColors: colors.slice(0, RECENT_LIMIT) })
  }

  /**
   * Uses a color where it makes sense right now: on the selection, the text being typed, the
   * highlighter, or otherwise the pen.
   */
  applyColor(color: string): void {
    this.rememberColor(color)
    const tool = this._state.tool
    if (this._state.selection) this.selection.recolor(color)
    else if (this.text.isEditing || tool === 'text') this.setTextStyle({ color })
    else if (tool === 'highlighter') this.setHighlighter({ color })
    else {
      this.setPen({ color })
      if (tool !== 'pen') this.setTool('pen')
    }
  }

  /** Shows what dropping a color at this point would change. */
  previewColorDrop(clientX: number, clientY: number, color: string): void {
    this.clearTip()
    const target = this.colorTarget(clientX, clientY)
    if (!target) return
    const { dpr, width, height } = this.view
    this.inkLayer.style.opacity = '1'
    this.inkLayer.style.mixBlendMode = 'normal'
    this.tip.save()
    enterPage(this.tip, this.camera, dpr, target.pageIndex)
    const zoom = this.camera.zoom
    if (target.region) {
      const path = new Path2D()
      traceStroke(path, target.region.points, { closed: true, straight: !target.region.smooth })
      this.tip.globalAlpha = 0.85
      this.tip.fillStyle = color
      this.tip.fill(path)
      this.tip.globalAlpha = 1
      this.tip.lineWidth = 2 / zoom
      this.tip.setLineDash([6 / zoom, 4 / zoom])
      this.tip.strokeStyle = '#795a46'
      this.tip.stroke(path)
    } else if (target.object) {
      paintObject(this.tip, recolor(target.object, color))
      const b = objectBounds(target.object)
      const pad = 6 / zoom
      this.tip.lineWidth = 2 / zoom
      this.tip.setLineDash([6 / zoom, 4 / zoom])
      this.tip.strokeStyle = '#795a46'
      this.tip.strokeRect(
        b.minX - pad,
        b.minY - pad,
        b.maxX - b.minX + pad * 2,
        b.maxY - b.minY + pad * 2,
      )
    } else {
      this.tip.globalAlpha = 0.45
      this.tip.fillStyle = color
      this.tip.fillRect(0, 0, PAGE_SIZE.width, PAGE_SIZE.height)
      this.tip.globalAlpha = 1
      this.tip.lineWidth = 3 / zoom
      this.tip.strokeStyle = '#795a46'
      this.tip.strokeRect(0, 0, PAGE_SIZE.width, PAGE_SIZE.height)
    }
    this.tip.restore()
    this.tipDirty = { x: 0, y: 0, w: width * dpr, h: height * dpr }
  }

  endColorPreview(): void {
    this.clearTip()
  }

  /**
   * Dropped on ink, text or a filled area, the color recolors it; inside a closed outline, it
   * fills that area; on empty paper, it colors the page.
   */
  dropColor(clientX: number, clientY: number, color: string): void {
    this.clearTip()
    const target = this.colorTarget(clientX, clientY)
    if (!target) return
    this.rememberColor(color)
    const page = target.page
    if (target.region && target.layerId) {
      const fill = fillFor(target.region, color, 1, target.layerId, newId())
      const after = insertBelow(page.objects, fill, target.region.sourceIds)
      this.history.execute(setPageObjects('Fill', page.id, page.objects, after))
    } else if (target.object) {
      const id = target.object.id
      const after = page.objects.map((o) => (o.id === id ? recolor(o, color) : o))
      this.history.execute(setPageObjects('Color', page.id, page.objects, after))
    } else {
      this.history.execute(setPageBackground(page.id, page.background, color))
    }
  }

  private colorTarget(clientX: number, clientY: number) {
    this.hostRect = this.host.getBoundingClientRect()
    const world = this.toWorld(this.screenPos({ clientX, clientY }))
    const pageIndex = pageIndexAt(world.x, world.y, this.doc.notebook.pageIds.length)
    const page = this.doc.pageList[pageIndex]
    if (!page) return null
    const o = pageOrigin(pageIndex)
    const x = world.x - o.x
    const y = world.y - o.y
    const layer = this.activeLayer()
    const slop = 8 / this.camera.zoom
    const usable = layer && !layer.locked && layer.visible ? layer : undefined
    const object = usable
      ? [...page.objects]
          .reverse()
          .find((obj) => obj.layerId === usable.id && hitsObject(obj, x, y, slop))
      : undefined
    // Inside a closed outline (and not on a stroke or an existing fill): fill that area.
    const region =
      usable && !object
        ? regionAt(outlineSources(page.objects, usable.id, around(x, y, 400)), x, y)
        : null
    return { page, pageIndex, object, region, layerId: usable?.id }
  }

  private rememberColor(color: string): void {
    const current = this._state.recentColors
    if (current[0] === color) return
    const next = [color, ...current.filter((c) => c !== color)].slice(0, RECENT_LIMIT)
    this.update({ recentColors: next })
  }

  setPen(patch: Partial<EditorState['pen']>): void {
    if (patch.color) this.rememberColor(patch.color)
    this.update({ pen: { ...this._state.pen, ...patch } })
  }

  setHighlighter(patch: Partial<EditorState['highlighter']>): void {
    if (patch.color) this.rememberColor(patch.color)
    this.update({ highlighter: { ...this._state.highlighter, ...patch } })
  }

  setBroom(patch: Partial<EditorState['broom']>): void {
    this.update({ broom: { ...this._state.broom, ...patch } })
  }

  undo(): void {
    if (this.session || this.selection.busy) return
    this.text.finish()
    this.dismissSuggestion()
    this.history.undo()
  }

  redo(): void {
    if (this.session || this.selection.busy) return
    this.text.finish()
    this.dismissSuggestion()
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
      ...(source.background ? { background: source.background } : {}),
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
    if (this.noticeTimer) clearTimeout(this.noticeTimer)
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
    this.syncLayers()
    const pageCount = this.doc.notebook.pageIds.length
    if (pageCount !== this._state.pageCount) {
      this.update({ pageCount })
      this.setCamera(this.camera)
    }
    // The editor already painted its own new stroke; everything else needs a redraw.
    if (!this.paintedByEditor) this.requestRender()
    this.selection.onDocumentChange()
    this.paths.onDocumentChange()
    this.checkSuggestion()
  }

  private syncLayers(): void {
    const layers = this.doc.notebook.layers
    if (layers === this._state.layers) return
    const active = layers.find((l) => l.id === this._state.activeLayerId)
    const activeLayerId = active ? active.id : (layers[layers.length - 1]?.id ?? '')
    if (activeLayerId !== this._state.activeLayerId || layerBlock(active)) {
      this.text.finish()
      this.selection.clear()
    }
    this.update({ layers, activeLayerId })
  }

  private showNotice(notice: string): void {
    if (this.noticeTimer) clearTimeout(this.noticeTimer)
    this.noticeTimer = setTimeout(() => this.update({ notice: null }), 2600)
    this.update({ notice })
  }

  /** Explains, instead of doing nothing, why the active layer cannot be changed. */
  private blockedByLayer(): boolean {
    const layer = this.activeLayer()
    const block = layerBlock(layer)
    if (!block || !layer) return false
    this.showNotice(
      block === 'hidden'
        ? `${layer.name} is hidden. Show it in Layers to work on it.`
        : `${layer.name} is locked. Unlock it in Layers to work on it.`,
    )
    return true
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
      scrollBy: (dy) => this.setCamera({ ...this.camera, offsetY: this.camera.offsetY + dy }),
      visibleArea: () => ({ top: TOP_INSET, bottom: this.view.height - this.bottomInset }),
      changed: () => this.syncControllers(),
    }
  }

  private syncControllers(): void {
    if (this.text.isEditing !== this._state.editingText) {
      queueMicrotask(() => this.updateBottomInset())
    }
    this.update({
      selection: this.selection.info(),
      pathEdit: this.paths.info(),
      hasClipboard: this.selection.hasClipboard,
      editingText: this.text.isEditing,
      textStyle: this.text.style ?? this._state.textStyle,
    })
  }

  private updateBottomInset(): void {
    let inset = 0
    if (this.text.isEditing) {
      const vv = window.visualViewport
      const visibleBottom = vv ? vv.offsetTop + vv.height - this.hostRect.top : this.view.height
      inset = Math.max(0, this.view.height - visibleBottom) + FORMAT_BAR_SPACE
    }
    if (inset === this.bottomInset && !this.text.isEditing) return
    this.bottomInset = inset
    this.setCamera(this.camera)
    this.text.ensureVisible()
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
    // While typing, the last page may scroll up above the keyboard.
    const minY = Math.min(TOP_INSET, height - pagesHeight - TOP_INSET - this.bottomInset)
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
    // Frames, handles, offers and the text field follow the page.
    if (this.pending) this.placeSuggestion()
    if (this.selection.active) {
      this.selection.draw()
      this.syncControllers()
    }
    if (this.paths.active) {
      this.paths.draw()
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

    // A second finger joins a finger already moving the selection: two-finger rotate.
    if (e.pointerType === 'touch' && this._state.tool === 'lasso' && this.selection.touchDragging) {
      this.host.setPointerCapture(e.pointerId)
      this.selection.addFinger(e)
      return
    }
    // A finger on a selection's frame or rotate handle moves or rotates it instead of panning.
    if (
      e.pointerType === 'touch' &&
      this.touches.size === 0 &&
      this._state.tool === 'lasso' &&
      !this.selection.busy &&
      this.selection.grabs(this.screenPos(e))
    ) {
      this.host.setPointerCapture(e.pointerId)
      this.selection.pointerDown(e)
      return
    }
    // A finger on an anchor point of the path being edited drags it.
    if (
      e.pointerType === 'touch' &&
      this.touches.size === 0 &&
      this._state.tool === 'path' &&
      this.paths.grabs(this.screenPos(e))
    ) {
      this.host.setPointerCapture(e.pointerId)
      this.paths.pointerDown(e)
      return
    }
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
        // With the text tool, a one-finger tap still places text: the finger brings up the
        // keyboard, while a pencil tap brings up iPadOS's handwriting (Scribble) bar.
        this.textTap =
          this._state.tool === 'text' && this.touches.size === 1
            ? { pointerId: e.pointerId, ...this.screenPos(e) }
            : null
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

    // An offer is meant for the stroke just drawn; the next action moves on.
    this.dismissSuggestion()
    if (this.blockedByLayer()) return
    const tool = this._state.tool
    if (tool === 'lasso') {
      this.host.setPointerCapture(e.pointerId)
      this.selection.pointerDown(e)
      return
    }
    if (tool === 'path') {
      this.host.setPointerCapture(e.pointerId)
      this.paths.pointerDown(e)
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
    if (!page || !layer || this.blockedByLayer()) return
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
    if (this.paths.pointerMove(e)) return
    if (this.textTap?.pointerId === e.pointerId) {
      const p = this.screenPos(e)
      if (Math.hypot(p.x - this.textTap.x, p.y - this.textTap.y) > TAP_SLOP_PX) this.textTap = null
      // A finger keeps panning while it decides between tap and scroll.
      if (e.pointerType !== 'touch') return
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
    this.paths.pointerUp(e)
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

  private activeLayer(): LayerDef | undefined {
    const layers = this.doc.notebook.layers
    return layers.find((l) => l.id === this._state.activeLayerId) ?? layers[layers.length - 1]
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
        ...(!highlighter && this._state.pen.dash ? { dash: this._state.pen.dash } : {}),
      },
      sampler: new StrokeSampler(),
      local: [],
      smooth: [],
      drawnSegments: 0,
      wetDirty: null,
      predicted: null,
      holdAt: this.screenPos(e),
      holdTimer: null,
      snapped: null,
    }
    this.session = session
    this.host.setPointerCapture(e.pointerId)
    // The ink layers show the stroke exactly as it will look once finished.
    this.inkLayer.style.opacity = String(session.stroke.opacity * layer.opacity)
    this.inkLayer.style.mixBlendMode = highlighter ? 'multiply' : 'normal'

    this.addInkSample(session, e)
    this.armHold(session)
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
    if (s.snapped) return
    const p = this.screenPos(e)
    if (Math.hypot(p.x - s.holdAt.x, p.y - s.holdAt.y) > HOLD_SLOP_PX) {
      s.holdAt = p
      this.armHold(s)
    }
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

    // A smoothed point is final once the raw points it averages over all exist.
    while (s.smooth.length / 2 <= n - 1 - SMOOTH_RADIUS) {
      s.smooth.push(...smoothedAt(raw, s.smooth.length / 2))
    }
    // A curve segment is final once the two smoothed points after its start are final.
    const settled = s.smooth.length / 2 - 2
    // A dash pattern restarts with every path, so dashed ink is drawn whole on the tip layer.
    const dashed = Boolean(s.stroke.dash)
    if (dashed && settled > s.drawnSegments) s.drawnSegments = settled
    if (!dashed && settled > s.drawnSegments) {
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

    // Unsettled end: on to the latest point, the pen tip, and a little beyond it. Only the tail is
    // copied, starting far enough back for the smoothing kernel, so work per event stays small.
    const start = Math.max(0, s.drawnSegments - 1)
    const offset = Math.max(0, start - SMOOTH_RADIUS)
    const tail = raw.slice(offset * 2)
    if (s.sampler.tip) {
      const t = this.toPageLocal(s.sampler.tip, s.pageIndex)
      tail.push(t.x, t.y)
    }
    const ahead = s.predicted ?? this.predictLocal(s)
    if (ahead) tail.push(ahead.x, ahead.y)
    const end: number[] = []
    for (let i = start - offset; i < tail.length / 2; i++) end.push(...smoothedAt(tail, i))

    this.clearTip()
    this.tip.save()
    enterPage(this.tip, this.camera, dpr, s.pageIndex)
    setInkStyle(this.tip, s.stroke)
    const path = new Path2D()
    const first = s.drawnSegments - start
    if (dashed && s.drawnSegments > 0) {
      path.moveTo(s.smooth[0]!, s.smooth[1]!)
      traceSegments(path, s.smooth, 0, s.drawnSegments)
    } else {
      path.moveTo(end[first * 2]!, end[first * 2 + 1]!)
    }
    if (end.length / 2 - 1 > first) traceSegments(path, end, first, end.length / 2 - 1)
    else path.lineTo(end[first * 2]! + 0.001, end[first * 2 + 1]!)
    this.tip.stroke(path)
    this.tip.restore()
    this.tipDirty = dashed
      ? { x: 0, y: 0, w: this.view.width * dpr, h: this.view.height * dpr }
      : this.deviceRect(end, s.pageIndex, s.stroke.width)
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

  /** Restarts the wait for the pen to rest; resting long enough draws the perfect shape. */
  private armHold(s: InkSession): void {
    if (s.holdTimer) clearTimeout(s.holdTimer)
    s.holdTimer = setTimeout(() => this.snapToPerfect(s), HOLD_MS)
  }

  private drawnPoints(s: InkSession): number[] {
    const raw: number[] = []
    for (const p of s.sampler.finalPoints()) {
      const local = this.toPageLocal(p, s.pageIndex)
      raw.push(local.x, local.y)
    }
    return smoothPoints(raw)
  }

  /**
   * Draw a shape and keep the pen on the screen: it turns into the perfect shape (equal sides,
   * a true circle, a straight line) of the same size. Lifting the pen keeps it.
   */
  private snapToPerfect(s: InkSession): void {
    s.holdTimer = null
    if (this.session !== s || s.snapped) return
    const points = this.drawnPoints(s)
    const b = boundsOfPoints(points)
    if (Math.hypot(b.maxX - b.minX, b.maxY - b.minY) < MIN_HOLD_SHAPE) return
    const shape = recognizeShape(points)
    if (!shape) return
    s.snapped = perfectShape(shape)
    this.clearArea(this.wet, s.wetDirty)
    s.wetDirty = null
    this.clearTip()
    this.tip.save()
    enterPage(this.tip, this.camera, this.view.dpr, s.pageIndex)
    setInkStyle(this.tip, s.stroke)
    const path = new Path2D()
    traceStroke(path, s.snapped.points, { closed: s.snapped.closed, straight: s.snapped.straight })
    this.tip.stroke(path)
    this.tip.restore()
    const { width, height, dpr } = this.view
    this.tipDirty = { x: 0, y: 0, w: width * dpr, h: height * dpr }
  }

  private finishInk(s: InkSession): void {
    if (s.holdTimer) clearTimeout(s.holdTimer)
    const snapped = s.snapped
    const points = snapped ? snapped.points : this.drawnPoints(s)
    const page = this.doc.page(s.pageId)
    if (page && points.length >= 2) {
      const stroke: StrokeObject = snapped
        ? { ...s.stroke, points, closed: snapped.closed, straight: snapped.straight }
        : {
            ...s.stroke,
            points,
            path: fitPath(points, { tolerance: FIT_TOLERANCE_PX / this.camera.zoom }),
          }
      const layers = this.doc.notebook.layers.filter((l) => l.visible)
      const top = layers[layers.length - 1]
      const onTop = top?.id === stroke.layerId && top.opacity >= 1
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
      if (this._state.suggest && !snapped) this.scheduleSuggestion(page.id, stroke)
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
        // A filled area goes as a whole when the broom touches it.
        if (
          object.type === 'fill' &&
          object.layerId === layerId &&
          intersects(objectBounds(object), probe) &&
          (hitsObject(object, cx, cy, 0) || strokeTouchesCircle(object.points, cx, cy, radius))
        ) {
          changed = true
          continue
        }
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
        for (const points of pieces) next.push({ ...withPoints(object, points), id: newId() })
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

  /** The broom itself marks where it sweeps; a ring shows the reach when it is larger. */
  private drawBroomCursor(screen: Point): void {
    this.clearTip()
    const { dpr } = this.view
    const r = (this._state.broom.size / 2) * this.camera.zoom
    const icon = 30
    this.inkLayer.style.opacity = '1'
    this.inkLayer.style.mixBlendMode = 'normal'
    this.tip.setTransform(dpr, 0, 0, dpr, 0, 0)
    if (r > icon / 3) {
      this.tip.beginPath()
      this.tip.arc(screen.x, screen.y, r, 0, Math.PI * 2)
      this.tip.fillStyle = 'rgba(185, 139, 101, 0.1)'
      this.tip.fill()
      this.tip.lineWidth = 1.25
      this.tip.setLineDash([4, 4])
      this.tip.strokeStyle = 'rgba(62, 45, 37, 0.45)'
      this.tip.stroke()
      this.tip.setLineDash([])
    }
    drawBroom(this.tip, screen.x, screen.y, icon)
    const reach = Math.max(r, icon) + 6
    this.tipDirty = {
      x: Math.floor((screen.x - reach) * dpr),
      y: Math.floor((screen.y - reach) * dpr),
      w: Math.ceil(reach * 2 * dpr),
      h: Math.ceil(reach * 2 * dpr),
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
      if (s.holdTimer) clearTimeout(s.holdTimer)
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
