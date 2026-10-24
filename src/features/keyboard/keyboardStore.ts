import { setKeyboardInset } from '../../lib/keyboardInset.ts'

/**
 * Broomit's own keyboard on iPad. iPadOS decides by itself what to show for a focused text field:
 * with a Pencil or a connected keyboard that is only a bar without keys, and a web page cannot
 * change that. So on iPad no text field is focused at all: a tapped field becomes the keyboard's
 * target, and keys edit its value directly. No system bar, no autofill bar.
 */

export type Field = HTMLInputElement | HTMLTextAreaElement

const STORAGE_KEY = 'broomit.virtualKeyboard'

/** Whether Broomit's keyboard is used: on iPads and other touch tablets, unless turned off. */
export function virtualKeyboardEnabled(): boolean {
  try {
    const choice = localStorage.getItem(STORAGE_KEY)
    if (choice === 'on') return true
    if (choice === 'off') return false
  } catch {
    // No storage: fall back to the device check.
  }
  const touchTablet =
    navigator.maxTouchPoints > 1 && /Macintosh|iPad|Android/.test(navigator.userAgent)
  return touchTablet
}

export function setVirtualKeyboardEnabled(on: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off')
  } catch {
    // Not remembered; the choice holds until reload.
  }
}

export type KeyPage = 'letters' | 'numbers' | 'symbols'

interface State {
  field: Field | null
  page: KeyPage
  shift: 'off' | 'once' | 'lock'
}

let state: State = { field: null, page: 'letters', shift: 'off' }
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
  for (const listener of listeners) listener()
}

export function isTextField(el: unknown): el is Field {
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled
  if (!(el instanceof HTMLInputElement) || el.readOnly || el.disabled) return false
  return /^(text|search|email|url|tel|number|password|)$/.test(el.type)
}

function numeric(field: Field): boolean {
  return field.inputMode === 'decimal' || field.inputMode === 'numeric' || field.type === 'number'
}

/** Starts typing into a field: it is marked as the target and the keyboard opens. */
export function activate(field: Field): void {
  if (state.field === field) return
  state.field?.removeAttribute('data-virtual-focus')
  field.setAttribute('data-virtual-focus', '')
  set({ field, page: numeric(field) ? 'numbers' : 'letters', shift: autoShift(field) })
  requestAnimationFrame(() => field.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }))
}

export function close(): void {
  if (!state.field) return
  state.field.removeAttribute('data-virtual-focus')
  set({ field: null })
  setKeyboardInset(0)
}

export function setPage(page: KeyPage): void {
  set({ page })
}

export function toggleShift(): void {
  set({ shift: state.shift === 'off' ? 'once' : state.shift === 'once' ? 'lock' : 'off' })
}

/** Capitals at the start of a field, a sentence or a line. */
function autoShift(field: Field): State['shift'] {
  if (numeric(field) || field.type === 'email' || field.type === 'url') return 'off'
  const v = field.value
  return v === '' || /[.!?]\s$/.test(v) || v.endsWith('\n') ? 'once' : 'off'
}

/** Changes a field's value the way typing does, so the page sees an ordinary input event. */
function write(field: Field, value: string): void {
  const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement
  Object.getOwnPropertyDescriptor(proto.prototype, 'value')!.set!.call(field, value)
  field.dispatchEvent(new Event('input', { bubbles: true }))
}

/** Types text; `exact` text (from a hardware keyboard) ignores the on-screen shift key. */
export function type(text: string, exact = false): void {
  const field = state.field
  if (!field || !field.isConnected) return close()
  const upper = !exact && state.shift !== 'off' && state.page === 'letters'
  write(field, field.value + (upper ? text.toUpperCase() : text))
  set({ shift: state.shift === 'lock' ? 'lock' : autoShift(field) })
}

export function backspace(): void {
  const field = state.field
  if (!field || !field.isConnected) return close()
  // Whole characters, also emoji made of two code units.
  write(field, Array.from(field.value).slice(0, -1).join(''))
  if (state.shift !== 'lock') set({ shift: autoShift(field) })
}

/** Return: a new line in multi-line text; otherwise the field is done (and its form sent). */
export function enter(): void {
  const field = state.field
  if (!field || !field.isConnected) return close()
  if (field instanceof HTMLTextAreaElement) {
    type('\n')
    return
  }
  const form = field.form
  close()
  form?.requestSubmit()
}
