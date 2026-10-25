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
- A new text box says "Text", selected so the first key replaces it, and is as wide as its
  text: it grows while typing up to the page's right edge, then wraps (`autoWidth`).
- **Rich text**: a text box has one style, and spans that format ranges of characters
  differently (font, size, color, bold, italic, underline; `model/richText.ts`). With text
  selected, the format bar changes only the selection; otherwise the whole box. Lines are as
  tall as their largest letters, like CSS line boxes.

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
- A selection has two handles; dragging one moves that end of the selection.
- The name shown is "Broomit Keyboard".
- There is no switch back to the system keyboard: on iPad it would bring the bar back.
- Each finger is read from touch events and from pointer events; whichever reports it first
  presses the key, so a tap one source drops still counts. A tap up to 60 px off the keys goes
  to the nearest key.
- Keys read touch events directly (every finger separately, on touch-down, also the space
  bar), so fast typing with overlapping fingers keeps every letter in order. Each key's touch
  area covers the gaps around it, and touches on the keyboard are cancelled, so iPadOS cannot
  take fast taps as a double-tap zoom or a selection.
- Return confirms a one-line field and closes the keyboard; it never submits a form. Tapping
  anywhere else closes the keyboard once the tap is complete. Fields that save on blur get a
  blur when typing ends.
- The keyboard's height (`lib/keyboardInset.ts`, CSS `--kb-height`) shrinks the visible area,
  so dialogs and the canvas keep the field in view.

## Library and folders

- The home screen: a header with the search, tiles/list switch, appearance, backup and one
  "New" menu (notebook, presentation, folder). Below it, today's calendar at the top left and,
  beside it, the top-level folders and the notebooks in no folder (or all of them); below
  those, every presentation. Folders and notebooks have their own sort order (folders: own
  order, name, recently edited).
- Folders and notebooks show as tiles or as a list (`libraryLayout.ts`, kept per device; the
  same choice applies inside folders). In the list a folder opens with one tap, and folders are
  sorted by dropping them above or below another (`data-drop-axis="y"`).
- A folder has a name, a fill (one color, or a linear or radial gradient with any number of
  stops and a direction) and an icon from four groups (school, study, work, personal). Folders
  can hold folders (`parentId`); their order among siblings is `order`.
- A tap on a folder opens it in place: the front tips open and its three latest notebooks slide
  out with their first page, title and date. A double tap, or "Open folder" in that preview,
  shows the folder's own page (`#/folder/<id>`) with its folders and all its notebooks. So on
  touch, previewing and opening never get in each other's way.
- Holding a folder or notebook (or dragging it with a mouse) picks it up: dropped on a folder it
  goes inside; dropped at a folder's left or right edge, a folder is sorted there; dropped on the
  notebooks area or the "Library" step of a folder path, it leaves its folder. Every card also has
  "Move to…" in its menu. Deleting a folder either keeps its contents (they move up) or deletes
  everything in it; duplicating copies all its folders and notebooks.
- Creating a notebook: a live preview (cover with title, first page peeking out in the chosen
  paper) beside title, folder (or a new one), cover and paper. Covers come from presets or are
  designed freely (color, linear or radial gradient); designs can be saved and reused (kept per
  device). Papers are chosen from a row of previews.

## Workspace

- The tool bar, the text format bar and the recent colors bar can be dragged by their grip
  anywhere, or dropped near an edge to snap to its middle (top, bottom, left, right). At the
  left and right a bar stands upright; bars at the same edge stack; menus open away from the
  edge. Positions are remembered per device (`FloatingPanel.tsx`, `panelLayout.ts`).
- The text color menu and the tool settings menus have a grip as well: dragged elsewhere, they
  open there again (kept on screen and above the keyboard).

## Colors

- Pen and text use twelve standard colors plus a color wheel; folders and covers use the full
  palette in `src/design/palette.ts`.
- Each notebook keeps the colors used in it (up to five, stored per device): the bar on the
  right starts empty and adds a color the first time it is drawn, typed, filled or applied, never
  twice; picking a color alone does not add it. When full, the oldest one makes room. Dragging
  one onto ink or text recolors it; dropping it on empty paper sets the page color
  (`Page.background`).

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

- On music paper, a hand-drawn treble, bass, alto or tenor clef (also drawn in parts, like a
  hook and two dots) offers a clean clef on the staff line it belongs to
  (`engine/geometry/clefs.ts`). Clean clefs are strokes with thick and thin parts.

## Pens and tools

- The fountain pen stores a width per point (`StrokeObject.widths`): wide across the nib's
  angled edge, thin along it, wider with more pen pressure (`engine/geometry/nib.ts`). Such a
  stroke is filled as the union of circles and the bands between them; the broom keeps each
  remaining point's width.
- Tape is a straight `StrokeObject` with `tool: 'tape'`; a finger double tap peels it off or
  sticks it back on (`revealed`), saved but not undoable, since it is a way of looking at the
  page.
- The eyedropper reads the page once per touch and hands the color to the tool used before.
- The laser trail, broom dust and tape animations draw on an effects canvas of their own with
  one animation loop that stops when idle (`FxLayer.ts`). No canvas shadows: blurring each
  frame made the laser lag.
- New text on ruled paper takes the line spacing as its line height and rests on the lines
  (Auto align).
- The control center (gear in the editor) switches features and toolbar tools on and off; the
  choice is kept per device (`editor/features.ts`).

- Hand-drawn arrows (one stroke, or a shaft and a head) offer Auto arrow: the shaft is kept
  (made straight when it nearly is) and gets an even head (`engine/geometry/arrows.ts`).
- A highlighter stroke over typed text becomes a text highlight in its color (a span style),
  snapped to whole words (`editor/textHighlight.ts`).
- The laser drawing stays in full until the pen has rested for three seconds, then fades.
- The magnifier enlarges a spot and lists the objects there with their layers, with a way to
  make that layer active.
- Pulling past the last page arms adding a page; the pull must then be held (a filling ring),
  so a fling never adds one. The new page's paper is asked for, or every new page gets one
  chosen paper from then on.

## Calendar

- The home screen shows today's calendar in a time grid that scrolls through the day
  (`CalendarHome` can also show yesterday to tomorrow); a tap opens the whole calendar (day, 3 days, week,
  month). Code in `src/features/calendar/`.
- Calendars are added by iCal link (WebUntis, Google, iCloud, Outlook) or as an .ics file, and
  read with an own parser (`ics.ts`: time zones, repeating events, exceptions). The last loaded
  version is stored, so the calendar works offline.
- Browsers may refuse to load a calendar from another site (CORS). Then a relay the user runs
  (`tools/calendar-relay/worker.js`) loads it. The installed app will load links directly.
- The Broomit calendar keeps its own events (with repeat, reminder, color), and days marked as
  important, in the database (schema version 3) and in backups.
- Reminders come while Broomit is open (in the app and as a notification when allowed); the
  installed app will schedule them with the system.
- Goal: Broomit is published as an app (App Store) later, wrapping this web app; features are
  built so they also work there.

## The App Store app

- Broomit ships as an iPad app (iPad only, iOS 17+) made with Capacitor from the same web app
  (`capacitor.config.ts`, `ios/`, Swift Package Manager). The bundle id is
  `com.luisschiffter.broomit`; the app is called Broomit.
- There is no Mac: GitHub Actions builds on a cloud Mac. `ios-check.yml` builds unsigned when the
  native side changes; `ios.yml` (started by hand) signs with an App Store Connect API key
  (cloud signing) and uploads to TestFlight.
- In the app: the iPad's calendars are read through EventKit (`deviceCalendar.ts`), reminders
  are scheduled with the system, requests go through iOS (calendar links load from any site),
  and there is no service worker (updates come through the App Store).
- The app keeps its own storage, apart from the browser: notebooks move over with a backup.

## Appearance

- Themes are built from one accent color (presets or any color), light or dark, by overriding
  the color tokens of `tokens.css` on the root element (`design/theme.ts`). Pages stay paper
  colored; the editor's desk follows `--color-desk`.

## Data safety

- Autosave writes per page, shortly after each change and on `pagehide`.
- A recovery journal stores unsaved commands until the page write succeeds.
- iPadOS deletes website storage after 7 days without use unless the app is installed to the
  Home Screen, so Broomit is installed as a PWA, requests persistent storage and offers a backup
  export from the first release.
- The service worker (`scripts/build-service-worker.mjs`, generated at build time) precaches the
  whole app, so it starts offline. Pages load network first (always revalidated, since GitHub Pages lets browsers cache them for 10 minutes), hashed build files cache first.
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

## Paper

- Every page keeps its own paper (lined, grid, dotted, music, blank); the notebook's paper is
  the one new pages get. The page overview changes the paper of the page in view, of new pages,
  of both, or of all pages, as one undo step.

## Gradients

- Ink, filled areas and text can be painted with a linear or radial gradient (any number of
  colors, any direction) instead of one color: the color menu of a selection has a Gradient tab
  with the same designer as folders. The gradient spans the object's box; its first color stays
  the object's plain color. Tables take that color; pictures and charts keep theirs.
- Object shadows were tried and removed again: drawing them made the editor lag.

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
- Every layer change (add, delete with content, reorder, rename, show, lock, opacity, duplicate,
  merge) is an undoable command. Layers are sorted by dragging their grip in the panel (or with
  Move up / Move down).
- Merge down moves a layer's content onto the layer below, on top of what is there, on every
  page. A layer fainter than the one below passes its opacity on to its objects. Clipping
  layers, and locked or hidden layers, are not merged. Layers below full opacity are drawn as a whole, then faded.
- Every notebook has a background layer below all others: a color (white for new notebooks).
- A new text box gets its own text layer, named after the text, right above the active layer.
  Text on text layers can be tapped and selected from any layer.
- A layer can be a clipping mask: it shows only where the nearest unclipped layer below has
  content (`render/layers.ts`).

## Presentations

- A presentation is a document with `kind: 'presentation'` and its own page size
  (`SLIDE_SIZES`: 16:9 or 4:3). The same engine edits it; `render/layout.ts` gives every
  document its own `PageLayout`, and in a presentation the layout's `focus` lets only the shown
  slide take input. The editor fits that one slide on screen; slides change through the slide
  list on the left, not by scrolling.
- Each slide (page) can have speaker notes and a transition (fade, push, cover, zoom); objects
  can have an entrance animation (`ObjectAnimation`) with a start (on tap, with or after the
  previous one), order and duration. `model/animation.ts` turns a slide's animations into steps
  and paints entrances and transitions; it has no DOM or React.
- Presenting (`engine/present/SlideShow.ts`, shown by `features/presentation/Presenter.tsx`)
  draws the slide into its own canvas through `paintLayers`' paint callback, so animated
  objects stay in their layer. Notes and tools are not shown. A tap or the arrow keys play the
  next step or slide; the left third, a swipe right or the left arrow go back.

## Roadmap

The editor was moved ahead of the dashboard (packages 2–3) so the tools can be tried early.

| Package | Scope                                                                   | Status   |
| ------- | ----------------------------------------------------------------------- | -------- |
| 0       | Ink spike (`spikes/ink-test.html`): validate writing feel on iPad       | Done     |
| 1a      | Project setup: Vite, TypeScript, Tailwind, oxlint, Prettier, Vitest, CI | Done     |
| 1b      | Design system: tokens, typefaces, base components, broom icon           | Done     |
| 1c      | Document model, Dexie storage, command system                           | Done     |
| 2a–2b   | Dashboard, folders, folder preview animation, folder view               | Done     |
| 3       | Notebook creation dialog with cover designer and paper choice           | Done     |
| 4a–4c   | Engine: camera, pages, paper, fineliner, highlighter, undo, autosave    | Done     |
| 5a–5d   | Broom, lasso and transforms, text boxes, layers, PWA, backup            | Done     |
| 6–10    | Full layers, text, tables, charts, colour drag and drop, PDF, polish    | 6–7 done |
