# Broomit architecture

This document records the decisions agreed before implementation. Change it when a decision changes.

## Decisions

| Topic          | Decision                                                                                            |
| -------------- | --------------------------------------------------------------------------------------------------- |
| Platform       | Web app (PWA) first; Capacitor (iOS/Android) and Tauri (desktop) later                              |
| Primary device | iPad Pro with Apple Pencil, Chrome and Safari (both use WebKit on iPadOS)                           |
| UI language    | English, with strings kept ready for translation                                                    |
| Pages          | Fixed A4 pages (595 × 842 pt), following downwards or (per notebook) to the side                    |
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
- A page text box asks for typing again after a touch only when it is not already the
  keyboard's target (`TextController.refocus`); asking again would move the caret to the end
  and drop the selection (the selected "Text" of a new box, or a dragged selection).
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
  anywhere else closes the keyboard once the tap is complete, and only after the tap's click
  (iPadOS sends it a moment later; closing earlier moves the button away from under it, so
  "Create notebook" needed a second tap). Fields that save on blur get a
  blur when typing ends.
- A popover is not closed by touches on the app's keyboard. The keyboard's mirror of a field
  is placed by adding up the field's offsets up to the mirror's positioned parent, less what
  the containers on the way are scrolled by (`placeIn`): table cells and scrolled dialogs and
  popovers otherwise put the typed letters beside the field.
- The keyboard's height (`lib/keyboardInset.ts`, CSS `--kb-height`) shrinks the visible area,
  so dialogs and the canvas keep the field in view.

## Library and folders

- The home screen: a header with the search, tiles/list switch, appearance and backup. Below
  it, today's calendar on the left (about two fifths of the width); on the right a carousel
  (`Carousel.tsx`): a Create page first, then one page each for the top-level folders, every
  notebook, every presentation and every deck of flashcards on the device, wherever it is
  filed (a chip shows its folder). Each page starts with a + to make one more. Swipe or use the
  arrows and names below it (the row of names scrolls when there are many); the page shown is
  remembered.
- Tiles have one size on every page: the carousel works out the largest tile width that fits
  two full rows in a page (at least three columns) and sets it as `--tile-w`. Every tile is
  6:5 with a name block of fixed height under it (`TILE_TEXT`), so folders, notebooks,
  presentations and flashcards line up. Presentations show their first slide with a chart
  badge in the middle, flashcards their stacked cards, both without a box around them.
- Pins and groups (`homeTabs.ts`, stored in the `homeTabs` table and in backups): each page
  except Create can pin up to five items (card menu "Pin"), shown at the top in a highlighted
  "Pinned" box, and can have groups ("New group" at the top, e.g. "School"). Groups sit above
  the rest, open and close by their name, and take what is dropped on them
  (`data-drop="group"`) or picked with "Add to group…". A group's menu renames it, removes it
  (its items stay) or shows it as a page of its own right after its page. Groups only arrange
  the home screen; folders are not changed. Pins on a page and inside a group are
  independent (a group keeps its own `pins`); a group can be pinned too, which puts it first
  among the groups. The pinned box is only as wide as what is pinned.
- "Select" in a page's header chooses several items (`librarySelection.ts`): a tap then
  marks an item, and a bar at the bottom moves them into a folder, puts them into a group or
  deletes them; dragging one of the marked items carries all of them (`DragItem.many`, also
  given to the drop). After any of these the selection ends.
- Search results are grouped by kind: folders, notebooks, presentations, flashcards.
- Names are unique: a folder, notebook, presentation, deck, group or interface preset with a
  name already taken gets the next number ("Mathe 2"), and the name field says so while
  typing (`uniqueName.ts`, `NameHint.tsx`).
- In a notebook's peek, "Add page" asks for the paper of that one new page (the last page's
  paper is marked); slides are added straight away.
- "Edit pages" in a notebook's peek: a tap on a page chooses its paper, and "Every page" sets
  all of them, without opening the notebook. "Edit folder" in a folder's peek opens the folder
  editor.
- Each carousel page has a scroll bar of its own along its right edge whenever there is more
  to see (`ScrollBar.tsx`; iPadOS shows its own only while scrolling); its thumb can be
  dragged.
- Appearance: Broomit's looks, or "Your own color": one color or a linear or radial gradient
  (`FillEditor`). A gradient theme is built from its first color, and the app's background
  shows the gradient, softened (`--app-backdrop`, `themeBackdrop`). Only there, "Your presets"
  saves the current look under a name; each preset has a switch that puts it on (kept on this
  device, `themePresets.ts`).
  Both sides are as tall as the screen allows and scroll inside. Folders and notebooks have
  their own sort order (folders: own order, name, recently edited).
- Folders and notebooks show as tiles or as a list (`libraryLayout.ts`, kept per device; the
  same choice applies inside folders). In the list a folder opens with one tap, and folders are
  sorted by dropping them above or below another (`data-drop-axis="y"`).
- A folder has a name, a fill (one color, or a linear or radial gradient with any number of
  stops and a direction) and an icon from four groups (school, study, work, personal). Folders
  can hold folders (`parentId`); their order among siblings is `order`.
- A tap on a folder, notebook or presentation first takes a look inside (`Peek.tsx`): a
  notebook's cover swings open and its pages come out to the right, a presentation fans out
  its slides, a folder opens and shows its folders and notebooks. A tap on a page opens the
  notebook there (`editor/openAt.ts`); "Open" opens it from the start, "Open folder" shows the
  folder's own page (`#/folder/<id>`). The last tile of a notebook's pages, "Add page" ("Add
  slide"), adds an empty page on the notebook's paper at the end (`appendPage`).
- The carousel's first page, Create, lists what can be made (notebook, folder, presentation,
  flashcards), as a compact list or as tiles, with room for six. The last place is a
  "Placeholder" for a feature that comes next, at the owner's request; it does nothing yet.
  It is the page shown on first start. While a
  notebook or presentation is held, every folder slides up in a row at the bottom of the
  carousel (`FolderDropStrip.tsx`); holding it near either end scrolls the row. Every move
  into or out of a folder shows a notice with Undo (`lib/notices.ts`).
- Held near the bottom of the screen, anything (folder, notebook, presentation, or a page in a
  notebook's peek) brings up the trash (`TrashZone.tsx`). Dropped there it is deleted at once
  ("Deleting…" shows meanwhile), after a copy was kept in memory (`storage/snapshot.ts`): the
  notice's Undo restores that copy (`trash.ts`). Deleting later instead lost deletions when
  iPadOS paused the app. A notebook keeps its last page.
- The object editors (table, chart, graph, picture) share one frame (`EditDialog.tsx`): the
  preview at the top, the settings scrolling under it, Cancel and Done always in view. Closing
  with unsaved changes asks whether to save them. The chart editor has Data and Look tabs; a
  pie or donut shows one series, chosen there. A table written across (one row of numbers
  under names) becomes one series of those names (`tableChartData`).
- A chart made with "Make chart" keeps `sourceTableId`: whenever page objects are set
  (`setPageObjects`), linked charts take the table's current data (`followTables`), in the
  same undo step. Its editor shows the link, locks the values and offers "Unlink".
- Tables, charts and graphs cannot be mirrored.
- Canvas shortcuts (Backspace deletes the selection, …) are off while a dialog is open or the
  app's keyboard types into a field: Backspace in an editor's field deleted the object.
- A new picture is medium sized: at most half the page's width and a third of its height.
- Dialogs keep their main button in view (`DialogFooter`) and fold away long design options
  (`Fold`), as in the folder and notebook dialogs.
- Dialogs close only by their close button or a tap on the dimmed backdrop: on iPad other
  touches could count as "outside" and lose what was being set up.
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
- The editor's top row: back and title on the left, the tool bar between (moved along to fit,
  below only when the row is too narrow), layers, pages and the control center on the right.
  The tool bar always opens with the main tools only; saving is silent unless it fails.
- Every published version has a number and a name (`src/release.ts`), shown on the home
  screen, in the control center and in the update banner; after an update has loaded, a notice
  says which version is now running. The build writes it to `release.json` for the banner.
- Pinch zoom keeps the point under the fingers still, also at the zoom limits, and lifting the
  fingers after a pinch never flings the page.
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

## Handwriting engine

The ink pipeline, from pen to storage, each part in its own module:

| Part         | Where                                      | What it does                                                                                                                                                                                                      |
| ------------ | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Input        | `Editor` pointer handlers                  | Pointer Events with `getCoalescedEvents()` (every 240 Hz Pencil sample); the pen always wins over touch (palm rejection); fingers pan while a pencil is in use.                                                   |
| Sampling     | `input/StrokeSampler.ts`                   | Drops late, doubled and sub-pixel samples, spaces equal time stamps, 1€ filter against jitter (strong when slow, none when fast). Keeps time, pressure and tilt per sample.                                       |
| Smoothing    | `geometry/strokePath.ts`                   | A small kernel over the samples, then a Catmull-Rom curve as cubic Béziers; round caps and joins.                                                                                                                 |
| Live drawing | `Editor.drawInk`                           | Settled curve segments go once onto the wet canvas; only the unsettled end (to the tip and a short prediction) is redrawn per event. `getPredictedEvents()` (or extrapolation) is drawn only there, never stored. |
| Storage      | `StrokeObject`                             | Page coordinates in points (zoom never changes them), widths per point for the fountain pen, and `input`: time, pressure, tilt and device per point. Saved by the autosave, one record per page.                  |
| Rendering    | `render/strokes.ts`, `render/pageCache.ts` | Path2D per stroke, cached for its life; finished pages as pictures, so panning and zooming do not redraw thousands of strokes. Pictures are made in pauses, never while writing.                                  |
| Erasing      | `geometry/erase.ts`                        | Whole strokes, or precise cuts that keep each remaining piece as its own stroke with its widths and recorded input.                                                                                               |
| Undo         | `commands/`                                | Every change (draw, erase, move, recolor, …) is a command; a broom sweep is one step.                                                                                                                             |

- Earlier versions smoothed ink three times (a 1€ filter, a seven-sample kernel, a long
  prediction): the line lagged behind the pencil and kept changing near the tip. Strokes saved
  then keep their smoothed points and look as they did.
- Pens: the ballpoint draws one width; the fountain pen's width follows pressure (adjustable
  sensitivity, off to strong), direction (an angled nib) and, where Safari reports it, tilt.
  Without pressure (finger, mouse) it keeps the base width.
- The highlighter's opacity is adjustable. It is painted opaque in its color faded by that
  opacity with the darken blend, so marks of one color overlapping stay one tint and text under
  it stays dark.
- Browsers give no direct access to Apple Pencil's hover distance, barrel roll or squeeze;
  tilt comes as altitude/azimuth (Safari) or tiltX/tiltY, and is left out where not reported.

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

- Hand-drawn arrows (one stroke, or a shaft and a head, at any size) become clean arrows only
  when the pen rests at the end, like perfect shapes: the shaft keeps its course (straight when
  it nearly is, otherwise smoothed along its course, `geometry/perfect.ts`) and gets an even
  head (`engine/geometry/arrows.ts`). An automatic suggestion found arrows in ordinary writing,
  so there is none.
- Graph axes: a horizontal and a vertical line (an "L" or a cross), maybe a third, slanted line
  through their crossing (depth), with an arrow head drawn at one end become straight axes with
  heads at the right and the top, never left or bottom; a slanted axis that runs on through
  the origin (a vector graph) gets its head at its lower end, one that ends at the origin none
  (`geometry/graphs.ts`). This happens as soon as the head is drawn, also with the plain pen:
  axes with a head at their end are never handwriting.
- Pictures can be cropped after they were added and get an optional title above and caption
  below, inside their frame ("Crop & caption" in the selection menu, `model/image.ts`). The crop
  is kept as shares of the stored picture, so showing all of it again is always possible; the
  picture keeps its scale and middle while its frame follows the part shown and the text.
  Title and caption can each be switched off (kept, not shown). The picture can have round
  edges, or be cut to a circle, diamond, square or heart (its crop is then square); the editor
  shows the cut as white dashes over the crop and a live preview of the result. Both are one
  SVG path (`pictureOutline`), used for clipping on the page and for the dashes.
  After editing, a picture is never larger than half the page's width and a third of its
  height (`mediumPicture`), so it never covers the page or the selection bar.
- Recognized graph axes become a graph object (`model/graph.ts`, drawn by `render/graph.ts`): a
  box like a chart, with the axes measured from the origin, the drawn color and line width,
  ticks with their own spacing per axis (always as wide as the drawn line and all the same
  length; across the slanted axis too), axis names and a title in the hand font. A chip offers
  its editor right after it was recognized; later "Edit graph" in the selection menu opens it.
  A slanted depth axis is moved, at its angle, to run exactly through the origin.
  Each axis's ticks have their own spacing, length and width; a depth-axis tick is left out only
  where it would cross the other axes. On grid or dot paper the origin
  snaps onto a grid crossing, the axis ends onto grid lines, and ticks start one square apart.
- Areas closed off by several strokes however they meet (a shape drawn onto another one) are
  found by filling a grid of the nearby strokes from the colored spot (`enclosedArea` in
  `geometry/shapes.ts`), when no single outline or chain of strokes closes them. Outlines up to
  6 pt apart count as meeting (the lines are drawn thick to find the area); the area then grows
  back up to the lines as drawn, also deep into narrow corners where two outlines meet, so no
  spot stays white. The grid's staircase edge is moved onto the strokes' middles.
  Coloring in may run a little over the edge. With the magic pen, coloring in wins over taking
  a scribble at a line's end for an arrow head.
- In a one-stroke arrow only the head may follow the tip: a wave or a word that goes on past a
  turn is never an arrow.
- Arrow heads are judged at their own scale: a small head on a long shaft counts, a piece of
  the shaft itself never counts as a barb, and the shaft runs right up to the tip.
- Clean curved lines (magic pen, curved arrow shafts) are stored as vector paths with anchors
  only at their ends and high and low points (`curvePath` in `geometry/perfect.ts`), so the
  path tool shows few points.
- Arrow heads may also be drawn as a triangle, on their own or on from the shaft in one stroke;
  the clean head is then a closed triangle of the drawn size (`detectTriangleArrow`).
- The magic pen (a tool beside the pen, with the pen's color and size) makes every stroke clean
  as the pen lifts (`magicFor` in `editor/suggestions.ts`): axes and arrows as above, coloring
  in a shape fills it, shapes and tables become clean ones, and any other line keeps exactly its
  course: only wobbles and jitter (a few points long) are averaged out and turns come out round. One undo step brings back what was drawn.
- The laser's glow is drawn opaque on a canvas of its own and laid over at its strength:
  translucent strokes straight on the page left dots where pieces overlapped.
- A notebook's pages follow downwards or to the side (`pageFlow`, `PageLayout.flow`); pulling
  past the last page adds a page in that direction.
- The pages overview: tapping a page opens a card to open it, change its paper, export,
  duplicate or delete it; above the pages, the page direction, the paper of new pages and the
  notebook export.
- A choice that nothing else marks (a paper, a recent color, the page in view) is outlined in
  `--color-selected` (`data-choice` with aria-pressed, -checked or -current, in `index.css`);
  buttons that fill in color when chosen get no outline.
- Every edit bar is ordered the same way, with a thin line between the groups: first what is
  done with the selection as a whole (delete, cut, duplicate, copy), then what changes its
  content or arrangement, then how it looks (color, outline).
- A highlighter stroke over typed text becomes a text highlight in its color (a span style),
  snapped to whole words (`editor/textHighlight.ts`).
- The laser drawing stays in full until the pen has rested for a second, then fades.
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

## Flashcards

- A deck is a document with `kind: 'deck'` and index-card pages (`CARD_SIZE`), in pairs: each
  card's front, then its back (`model/flashcards.ts`). Cards are written and drawn with the
  same editor and tools; the cards panel on the left shows both sides and adds, copies, moves
  and deletes whole cards. "Type cards" makes cards from typed text instead: front and back,
  centered and sized to fit (a blank card in view is filled first).
- Studying (`features/flashcards/Study.tsx`) works like Anki with two answers: a known card
  moves up a box and is due again after 1, 3, 7, 16, 35 or 80 days; a missed one goes back to
  the first box and comes again three cards later in the same session. How well each card is
  known is stored on the deck (`Notebook.study`, by front page id), so backups keep it.
- Decks are notebooks to the library: they go into folders, peek (the cards fan out, with
  Study and Edit), drag into folders or onto the trash like any other.

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

## Shop

- The shop (`#/shop`, `features/shop`) is the last entry of the Create page. It lists free and
  paid products (`catalog.ts`): design packs, planners, templates and design elements. Only
  the design packs can be bought so far; the rest show as "Coming soon".
- A design pack (`design/packs.ts`) is a whole look: a wallpaper behind the app (in
  `public/shop`, under a veil so text stays readable) and a full set of color tokens taken
  from its design sheet, so buttons, panels, menus, dialogs, the calendar and the editor all
  follow it. Panels blur the wallpaper behind them (`[data-pack]`), and the "it" of the logo
  takes the accent. Packs: Sakura Dusk, Golden Hour, Nebula Night, 4,99 € each.
- A pack is part of the theme setting (`ThemeSetting.pack`) and wins over the other theme
  choices. Bought packs show in the appearance menu with a switch each.
- Buying (`purchases.ts`): in the App Store app, through Apple with StoreKit 2. A small native
  plugin of our own (`ios/App/App/Store.swift`, registered by `BroomitViewController` in
  `SceneDelegate.swift`) loads the App Store's prices, shows Apple's purchase sheet, and says
  what is owned (`Transaction.currentEntitlements`); StoreKit checks Apple's signature on the
  device, so no server is needed. Each paid product has an `appStoreId` (a non-consumable in
  App Store Connect, e.g. `com.luisschiffter.broomit.pack.sakuradusk`). At start and on every
  transaction update the stored purchases follow the App Store (bought elsewhere, restored,
  refunded); a refunded pack in use is taken off. The shop offers "Restore purchases", as
  Apple requires.
- In a browser there is no App Store: buying is a test purchase, unlocked on that device and
  marked `test`; the shop says so. Test purchases never count in the app. Purchases are kept
  in the `purchases` table and in backups.

## Quizzes

- A quiz is a document of its own kind (`kind: 'quiz'`) with questions instead of pages
  (`Notebook.quiz`, `engine/model/quiz.ts`), so folders, pins, groups, search, selection,
  trash and backups work for it as for notebooks. It has its own tab, Create entry, tile
  (`QuizCover`) and peek (`QuizPeek`).
- Question kinds, as in Kahoot: Quiz (one right answer of up to six), Multi-select, True or
  false, Puzzle (put in order), Type answer (accepted spellings; case, accents and spaces do
  not matter), Slider (a value with a tolerance) and Poll (no right answer). Each has a time
  limit, standard, double or no points, and an optional picture (a small JPEG kept with it).
- The editor (`#/quiz/<id>`, `QuizEditor.tsx`) is laid out like the presentation editor:
  questions on the left, the question as players see it in the middle (answers on colored
  tiles with shapes, `--color-answer-*`), its settings on the right. It saves itself a moment
  after each change and says what keeps a question from being played.
- Playing (`#/play/<id>`, `QuizPlay.tsx`): each question against the clock; a right answer is
  worth up to 1000 points, falling to 500 as time runs out (`pointsFor`). Puzzle items come
  shuffled and are tapped in order. The end shows the score and every question; the last
  runs are kept with the quiz (best score on its tile).
- Playing with other Broomit accounts (inviting friends, a shared game) needs a server for
  accounts and is not built yet; see Profile.

## Profile

- The profile (`#/profile`, `features/profile`), opened from the avatar at the right of the
  library header: your name and picture (a 320 px square JPEG), your Broomit plan, and
  settings (interface colors, backup, shop, version). Kept in the `profile` table (one row,
  id `me`) and in backups.
- The Broomit plan is sold two ways: Broomit Lifetime, 19,99 € once (a non-consumable,
  `com.luisschiffter.broomit.lifetime`), or Broomit Yearly, 6,99 € a year (an auto-renewable
  subscription, `com.luisschiffter.broomit.yearly`). Both are products in `shop/catalog.ts`
  (kind `plan`, not shown in the shop grid) and are bought like the packs; an active yearly
  plan can be changed or cancelled with Apple's own sheet (`Store.manage`). Nothing is locked
  behind the plan yet.
- A Broomit ID, friends and inviting friends to play a quiz need accounts on a server; they
  wait for the choice of server and of play mode (live, at one's own time, or both).
