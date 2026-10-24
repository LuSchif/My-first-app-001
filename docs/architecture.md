# Broomit architecture

This document records the decisions agreed before implementation. Change it when a decision changes.

## Decisions

| Topic          | Decision                                                                                            |
| -------------- | --------------------------------------------------------------------------------------------------- |
| Platform       | Web app (PWA) first; Capacitor (iOS/Android) and Tauri (desktop) later                              |
| Primary device | iPad Pro with Apple Pencil, Chrome and Safari (both use WebKit on iPadOS)                           |
| UI language    | English, with strings kept ready for translation                                                    |
| Pages          | Fixed A4 pages (595 × 842 pt), scrolled vertically                                                  |
| Layers         | Defined per notebook (name, order, visibility, lock); content stored per page                       |
| UI kit         | Plus Jakarta Sans, Lucide icons plus own broom icon, Radix primitives; reference page `design.html` |
| Stack          | React, TypeScript (strict), Vite, Tailwind CSS v4, Zustand, Dexie (IndexedDB)                       |
| Ink            | Constant-width strokes (width set by the user, not by pressure); 1€ input filter; vector paths      |
| Rendering      | Own Canvas 2D engine; no Fabric.js or Konva                                                         |

## Why an own canvas engine

Fabric.js and Konva model every object as a heavyweight scene node. A page of handwriting holds
thousands of strokes, Konva maps each layer to its own `<canvas>` (practically limited to a few),
and both libraries couple the saved document format to their internal object model.

Broomit instead keeps a plain, versioned document model and a renderer that only reads it:

- **Document model** (`engine/model`): notebooks, pages, layers and canvas objects
  (`Stroke | TextBox | Image | Shape | Table | Chart`) as serializable data with stable ids.
- **Commands** (`engine/commands`): every change is a command with an inverse. Undo/redo,
  autosave and a future sync log all build on this.
- **Renderer** (`engine/render`): per page, a paper canvas, a scene canvas composed from one
  cached bitmap per layer, and a live canvas that draws only the stroke in progress.
  The renderer can later be swapped for WebGL without touching the model.
- **Spatial index** (`engine/spatial`): an R-tree per page for lasso, broom and drop targets.
- **Input** (`engine/input`): pointer events with coalesced samples, palm rejection (fingers pan
  and zoom while a pen is in use). Samples that arrive late, repeat or sit under a pixel apart are
  dropped, then a 1€ filter removes jitter. The live stroke is drawn once per frame, one frame
  ahead of the pen (browser prediction or velocity extrapolation), clearing only its own area.
- **Ink**: strokes keep a constant width chosen with the size control; pen pressure does not
  change it. Ink follows a Catmull-Rom curve through the smoothed samples, and the finished
  stroke looks exactly as it did while drawing: nothing is refitted when the pen lifts. Only
  the path tool turns a stroke into an editable vector path (`geometry/fitCurve.ts`) with few
  anchors; straight lines get two, and straight segments stay straight. Pens can draw solid,
  dashed or dotted lines.
- **Text and tables**: rendered on the canvas at rest; edited through a DOM overlay positioned
  with the same transform, so typing feels native. A text box stays on the page; while typing,
  the page moves (and zooms out if needed) so the whole box is on screen.

## Keyboard

- On iPad, iPadOS shows only a shortcut bar (and Chrome an autofill bar) instead of the full
  keyboard when a Pencil or a hardware keyboard is around, so Broomit brings its own on-screen
  keyboard (`features/keyboard`). Text fields there are never focused: tapping one makes it the
  keyboard's target, and keys write into it with input events React sees.
- German QWERTZ with umlauts and ß, number and symbol pages, shift and caps lock. A hardware
  keyboard types into the same field.
- Since the field is not focused, a mirror (`fieldMirror.ts`) with the field's box, font and
  wrapping draws its text, caret and selection. A tap places the caret, a double tap selects a
  word, dragging selects text; arrow keys and sliding along the space bar move the caret.
- The name shown is "Broomit Keyboard".
- "Use the iPad keyboard instead" turns this off per device (`broomit.virtualKeyboard`).
- The keyboard's height (`lib/keyboardInset.ts`, CSS `--kb-height`) shrinks the visible area,
  so dialogs and the canvas keep the field in view.

## Colors

- Pen and text use twelve standard colors plus a color wheel; folders and covers use the full
  palette in `src/design/palette.ts`.
- The editor keeps the five most recent colors (stored per device). Dragging one onto ink or
  text recolors it; dropping it on empty paper sets the page color (`Page.background`).

## Shapes and fills

- `engine/geometry/shapes.ts` finds closed outlines (a stroke whose ends meet or that crosses
  itself, or several strokes joined end to end) and recognizes circles, ellipses, triangles,
  rectangles, other quadrilaterals, pentagons and U-shaped curves. A robustness test draws each
  kind 70 times with random shaky lines.
- After drawing, the editor offers Auto shape (strokes from 36 pt) or Auto fill (when a stroke
  colors in a closed outline). Fills are `FillObject`s placed directly below their outline.
  Straight lines and squares (equal sides, rounded corners allowed) are recognized too, also
  when drawn from several strokes.
- Auto shape keeps the drawn proportions. Holding the pen still at the end of a stroke (550 ms)
  replaces it with the perfect shape instead (equilateral triangle, square, circle, regular
  pentagon) at the same size and angle.
- The shape analysis runs 350 ms after the pen lifts and only over nearby strokes, so it never
  costs time while writing.

## Data safety

- Autosave writes per page, shortly after each change and on `pagehide`.
- A recovery journal stores unsaved commands until the page write succeeds.
- iPadOS deletes website storage after 7 days without use unless the app is installed to the
  Home Screen, so Broomit is installed as a PWA, requests persistent storage and offers a backup
  export from the first release.
- The service worker (`scripts/build-service-worker.mjs`, generated at build time) precaches the
  whole app, so it starts offline. Pages load network first, hashed build files cache first.
- A backup is one JSON file with all folders, notebooks and pages. Restoring adds and replaces
  by id and never deletes other notebooks.

## Pictures, tables and charts

- These objects sit in a rotated rectangle (`BoxFrame`, `engine/geometry/box.ts`) and share
  selection, moving, scaling and rotation.
- Picture data is stored once per picture in the `assets` table (schema version 2), apart from
  the pages, and loaded lazily for drawing. Large photos are scaled to 2400 px on the long side.
  Backups carry pictures as base64.
- Tables keep to the page: growing past its edge shrinks the columns or rows to fit. Totals
  and average rows, and charts made from a table, read numbers from the cells
  (`model/table.ts`).
- Charts can be stacked, show average lines, and be sorted or transposed (`model/chart.ts`).
- Outlines sit outside, centered on or inside the edge (`render/outline.ts`).

## Export

- The page overview (the page button in the toolbar) shows every page and exports single pages
  or the whole notebook.
- PDF and JPG are drawn from the same renderer as the screen at 3 pixels per point (about
  216 dpi). The PDF holds one JPEG per page (`lib/pdf.ts`, no library); vector PDF can follow.
- A `.broomit` file holds one notebook (or some pages) with its pictures. Opening it in the
  library adds a copy with new ids.

## Layers

- Layers belong to the notebook; the editor keeps an active layer for new ink, text and
  selections. Hidden or locked layers cannot be changed, and the editor says so.
- Every layer change (add, delete with content, reorder, rename, show, lock, opacity) is an
  undoable command. Layers below full opacity are drawn as a whole, then faded.
- Every notebook has a background layer below all others: a color (white for new notebooks).
- A new text box gets its own text layer, named after the text, right above the active layer.
  Text on text layers can be tapped and selected from any layer.
- A layer can be a clipping mask: it shows only where the nearest unclipped layer below has
  content (`render/layers.ts`).

## Roadmap

The editor was moved ahead of the dashboard (packages 2–3) so the tools can be tried early.

| Package | Scope                                                                   | Status      |
| ------- | ----------------------------------------------------------------------- | ----------- |
| 0       | Ink spike (`spikes/ink-test.html`): validate writing feel on iPad       | Done        |
| 1a      | Project setup: Vite, TypeScript, Tailwind, oxlint, Prettier, Vitest, CI | Done        |
| 1b      | Design system: tokens, typefaces, base components, broom icon           | Done        |
| 1c      | Document model, Dexie storage, command system                           | Done        |
| 2a–2b   | Dashboard, folders, folder preview animation, folder view               |             |
| 3       | Notebook creation dialog with cover designer and paper carousel         |             |
| 4a–4c   | Engine: camera, pages, paper, fineliner, highlighter, undo, autosave    | Done        |
| 5a–5d   | Broom, lasso and transforms, text boxes, layers, PWA, backup            | Done        |
| 6–10    | Full layers, text, tables, charts, colour drag and drop, PDF, polish    | Version 1.0 |
