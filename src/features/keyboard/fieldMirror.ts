import type { Field, Selection } from './keyboardStore.ts'

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
  ].join('|')
  if (shown?.field === field && shown.key === key && mirror?.isConnected) return
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
  m.style.setProperty('-webkit-text-fill-color', style.color)
  fill(content!, field, sel)
  m.scrollTop = field.scrollTop
  keepCaretInView(m, multiLine)
}

function fill(target: HTMLSpanElement, field: Field, sel: Selection): void {
  const value = field.value
  target.replaceChildren()
  if (value === '' && field.placeholder) {
    target.append(caret())
    const hint = document.createElement('span')
    hint.className = 'field-mirror-placeholder'
    hint.textContent = field.placeholder
    target.append(hint)
    return
  }
  target.append(value.slice(0, sel.start))
  if (sel.start === sel.end) {
    target.append(caret())
  } else {
    const marked = document.createElement('span')
    marked.className = 'field-mirror-selection'
    marked.textContent = value.slice(sel.start, sel.end)
    target.append(marked)
  }
  target.append(value.slice(sel.end))
  // A text ending in a line break shows its empty last line, like the field does.
  if (value.endsWith('\n') && sel.end < value.length) target.append(HOLD)
}

function caret(): HTMLSpanElement {
  const span = document.createElement('span')
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
