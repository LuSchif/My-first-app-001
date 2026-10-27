import {
  compound,
  insertPages,
  movePage,
  removePage,
  setPageProps,
  setLayers,
  setNotebookBackground,
  setNotebookPaper,
  setPageBackground,
  setPageObjects,
  setPagePaper,
  type Command,
} from '../commands/commands.ts'
import type { History } from '../commands/History.ts'
import { fillBaseColor, type Fill } from '../model/fill.ts'
import type { NotebookDocument } from '../document/NotebookDocument.ts'
import {
  DEFAULT_SENSITIVITY,
  flattenStroke,
  nibWidthAt,
  traceNib,
  type NibOptions,
} from '../geometry/nib.ts'
import { eraseFromStroke, strokeTouchesCircle } from '../geometry/erase.ts'
import { intersects } from '../geometry/rect.ts'
import type { Camera, Point } from '../geometry/camera.ts'
import { StrokeSampler, type Tilt } from '../input/StrokeSampler.ts'
import { createPage, withPoints } from '../model/factory.ts'
import { newId } from '../model/ids.ts'
import {
  type CanvasObject,
  type CardStudy,
  type DocumentKind,
  type Id,
  type BoxFrame,
  type ObjectAnimation,
  type SlideTransition,
  type LayerDef,
  type Outline,
  type Page,
  type PageSize,
  type PaperKind,
  type StrokeDash,
  type StrokeInput,
  type StrokeObject,
  type TextObject,
  type TextStyle,
} from '../model/types.ts'
import { layoutOf, pageSizeOf, PageLayout } from '../render/layout.ts'
import { enterPage, renderScene, setDeskColor, type View } from '../render/SceneRenderer.ts'
import { PAPER_STYLE } from '../render/paper.ts'
import { inkAlpha, paintStroke, setInkStyle, strokeBounds } from '../render/strokes.ts'
import { perfectShape, recognizeShape, regionAt, type Shape } from '../geometry/shapes.ts'
import { finishPoints, traceSegments, traceStroke } from '../geometry/strokePath.ts'
import { boundsOfPoints } from '../geometry/rect.ts'
import { drawBroom } from '../render/broomGlyph.ts'
import { objectBounds, paintObject } from '../render/objects.ts'
import { onImageLoaded } from '../render/images.ts'
import { PageCache } from '../render/pageCache.ts'
import { invalidateTextLayouts, layoutText } from '../render/text.ts'
import type { EditorContext } from './context.ts'
import { hitsObject, recolor } from './selection.ts'
import {
  applySuggestion,
  around,
  fillFor,
  insertBelow,
  outlineSources,
  suggestFor,
  suggestionBounds,
  suggestionIds,
  suggestionLabel,
  type Suggestion,
} from './suggestions.ts'
import {
  addLayer,
  duplicateLayer,
  layerBlock,
  type LayerPatch,
  mergeLayerDown,
  moveLayer,
  patchLayer,
  placeLayer,
  removeLayer,
} from './layers.ts'
import { SelectionController, type LassoMode, type SelectionInfo } from './SelectionController.ts'
import { DEFAULT_TEXT_STYLE, TextController } from './TextController.ts'
import { BroomDust } from './BroomDust.ts'
import { FxLayer } from './FxLayer.ts'
import { LaserPointer } from './LaserPointer.ts'
import { TapePeel } from './TapePeel.ts'
import { PathController, type PathEditInfo } from './PathController.ts'
import { DEFAULT_FEATURES, type Features } from './features.ts'
import { highlightText } from './textHighlight.ts'

export type ToolId =
  | 'pen'
  | 'highlighter'
  | 'broom'
  | 'lasso'
  | 'text'
  | 'path'
  | 'laser'
  | 'eyedropper'
  | 'tape'
  | 'magnifier'
export type BroomMode = 'precise' | 'stroke'
/** A ballpoint draws one width; a fountain pen's width follows direction and pressure. */
export type PenNib = 'ballpoint' | 'fountain'

export interface EditorState {
  tool: ToolId
  pen: {
    color: string
    width: number
    opacity: number
    dash: StrokeDash | null
    nib: PenNib
    /** Fountain pen: how strongly pressure changes the width, from 0 to 1. */
    sensitivity: number
  }
  highlighter: { color: string; width: number; opacity: number }
  broom: { size: number; mode: BroomMode }
  tape: { color: string; width: number }
  laserColor: string
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
  /** What the control center has switched on. */
  features: Features
  /** The offer currently shown, placed near what it would change. */
  suggestion: {
    kind: 'shape' | 'fill' | 'table' | 'clef' | 'arrow'
    label: string
    rect: ScreenRect
  } | null
  selection: SelectionInfo | null
  /** The stroke being edited with the path tool. */
  pathEdit: PathEditInfo | null
  hasClipboard: boolean
  /** The notebook's layers, bottom to top. */
  layers: LayerDef[]
  /** The layer new ink, text and selections belong to. */
  activeLayerId: Id
  /** Color of the background layer below all others, or null for the paper color. */
  background: string | null
  /** A short message, e.g. why the pen does nothing on a hidden layer. */
  notice: string | null
  /** What the magnifier found: the objects under it and their layers, at a screen point. */
  inspect: { x: number; y: number; items: InspectItem[] } | null
  /**
   * Pulling past the last page: how far the hold to add a page has come (0 to 1), and whether
   * the pull is far enough for it to count.
   */
  pull: { armed: boolean; progress: number } | null
  /** The menu for the paper of the page about to be added is open. */
  newPageMenu: boolean
  /** Where a long press offers to paste, in screen pixels. */
  pasteMenu: { x: number; y: number } | null
}

const HIGHLIGHTER_OPACITY = 0.45
/** How long the screen must be still before sharp page pictures are made. */
const CACHE_DELAY_MS = 160
/** How far ahead of the pen (px) a predicted point may be drawn. */
const PREDICT_MAX_PX = 6
/** How quickly the fountain pen's width follows pressure and direction (0 to 1, per point). */
const WIDTH_EASE = 0.35
/** After writing, pictures wait this long, so a pause between words is never spent on them. */
const CACHE_AFTER_INK_MS = 1500
/** Space kept free above the first page for the floating toolbar. */
const TOP_INSET = 84
const SIDE_MARGIN = 24
/** Room around a slide in a presentation. */
const SLIDE_MARGIN = 32
/** Room on the right for the recent colors bar. */
const RIGHT_INSET = 76
/** Resting the pen this long after drawing a shape turns it into the perfect shape. */
const HOLD_MS = 550
const HOLD_SLOP_PX = 4
const MIN_HOLD_SHAPE = 30

/** Pause after a stroke before looking for shapes to offer. */
const SUGGEST_DELAY_MS = 350
/** Holding a pen or finger still this long on the page offers Paste. */
const LONG_PRESS_MS = 500
const LONG_PRESS_SLOP_PX = 8
const RECENT_LIMIT = 5

/** Room kept free above the keyboard for the text format bar. */
const FORMAT_BAR_SPACE = 84
const TWO_FINGER_TAP_MS = 280
/** The second tap of a two- or three-finger double tap must come within this time. */
const DOUBLE_TAP_MS = 450
const TAP_SLOP_PX = 12
/** Pulling this far past the last page arms adding a page. */
const PULL_ARM_PX = 110
/** Then the pull must be held this long, so a page is never added by a fling. */
const PULL_HOLD_MS = 900
/** How far the pages follow the pull, at most. */
const PULL_STRETCH_PX = 70

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
  /** Fountain pen only: pressure and line width of each point in `local`, and smoothed widths. */
  nib: boolean
  pressures: number[]
  /** The pen's altitude in degrees at each point of `local`, where the device reports it. */
  altitudes: (number | undefined)[]
  rawWidths: number[]
  /** The width drawn at each point: `rawWidths` eased, never changing once set. */
  widths: number[]
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

/** Dragging out a strip of tape. */
interface TapeSession {
  kind: 'tape'
  pointerId: number
  pointerType: string
  pageIndex: number
  pageId: Id
  /** Ends of the strip in page coordinates. */
  from: Point
  to: Point
}

/** The eyedropper held on the page, showing the color under it. */
interface PickSession {
  kind: 'pick'
  pointerId: number
  pointerType: string
  color: string | null
  /** The page as shown when the eyedropper touched down, read once. */
  pixels: ImageData | null
}

/** The magnifier held on the page. */
interface LookSession {
  kind: 'look'
  pointerId: number
  pointerType: string
  /** The page as shown when the magnifier touched down, to enlarge from. */
  snapshot: HTMLCanvasElement
  at: Point
}

/** An object under the magnifier, with the layer it is on. */
export interface InspectItem {
  id: Id
  label: string
  layerId: Id
  layerName: string
  /** The layer is hidden or locked. */
  hidden: boolean
  locked: boolean
}

type Session = InkSession | EraseSession | TapeSession | PickSession | LookSession

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
/** Which pages a paper change is for: the page in view, pages added later, or both, or all. */
/** Colors compare as lowercase hex, so the same color is never listed twice. */
function normalizeColor(color: string): string {
  return color.trim().toLowerCase()
}

export type PaperScope = 'page' | 'page-and-new' | 'new' | 'all'

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
  private readonly laser: LaserPointer
  /** Where the pages sit: A4 for notebooks, slides for presentations. */
  private readonly layout: PageLayout
  /** One page at a time, fitted to the screen: presentations and flashcard decks. */
  readonly slides: boolean
  readonly kind: DocumentKind
  /** Laser trail and broom dust. */
  private readonly fx: FxLayer
  private readonly dust = new BroomDust()
  private readonly tapePeel: TapePeel
  private hidden: ReadonlySet<Id> = new Set()
  private textTap: { pointerId: number; x: number; y: number } | null = null
  /** Screen pixels at the bottom hidden by the keyboard and format bar while typing. */
  private bottomInset = 0
  /** Height of the app's own on-screen keyboard, when it is open. */
  private keyboardInset = 0
  private pending: { pageId: Id; layerId: Id; suggestion: Suggestion } | null = null
  private suggestTimer: ReturnType<typeof setTimeout> | null = null
  private noticeTimer: ReturnType<typeof setTimeout> | null = null
  /** The tool to go back to when typing in a text box opened by a pen tap ends. */
  private returnTool: ToolId | null = null
  private longPress: {
    timer: ReturnType<typeof setTimeout>
    pointerId: number
    x: number
    y: number
  } | null = null
  /** The page spot a long press chose for pasting. */
  private pasteTarget: { pageId: Id; x: number; y: number } | null = null
  /** Layers before an opacity drag started, so the whole drag is one undo step. */
  private opacityBefore: LayerDef[] | null = null
  /** The background color before a color wheel drag started. */
  private backgroundEdit: { before: string | undefined } | null = null

  private camera: Camera = { offsetX: 0, offsetY: TOP_INSET, zoom: 1 }
  private view: View = { width: 0, height: 0, dpr: 1 }
  private hostRect: DOMRect
  private renderQueued = false
  private paintedByEditor = false
  /** Pictures of finished pages, for fast panning and zooming (see pageCache.ts). */
  private readonly pageCache = new PageCache()
  private cacheTimer: ReturnType<typeof setTimeout> | null = null
  /** When ink was last finished, so pictures are made in a real pause (performance.now()). */
  private lastInkAt = -Infinity
  /** Set when a touch gesture zoomed, until every finger has lifted. */
  private pinched = false
  /** The frame the stroke in progress is drawn in next, if one is booked. */
  private inkFrame = 0
  private session: Session | null = null
  private tipDirty: DeviceRect | null = null

  private penSeen = false
  private readonly touches = new Map<number, Point>()
  private gesture: { cx: number; cy: number; dist: number; count: number } | null = null
  private panning = false
  private tap: { start: number; maxTouches: number; moved: number; x: number; y: number } | null =
    null
  /** How far fingers or a wheel pulled past the last page, and since when it is armed. */
  private pullRaw = 0
  private pullArmedAt = 0
  private pullFrame = 0
  private wheelPullTimer: ReturnType<typeof setTimeout> | null = null
  /** The last tap on a strip of tape, to tell a double tap. */
  private lastTapeTap: { id: Id; time: number } | null = null
  /** The tool to go back to once the eyedropper picked a color. */
  private pickReturn: ToolId = 'pen'
  private lastGestureTap: { fingers: number; time: number } | null = null
  private momentum: { vx: number; vy: number; last: number } | null = null
  private velocity: { vx: number; vy: number; t: number } = { vx: 0, vy: 0, t: 0 }
  private mousePan: { id: number; x: number; y: number } | null = null

  private _state: EditorState
  private readonly listeners = new Set<() => void>()
  private readonly cleanups: (() => void)[] = []

  constructor(host: HTMLElement, doc: NotebookDocument, history: History) {
    this.host = host
    this.doc = doc
    this.history = history
    this._state = {
      tool: 'pen',
      pen: {
        color: '#3e2d25',
        width: 2,
        opacity: 1,
        dash: null,
        nib: 'ballpoint',
        sensitivity: DEFAULT_SENSITIVITY,
      },
      highlighter: { color: '#f2cf4a', width: 14, opacity: HIGHLIGHTER_OPACITY },
      broom: { size: 16, mode: 'precise' },
      tape: { color: '#d9b48f', width: 22 },
      laserColor: '#e0533f',
      canUndo: history.canUndo,
      canRedo: history.canRedo,
      pageIndex: 0,
      pageCount: doc.notebook.pageIds.length,
      textStyle: DEFAULT_TEXT_STYLE,
      editingText: false,
      lassoMode: 'freehand',
      snapRotation: false,
      recentColors: [],
      features: DEFAULT_FEATURES,
      suggestion: null,
      selection: null,
      pathEdit: null,
      hasClipboard: false,
      layers: doc.notebook.layers,
      background: doc.notebook.background ?? null,
      activeLayerId: doc.notebook.layers[doc.notebook.layers.length - 1]?.id ?? '',
      notice: null,
      inspect: null,
      pull: null,
      newPageMenu: false,
      pasteMenu: null,
    }

    // The canvases are positioned inside the host; keep the host's own positioning if it has one.
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative'
    host.style.touchAction = 'none'
    host.style.overscrollBehavior = 'none'
    host.style.userSelect = 'none'
    host.style.setProperty('-webkit-user-select', 'none')
    host.style.setProperty('-webkit-touch-callout', 'none')

    this.kind = doc.notebook.kind ?? 'notebook'
    this.slides = this.kind !== 'notebook'
    // A presentation's (or deck's) layout is its own: it remembers which slide is in view.
    this.layout = this.slides ? new PageLayout(pageSizeOf(doc.notebook)) : layoutOf(doc.notebook)
    if (this.slides) this.layout.focus = 0
    this.sceneCanvas = makeCanvas()
    this.inkLayer = document.createElement('div')
    Object.assign(this.inkLayer.style, { position: 'absolute', inset: '0', pointerEvents: 'none' })
    this.wetCanvas = makeCanvas()
    this.tipCanvas = makeCanvas()
    this.inkLayer.append(this.wetCanvas, this.tipCanvas)
    // Selection frames and the lasso path draw above the ink.
    this.overlayCanvas = makeCanvas()
    this.overlayCanvas.style.pointerEvents = 'none'
    const fxCanvas = makeCanvas()
    fxCanvas.style.pointerEvents = 'none'
    this.fx = new FxLayer(fxCanvas, () => this.view)
    host.append(this.sceneCanvas, this.inkLayer, this.overlayCanvas, fxCanvas)

    this.scene = this.sceneCanvas.getContext('2d', { alpha: false })!
    // desynchronized asks for a low-latency path where the browser has one.
    this.wet = this.wetCanvas.getContext('2d', { desynchronized: true })!
    this.tip = this.tipCanvas.getContext('2d', { desynchronized: true })!
    this.hostRect = host.getBoundingClientRect()
    const context = this.createContext(this.overlayCanvas.getContext('2d')!)
    this.selection = new SelectionController(context)
    this.text = new TextController(context)
    this.paths = new PathController(context)
    this.laser = new LaserPointer(context, () => this.fx.request())
    this.tapePeel = new TapePeel(
      () => this.camera,
      () => this.view.dpr,
      this.layout,
    )
    this.fx.add(this.laser)
    this.fx.add(this.dust)
    this.fx.add(this.tapePeel)

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
        this.pageCache.clear()
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
    // The desk around the pages takes its color from the interface theme.
    const readDesk = () => {
      const desk = getComputedStyle(document.documentElement).getPropertyValue('--color-desk')
      setDeskColor(desk.trim())
      this.requestRender()
    }
    readDesk()
    this.listen(window, 'broomit:theme', readDesk)
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
    // Pictures load after the first frame; draw again once one is ready.
    this.cleanups.push(
      onImageLoaded(() => {
        // A picture made before an image arrived would miss it.
        this.pageCache.clear()
        this.requestRender()
      }),
    )
    this.cleanups.push(history.subscribe(() => this.syncHistory()))
    this.resize()
  }

  // ---------- Public API ----------

  get state(): EditorState {
    return this._state
  }

  /** The size of the document's pages, in points. */
  get pageSize(): PageSize {
    return this.layout.size
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
    if (tool !== 'laser') this.laser.clear()
    if (tool === 'eyedropper' && this._state.tool !== 'eyedropper')
      this.pickReturn = this._state.tool
    if (this._state.inspect) this.closeInspect()
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

  setLassoMode(mode: LassoMode): void {
    this.selection.mode = mode
    this.update({ lassoMode: mode })
  }

  flipSelection(axis: 'horizontal' | 'vertical'): void {
    this.selection.flip(axis)
  }

  /** Recolors the selection; with `commit` false it is a preview until `commitSelectionEdit`. */
  recolorSelection(color: string, commit = true): void {
    if (commit) this.rememberColor(color)
    this.selection.recolor(color, commit)
  }

  /** Paints the selection with a color or a gradient; `commit` false previews it. */
  paintSelection(fill: Fill, commit = true): void {
    if (commit) this.rememberColor(fill.type === 'solid' ? fill.color : fillBaseColor(fill))
    this.selection.repaint(fill, commit)
  }

  /** Records the previewed change to the selection as one undo step. */
  commitSelectionEdit(label = 'Edit'): void {
    this.selection.commitEdit(label)
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

  /** Merges a layer into the one below it; that one becomes the active layer. */
  mergeLayerDown(id: Id): void {
    const layers = this.doc.notebook.layers
    const below = layers[layers.findIndex((l) => l.id === id) - 1]
    const command = mergeLayerDown(this.doc, id)
    if (!command || !below) return
    this.text.finish()
    this.selection.clear()
    this.history.execute(command)
    this.update({ activeLayerId: below.id })
  }

  /** Copies a layer with all its content; the copy becomes the active layer. */
  duplicateLayer(id: Id): void {
    const result = duplicateLayer(this.doc, id)
    if (!result) return
    this.history.execute(result.command)
    this.setActiveLayer(result.id)
  }

  /** Puts a layer at a place in the drawing order (0 is the bottom layer). */
  placeLayer(id: Id, index: number): void {
    const command = placeLayer(this.doc, id, index)
    if (command) this.history.execute(command)
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

  /**
   * Colors the background layer. While a color wheel moves, `commit` is false and the color is
   * only shown; the final call records one undo step.
   */
  setBackground(color: string, commit: boolean): void {
    this.backgroundEdit ??= { before: this.doc.notebook.background }
    if (!commit) {
      this.doc.updateNotebook({ background: color })
      return
    }
    const { before } = this.backgroundEdit
    this.backgroundEdit = null
    this.history.execute(setNotebookBackground(before, color))
  }

  /** Records the background color shown by the last preview. */
  commitBackground(): void {
    const color = this.doc.notebook.background
    if (this.backgroundEdit && color) this.setBackground(color, true)
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

  /** The selected object, when exactly one is selected (e.g. a table to edit). */
  selectedObject(): CanvasObject | null {
    return this.selection.single()
  }

  /** Replaces the single selected object with a changed version, as one undo step. */
  updateSelectedObject(next: CanvasObject, label: string): void {
    this.selection.replaceSingle(next, label)
  }

  /** Adds, changes or removes the outline; with `commit` false it is a live preview. */
  setSelectionOutline(outline: Outline | null, commit = true): void {
    if (outline && commit) this.rememberColor(outline.color)
    this.selection.setOutline(outline, commit)
  }

  /** Presentations: gives the selection an entrance animation, changes it, or removes it. */
  setSelectedAnimation(patch: Partial<ObjectAnimation> | null): void {
    this.selection.setAnimation(patch)
  }

  /** Presentations: plays the selection's animation one place earlier (-1) or later (1). */
  moveSelectedAnimation(direction: -1 | 1): void {
    this.selection.moveAnimation(direction)
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
    this.showNotice('Copied. Hold your pen or finger on the page to paste.')
  }

  /** Pastes the copied objects where the long press was. */
  pasteHere(): void {
    const target = this.pasteTarget
    this.closePasteMenu()
    if (!target) return
    this.setTool('lasso')
    this.selection.pasteAt(target.pageId, target.x, target.y)
  }

  closePasteMenu(): void {
    this.pasteTarget = null
    if (this._state.pasteMenu) this.update({ pasteMenu: null })
  }

  /**
   * A pen or finger resting on the page offers to paste what was copied. Moving more than a
   * few pixels, or lifting, cancels it.
   */
  private armLongPress(e: PointerEvent): void {
    this.cancelLongPress()
    if (!this.selection.hasClipboard) return
    const p = this.screenPos(e)
    const timer = setTimeout(() => this.firePasteMenu(), LONG_PRESS_MS)
    this.longPress = { timer, pointerId: e.pointerId, x: p.x, y: p.y }
  }

  private cancelLongPress(): void {
    if (!this.longPress) return
    clearTimeout(this.longPress.timer)
    this.longPress = null
  }

  private firePasteMenu(): void {
    const press = this.longPress
    this.longPress = null
    if (!press) return
    const hit = this.pageAt(press)
    if (!hit) return
    // The press was not meant as a dot, a lasso or a new text box.
    this.cancelSession()
    this.selection.clear()
    this.textTap = null
    this.panning = false
    this.pasteTarget = { pageId: hit.page.id, x: hit.x, y: hit.y }
    this.update({ pasteMenu: { x: press.x, y: press.y } })
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

  setFeatures(patch: Partial<Features>): void {
    if (patch.suggestions === false) this.dismissSuggestion()
    const features = { ...this._state.features, ...patch }
    this.update({ features })
    // A tool taken off the toolbar cannot stay in use.
    const hidden: Partial<Record<ToolId, boolean>> = {
      laser: !features.laser,
      tape: !features.tape,
      eyedropper: !features.eyedropper,
      magnifier: !features.magnifier,
      path: !features.pathTool,
    }
    if (hidden[this._state.tool]) this.setTool('pen')
  }

  /** Turns the drawn stroke into the recognized shape, or fills the colored-in area. */
  acceptSuggestion(): void {
    const pending = this.pending
    const page = pending && this.doc.page(pending.pageId)
    this.dismissSuggestion()
    if (!pending || !page) return
    const after = applySuggestion(page.objects, pending.suggestion, pending.layerId, newId)
    const label = suggestionLabel(pending.suggestion).split(' · ')[0]!
    this.history.execute(setPageObjects(label, page.id, page.objects, after))
  }

  /**
   * Looks for a shape or fill to offer once the pen has rested briefly, never while writing:
   * the analysis must not delay the next stroke.
   */
  private scheduleSuggestion(pageId: Id, stroke: StrokeObject, tableOnly = false): void {
    if (this.suggestTimer) clearTimeout(this.suggestTimer)
    this.suggestTimer = setTimeout(() => {
      this.suggestTimer = null
      if (this.session) return
      const page = this.doc.page(pageId)
      const objects = page?.objects
      if (!objects?.some((o) => o.id === stroke.id)) return
      const suggestion = suggestFor(objects, stroke, tableOnly, page?.paper)
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
    const needed = suggestionIds(s)
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
    if (index < 0 || !page) {
      this.dismissSuggestion()
      return
    }
    const b = suggestionBounds(s)
    const o = this.layout.origin(index)
    const { zoom, offsetX, offsetY } = this.camera
    const rect = {
      x: (b.minX + o.x) * zoom + offsetX,
      y: (b.minY + o.y) * zoom + offsetY,
      width: (b.maxX - b.minX) * zoom,
      height: (b.maxY - b.minY) * zoom,
    }
    this.update({ suggestion: { kind: s.kind, label: suggestionLabel(s), rect } })
  }

  /** The app's own keyboard opened, closed or changed height. */
  setKeyboardInset(px: number): void {
    if (px === this.keyboardInset) return
    this.keyboardInset = px
    this.updateBottomInset()
  }

  /** The colors used before in this notebook (kept per device). */
  setRecentColors(colors: string[]): void {
    const unique = [...new Set(colors.map(normalizeColor))]
    this.update({ recentColors: unique.slice(-RECENT_LIMIT) })
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
    else if (tool === 'tape') this.setTape({ color })
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
    enterPage(this.tip, this.camera, dpr, target.pageIndex, this.layout)
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
      this.tip.fillRect(0, 0, this.layout.size.width, this.layout.size.height)
      this.tip.globalAlpha = 1
      this.tip.lineWidth = 3 / zoom
      this.tip.strokeStyle = '#795a46'
      this.tip.strokeRect(0, 0, this.layout.size.width, this.layout.size.height)
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
    const pageIndex = this.layout.indexAt(world.x, world.y, this.doc.notebook.pageIds.length)
    const page = this.doc.pageList[pageIndex]
    if (!page) return null
    const o = this.layout.origin(pageIndex)
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

  /**
   * Adds a color that was just used (drawn, filled, typed, applied) to the recent colors. The
   * bar fills up one color at a time in the order of first use; each color appears once, and
   * when it is full the oldest one makes room. Picking a color alone does not count.
   */
  private rememberColor(color: string): void {
    const value = normalizeColor(color)
    const current = this._state.recentColors
    if (current.includes(value)) return
    this.update({ recentColors: [...current, value].slice(-RECENT_LIMIT) })
  }

  setPen(patch: Partial<EditorState['pen']>): void {
    this.update({ pen: { ...this._state.pen, ...patch } })
  }

  setTape(patch: Partial<EditorState['tape']>): void {
    this.update({ tape: { ...this._state.tape, ...patch } })
  }

  setLaserColor(laserColor: string): void {
    this.laser.color = laserColor
    this.update({ laserColor })
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
    this.selection.commitEdit('Edit')
    this.dismissSuggestion()
    this.history.undo()
  }

  redo(): void {
    if (this.session || this.selection.busy) return
    this.text.finish()
    this.selection.commitEdit('Edit')
    this.dismissSuggestion()
    this.history.redo()
  }

  /**
   * Places an object (a picture, table or chart) in the middle of what is visible of the current
   * page, on the active layer, and selects it so it can be moved and resized right away.
   * `width` and `height` are the size it would like; it is scaled down to fit the page.
   */
  insertBox(
    make: (frame: BoxFrame, layerId: Id) => CanvasObject,
    width: number,
    height: number,
    /** Where its top-left corner should go on the page; the middle of the view otherwise. */
    at?: { x: number; y: number },
  ) {
    const layer = this.activeLayer()
    if (!layer || this.blockedByLayer()) return
    const index = this._state.pageIndex
    const page = this.doc.pageList[index]
    if (!page) return
    const fit = Math.min(
      1,
      (this.layout.size.width * 0.7) / width,
      (this.layout.size.height * 0.6) / height,
    )
    const w = width * fit
    const h = height * fit
    const center = at
      ? { x: at.x + w / 2, y: at.y + h / 2 }
      : this.toPageLocal({ x: this.view.width / 2, y: this.view.height / 2 }, index)
    const cx = Math.min(this.layout.size.width - w / 2, Math.max(w / 2, center.x))
    const cy = Math.min(this.layout.size.height - h / 2, Math.max(h / 2, center.y))
    const object = make(
      { x: cx - w / 2, y: cy - h / 2, width: w, height: h, rotation: 0 },
      layer.id,
    )
    this.history.execute(setPageObjects('Insert', page.id, page.objects, [...page.objects, object]))
    this.setTool('lasso')
    this.selection.select(page.id, [object.id])
  }

  /**
   * Changes the paper: of the page in view, of the pages added from now on, or of every page.
   * One step to undo.
   */
  setPaper(kind: PaperKind, scope: PaperScope): void {
    const commands: Command[] = []
    const pages =
      scope === 'all'
        ? this.doc.pageList
        : scope === 'new'
          ? []
          : [this.doc.pageList[this._state.pageIndex]].filter((p) => p !== undefined)
    for (const page of pages) {
      if (page.paper !== kind) commands.push(setPagePaper(page.id, page.paper, kind))
    }
    const notebook = this.doc.notebook.paper
    if (scope !== 'page' && notebook !== kind) commands.push(setNotebookPaper(notebook, kind))
    if (commands.length) this.history.execute(compound('Paper', commands))
  }

  addPageAfterCurrent(): void {
    const index = this._state.pageIndex + 1
    this.history.execute(
      insertPages('Add page', index, [createPage(this.doc.notebook.id, this.doc.notebook.paper)]),
    )
    this.scrollToPage(index)
  }

  /** Adds an empty page at `index` in the page order. */
  addPageAt(index: number): void {
    this.history.execute(
      insertPages('Add page', index, [createPage(this.doc.notebook.id, this.doc.notebook.paper)]),
    )
    this.scrollToPage(index)
  }

  duplicateCurrentPage(): void {
    this.duplicatePage(this._state.pageIndex)
  }

  /** Inserts a copy of page `at` right after it. */
  duplicatePage(at: number): void {
    const source = this.doc.pageList[at]
    if (!source) return
    const copy = {
      ...createPage(this.doc.notebook.id, source.paper),
      objects: source.objects.map((o) => ({ ...o, id: newId() })),
      ...(source.background ? { background: source.background } : {}),
    }
    const index = at + 1
    this.history.execute(insertPages('Duplicate page', index, [copy]))
    this.scrollToPage(index)
  }

  deleteCurrentPage(): void {
    this.deletePage(this._state.pageIndex)
  }

  deletePage(index: number): void {
    const pages = this.doc.pageList
    const page = pages[index]
    if (!page || pages.length <= 1) return
    this.history.execute(removePage('Delete page', page.id))
  }

  /** Flashcards: a new empty card (front and back) at card position `at`, showing its front. */
  addCardAt(at: number): void {
    const { id, paper } = this.doc.notebook
    const index = Math.max(0, Math.min(this.doc.notebook.pageIds.length, at * 2))
    this.history.execute(
      insertPages('Add card', index, [createPage(id, paper), createPage(id, paper)]),
    )
    this.goToPage(index)
  }

  /**
   * Flashcards: a new card with typed text on its front and back, centered, after card `at`
   * (or at the end). Shows its front.
   */
  addTypedCard(front: string, back: string, at?: number): void {
    const { id, paper } = this.doc.notebook
    const layers = this.doc.notebook.layers
    const layer =
      layers.find((l) => l.id === this._state.activeLayerId && !l.locked) ??
      layers.find((l) => !l.locked)
    if (!layer) return
    const side = (text: string) => {
      const page = createPage(id, paper)
      const trimmed = text.trim()
      if (!trimmed) return page
      const { width, height } = this.layout.size
      // Short answers large, longer ones smaller, so they fit the card.
      const size = trimmed.length <= 40 ? 32 : trimmed.length <= 140 ? 24 : 18
      const object: TextObject = {
        id: newId(),
        type: 'text',
        layerId: layer.id,
        x: 40,
        y: 0,
        width: width - 80,
        rotation: 0,
        text: trimmed,
        style: { ...DEFAULT_TEXT_STYLE, size, align: 'center' },
      }
      object.y = Math.max(24, (height - layoutText(object).height) / 2)
      return { ...page, objects: [object] }
    }
    const sides = [side(front), side(back)]
    // The card in view is still blank (as in a new deck): the text goes on it.
    const shown = Math.floor(this._state.pageIndex / 2) * 2
    const blank = this.doc.pageList.slice(shown, shown + 2)
    if (blank.length === 2 && blank.every((p) => p.objects.length === 0)) {
      this.history.execute(
        compound(
          'Add card',
          blank.map((p, i) => setPageObjects('Add card', p.id, p.objects, sides[i]!.objects)),
        ),
      )
      this.goToPage(shown)
      return
    }
    const count = Math.ceil(this.doc.notebook.pageIds.length / 2)
    const index = Math.min(this.doc.notebook.pageIds.length, Math.min(count, at ?? count) * 2)
    this.history.execute(insertPages('Add card', index, sides))
    this.goToPage(index)
  }

  /** Flashcards: a copy of card `at` right after it. */
  duplicateCard(at: number): void {
    const pages = this.doc.pageList.slice(at * 2, at * 2 + 2)
    if (pages.length === 0) return
    const copies = pages.map((source) => ({
      ...createPage(this.doc.notebook.id, source.paper),
      objects: source.objects.map((o) => ({ ...o, id: newId() })),
      ...(source.background ? { background: source.background } : {}),
    }))
    const index = at * 2 + 2
    this.history.execute(insertPages('Duplicate card', index, copies))
    this.goToPage(index)
  }

  /** Flashcards: removes card `at` (both sides). The last card stays. */
  deleteCard(at: number): void {
    const pages = this.doc.pageList
    if (pages.length <= 2) return
    const sides = pages.slice(at * 2, at * 2 + 2)
    this.history.execute(
      compound(
        'Delete card',
        sides.map((p) => removePage('Delete card', p.id)),
      ),
    )
  }

  /** Flashcards: moves card `from` to card position `to`, both sides together. */
  moveCard(from: number, to: number): void {
    const count = Math.ceil(this.doc.notebook.pageIds.length / 2)
    const target = Math.max(0, Math.min(count - 1, to))
    if (from === target || from < 0 || from >= count) return
    const moves =
      target > from
        ? [
            movePage('Move card', from * 2, target * 2 + 1),
            movePage('Move card', from * 2, target * 2 + 1),
          ]
        : [
            movePage('Move card', from * 2, target * 2),
            movePage('Move card', from * 2 + 1, target * 2 + 1),
          ]
    this.history.execute(compound('Move card', moves))
    this.goToPage(target * 2)
  }

  /** Flashcards: how well the cards are known, after studying. Not an undo step. */
  setStudy(study: Record<Id, CardStudy>): void {
    this.doc.updateNotebook({ study })
  }

  /** Moves the page (slide) at `from` to `to`, and keeps it in view. */
  movePageTo(from: number, to: number): void {
    const count = this.doc.notebook.pageIds.length
    const target = Math.max(0, Math.min(count - 1, to))
    if (from === target || from < 0 || from >= count) return
    this.history.execute(movePage(this.slides ? 'Move slide' : 'Move page', from, target))
    this.goToPage(target)
  }

  /** A slide's speaker notes; an empty text removes them. */
  setNotes(pageId: Id, notes: string): void {
    const page = this.doc.page(pageId)
    if (!page || (page.notes ?? '') === notes) return
    this.history.execute(
      setPageProps(
        'Notes',
        pageId,
        { notes: page.notes },
        { notes: notes.trim() ? notes : undefined },
      ),
    )
  }

  /** How slide `index` comes in when presenting (null: it just appears); `all` sets every slide. */
  setTransition(index: number, transition: SlideTransition | null, all = false): void {
    const { pageIds } = this.doc.notebook
    const ids = all ? pageIds : pageIds.slice(index, index + 1)
    const commands = ids.flatMap((id) => {
      const page = this.doc.page(id)
      if (!page) return []
      return [
        setPageProps(
          'Transition',
          id,
          { transition: page.transition },
          { transition: transition ?? undefined },
        ),
      ]
    })
    if (commands.length) this.history.execute(compound('Transition', commands))
  }

  /** Ends typing and editing, so the document holds everything, e.g. before presenting. */
  finishEditing(): void {
    this.text.finish()
    this.selection.commitEdit('Edit')
    this.selection.clear()
    this.paths.clear()
    this.dismissSuggestion()
  }

  /** A presentation: shows slide `index`, fitted to the screen. */
  goToPage(index: number): void {
    if (!this.slides) {
      this.scrollToPage(index)
      return
    }
    const target = Math.max(0, Math.min(this.doc.notebook.pageIds.length - 1, index))
    if (target !== this.layout.focus) {
      this.text.finish()
      this.selection.clear()
      this.paths.clear()
      this.dismissSuggestion()
      this.layout.focus = target
    }
    this.update({ pageIndex: target })
    this.setCamera({ zoom: 0, offsetX: 0, offsetY: 0 })
    this.requestRender()
  }

  scrollToPage(index: number): void {
    if (this.slides) {
      this.goToPage(index)
      return
    }
    const z = this.camera.zoom
    this.setCamera({ ...this.camera, offsetY: TOP_INSET - this.layout.origin(index).y * z })
  }

  dispose(): void {
    this.text.finish()
    if (this.cacheTimer) clearTimeout(this.cacheTimer)
    if (this.noticeTimer) clearTimeout(this.noticeTimer)
    this.cancelLongPress()
    this.cleanups.forEach((fn) => fn())
    this.sceneCanvas.remove()
    this.inkLayer.remove()
    this.overlayCanvas.remove()
    this.fx.dispose()
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
      // A deleted last slide (or an undone new one) leaves the slide before it in view.
      if (this.slides && (this.layout.focus ?? 0) >= pageCount) this.goToPage(pageCount - 1)
      this.setCamera(this.camera)
    }
    // The editor already painted its own new stroke; everything else needs a redraw.
    if (!this.paintedByEditor) this.requestRender()
    this.selection.onDocumentChange()
    this.paths.onDocumentChange()
    this.checkSuggestion()
  }

  private syncLayers(): void {
    const background = this.doc.notebook.background ?? null
    if (background !== this._state.background) this.update({ background })
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
      layout: () => this.layout,
      view: () => this.view,
      screenPos: (e) => this.screenPos(e),
      pageAt: (screen) => this.pageAt(screen),
      pageIndexOf: (id) => this.doc.notebook.pageIds.indexOf(id),
      toScreen: (index, x, y) => {
        const o = this.layout.origin(index)
        const c = this.camera
        return { x: (x + o.x) * c.zoom + c.offsetX, y: (y + o.y) * c.zoom + c.offsetY }
      },
      activeLayer: () => this.activeLayer(),
      setHidden: (ids) => {
        this.hidden = ids
        this.requestRender()
      },
      requestRender: () => this.requestRender(),
      scrollBy: (dx, dy) =>
        this.setCamera({
          ...this.camera,
          offsetX: this.camera.offsetX + dx,
          offsetY: this.camera.offsetY + dy,
        }),
      zoomAt: (anchor, factor) => this.zoomAt(anchor, factor),
      visibleArea: () => ({
        left: SIDE_MARGIN,
        right: this.view.width - RIGHT_INSET,
        top: TOP_INSET,
        bottom: this.view.height - this.bottomInset,
      }),
      changed: () => this.syncControllers(),
      rememberColor: (color) => this.rememberColor(color),
    }
  }

  private syncControllers(): void {
    if (this.text.isEditing !== this._state.editingText) {
      queueMicrotask(() => this.updateBottomInset())
    }
    if (!this.text.isEditing && this.returnTool) {
      const tool = this.returnTool
      this.returnTool = null
      if (this._state.tool === 'text') this.update({ tool })
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
      const viewportBottom = vv ? vv.offsetTop + vv.height - this.hostRect.top : this.view.height
      // The app's own keyboard (on iPad) covers the bottom without shrinking the viewport.
      const visibleBottom = Math.min(viewportBottom, this.view.height - this.keyboardInset)
      inset = Math.max(0, this.view.height - visibleBottom) + FORMAT_BAR_SPACE
    }
    if (inset === this.bottomInset && !this.text.isEditing) return
    this.bottomInset = inset
    this.setCamera(this.camera)
    this.text.ensureVisible()
  }

  // ---------- Camera and rendering ----------

  private fitZoom(): number {
    if (this.slides) {
      const { width, height } = this.slideArea()
      return Math.min(width / this.layout.size.width, height / this.layout.size.height)
    }
    return Math.min(1.6, (this.view.width - SIDE_MARGIN * 2) / this.layout.size.width)
  }

  /** The part of the screen a slide fits into: below the toolbar, inside the margins. */
  private slideArea(): { top: number; width: number; height: number } {
    const bottom = Math.max(SLIDE_MARGIN, this.bottomInset)
    return {
      top: TOP_INSET,
      width: Math.max(1, this.view.width - SLIDE_MARGIN * 2),
      height: Math.max(1, this.view.height - TOP_INSET - bottom),
    }
  }

  /** A presentation keeps its slide in view: centered when it fits, never lost when zoomed in. */
  private clampSlideCamera(c: Camera): Camera {
    const zoom = this.limitZoom(c.zoom)
    const area = this.slideArea()
    const o = this.layout.origin(this.layout.focus ?? 0)
    const w = this.layout.size.width * zoom
    const h = this.layout.size.height * zoom
    const axis = (start: number, room: number, size: number, offset: number, world: number) => {
      if (size <= room) return start + (room - size) / 2 - world * zoom
      // Zoomed in: the slide's edges may not come inside the area.
      const max = start - world * zoom
      const min = start + room - size - world * zoom
      return Math.min(max, Math.max(min, offset))
    }
    return {
      zoom,
      offsetX: axis(SLIDE_MARGIN, area.width, w, c.offsetX, o.x),
      offsetY: axis(area.top, area.height, h, c.offsetY, o.y),
    }
  }

  /** Keeps the pages in reach: centered when narrower than the screen, never lost off-screen. */
  private clampCamera(c: Camera): Camera {
    if (this.slides) return this.clampSlideCamera(c)
    const zoom = this.limitZoom(c.zoom)
    const { width, height } = this.view
    const pagesWidth = this.layout.size.width * zoom
    const offsetX =
      pagesWidth + SIDE_MARGIN * 2 <= width
        ? (width - pagesWidth) / 2
        : Math.min(SIDE_MARGIN, Math.max(width - pagesWidth - SIDE_MARGIN, c.offsetX))
    const pagesHeight = this.layout.contentHeight(this.doc.notebook.pageIds.length) * zoom
    // While typing, the last page may scroll up above the keyboard. A pull for a new page
    // stretches a little further.
    const minY = Math.min(TOP_INSET, height - pagesHeight - TOP_INSET - this.bottomInset)
    const stretch = Math.min(PULL_STRETCH_PX, this.pullRaw * 0.35)
    const offsetY = Math.min(TOP_INSET, Math.max(minY - stretch, c.offsetY))
    return { zoom, offsetX, offsetY }
  }

  private setCamera(c: Camera): void {
    // The magnifier's frames belong to the view it was used in.
    if (this._state.inspect) this.closeInspect()
    this.camera = this.clampCamera(c)
    const center = (this.view.height / 2 - this.camera.offsetY) / this.camera.zoom
    const pageIndex =
      this.layout.focus ??
      Math.max(
        0,
        Math.min(this._state.pageCount - 1, Math.floor((center + 14) / this.layout.pitch)),
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

  /** The zoom within its limits: from half the fitted size (a whole slide) up to eight times. */
  private limitZoom(zoom: number): number {
    const fit = this.fitZoom()
    return Math.min(fit * 8, Math.max(this.slides ? fit : fit * 0.5, zoom))
  }

  private zoomAt(anchor: Point, factor: number): void {
    const c = this.camera
    // Limited first, so the point under the fingers stays put even at the limits.
    const zoom = this.limitZoom(c.zoom * factor)
    const wx = (anchor.x - c.offsetX) / c.zoom
    const wy = (anchor.y - c.offsetY) / c.zoom
    this.setCamera({ zoom, offsetX: anchor.x - wx * zoom, offsetY: anchor.y - wy * zoom })
  }

  private resize(): void {
    const rect = this.host.getBoundingClientRect()
    this.hostRect = rect
    const first = this.view.width === 0
    // A slide shown whole stays whole when the space around it changes (panels, rotation).
    const wasFit = this.slides && Math.abs(this.camera.zoom - this.fitZoom()) < 1e-6
    const dpr = window.devicePixelRatio || 1
    this.view = { width: rect.width, height: rect.height, dpr }
    const canvases = [this.sceneCanvas, this.wetCanvas, this.tipCanvas, this.overlayCanvas]
    for (const c of [...canvases, this.fx.canvas]) {
      c.width = Math.round(rect.width * dpr)
      c.height = Math.round(rect.height * dpr)
    }
    this.tipDirty = null
    if (first && rect.width > 0) {
      this.setCamera({ zoom: this.fitZoom(), offsetX: 0, offsetY: TOP_INSET })
    } else if (wasFit) {
      this.setCamera({ zoom: 0, offsetX: 0, offsetY: 0 })
    } else {
      this.setCamera(this.camera)
    }
  }

  private requestRender(): void {
    if (this.renderQueued) return
    this.renderQueued = true
    requestAnimationFrame(() => {
      this.renderQueued = false
      const stale = renderScene(
        this.scene,
        this.doc.pageList,
        this.doc.notebook.layers,
        this.camera,
        this.view,
        this.layout,
        this.hidden,
        this.doc.notebook.background,
        this.layout.focus,
        this.pageCache,
      )
      this.scheduleCacheBuild(stale)
    })
  }

  /**
   * Once the screen has been still for a moment (no zoom, pan or ink), makes sharp pictures of
   * the pages that were drawn directly or from a scaled picture, then shows them.
   */
  private scheduleCacheBuild(stale: number[], delay = CACHE_DELAY_MS): void {
    if (this.cacheTimer) clearTimeout(this.cacheTimer)
    this.cacheTimer = null
    if (stale.length === 0) return
    this.cacheTimer = setTimeout(() => {
      this.cacheTimer = null
      // Never in the middle of writing, and not right after: the pen must not wait for it.
      if (this.session || performance.now() - this.lastInkAt < CACHE_AFTER_INK_MS) {
        this.scheduleCacheBuild(stale, CACHE_AFTER_INK_MS)
        return
      }
      const pages = this.doc.pageList
      for (const index of stale) {
        const page = pages[index]
        if (!page) continue
        this.pageCache.build(
          page,
          index,
          this.doc.notebook.layers,
          this.doc.notebook.background,
          this.camera,
          this.view.dpr,
          this.layout,
        )
      }
      this.requestRender()
    }, delay)
  }

  // ---------- Pointer input ----------

  private screenPos(e: { clientX: number; clientY: number }): Point {
    return { x: e.clientX - this.hostRect.left, y: e.clientY - this.hostRect.top }
  }

  private toWorld(p: Point): Point {
    const c = this.camera
    return { x: (p.x - c.offsetX) / c.zoom, y: (p.y - c.offsetY) / c.zoom }
  }

  /** The page under a screen point, with the point in that page's coordinates. */
  private pageAt(screen: Point): { index: number; page: Page; x: number; y: number } | null {
    const w = this.toWorld(screen)
    const index = this.layout.indexAt(w.x, w.y, this.doc.notebook.pageIds.length)
    const page = this.doc.pageList[index]
    if (!page) return null
    const o = this.layout.origin(index)
    return { index, page, x: w.x - o.x, y: w.y - o.y }
  }

  private onPointerDown(e: PointerEvent): void {
    // Taps inside the text field place the caret; leave them to the browser.
    if (e.target === this.text.element) return
    e.preventDefault()
    this.hostRect = this.host.getBoundingClientRect()
    this.momentum = null
    if (e.pointerType === 'pen') this.penSeen = true
    this.closePasteMenu()
    // A second finger is a gesture, not a long press.
    if (e.pointerType !== 'touch' || this.touches.size === 0) this.armLongPress(e)
    else this.cancelLongPress()

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
      if (this.touches.size === 1) {
        this.tap = { start: e.timeStamp, maxTouches: 1, moved: 0, ...this.screenPos(e) }
      } else if (this.tap) this.tap.maxTouches = Math.max(this.tap.maxTouches, this.touches.size)
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
    // The laser only points; it works on any layer.
    if (this._state.tool === 'laser') {
      this.host.setPointerCapture(e.pointerId)
      this.laser.down(e)
      return
    }
    // The magnifier only looks; it works on any layer.
    if (this._state.tool === 'magnifier') {
      this.host.setPointerCapture(e.pointerId)
      this.beginLook(e)
      return
    }
    // The eyedropper only looks; it works on any layer.
    if (this._state.tool === 'eyedropper') {
      this.host.setPointerCapture(e.pointerId)
      const { width, height, dpr } = this.view
      this.session = {
        kind: 'pick',
        pointerId: e.pointerId,
        pointerType: e.pointerType,
        color: null,
        pixels: this.scene.getImageData(0, 0, Math.round(width * dpr), Math.round(height * dpr)),
      }
      this.extendPick(this.session, e)
      return
    }
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
    else if (tool === 'tape') this.beginTape(e)
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
    const index = this.layout.indexAt(w.x, w.y, this.doc.notebook.pageIds.length)
    const page = this.doc.pageList[index]
    const layer = this.activeLayer()
    if (!page || !layer || this.blockedByLayer()) return
    const o = this.layout.origin(index)
    const x = w.x - o.x
    const y = w.y - o.y
    const hit = this.textAt(page, x, y)
    if (hit) this.text.edit(page.id, hit)
    else if (!wasEditing) {
      // On ruled paper, text can sit on the lines.
      const ruled = this._state.features.textAutoAlign && page.paper === 'lined'
      const rules = ruled ? PAPER_STYLE.lined : undefined
      this.text.create(page.id, x, y, this._state.textStyle, rules)
    }
  }

  /**
   * The topmost text box at a page point that can be edited: on the active layer, or on its
   * own text layer, as long as that layer is visible and not locked.
   */
  private textAt(page: Page, x: number, y: number): TextObject | null {
    const editable = (layerId: Id) => {
      const layer = this.doc.notebook.layers.find((l) => l.id === layerId)
      return (
        !!layer &&
        !layerBlock(layer) &&
        (layer.id === this._state.activeLayerId || layer.kind === 'text')
      )
    }
    const hit = [...page.objects]
      .reverse()
      .find((obj) => obj.type === 'text' && editable(obj.layerId) && hitsObject(obj, x, y, 4))
    return hit?.type === 'text' ? hit : null
  }

  /** Opens the text of a text layer for editing, scrolling to it first. */
  editLayerText(layerId: Id): void {
    const index = this.doc.pageList.findIndex((p) => p.objects.some((o) => o.layerId === layerId))
    const page = this.doc.pageList[index]
    const object = page?.objects.find((o) => o.layerId === layerId && o.type === 'text')
    if (!page || object?.type !== 'text') return
    this.selection.clear()
    this.update({ tool: 'text' })
    this.scrollToPage(index)
    this.text.edit(page.id, object)
  }

  private onPointerMove(e: PointerEvent): void {
    const press = this.longPress
    if (press?.pointerId === e.pointerId) {
      const p = this.screenPos(e)
      if (Math.hypot(p.x - press.x, p.y - press.y) > LONG_PRESS_SLOP_PX) this.cancelLongPress()
    }
    if (this.selection.pointerMove(e)) return
    if (this.paths.pointerMove(e)) return
    if (this.laser.move(e)) return
    if (this.textTap?.pointerId === e.pointerId) {
      const p = this.screenPos(e)
      if (Math.hypot(p.x - this.textTap.x, p.y - this.textTap.y) > TAP_SLOP_PX) this.textTap = null
      // A finger keeps panning while it decides between tap and scroll.
      if (e.pointerType !== 'touch') return
    }
    const s = this.session
    if (s && e.pointerId === s.pointerId) {
      if (s.kind === 'ink') this.extendInk(s, e)
      else if (s.kind === 'tape') this.extendTape(s, e)
      else if (s.kind === 'pick') this.extendPick(s, e)
      else if (s.kind === 'look') this.extendLook(s, e)
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
    if (this.longPress?.pointerId === e.pointerId) this.cancelLongPress()
    this.selection.pointerUp(e)
    this.paths.pointerUp(e)
    this.laser.up(e)
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
        if (this.pullRaw > 0) this.endPull()
        // After a pinch the fingers lift one by one; the last one's movement is no fling.
        else if (this.panning && !this.pinched) this.startMomentum(e.timeStamp)
        this.pinched = false
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
      if (this.atBottom() || this.pullRaw > 0) {
        this.pullBy(e.deltaY * 0.6)
        // A wheel has no release; a short pause ends the pull.
        if (this.wheelPullTimer) clearTimeout(this.wheelPullTimer)
        this.wheelPullTimer = setTimeout(() => this.endPull(), 220)
      }
      this.setCamera({
        ...this.camera,
        offsetX: this.camera.offsetX - e.deltaX,
        offsetY: this.camera.offsetY - e.deltaY,
      })
    }
  }

  // ---------- Pull for a new page ----------

  /** Whether the view shows the end of the last page. */
  private atBottom(): boolean {
    // Presentations get new slides from the slide list.
    if (this.slides) return false
    const { height } = this.view
    const pagesHeight =
      this.layout.contentHeight(this.doc.notebook.pageIds.length) * this.camera.zoom
    const minY = Math.min(TOP_INSET, height - pagesHeight - TOP_INSET - this.bottomInset)
    return this.camera.offsetY <= minY + 1
  }

  /** Pulls `by` pixels further past the last page (less when negative). */
  private pullBy(by: number): void {
    if (this._state.newPageMenu) return
    this.pullRaw = Math.max(0, this.pullRaw + by)
    const armed = this.pullRaw >= PULL_ARM_PX
    if (armed && !this.pullArmedAt) this.pullArmedAt = performance.now()
    if (!armed) this.pullArmedAt = 0
    this.showPull()
    if (armed && !this.pullFrame) this.pullFrame = requestAnimationFrame(() => this.tickPull())
  }

  private showPull(): void {
    if (this.pullRaw < 12) {
      if (this._state.pull) this.update({ pull: null })
      return
    }
    const progress = this.pullArmedAt
      ? Math.min(1, (performance.now() - this.pullArmedAt) / PULL_HOLD_MS)
      : 0
    this.update({ pull: { armed: Boolean(this.pullArmedAt), progress } })
  }

  /** The hold fills up while the pull stays armed; once full, a page is asked for. */
  private tickPull(): void {
    this.pullFrame = 0
    if (!this.pullArmedAt) return
    this.showPull()
    if ((this._state.pull?.progress ?? 0) >= 1) {
      navigator.vibrate?.(15)
      this.endPull()
      this.requestNewPage()
      return
    }
    this.pullFrame = requestAnimationFrame(() => this.tickPull())
  }

  /** Letting go: the pages spring back, and a pull not held long enough does nothing. */
  private endPull(): void {
    if (this.wheelPullTimer) clearTimeout(this.wheelPullTimer)
    this.wheelPullTimer = null
    cancelAnimationFrame(this.pullFrame)
    this.pullFrame = 0
    this.pullRaw = 0
    this.pullArmedAt = 0
    if (this._state.pull) this.update({ pull: null })
    this.setCamera(this.camera)
  }

  /** Adds a page at the end: right away, or after asking for its paper. */
  requestNewPage(): void {
    if (this._state.features.askPaper) this.update({ newPageMenu: true })
    else this.addPageAtEnd(this.doc.notebook.paper, false)
  }

  /** The paper new pages get. */
  notebookPaper(): PaperKind {
    return this.doc.notebook.paper
  }

  closeNewPageMenu(): void {
    this.update({ newPageMenu: false })
  }

  /**
   * Adds a page of `paper` after the last one. With `makeDefault`, every new page gets that
   * paper from now on, without asking.
   */
  addPageAtEnd(paper: PaperKind, makeDefault: boolean): void {
    const index = this.doc.notebook.pageIds.length
    const commands = [insertPages('Add page', index, [createPage(this.doc.notebook.id, paper)])]
    const before = this.doc.notebook.paper
    if (makeDefault && before !== paper) commands.push(setNotebookPaper(before, paper))
    this.history.execute(compound('Add page', commands))
    if (makeDefault) this.setFeatures({ askPaper: false })
    this.update({ newPageMenu: false })
    this.scrollToPage(index)
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
        // Limited before placing the page: past a limit, an unlimited zoom here would move the
        // page sideways once the limit applies.
        const zoom = this.limitZoom(camera.zoom * factor)
        this.pinched = true
        camera = { zoom, offsetX: cx - wx * zoom, offsetY: cy - wy * zoom }
      }
      const atBottom = this.atBottom()
      if (next.count === 1 && (atBottom || this.pullRaw > 0)) this.pullBy(-dy)
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
  /**
   * A double tap with two fingers undoes, with three fingers redoes. A single tap does nothing,
   * so resting fingers on the screen never changes the page by accident.
   */
  private finishTap(time: number): void {
    const tap = this.tap
    if (!tap || time - tap.start > TWO_FINGER_TAP_MS || tap.moved > TAP_SLOP_PX) return
    if (tap.maxTouches === 1) {
      this.tapeTapAt(tap, time)
      return
    }
    if (tap.maxTouches !== 2 && tap.maxTouches !== 3) return
    if (!this._state.features.gestureUndo) return
    const last = this.lastGestureTap
    if (last && last.fingers === tap.maxTouches && time - last.time < DOUBLE_TAP_MS) {
      this.lastGestureTap = null
      if (tap.maxTouches === 2) this.undo()
      else this.redo()
      return
    }
    this.lastGestureTap = { fingers: tap.maxTouches, time }
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
    const pageIndex = this.layout.indexAt(world.x, world.y, this.doc.notebook.pageIds.length)
    const page = this.doc.pageList[pageIndex]
    if (!page) return

    const highlighter = this._state.tool === 'highlighter'
    const settings = highlighter ? this._state.highlighter : this._state.pen
    const fountain = !highlighter && this._state.pen.nib === 'fountain'
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
        opacity: highlighter ? this._state.highlighter.opacity : this._state.pen.opacity,
        ...(!highlighter && !fountain && this._state.pen.dash
          ? { dash: this._state.pen.dash }
          : {}),
      },
      sampler: new StrokeSampler(),
      local: [],
      nib: fountain,
      pressures: [],
      altitudes: [],
      rawWidths: [],
      widths: [],
      drawnSegments: 0,
      wetDirty: null,
      predicted: null,
      holdAt: this.screenPos(e),
      holdTimer: null,
      snapped: null,
    }
    this.session = session
    this.host.setPointerCapture(e.pointerId)
    // The ink layers show the stroke exactly as it will look once finished (see inkColor).
    this.inkLayer.style.opacity = String(inkAlpha(session.stroke) * layer.opacity)
    this.inkLayer.style.mixBlendMode = highlighter ? 'darken' : 'normal'

    this.addInkSample(session, e)
    this.armHold(session)
    this.drawInk(session)
  }

  private addInkSample(s: InkSession, e: PointerEvent): void {
    const p = this.screenPos(e)
    if (!s.sampler.add(p.x, p.y, e.timeStamp, this.pressureOf(e), tiltOf(e))) return
    const last = s.sampler.points[s.sampler.points.length - 1]!
    const local = this.toPageLocal(last, s.pageIndex)
    s.local.push(local.x, local.y)
    if (!s.nib) return
    s.pressures.push(last.p)
    s.altitudes.push(last.tilt ? (last.tilt.altitude * 180) / Math.PI : undefined)
    // The first widths look ahead to the third point (see nibWidthAt); after that they are final.
    const n = s.local.length / 2
    const from = n <= 3 ? 0 : s.rawWidths.length
    s.rawWidths.length = from
    s.widths.length = from
    for (let i = from; i < n; i++) {
      s.rawWidths.push(nibWidthAt(s.local, s.pressures, s.stroke.width, i, this.nibOptions(s)))
      s.widths.push(easeWidth(s.widths[i - 1], s.rawWidths[i]!))
    }
  }

  private nibOptions(s: InkSession): NibOptions {
    return { sensitivity: this._state.pen.sensitivity, altitudes: s.altitudes }
  }

  /** The stroke's recorded input, one entry per point of `drawnPoints`. */
  private inputRecord(s: InkSession): StrokeInput {
    const samples = s.sampler.finalPoints()
    const t0 = samples[0]?.t ?? 0
    const device = s.pointerType === 'pen' || s.pointerType === 'touch' ? s.pointerType : 'mouse'
    const record: StrokeInput = {
      device,
      t: samples.map((p) => Math.round(p.t - t0)),
      p: samples.map((p) => Math.round(p.p * 1000) / 1000),
    }
    if (samples.some((p) => p.tilt)) {
      const deg = (r: number) => Math.round(((r * 180) / Math.PI) * 10) / 10
      record.altitude = samples.map((p) => (p.tilt ? deg(p.tilt.altitude) : 90))
      record.azimuth = samples.map((p) => (p.tilt ? deg(p.tilt.azimuth) : 0))
    }
    return record
  }

  /** Pen pressure from 0 to 1; fingers and mice report none, so they draw at the base width. */
  private pressureOf(e: PointerEvent): number {
    if (!this._state.features.pressure || e.pointerType !== 'pen' || !(e.pressure > 0)) return 0.5
    return e.pressure
  }

  private toPageLocal(p: Point, pageIndex: number): Point {
    const w = this.toWorld(p)
    const o = this.layout.origin(pageIndex)
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
    s.predicted = this.predictedPoint(s, e)
    // Drawn once per screen frame, however many events arrive in it.
    if (!this.inkFrame) {
      this.inkFrame = requestAnimationFrame(() => {
        this.inkFrame = 0
        if (this.session === s && !s.snapped) this.drawInk(s)
      })
    }
  }

  /**
   * Draws the stroke in progress inside the input event, so new samples reach the next frame.
   * The line goes straight through the pen's samples (a Catmull-Rom curve between them, no
   * filter that trails behind): what is drawn stays exactly where it is. Segment i, from point i
   * to point i + 1, is final once point i + 2 exists; final segments go once onto the wet layer,
   * and only the last bit, out to the pen tip, is redrawn per event.
   */
  private drawInk(s: InkSession): void {
    if (s.nib) {
      this.drawNibInk(s)
      return
    }
    const pts = s.local
    const n = pts.length / 2
    const { dpr } = this.view
    const settled = Math.max(0, n - 2)
    // A dash pattern restarts with every path, so dashed ink is drawn whole on the tip layer.
    const dashed = Boolean(s.stroke.dash)
    if (dashed && settled > s.drawnSegments) s.drawnSegments = settled
    if (!dashed && settled > s.drawnSegments) {
      const from = s.drawnSegments
      const path = new Path2D()
      path.moveTo(pts[from * 2]!, pts[from * 2 + 1]!)
      traceSegments(path, pts, from, settled)
      this.wet.save()
      enterPage(this.wet, this.camera, dpr, s.pageIndex, this.layout)
      setInkStyle(this.wet, s.stroke)
      this.wet.stroke(path)
      this.wet.restore()
      const covered = pts.slice(Math.max(0, from - 1) * 2, (settled + 2) * 2)
      s.wetDirty = unionDevice(s.wetDirty, this.deviceRect(covered, s.pageIndex, s.stroke.width))
      s.drawnSegments = settled
    }

    // The open end: from the last final point through the newest ones to the pen tip.
    const start = Math.max(0, s.drawnSegments - 1)
    const tail = this.inkTail(s, pts.slice(start * 2))
    const first = s.drawnSegments - start
    this.clearTip()
    this.tip.save()
    enterPage(this.tip, this.camera, dpr, s.pageIndex, this.layout)
    setInkStyle(this.tip, s.stroke)
    const path = new Path2D()
    if (dashed && s.drawnSegments > 0) {
      path.moveTo(pts[0]!, pts[1]!)
      traceSegments(path, pts, 0, s.drawnSegments)
    } else {
      path.moveTo(tail[first * 2]!, tail[first * 2 + 1]!)
    }
    if (tail.length / 2 - 1 > first) traceSegments(path, tail, first, tail.length / 2 - 1)
    else path.lineTo(tail[first * 2]! + 0.001, tail[first * 2 + 1]!)
    this.tip.stroke(path)
    this.tip.restore()
    this.tipDirty = dashed
      ? { x: 0, y: 0, w: this.view.width * dpr, h: this.view.height * dpr }
      : this.deviceRect(tail, s.pageIndex, s.stroke.width)
  }

  /**
   * `points` (page coordinates) followed by the pen tip when it is not a point yet, and the
   * browser's predicted next position: drawn for this frame only, never kept.
   */
  private inkTail(s: InkSession, points: number[]): number[] {
    const tip = s.sampler.tip
    const last = s.sampler.points[s.sampler.points.length - 1]
    if (tip && tip !== last) {
      const t = this.toPageLocal(tip, s.pageIndex)
      points.push(t.x, t.y)
    }
    if (s.predicted) points.push(s.predicted.x, s.predicted.y)
    return points
  }

  /**
   * `drawInk` for the fountain pen: the same final and open parts, filled as a line whose width
   * changes along the way.
   */
  private drawNibInk(s: InkSession): void {
    const pts = s.local
    const n = pts.length / 2
    const { dpr } = this.view
    const settled = Math.max(0, n - 2)
    if (settled > s.drawnSegments) {
      const from = s.drawnSegments
      const flat = flattenStroke(pts, s.widths, from, settled)
      const path = new Path2D()
      traceNib(path, flat)
      this.wet.save()
      enterPage(this.wet, this.camera, dpr, s.pageIndex, this.layout)
      this.wet.fillStyle = s.stroke.color
      this.wet.fill(path)
      this.wet.restore()
      s.wetDirty = unionDevice(
        s.wetDirty,
        this.deviceRect(flat3to2(flat), s.pageIndex, widest(flat)),
      )
      s.drawnSegments = settled
    }
    const start = Math.max(0, s.drawnSegments - 1)
    const tail = this.inkTail(s, pts.slice(start * 2))
    // The tip and the prediction keep the newest width.
    const widths = s.widths.slice(start)
    const lastWidth = widths[widths.length - 1] ?? s.stroke.width
    while (widths.length < tail.length / 2) widths.push(lastWidth)
    const first = s.drawnSegments - start
    const flat = flattenStroke(tail, widths, first, Math.max(first, tail.length / 2 - 1))
    this.clearTip()
    this.tip.save()
    enterPage(this.tip, this.camera, dpr, s.pageIndex, this.layout)
    this.tip.fillStyle = s.stroke.color
    const path = new Path2D()
    traceNib(path, flat)
    this.tip.fill(path)
    this.tip.restore()
    this.tipDirty = this.deviceRect(flat3to2(flat), s.pageIndex, widest(flat))
  }

  /**
   * Where the browser expects the pen next (Chrome reports it; Safari does not), only a short way
   * ahead: a long guess overshoots turns and has to be taken back, which looks like the line
   * correcting itself. Never part of the stroke.
   */
  private predictedPoint(s: InkSession, e: PointerEvent): Point | null {
    const predicted = e.getPredictedEvents?.()[0]
    const tip = s.sampler.tip
    if (!predicted || !tip) return null
    const p = this.screenPos(predicted)
    const d = Math.hypot(p.x - tip.x, p.y - tip.y)
    if (d < 0.5) return null
    const k = Math.min(1, PREDICT_MAX_PX / d)
    return this.toPageLocal(
      { x: tip.x + (p.x - tip.x) * k, y: tip.y + (p.y - tip.y) * k },
      s.pageIndex,
    )
  }

  /** Restarts the wait for the pen to rest; resting long enough draws the perfect shape. */
  private armHold(s: InkSession): void {
    if (s.holdTimer) clearTimeout(s.holdTimer)
    if (!this._state.features.holdToShape) return
    s.holdTimer = setTimeout(() => this.snapToPerfect(s), HOLD_MS)
  }

  /** Whether drawn points stayed within a few screen pixels: a tap, not a stroke. */
  private isTap(points: readonly number[]): boolean {
    const b = boundsOfPoints(points)
    const zoom = this.camera.zoom
    return (b.maxX - b.minX) * zoom < TAP_SLOP_PX && (b.maxY - b.minY) * zoom < TAP_SLOP_PX
  }

  /** The finished stroke's points: the ones drawn live, lightly finished, ending at the pen tip. */
  private drawnPoints(s: InkSession): number[] {
    return finishPoints(this.rawPoints(s))
  }

  private rawPoints(s: InkSession): number[] {
    const raw: number[] = []
    for (const p of s.sampler.finalPoints()) {
      const local = this.toPageLocal(p, s.pageIndex)
      raw.push(local.x, local.y)
    }
    return raw
  }

  /** The fountain pen's width at each point of `drawnPoints`. */
  private drawnWidths(s: InkSession): number[] {
    const raw = this.rawPoints(s)
    const samples = s.sampler.finalPoints()
    const pressures = samples.map((p) => p.p)
    const options = {
      sensitivity: this._state.pen.sensitivity,
      altitudes: samples.map((p) => (p.tilt ? (p.tilt.altitude * 180) / Math.PI : undefined)),
    }
    const widths: number[] = []
    for (let i = 0; i < pressures.length; i++) {
      widths.push(easeWidth(widths[i - 1], nibWidthAt(raw, pressures, s.stroke.width, i, options)))
    }
    return widths
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
    enterPage(this.tip, this.camera, this.view.dpr, s.pageIndex, this.layout)
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
    cancelAnimationFrame(this.inkFrame)
    this.inkFrame = 0
    const snapped = s.snapped
    const points = snapped ? snapped.points : this.drawnPoints(s)
    const page = this.doc.page(s.pageId)
    // A finger writing (before any pencil was used) double taps tape like a panning finger does.
    if (page && !snapped && s.pointerType === 'touch' && this.isTap(points)) {
      const b = boundsOfPoints(points)
      const o = this.layout.origin(s.pageIndex)
      const c = this.camera
      const at = {
        x: (o.x + (b.minX + b.maxX) / 2) * c.zoom + c.offsetX,
        y: (o.y + (b.minY + b.maxY) / 2) * c.zoom + c.offsetY,
      }
      if (this.tapeTapAt(at, performance.now())) {
        this.clearArea(this.wet, s.wetDirty)
        this.clearTip()
        return
      }
    }
    // A pen tap on a text box opens it for typing instead of leaving a dot.
    if (page && !snapped && this.isTap(points)) {
      const b = boundsOfPoints(points)
      const hit = this.textAt(page, (b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2)
      if (hit) {
        this.clearArea(this.wet, s.wetDirty)
        this.clearTip()
        this.returnTool = this._state.tool
        this.update({ tool: 'text' })
        this.text.edit(page.id, hit)
        return
      }
    }
    if (page && points.length >= 2) {
      const stroke: StrokeObject = snapped
        ? { ...s.stroke, points, closed: snapped.closed, straight: snapped.straight }
        : s.nib
          ? { ...s.stroke, points, widths: this.drawnWidths(s), input: this.inputRecord(s) }
          : { ...s.stroke, points, input: this.inputRecord(s) }
      // A highlighter stroke over typed text becomes a neat highlight of that text.
      if (stroke.tool === 'highlighter' && this._state.features.smartHighlight) {
        const marked = highlightText(page.objects, stroke, this.doc.notebook.layers)
        if (marked) {
          this.history.execute(setPageObjects('Highlight text', page.id, page.objects, marked))
          this.rememberColor(stroke.color)
          this.clearArea(this.wet, s.wetDirty)
          this.clearTip()
          return
        }
      }
      const layers = this.doc.notebook.layers.filter((l) => l.visible)
      const top = layers[layers.length - 1]
      const onTop = top?.id === stroke.layerId && top.opacity >= 1 && !top.clip
      // Paint the finished stroke straight onto the scene, so there is no frame without it.
      if (onTop) {
        this.scene.save()
        enterPage(this.scene, this.camera, this.view.dpr, s.pageIndex, this.layout)
        paintStroke(this.scene, stroke)
        this.scene.restore()
      }
      this.paintedByEditor = onTop
      this.history.execute(setPageObjects('Draw', page.id, page.objects, [...page.objects, stroke]))
      this.rememberColor(stroke.color)
      this.paintedByEditor = false
      this.lastInkAt = performance.now()
      // The page's picture no longer matches; a new one is made in the next pause.
      if (onTop) this.scheduleCacheBuild([s.pageIndex], CACHE_AFTER_INK_MS)
      // A line made perfectly straight can still complete a table.
      if (this._state.features.suggestions)
        this.scheduleSuggestion(page.id, stroke, Boolean(snapped))
    }
    this.clearArea(this.wet, s.wetDirty)
    this.clearTip()
  }

  // ---------- Tape ----------

  private beginTape(e: PointerEvent): void {
    const layer = this.activeLayer()
    if (!layer || layer.locked || !layer.visible) return
    const world = this.toWorld(this.screenPos(e))
    const pageIndex = this.layout.indexAt(world.x, world.y, this.doc.notebook.pageIds.length)
    const page = this.doc.pageList[pageIndex]
    if (!page) return
    const at = this.toPageLocal(this.screenPos(e), pageIndex)
    const session: TapeSession = {
      kind: 'tape',
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      pageIndex,
      pageId: page.id,
      from: at,
      to: at,
    }
    this.session = session
    this.host.setPointerCapture(e.pointerId)
  }

  private tapeStroke(s: TapeSession): StrokeObject {
    return {
      id: newId(),
      type: 'stroke',
      layerId: this._state.activeLayerId,
      tool: 'tape',
      color: this._state.tape.color,
      width: this._state.tape.width,
      opacity: 1,
      straight: true,
      points: [s.from.x, s.from.y, s.to.x, s.to.y],
    }
  }

  private extendTape(s: TapeSession, e: PointerEvent): void {
    s.to = this.toPageLocal(this.screenPos(e), s.pageIndex)
    this.clearTip()
    this.inkLayer.style.opacity = '1'
    this.inkLayer.style.mixBlendMode = 'normal'
    this.tip.save()
    enterPage(this.tip, this.camera, this.view.dpr, s.pageIndex, this.layout)
    paintStroke(this.tip, this.tapeStroke(s))
    this.tip.restore()
    const { width, height, dpr } = this.view
    this.tipDirty = { x: 0, y: 0, w: width * dpr, h: height * dpr }
  }

  private finishTape(s: TapeSession): void {
    this.clearTip()
    const page = this.doc.page(s.pageId)
    if (!page) return
    const length = Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y) * this.camera.zoom
    // A tap opens or closes the tape under it.
    if (length < TAP_SLOP_PX) {
      const tape = this.tapeAt(page, s.from.x, s.from.y)
      if (tape) this.toggleTape(page.id, tape)
      return
    }
    const tape = this.tapeStroke(s)
    this.history.execute(setPageObjects('Tape', page.id, page.objects, [...page.objects, tape]))
  }

  /** The topmost strip of tape at a page point. */
  private tapeAt(page: Page, x: number, y: number): StrokeObject | null {
    for (let i = page.objects.length - 1; i >= 0; i--) {
      const o = page.objects[i]!
      if (o.type !== 'stroke' || o.tool !== 'tape') continue
      if (!this.doc.notebook.layers.find((l) => l.id === o.layerId)?.visible) continue
      if (strokeTouchesCircle(o.points, x, y, o.width / 2 + 4 / this.camera.zoom)) return o
    }
    return null
  }

  /**
   * A finger tap at a screen point: a second tap on the same strip of tape soon after the first
   * opens or closes it. Returns whether the tap was on tape.
   */
  private tapeTapAt(screen: Point, time: number): boolean {
    const hit = this.pageAt(screen)
    const tape = hit && this.tapeAt(hit.page, hit.x, hit.y)
    if (!hit || !tape) {
      this.lastTapeTap = null
      return false
    }
    const last = this.lastTapeTap
    if (last && last.id === tape.id && time - last.time < DOUBLE_TAP_MS) {
      this.lastTapeTap = null
      this.toggleTape(hit.page.id, tape)
    } else {
      this.lastTapeTap = { id: tape.id, time }
    }
    return true
  }

  /**
   * Pulls tape off or sticks it back on, with a short animation. Whether tape is open is a
   * way of looking at the page, not an edit, so it is saved but not undone.
   */
  private toggleTape(pageId: Id, tape: StrokeObject): void {
    const pageIndex = this.doc.pageList.findIndex((p) => p.id === pageId)
    const set = (revealed: boolean) => {
      const page = this.doc.page(pageId)
      if (!page) return
      const objects = page.objects.map((o) =>
        o.id === tape.id && o.type === 'stroke' ? { ...o, revealed } : o,
      )
      this.doc.setObjects(pageId, objects)
    }
    if (tape.revealed) {
      // Stuck back on: the page shows it covered once the strip has come down.
      this.tapePeel.add({ ...tape, revealed: false }, pageIndex, false, () => set(false))
    } else {
      set(true)
      this.tapePeel.add(tape, pageIndex, true)
    }
    this.fx.request()
  }

  // ---------- Magnifier ----------

  private beginLook(e: PointerEvent): void {
    this.closeInspect()
    // A copy of the page as shown, so the loupe never enlarges itself.
    const snapshot = document.createElement('canvas')
    snapshot.width = this.sceneCanvas.width
    snapshot.height = this.sceneCanvas.height
    snapshot.getContext('2d')?.drawImage(this.sceneCanvas, 0, 0)
    const session: LookSession = {
      kind: 'look',
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      snapshot,
      at: this.screenPos(e),
    }
    this.session = session
    this.extendLook(session, e)
  }

  private extendLook(s: LookSession, e: PointerEvent): void {
    s.at = this.screenPos(e)
    this.drawLoupe(s, this.objectsAt(s.at))
  }

  /** A round loupe above the finger, showing the spot under it enlarged. */
  private drawLoupe(s: LookSession, items: InspectItem[]): void {
    this.clearTip()
    const { dpr, width, height } = this.view
    const ctx = this.tip
    const r = 64
    const zoom = 2.5
    const cx = s.at.x
    const cy = Math.max(r + 8, s.at.y - (s.pointerType === 'touch' ? 110 : 90))
    this.inkLayer.style.opacity = '1'
    this.inkLayer.style.mixBlendMode = 'normal'
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.outlineObjects(ctx, items)
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.clip()
    const size = (r * 2) / zoom
    ctx.drawImage(
      s.snapshot,
      (s.at.x - size / 2) * dpr,
      (s.at.y - size / 2) * dpr,
      size * dpr,
      size * dpr,
      cx - r,
      cy - r,
      r * 2,
      r * 2,
    )
    ctx.restore()
    ctx.lineWidth = 5
    ctx.strokeStyle = '#fffcf7'
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.lineWidth = 1.5
    ctx.strokeStyle = 'rgba(62, 45, 37, 0.6)'
    ctx.beginPath()
    ctx.arc(cx, cy, r + 3, 0, Math.PI * 2)
    ctx.stroke()
    // Cross hairs in the loupe, and a ring at the spot itself.
    ctx.beginPath()
    ctx.moveTo(cx - 9, cy)
    ctx.lineTo(cx + 9, cy)
    ctx.moveTo(cx, cy - 9)
    ctx.lineTo(cx, cy + 9)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(s.at.x, s.at.y, 6, 0, Math.PI * 2)
    ctx.stroke()
    this.tipDirty = { x: 0, y: 0, w: width * dpr, h: height * dpr }
  }

  /** Dashed frames around objects, in screen pixels. */
  private outlineObjects(ctx: CanvasRenderingContext2D, items: InspectItem[]): void {
    const pages = this.doc.pageList
    const c = this.camera
    ctx.save()
    ctx.setLineDash([5, 4])
    ctx.lineWidth = 1.5
    ctx.strokeStyle = 'rgba(185, 139, 101, 0.95)'
    for (const item of items) {
      const index = pages.findIndex((p) => p.objects.some((o) => o.id === item.id))
      const object = pages[index]?.objects.find((o) => o.id === item.id)
      if (!object) continue
      const b = objectBounds(object)
      const o = this.layout.origin(index)
      ctx.strokeRect(
        (b.minX + o.x) * c.zoom + c.offsetX - 4,
        (b.minY + o.y) * c.zoom + c.offsetY - 4,
        (b.maxX - b.minX) * c.zoom + 8,
        (b.maxY - b.minY) * c.zoom + 8,
      )
    }
    ctx.restore()
  }

  /** Lifting the magnifier lists what was under it; the frames stay until the list closes. */
  private finishLook(s: LookSession): void {
    const items = this.objectsAt(s.at)
    this.clearTip()
    const { dpr, width, height } = this.view
    this.tip.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.outlineObjects(this.tip, items)
    this.tipDirty = { x: 0, y: 0, w: width * dpr, h: height * dpr }
    this.update({ inspect: { x: s.at.x, y: s.at.y, items } })
  }

  closeInspect(): void {
    if (!this._state.inspect) return
    this.clearTip()
    this.update({ inspect: null })
  }

  /** Every object under a screen point, upper layers first, with its layer. */
  private objectsAt(screen: Point): InspectItem[] {
    const hit = this.pageAt(screen)
    if (!hit) return []
    const slop = 6 / this.camera.zoom
    const layers = this.doc.notebook.layers
    const out: InspectItem[] = []
    for (let i = hit.page.objects.length - 1; i >= 0; i--) {
      const o = hit.page.objects[i]!
      const layer = layers.find((l) => l.id === o.layerId)
      if (!layer || !hitsObject(o, hit.x, hit.y, slop)) continue
      out.push({
        id: o.id,
        label: objectLabel(o),
        layerId: layer.id,
        layerName: layer.name,
        hidden: !layer.visible,
        locked: layer.locked,
      })
    }
    const order = (id: Id) => layers.findIndex((l) => l.id === id)
    return out.sort((a, b) => order(b.layerId) - order(a.layerId))
  }

  // ---------- Eyedropper ----------

  /** The color of the page at a screen point, as #rrggbb. */
  private colorAt(pixels: ImageData | null, p: Point): string | null {
    const { dpr } = this.view
    const x = Math.floor(p.x * dpr)
    const y = Math.floor(p.y * dpr)
    if (!pixels || x < 0 || y < 0 || x >= pixels.width || y >= pixels.height) return null
    const i = (y * pixels.width + x) * 4
    const rgb = [pixels.data[i]!, pixels.data[i + 1]!, pixels.data[i + 2]!]
    return '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('')
  }

  private extendPick(s: PickSession, e: PointerEvent): void {
    const p = this.screenPos(e)
    s.color = this.colorAt(s.pixels, p) ?? s.color
    this.clearTip()
    if (!s.color) return
    // A loupe above the finger shows the color, with a small ring around the exact spot.
    const { dpr } = this.view
    const ctx = this.tip
    this.inkLayer.style.opacity = '1'
    this.inkLayer.style.mixBlendMode = 'normal'
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const lx = p.x
    const ly = p.y - (e.pointerType === 'touch' ? 86 : 64)
    ctx.beginPath()
    ctx.arc(lx, ly, 30, 0, Math.PI * 2)
    ctx.fillStyle = s.color
    ctx.fill()
    ctx.lineWidth = 6
    ctx.strokeStyle = '#fffcf7'
    ctx.stroke()
    ctx.lineWidth = 1.5
    ctx.strokeStyle = 'rgba(62, 45, 37, 0.55)'
    ctx.beginPath()
    ctx.arc(lx, ly, 33, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(p.x, p.y, 7, 0, Math.PI * 2)
    ctx.lineWidth = 3
    ctx.strokeStyle = '#fffcf7'
    ctx.stroke()
    ctx.lineWidth = 1.5
    ctx.strokeStyle = 'rgba(62, 45, 37, 0.8)'
    ctx.stroke()
    const { width, height } = this.view
    this.tipDirty = { x: 0, y: 0, w: width * dpr, h: height * dpr }
  }

  /** Lifting the eyedropper takes the color and goes back to the tool used before. */
  private finishPick(s: PickSession): void {
    this.clearTip()
    if (!s.color) return
    const back = this.pickReturn === 'eyedropper' ? 'pen' : this.pickReturn
    this.setTool(back)
    this.applyColor(s.color)
    this.showNotice(`Picked ${s.color.toUpperCase()}`)
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
    let swept: string | null = null
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      const x = from.x + (to.x - from.x) * t
      const y = from.y + (to.y - from.y) * t
      swept = this.eraseAt(s, layer.id, x, y, radius) ?? swept
    }
    if (steps === 1 && from === to) swept = this.eraseAt(s, layer.id, to.x, to.y, radius)
    if (swept && this._state.features.broomDust) {
      const c = this.camera
      const at = { x: to.x * c.zoom + c.offsetX, y: to.y * c.zoom + c.offsetY }
      this.dust.puff(at, to.x - from.x, to.y - from.y, swept, radius * 2 * c.zoom)
      this.fx.request()
    }
    s.last = to
  }

  /** Sweeps one spot; returns the color of something it swept away, if anything. */
  private eraseAt(
    s: EraseSession,
    layerId: Id,
    wx: number,
    wy: number,
    radius: number,
  ): string | null {
    let swept: string | null = null
    const pageCount = this.doc.notebook.pageIds.length
    // The broom can overlap two pages near a gap; check both neighbours.
    const near = Math.floor(wy / this.layout.pitch)
    for (const index of [near - 1, near, near + 1]) {
      if (index < 0 || index >= pageCount) continue
      const page = this.doc.pageList[index]
      if (!page) continue
      const o = this.layout.origin(index)
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
          swept = object.color
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
          if (strokeTouchesCircle(object.points, cx, cy, reach)) {
            changed = true
            swept = object.color
          } else next.push(object)
          continue
        }
        const pieces = eraseFromStroke(object.points, object.widths, cx, cy, reach, object.input)
        if (!pieces) {
          next.push(object)
          continue
        }
        changed = true
        swept = object.color
        for (const piece of pieces) {
          next.push({ ...withPoints(object, piece.points, piece.widths, piece.input), id: newId() })
        }
      }
      if (!changed) continue
      if (!s.before.has(page.id)) s.before.set(page.id, page.objects)
      this.doc.setObjects(page.id, next)
    }
    return swept
  }

  private finishErase(s: EraseSession): void {
    this.clearTip()
    if (s.before.size === 0) return
    const commands = [...s.before].map(([pageId, before]) =>
      setPageObjects('Erase', pageId, before, this.doc.page(pageId)?.objects ?? before),
    )
    this.history.record(compound('Erase', commands))
  }

  /** The broom itself marks where it sweeps: its head is as wide as the sweep. */
  private drawBroomCursor(screen: Point): void {
    this.clearTip()
    const { dpr } = this.view
    const r = (this._state.broom.size / 2) * this.camera.zoom
    // The head spans about half the icon's height.
    const icon = Math.max(22, r * 4)
    this.inkLayer.style.opacity = '1'
    this.inkLayer.style.mixBlendMode = 'normal'
    this.tip.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawBroom(this.tip, screen.x, screen.y, icon)
    const reach = icon + 6
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
    else if (s.kind === 'tape') this.finishTape(s)
    else if (s.kind === 'pick') this.finishPick(s)
    else if (s.kind === 'look') this.finishLook(s)
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
    } else if (s.kind === 'tape' || s.kind === 'pick' || s.kind === 'look') {
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
    const o = this.layout.origin(pageIndex)
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

/** The x, y pairs of flattened x, y, width triples. */
function flat3to2(flat: readonly number[]): number[] {
  const out: number[] = []
  for (let i = 0; i < flat.length; i += 3) out.push(flat[i]!, flat[i + 1]!)
  return out
}

function widest(flat: readonly number[]): number {
  let w = 0
  for (let i = 2; i < flat.length; i += 3) w = Math.max(w, flat[i]!)
  return w
}

/** A short name for an object, as the magnifier lists it. */
function objectLabel(o: CanvasObject): string {
  if (o.type === 'stroke') {
    if (o.tool === 'tape') return 'Tape'
    if (o.tool === 'highlighter') return 'Highlighter'
    return o.widths ? 'Fountain pen' : 'Ink'
  }
  if (o.type === 'text') {
    const t = o.text.trim().replace(/\s+/g, ' ')
    return `Text “${t.length > 18 ? `${t.slice(0, 18)}…` : t}”`
  }
  if (o.type === 'fill') return 'Filled area'
  if (o.type === 'image') return 'Picture'
  if (o.type === 'table') return 'Table'
  return 'Chart'
}

/**
 * The pen's tilt, where the browser reports it: Safari gives Apple Pencil's altitude and
 * azimuth; others give tiltX/tiltY, converted here. Fingers and mice have none.
 */
function tiltOf(e: PointerEvent): Tilt | undefined {
  if (e.pointerType !== 'pen') return undefined
  const angles = e as PointerEvent & { altitudeAngle?: number; azimuthAngle?: number }
  if (typeof angles.altitudeAngle === 'number' && typeof angles.azimuthAngle === 'number') {
    // Exactly upright with no direction is what browsers report for pens without tilt.
    if (angles.altitudeAngle === Math.PI / 2 && angles.azimuthAngle === 0) return undefined
    return { altitude: angles.altitudeAngle, azimuth: angles.azimuthAngle }
  }
  if (!e.tiltX && !e.tiltY) return undefined
  const tx = Math.tan((e.tiltX * Math.PI) / 180)
  const ty = Math.tan((e.tiltY * Math.PI) / 180)
  return { altitude: Math.atan2(1, Math.hypot(tx, ty)), azimuth: Math.atan2(ty, tx) }
}

/** The fountain pen's next width, eased from the previous one so it swells and thins smoothly. */
function easeWidth(previous: number | undefined, target: number): number {
  return previous === undefined ? target : previous + (target - previous) * WIDTH_EASE
}
