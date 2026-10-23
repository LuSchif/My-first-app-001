# Broomit architecture

This document records the decisions agreed before implementation. Change it when a decision changes.

## Decisions

| Topic          | Decision                                                                      |
| -------------- | ----------------------------------------------------------------------------- |
| Platform       | Web app (PWA) first; Capacitor (iOS/Android) and Tauri (desktop) later        |
| Primary device | iPad Pro with Apple Pencil, Chrome and Safari (both use WebKit on iPadOS)     |
| UI language    | English, with strings kept ready for translation                              |
| Pages          | Fixed A4 pages (595 × 842 pt), scrolled vertically                            |
| Layers         | Defined per notebook (name, order, visibility, lock); content stored per page |
| Stack          | React, TypeScript (strict), Vite, Tailwind CSS v4, Zustand, Dexie (IndexedDB) |
| Ink geometry   | perfect-freehand                                                              |
| Rendering      | Own Canvas 2D engine; no Fabric.js or Konva                                   |

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
- **Input** (`engine/input`): pointer events with coalesced and predicted samples, pressure and
  tilt, palm rejection (fingers pan and zoom while a pen is in use).
- **Text and tables**: rendered on the canvas at rest; edited through a DOM overlay positioned
  with the same transform, so typing feels native.

## Data safety

- Autosave writes per page, shortly after each change and on `pagehide`.
- A recovery journal stores unsaved commands until the page write succeeds.
- iPadOS deletes website storage after 7 days without use unless the app is installed to the
  Home Screen, so Broomit is installed as a PWA, requests persistent storage and offers a backup
  export from the first release.

## Roadmap

| Package | Scope                                                                   | Status      |
| ------- | ----------------------------------------------------------------------- | ----------- |
| 0       | Ink spike (`spikes/ink-test.html`): validate writing feel on iPad       | In review   |
| 1a      | Project setup: Vite, TypeScript, Tailwind, oxlint, Prettier, Vitest, CI | Done        |
| 1b      | Design system: tokens, typefaces, base components, broom icon           |             |
| 1c      | Document model, Dexie storage, command system                           |             |
| 2a–2b   | Dashboard, folders, folder preview animation, folder view               |             |
| 3       | Notebook creation dialog with cover designer and paper carousel         |             |
| 4a–4c   | Engine: camera, pages, paper, fineliner, highlighter, undo, autosave    |             |
| 5a–5d   | Broom, lasso and transforms, text boxes, layer basics, PWA, backup      | MVP         |
| 6–10    | Full layers, text, tables, charts, colour drag and drop, PDF, polish    | Version 1.0 |
