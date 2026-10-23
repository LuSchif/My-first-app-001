# Broomit architecture

This document records the decisions agreed before implementation. Change it when a decision changes.

## Decisions

| Topic          | Decision                                                                                                    |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| Platform       | Web app (PWA) first; Capacitor (iOS/Android) and Tauri (desktop) later                                      |
| Primary device | iPad Pro with Apple Pencil, Chrome and Safari (both use WebKit on iPadOS)                                   |
| UI language    | English, with strings kept ready for translation                                                            |
| Pages          | Fixed A4 pages (595 × 842 pt), scrolled vertically                                                          |
| Layers         | Defined per notebook (name, order, visibility, lock); content stored per page                               |
| UI kit         | Plus Jakarta Sans, Lucide icons plus own broom icon, Radix primitives; reference page `design.html`         |
| Stack          | React, TypeScript (strict), Vite, Tailwind CSS v4, Zustand, Dexie (IndexedDB)                               |
| Ink            | Constant-width strokes (width set by the user, not by pressure); 1€ input filter; quadratic midpoint curves |
| Rendering      | Own Canvas 2D engine; no Fabric.js or Konva                                                                 |

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
  change it. Strokes are stored as points and drawn as smooth quadratic curves.
- **Text and tables**: rendered on the canvas at rest; edited through a DOM overlay positioned
  with the same transform, so typing feels native.

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

## Roadmap

The editor was moved ahead of the dashboard (packages 2–3) so the tools can be tried early.

| Package | Scope                                                                     | Status      |
| ------- | ------------------------------------------------------------------------- | ----------- |
| 0       | Ink spike (`spikes/ink-test.html`): validate writing feel on iPad         | Done        |
| 1a      | Project setup: Vite, TypeScript, Tailwind, oxlint, Prettier, Vitest, CI   | Done        |
| 1b      | Design system: tokens, typefaces, base components, broom icon             | Done        |
| 1c      | Document model, Dexie storage, command system                             | Done        |
| 2a–2b   | Dashboard, folders, folder preview animation, folder view                 |             |
| 3       | Notebook creation dialog with cover designer and paper carousel           |             |
| 4a–4c   | Engine: camera, pages, paper, fineliner, highlighter, undo, autosave      | Done        |
| 5a–5d   | Broom, lasso and transforms, text boxes (done); layer basics, PWA, backup | MVP         |
| 6–10    | Full layers, text, tables, charts, colour drag and drop, PDF, polish      | Version 1.0 |
