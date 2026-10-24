import { setKeyboardInset } from '../../lib/keyboardInset.ts'

/**
 * Broomit's own keyboard on iPad. iPadOS decides by itself what to show for a focused text field:
 * with a Pencil or a connected keyboard that is only a bar without keys, and a web page cannot
 * change that. So on iPad no text field is focused at all: a tapped field becomes the keyboard's
 * target, and keys edit its value directly. No system bar, no autofill bar.
 */

export type Field = HTMLInputElement | HTMLTextAreaElement

/** Whether Broomit Keyboard is used: on iPads and other touch tablets (or when forced on). */
export function virtualKeyboardEnabled(): boolean {
  try {
    // Forced on for testing on other devices; an old 'off' choice no longer exists.
    if (localStorage.getItem('broomit.virtualKeyboard') === 'on') return true
  } catch {
    // No storage: the device check decides.
  }
  return navigator.maxTouchPoints > 1 && /Macintosh|iPad|Android/.test(navigator.userAgent)
}

export type KeyPage = 'letters' | 'numbers' | 'symbols'

/** The caret (start === end) or the selected range, as indexes into the field's value. */
export interface Selection {
  start: number
  end: number
}

interface State {
  field: Field | null
  page: KeyPage
  shift: 'off' | 'once' | 'lock'
  selection: Selection
}

let state: State = { field: null, page: 'letters', shift: 'off', selection: { start: 0, end: 0 } }
const listeners = new Set<() => void>()

export function keyboardState(): State {
  return state
}

export function onKeyboardChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function set(patch: Partial<State>): void {
  state = { ...state, ...patch }
  if (patch.selection) syncSelection()
  for (const listener of listeners) listener()
}

/**
 * Gives the field the same selection (it stays unfocused), so the page can tell what is
 * selected, for example to format only the selected words.
 */
function syncSelection(): void {
  const field = state.field
  if (!field) return
  const { start, end } = selection()
  try {
    field.setSelectionRange(start, end)
  } catch {
    // Number fields have no selection.
  }
  field.dispatchEvent(new Event('broomit:selection'))
}

export function isTextField(el: unknown): el is Field {
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled
  if (!(el instanceof HTMLInputElement) || el.readOnly || el.disabled) return false
  return /^(text|search|email|url|tel|number|password|)$/.test(el.type)
}

function numeric(field: Field): boolean {
  return field.inputMode === 'decimal' || field.inputMode === 'numeric' || field.type === 'number'
}

/**
 * Starts typing into a field: it is marked as the target and the keyboard opens. The caret goes
 * to `at` (an index into the value), or to the end.
 */
export function activate(field: Field, at?: number): void {
  if (state.field === field) {
    if (at !== undefined) select(at)
    return
  }
  if (state.field) leave(state.field)
  field.setAttribute('data-virtual-focus', '')
  const caret = clampIndex(field, at ?? field.value.length)
  set({
    field,
    page: numeric(field) ? 'numbers' : 'letters',
    selection: { start: caret, end: caret },
  })
  set({ shift: autoShift(field) })
  requestAnimationFrame(() => field.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }))
}

function clampIndex(field: Field, index: number): number {
  return Math.max(0, Math.min(field.value.length, index))
}

/** The current selection, kept inside the field's value (which the page may have changed). */
export function selection(): Selection {
  const field = state.field
  if (!field) return { start: 0, end: 0 }
  const a = clampIndex(field, state.selection.start)
  const b = clampIndex(field, state.selection.end)
  return { start: Math.min(a, b), end: Math.max(a, b) }
}

/** Places the caret at `start`, or selects from `start` to `end`. */
export function select(start: number, end = start): void {
  const field = state.field
  if (!field) return
  const a = clampIndex(field, start)
  const b = clampIndex(field, end)
  set({ selection: { start: Math.min(a, b), end: Math.max(a, b) } })
  if (state.shift !== 'lock') set({ shift: autoShift(field) })
}

/** Selects the word at `index` (letters and digits); between words, only the caret moves. */
export function selectWord(index: number): void {
  const field = state.field
  if (!field) return
  const value = field.value
  const word = /[\p{L}\p{N}_]/u
  let start = clampIndex(field, index)
  let end = start
  while (start > 0 && word.test(value[start - 1]!)) start--
  while (end < value.length && word.test(value[end]!)) end++
  select(start, end)
}

export function selectAll(): void {
  if (state.field) select(0, state.field.value.length)
}

/**
 * Moves the caret one character left or right (a selection collapses to its side first).
 * With `extend`, the selection grows or shrinks at its moving end instead.
 */
export function moveCaret(direction: -1 | 1, extend = false): void {
  const field = state.field
  if (!field) return
  const { start, end } = selection()
  const anchor = state.selection
  if (extend) {
    // The end that moves is the one away from where the selection started.
    const fixed = anchor.start <= anchor.end ? start : end
    const moving = anchor.start <= anchor.end ? end : start
    const next = step(field.value, moving, direction)
    set({ selection: { start: fixed, end: next } })
    return
  }
  const at = start !== end ? (direction < 0 ? start : end) : step(field.value, start, direction)
  select(at)
}

/** The index one whole character (also an emoji made of two code units) away. */
function step(value: string, index: number, direction: -1 | 1): number {
  if (direction > 0) {
    const code = value.codePointAt(index)
    return Math.min(value.length, index + (code !== undefined && code > 0xffff ? 2 : 1))
  }
  const low = value.charCodeAt(index - 1)
  const pair = index > 1 && low >= 0xdc00 && low <= 0xdfff
  return Math.max(0, index - (pair ? 2 : 1))
}

/** The selected text, or '' at a caret. */
export function selectedText(): string {
  const { start, end } = selection()
  return state.field?.value.slice(start, end) ?? ''
}

export function close(): void {
  if (!state.field) return
  const field = state.field
  set({ field: null })
  setKeyboardInset(0)
  leave(field)
}

/**
 * Typing into a field has ended. Fields that save their value when they lose focus (a color's
 * hex code, a layer's name) are told so, as if they had been focused.
 */
function leave(field: Field): void {
  field.removeAttribute('data-virtual-focus')
  field.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
  field.dispatchEvent(new FocusEvent('blur'))
}

export function setPage(page: KeyPage): void {
  set({ page })
}

export function toggleShift(): void {
  set({ shift: state.shift === 'off' ? 'once' : state.shift === 'once' ? 'lock' : 'off' })
}

/** Capitals at the start of a field, a sentence or a line (looking at the text before the caret). */
function autoShift(field: Field): State['shift'] {
  if (numeric(field) || field.type === 'email' || field.type === 'url') return 'off'
  const v = field.value.slice(0, selection().start)
  return v === '' || /[.!?]\s$/.test(v) || v.endsWith('\n') ? 'once' : 'off'
}

/** Changes a field's value the way typing does, so the page sees an ordinary input event. */
function write(field: Field, value: string): void {
  const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement
  Object.getOwnPropertyDescriptor(proto.prototype, 'value')!.set!.call(field, value)
  field.dispatchEvent(new Event('input', { bubbles: true }))
}

/** Replaces the selection (or inserts at the caret) and puts the caret after the new text. */
function replaceSelection(field: Field, text: string, start: number, end: number): void {
  const value = field.value
  write(field, value.slice(0, start) + text + value.slice(end))
  // A field may refuse or reshape the text (a number field, a length limit).
  const caret =
    field.value === value.slice(0, start) + text + value.slice(end)
      ? start + text.length
      : field.value.length
  set({ selection: { start: caret, end: caret } })
}

/** Types text; `exact` text (from a hardware keyboard) ignores the on-screen shift key. */
export function type(text: string, exact = false): void {
  const field = state.field
  if (!field || !field.isConnected) return close()
  const upper = !exact && state.shift !== 'off' && state.page === 'letters'
  const { start, end } = selection()
  replaceSelection(field, upper ? text.toUpperCase() : text, start, end)
  set({ shift: state.shift === 'lock' ? 'lock' : autoShift(field) })
}

/** Deletes the selection, or the whole character before the caret. */
export function backspace(): void {
  const field = state.field
  if (!field || !field.isConnected) return close()
  const { start, end } = selection()
  if (start === end && start === 0) return
  replaceSelection(field, '', start === end ? step(field.value, start, -1) : start, end)
  if (state.shift !== 'lock') set({ shift: autoShift(field) })
}

/** Removes the selected text and returns it. */
export function cut(): string {
  const field = state.field
  const text = selectedText()
  if (!field || !text) return ''
  const { start, end } = selection()
  replaceSelection(field, '', start, end)
  return text
}

/** Return: a new line in multi-line text; otherwise it confirms the field and typing ends. */
export function enter(): void {
  const field = state.field
  if (!field || !field.isConnected) return close()
  if (field instanceof HTMLTextAreaElement) {
    type('\n')
    return
  }
  close()
}
