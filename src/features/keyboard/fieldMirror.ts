import { styledRanges, type StyledCss } from '../../engine/editor/styledField.ts'
import { keyboardState, select, type Field, type Selection } from './keyboardStore.ts'

/**
 * The field Broomit's keyboard types into is never focused, so the browser draws no caret and no
 * selection in it. A mirror takes over its text instead: an element with the same box, font and
 * wrapping, placed exactly on the field, that draws the text with the caret or the selection.
 * The field's own text is hidden meanwhile (index.css), so nothing can drift apart.
 */

/** Keeps a line with only the caret (after a line break) from collapsing; never breaks a line. */
const HOLD = '⁠'

const COPIED = [
  'boxSizing',
  'width',
  'height',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'fontStretch',
  'fontVariant',
  'letterSpacing',
  'wordSpacing',
  'lineHeight',
  'textAlign',
  'textIndent',
  'textTransform',
  'textDecoration',
  'color',
  'opacity',
  'direction',
  'tabSize',
  'overflowWrap',
  'wordBreak',
  'transform',
  'transformOrigin',
] as const

let mirror: HTMLDivElement | null = null
let content: HTMLSpanElement | null = null
let shown: { field: Field; key: string } | null = null

/** Draws `field` with its caret or selection, or removes the mirror (for `null`). */
export function showMirror(field: Field | null, sel: Selection): void {
  if (!field || !field.isConnected) {
    mirror?.remove()
    mirror = content = shown = null
    handles?.start.remove()
    handles?.end.remove()
    handles = null
    return
  }
  const style = getComputedStyle(field)
  const key = [
    field.value,
    sel.start,
    sel.end,
    field.offsetLeft,
    field.offsetTop,
    field.offsetWidth,
    field.offsetHeight,
    style.font,
    style.color,
    style.transform,
    style.textAlign,
    JSON.stringify(styledRanges(field)),
  ].join('|')
  if (shown?.field === field && shown.key === key && mirror?.isConnected) {
    // The page may have scrolled under the handles.
    placeHandles(mirror, field, sel)
    return
  }
  shown = { field, key }

  if (!mirror || mirror.parentElement !== field.parentElement) {
    mirror?.remove()
    mirror = document.createElement('div')
    mirror.dataset.fieldMirror = ''
    mirror.setAttribute('aria-hidden', 'true')
    content = document.createElement('span')
    mirror.append(content)
    field.after(mirror)
  }
  const m = mirror
  const multiLine = field instanceof HTMLTextAreaElement
  for (const prop of COPIED) m.style[prop] = style[prop]
  // The field sits in the same parent, so its layout position is the mirror's.
  Object.assign(m.style, {
    position: 'absolute',
    left: `${field.offsetLeft}px`,
    top: `${field.offsetTop}px`,
    width: `${field.offsetWidth}px`,
    height: `${field.offsetHeight}px`,
    margin: '0',
    borderStyle: 'solid',
    borderColor: 'transparent',
    background: 'transparent',
    overflow: 'hidden',
    pointerEvents: 'none',
    zIndex: String((parseInt(style.zIndex, 10) || 0) + 1),
    // A one-line field centers its line vertically.
    display: multiLine ? 'block' : 'flex',
    alignItems: 'center',
    justifyContent:
      style.textAlign === 'center' ? 'center' : style.textAlign === 'right' ? 'flex-end' : '',
    whiteSpace: multiLine ? 'pre-wrap' : 'pre',
  } satisfies Partial<CSSStyleDeclaration>)
  // A line height given as a factor lets larger parts of the text have taller lines.
  if (field.style.lineHeight) m.style.lineHeight = field.style.lineHeight
  m.style.setProperty('-webkit-text-fill-color', style.color)
  fill(content!, field, sel)
  m.scrollTop = field.scrollTop
  keepCaretInView(m, multiLine)
  placeHandles(m, field, sel)
}

function fill(target: HTMLSpanElement, field: Field, sel: Selection): void {
  const value = field.value
  target.replaceChildren()
  if (value === '' && field.placeholder) {
    target.append(caret({}))
    const hint = document.createElement('span')
    hint.className = 'field-mirror-placeholder'
    hint.textContent = field.placeholder
    target.append(hint)
    return
  }
  // The text is cut where its style changes and where the selection starts and ends.
  const ranges = styledRanges(field) ?? []
  const cssAt = (i: number) => ranges.find((r) => r.start <= i && i < r.end)?.css ?? {}
  const cuts = [
    ...new Set([0, value.length, sel.start, sel.end, ...ranges.flatMap((r) => [r.start, r.end])]),
  ]
    .filter((n) => n >= 0 && n <= value.length)
    .sort((a, b) => a - b)
  const collapsed = sel.start === sel.end
  cuts.forEach((at, i) => {
    if (collapsed && at === sel.start) target.append(caret(cssAt(Math.max(0, at - 1))))
    if (!collapsed && at === sel.start) target.append(anchor('start', cssAt(at)))
    if (!collapsed && at === sel.end) target.append(anchor('end', cssAt(Math.max(0, at - 1))))
    const next = cuts[i + 1]
    if (next === undefined) return
    const part = styled(cssAt(at))
    part.textContent = value.slice(at, next)
    if (!collapsed && at >= sel.start && next <= sel.end) part.className = 'field-mirror-selection'
    target.append(part)
  })
  // A text ending in a line break shows its empty last line, like the field does.
  if (value.endsWith('\n') && sel.end < value.length) target.append(HOLD)
}

function styled(css: StyledCss): HTMLSpanElement {
  const span = document.createElement('span')
  Object.assign(span.style, css)
  if (css.color) span.style.setProperty('-webkit-text-fill-color', css.color)
  return span
}

/** An empty mark where a selection starts or ends; the handles are placed on it. */
function anchor(role: 'start' | 'end', css: StyledCss): HTMLSpanElement {
  const span = styled(css)
  span.dataset.anchor = role
  span.textContent = HOLD
  return span
}

// ---------- Selection handles ----------

/** The round knobs at the ends of a selection; dragging one moves that end. */
let handles: { start: HTMLDivElement; end: HTMLDivElement } | null = null
const HANDLE_REACH = 22
const KNOB = 14

function createHandle(role: 'start' | 'end'): HTMLDivElement {
  const handle = document.createElement('div')
  handle.className = 'field-mirror-handle'
  handle.dataset.role = role
  // Using a handle is part of typing; it must not end it.
  handle.dataset.keepKeyboard = ''
  handle.setAttribute('aria-hidden', 'true')
  const bar = document.createElement('div')
  bar.className = 'field-mirror-handle-bar'
  const knob = document.createElement('div')
  knob.className = 'field-mirror-handle-knob'
  handle.append(bar, knob)
  handle.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false })
  handle.addEventListener('pointerdown', (e) => dragHandle(e, role))
  document.body.append(handle)
  return handle
}

function placeHandles(m: HTMLDivElement, field: Field, sel: Selection): void {
  if (sel.start === sel.end) {
    if (handles) handles.start.style.display = handles.end.style.display = 'none'
    return
  }
  handles ??= { start: createHandle('start'), end: createHandle('end') }
  const box = m.getBoundingClientRect()
  for (const role of ['start', 'end'] as const) {
    const handle = handles[role]
    const mark = m.querySelector<HTMLElement>(`[data-anchor="${role}"]`)
    const r = mark?.getBoundingClientRect()
    // Hidden when its end of the selection is scrolled out of the field.
    if (!r || r.left < box.left - 2 || r.left > box.right + 2 || !field.isConnected) {
      handle.style.display = 'none'
      continue
    }
    const knobRoom = KNOB + 6
    Object.assign(handle.style, {
      display: 'block',
      left: `${r.left - HANDLE_REACH}px`,
      top: `${role === 'start' ? r.top - knobRoom : r.top}px`,
      width: `${HANDLE_REACH * 2}px`,
      height: `${r.height + knobRoom}px`,
    })
    const bar = handle.firstElementChild as HTMLElement
    const knob = handle.lastElementChild as HTMLElement
    Object.assign(bar.style, {
      top: `${role === 'start' ? knobRoom : 0}px`,
      height: `${r.height}px`,
    })
    Object.assign(knob.style, {
      top: `${role === 'start' ? knobRoom - KNOB + 1 : r.height - 1}px`,
    })
  }
}

/** Moves one end of the selection with the finger; the other end stays. */
function dragHandle(e: PointerEvent, role: 'start' | 'end'): void {
  const field = keyboardState().field
  const handle = e.currentTarget as HTMLDivElement
  if (!field) return
  e.preventDefault()
  e.stopPropagation()
  handle.setPointerCapture?.(e.pointerId)
  const { start, end } = keyboardState().selection
  const fixed = role === 'start' ? Math.max(start, end) : Math.min(start, end)
  // The point that follows the finger is the middle of the handle's bar, wherever it was held.
  const bar = (handle.firstElementChild as HTMLElement).getBoundingClientRect()
  const dx = bar.left + bar.width / 2 - e.clientX
  const dy = bar.top + bar.height / 2 - e.clientY
  const move = (ev: PointerEvent) => {
    if (ev.pointerId !== e.pointerId) return
    ev.preventDefault()
    const at = indexAt(field, ev.clientX + dx, ev.clientY + dy)
    // The selection keeps at least one character.
    if (at !== null && at !== fixed) select(fixed, at)
  }
  const stop = (ev: PointerEvent) => {
    if (ev.pointerId !== e.pointerId) return
    handle.removeEventListener('pointermove', move)
    handle.removeEventListener('pointerup', stop)
    handle.removeEventListener('pointercancel', stop)
  }
  handle.addEventListener('pointermove', move)
  handle.addEventListener('pointerup', stop)
  handle.addEventListener('pointercancel', stop)
}

function caret(css: StyledCss): HTMLSpanElement {
  const span = styled(css)
  span.className = 'field-mirror-caret'
  span.dataset.caret = ''
  span.textContent = HOLD
  return span
}

/** Scrolls a one-line field's mirror sideways so the caret stays visible. */
function keepCaretInView(m: HTMLDivElement, multiLine: boolean): void {
  if (multiLine) return
  const mark = m.querySelector<HTMLElement>('[data-caret], .field-mirror-selection')
  if (!mark) return
  const box = m.getBoundingClientRect()
  const at = mark.getBoundingClientRect()
  const pad = 8
  if (at.right > box.right - pad) m.scrollLeft += at.right - box.right + pad
  else if (at.left < box.left + pad) m.scrollLeft -= box.left + pad - at.left
}

/** The index into the field's value nearest to a screen point, or null when it cannot tell. */
export function indexAt(field: Field, clientX: number, clientY: number): number | null {
  if (!mirror || shown?.field !== field) showMirror(field, { start: 0, end: 0 })
  const m = mirror
  if (!m) return null
  // Hit testing skips elements that ignore the pointer, so the mirror takes it for a moment.
  m.style.pointerEvents = 'auto'
  let node: Node | null = null
  let offset = 0
  try {
    const doc = document as Document & {
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
    }
    if (doc.caretPositionFromPoint) {
      const pos = doc.caretPositionFromPoint(clientX, clientY)
      if (pos) ({ offsetNode: node, offset } = pos)
    } else if (document.caretRangeFromPoint) {
      const range = document.caretRangeFromPoint(clientX, clientY)
      if (range) ({ startContainer: node, startOffset: offset } = range)
    }
  } finally {
    m.style.pointerEvents = 'none'
  }
  if (!node || !m.contains(node) || node.parentElement?.closest('.field-mirror-placeholder')) {
    return node && m.contains(node) ? 0 : null
  }
  const range = document.createRange()
  range.setStart(m, 0)
  range.setEnd(node, offset)
  return range.toString().replaceAll(HOLD, '').length
}
