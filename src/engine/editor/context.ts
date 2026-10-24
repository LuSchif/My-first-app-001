import type { History } from '../commands/History.ts'
import type { NotebookDocument } from '../document/NotebookDocument.ts'
import type { Camera, Point } from '../geometry/camera.ts'
import type { Id, LayerDef, Page } from '../model/types.ts'
import type { View } from '../render/SceneRenderer.ts'

/** What the editor shares with its tool controllers (selection, text). */
export interface EditorContext {
  readonly doc: NotebookDocument
  readonly history: History
  readonly host: HTMLElement
  readonly overlay: CanvasRenderingContext2D
  camera(): Camera
  view(): View
  screenPos(e: { clientX: number; clientY: number }): Point
  /** The page under a screen point, with the point in that page's coordinates. */
  pageAt(screen: Point): { index: number; page: Page; x: number; y: number } | null
  pageIndexOf(pageId: Id): number
  /** Screen position of a point given in a page's coordinates. */
  toScreen(pageIndex: number, x: number, y: number): Point
  activeLayer(): LayerDef | undefined
  /** Objects the scene should skip because a controller draws them itself. */
  setHidden(ids: ReadonlySet<Id>): void
  requestRender(): void
  /** Moves the pages by `dx`, `dy` screen pixels. */
  scrollBy(dx: number, dy: number): void
  /** Zooms by `factor`, keeping the screen point `anchor` in place. */
  zoomAt(anchor: Point, factor: number): void
  /** The part of the screen not covered by toolbars, the color bar or the on-screen keyboard. */
  visibleArea(): { left: number; right: number; top: number; bottom: number }
  /** A controller's state changed in a way the UI shows. */
  changed(): void
}
