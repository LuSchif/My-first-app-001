import {
  ArrowBigUp,
  ArrowBigUpDash,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CornerDownLeft,
  Delete,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { setKeyboardInset } from '../../lib/keyboardInset.ts'
import { cn } from '../../lib/cn.ts'
import {
  backspace,
  close,
  cut,
  enter,
  keyboardState,
  moveCaret,
  onKeyboardChange,
  selectAll,
  selectedText,
  setPage,
  toggleShift,
  type,
  type KeyPage,
} from './keyboardStore.ts'

const LETTERS = ['qwertzuiopü', 'asdfghjklöä', 'yxcvbnm']
const NUMBERS = ['1234567890', '-/:;()€&@"', ".,?!'%+="]
const SYMBOLS = ['[]{}#%^*+=', '_\\|~<>$£¥•', ".,?!'`§°"]

/** Sliding this far along the space bar starts moving the caret, then one character per step. */
const SPACE_SLIDE_PX = 28
const SPACE_STEP_PX = 14

function copy(text: string): void {
  void navigator.clipboard?.writeText(text).catch(() => {})
}

async function paste(): Promise<void> {
  try {
    const text = await navigator.clipboard.readText()
    if (text) type(text, true)
  } catch {
    // No permission to read the clipboard: nothing to paste.
  }
}

/** Broomit Keyboard, shown while a text field is its target (see keyboardStore). */
export function VirtualKeyboard() {
  const state = useSyncExternalStore(onKeyboardChange, keyboardState)
  const ref = useRef<HTMLDivElement>(null)
  const open = state.field !== null

  // Everything else keeps clear of the keyboard's height.
  useLayoutEffect(() => {
    const el = ref.current
    if (!open || !el) return
    const measure = () => setKeyboardInset(el.offsetHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    const stopTouches = routeTouches(el)
    return () => {
      observer.disconnect()
      stopTouches()
    }
  }, [open])

  if (!open) return null
  const rows = state.page === 'letters' ? LETTERS : state.page === 'numbers' ? NUMBERS : SYMBOLS
  const upper = state.shift !== 'off' && state.page === 'letters'
  const hasSelection = state.selection.start !== state.selection.end
  const canPaste = typeof navigator.clipboard?.readText === 'function'

  return (
    <div
      ref={ref}
      data-virtual-keyboard=""
      role="group"
      aria-label="Broomit Keyboard"
      // Stays usable while a dialog blocks the page behind it.
      style={{ pointerEvents: 'auto', touchAction: 'none', WebkitTouchCallout: 'none' }}
      className="fixed inset-x-0 bottom-0 z-[70] grid gap-1 bg-surface-sunken/97 px-1 pt-1.5 pb-[calc(14px+env(safe-area-inset-bottom))] shadow-overlay backdrop-blur select-none"
    >
      <div className="mx-auto flex w-full max-w-[64rem] items-center gap-1 px-1">
        <span className="mr-auto truncate text-sm font-semibold text-ink">Broomit Keyboard</span>
        <StripButton label="Select all" onClick={selectAll}>
          Select all
        </StripButton>
        <StripButton label="Cut" disabled={!hasSelection} onClick={() => copy(cut())}>
          Cut
        </StripButton>
        <StripButton label="Copy" disabled={!hasSelection} onClick={() => copy(selectedText())}>
          Copy
        </StripButton>
        {canPaste ? (
          <StripButton label="Paste" onClick={() => void paste()}>
            Paste
          </StripButton>
        ) : null}
        <span className="mx-1 h-6 w-px bg-line-strong" />
        <StripButton label="Move cursor left" repeat onPress={() => moveCaret(-1)}>
          <ChevronLeft size={22} />
        </StripButton>
        <StripButton label="Move cursor right" repeat onPress={() => moveCaret(1)}>
          <ChevronRight size={22} />
        </StripButton>
        <span className="mx-1 h-6 w-px bg-line-strong" />
        <StripButton label="Hide keyboard" onClick={close}>
          <ChevronDown size={22} />
        </StripButton>
      </div>
      <div className="mx-auto grid w-full max-w-[64rem]">
        {rows.map((row, r) => (
          <div key={r} className="flex justify-center">
            {r === 2 && state.page === 'letters' ? (
              <Key
                wide
                label={state.shift === 'lock' ? 'Caps lock' : 'Shift'}
                pressed={state.shift !== 'off'}
                onPress={toggleShift}
              >
                {state.shift === 'lock' ? <ArrowBigUpDash size={22} /> : <ArrowBigUp size={22} />}
              </Key>
            ) : null}
            {r === 2 && state.page !== 'letters' ? (
              <Key
                wide
                label={state.page === 'numbers' ? 'More symbols' : 'Numbers'}
                onPress={() => setPage(state.page === 'numbers' ? 'symbols' : 'numbers')}
              >
                <span className="text-base">{state.page === 'numbers' ? '#+=' : '123'}</span>
              </Key>
            ) : null}
            {Array.from(row).map((ch) => (
              <Key key={ch} label={ch} onPress={() => type(ch)}>
                {upper ? ch.toUpperCase() : ch}
              </Key>
            ))}
            {r === 2 && state.page === 'letters' ? (
              <Key label="ß" onPress={() => type('ß')}>
                ß
              </Key>
            ) : null}
            {r === 2 ? (
              <Key wide label="Delete" repeat onPress={backspace}>
                <Delete size={22} />
              </Key>
            ) : null}
          </div>
        ))}
        <div className="flex justify-center">
          <Key
            wide
            label={state.page === 'letters' ? 'Numbers' : 'Letters'}
            onPress={() => setPage(state.page === 'letters' ? 'numbers' : 'letters')}
          >
            <span className="text-base">{state.page === 'letters' ? '123' : 'ABC'}</span>
          </Key>
          <Key label="Comma" onPress={() => type(',')}>
            ,
          </Key>
          <SpaceKey />
          <Key label="Full stop" onPress={() => type('.')}>
            .
          </Key>
          <Key wide label="Return" accent onPress={enter}>
            <CornerDownLeft size={22} />
          </Key>
        </div>
      </div>
    </div>
  )
}

/**
 * What a key does with a touch. Each finger has its own id, so keys pressed in quick succession,
 * or the same key by two fingers, are all counted.
 */
interface KeyHandler {
  down(id: number, x: number): void
  move?(id: number, x: number): void
  up?(id: number): void
  cancel?(id: number): void
}

const keyHandlers = new WeakMap<Element, KeyHandler>()

/** How far from a key a touch at the keyboard's edge may land and still press it. */
const NEAREST_KEY_PX = 60
/** A touch and a pointer event this close in time and place are the same finger. */
const SAME_PRESS_MS = 250
const SAME_PRESS_PX = 24

/**
 * Feeds touches on the keyboard straight to the keys, on touch-down. Each finger is read from
 * two sources, touch events and pointer events, and whichever reports it first presses the
 * key; the other is recognized as the same finger. So a tap one source drops (which iPadOS
 * does now and then when typing fast) still counts. All touches are cancelled, so iPadOS
 * cannot read quick taps as a double-tap zoom, a scroll or a text selection.
 */
function routeTouches(keyboard: HTMLElement): () => void {
  /** Finger ids from both sources ('t3', 'p12') to the press they started. */
  const fingers = new Map<string, Press>()
  const recent: Press[] = []
  let nextId = 1

  interface Press {
    id: number
    key: Element
    x: number
    y: number
    time: number
    sources: Set<'t' | 'p'>
    ended: boolean
  }

  const keyAt = (x: number, y: number): Element | null => {
    const hit = document.elementFromPoint(x, y)?.closest('[data-key]')
    if (hit && keyboard.contains(hit)) return hit
    let best: Element | null = null
    let bestDistance = NEAREST_KEY_PX
    for (const key of keyboard.querySelectorAll('[data-key]')) {
      const r = key.getBoundingClientRect()
      const d = Math.hypot(
        Math.max(r.left - x, 0, x - r.right),
        Math.max(r.top - y, 0, y - r.bottom),
      )
      if (d < bestDistance) {
        best = key
        bestDistance = d
      }
    }
    return best
  }

  const begin = (source: 't' | 'p', finger: number, x: number, y: number) => {
    const name = `${source}${finger}`
    if (fingers.has(name)) return
    const now = performance.now()
    // The same finger, already reported by the other source.
    const same = recent.find(
      (p) =>
        !p.sources.has(source) &&
        now - p.time < SAME_PRESS_MS &&
        Math.hypot(p.x - x, p.y - y) < SAME_PRESS_PX,
    )
    if (same) {
      same.sources.add(source)
      if (!same.ended) fingers.set(name, same)
      return
    }
    const key = keyAt(x, y)
    if (!key || (key as HTMLButtonElement).disabled) return
    const press: Press = {
      id: nextId++,
      key,
      x,
      y,
      time: now,
      sources: new Set([source]),
      ended: false,
    }
    fingers.set(name, press)
    recent.push(press)
    while (recent.length > 20) recent.shift()
    key.setAttribute('data-down', '')
    keyHandlers.get(key)?.down(press.id, x)
  }
  const moveTo = (source: 't' | 'p', finger: number, x: number) => {
    const press = fingers.get(`${source}${finger}`)
    if (press && !press.ended) keyHandlers.get(press.key)?.move?.(press.id, x)
  }
  const end = (source: 't' | 'p', finger: number, cancelled: boolean) => {
    const name = `${source}${finger}`
    const press = fingers.get(name)
    fingers.delete(name)
    if (!press || press.ended) return
    // A cancelled report from one source does not undo a press the other still follows.
    if (cancelled && [...fingers.values()].includes(press)) return
    press.ended = true
    for (const [other, p] of fingers) if (p === press) fingers.delete(other)
    if (![...fingers.values()].some((p) => p.key === press.key)) {
      press.key.removeAttribute('data-down')
    }
    const handler = keyHandlers.get(press.key)
    if (cancelled) handler?.cancel?.(press.id)
    else handler?.up?.(press.id)
  }

  const onTouchStart = (e: TouchEvent) => {
    e.preventDefault()
    for (const t of Array.from(e.changedTouches)) begin('t', t.identifier, t.clientX, t.clientY)
  }
  const onTouchMove = (e: TouchEvent) => {
    e.preventDefault()
    for (const t of Array.from(e.changedTouches)) moveTo('t', t.identifier, t.clientX)
  }
  const onTouchEnd = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      end('t', t.identifier, e.type === 'touchcancel')
    }
  }
  // A mouse or trackpad is handled by the keys themselves (useKey).
  const finger = (e: PointerEvent) => e.pointerType !== 'mouse'
  const onPointerDown = (e: PointerEvent) => {
    if (finger(e)) begin('p', e.pointerId, e.clientX, e.clientY)
  }
  const onPointerMove = (e: PointerEvent) => {
    if (finger(e)) moveTo('p', e.pointerId, e.clientX)
  }
  const onPointerUp = (e: PointerEvent) => {
    if (finger(e)) end('p', e.pointerId, e.type === 'pointercancel')
  }

  const listeners: [string, (e: never) => void, AddEventListenerOptions?][] = [
    ['touchstart', onTouchStart, { passive: false }],
    ['touchmove', onTouchMove, { passive: false }],
    ['touchend', onTouchEnd],
    ['touchcancel', onTouchEnd],
    ['pointerdown', onPointerDown],
    ['pointermove', onPointerMove],
    ['pointerup', onPointerUp],
    ['pointercancel', onPointerUp],
  ]
  for (const [type, fn, options] of listeners) {
    keyboard.addEventListener(type, fn as EventListener, options)
  }
  return () => {
    for (const [type, fn] of listeners) keyboard.removeEventListener(type, fn as EventListener)
  }
}

/**
 * Connects a key to touches (see routeTouches) and to a mouse or trackpad, which still uses
 * pointer events.
 */
function useKey(handler: KeyHandler) {
  const current = useRef(handler)
  useLayoutEffect(() => {
    current.current = handler
  })
  const ref = useCallback((el: HTMLElement | null) => {
    if (!el) return
    keyHandlers.set(el, {
      down: (id, x) => current.current.down(id, x),
      move: (id, x) => current.current.move?.(id, x),
      up: (id) => current.current.up?.(id),
      cancel: (id) => current.current.cancel?.(id),
    })
  }, [])
  const mouse = (e: PointerEvent<HTMLElement>) => e.pointerType === 'mouse'
  return {
    ref,
    'data-key': '',
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (!mouse(e)) return
      e.preventDefault()
      e.currentTarget.setPointerCapture?.(e.pointerId)
      e.currentTarget.dataset.down = ''
      current.current.down(-1, e.clientX)
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      if (mouse(e) && e.currentTarget.dataset.down !== undefined)
        current.current.move?.(-1, e.clientX)
    },
    onPointerUp: (e: PointerEvent<HTMLElement>) => {
      if (!mouse(e) || e.currentTarget.dataset.down === undefined) return
      delete e.currentTarget.dataset.down
      current.current.up?.(-1)
    },
    onPointerCancel: (e: PointerEvent<HTMLElement>) => {
      if (!mouse(e)) return
      delete e.currentTarget.dataset.down
      current.current.cancel?.(-1)
    },
  }
}

/** A handler that acts on touch-down and, with `repeat`, again while held. */
function usePress(onPress: () => void, repeat?: boolean) {
  const timer = useRef<{
    wait?: ReturnType<typeof setTimeout>
    every?: ReturnType<typeof setInterval>
  }>({})
  const stop = () => {
    clearTimeout(timer.current.wait)
    clearInterval(timer.current.every)
  }
  useEffect(() => stop, [])
  return useKey({
    down: () => {
      stop()
      onPress()
      if (repeat) {
        timer.current.wait = setTimeout(() => {
          timer.current.every = setInterval(onPress, 70)
        }, 420)
      }
    },
    up: stop,
    cancel: stop,
  })
}

/** Space; sliding a finger along it moves the caret instead, like on the iPad's keyboard. */
function SpaceKey() {
  const drags = useRef(new Map<number, { x: number; moved: boolean }>())
  const key = useKey({
    // The space is typed at once, like every key, so fast typing keeps its order.
    down: (id, x) => {
      drags.current.set(id, { x, moved: false })
      type(' ')
    },
    move: (id, x) => {
      const d = drags.current.get(id)
      if (!d) return
      // A small slip while typing fast is still just a space.
      if (!d.moved && Math.abs(x - d.x) < SPACE_SLIDE_PX) return
      if (!d.moved) {
        // Sliding moves the caret instead; the space typed on touch-down goes again.
        d.moved = true
        d.x = x
        backspace()
      }
      while (Math.abs(x - d.x) >= SPACE_STEP_PX) {
        const direction = x > d.x ? 1 : -1
        moveCaret(direction)
        d.x += direction * SPACE_STEP_PX
      }
    },
    up: (id) => drags.current.delete(id),
    cancel: (id) => drags.current.delete(id),
  })
  return (
    <button
      type="button"
      aria-label="Space"
      {...key}
      className={cn(HIT_CLASS, 'max-w-none flex-[5]')}
    >
      <span className={cn(KEY_CLASS, 'bg-surface-raised text-sm text-ink-muted')}>space</span>
    </button>
  )
}

/**
 * A button in the strip above the keys. `onPress` acts on touch-down (and repeats if asked);
 * `onClick` acts when the touch ends, which also lets it use the clipboard.
 */
function StripButton({
  label,
  children,
  onClick,
  onPress,
  repeat,
  disabled,
}: {
  label: string
  children: ReactNode
  onClick?: () => void
  onPress?: () => void
  repeat?: boolean
  disabled?: boolean
}) {
  const press = usePress(onPress ?? (() => {}), repeat)
  const click = useKey({ down: () => {}, up: () => onClick?.() })
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      {...(onPress ? press : click)}
      className="grid h-10 min-w-10 place-items-center rounded-control px-2 text-sm font-semibold text-ink hover:bg-hover data-[down]:bg-pressed disabled:text-ink-subtle"
    >
      {children}
    </button>
  )
}

/**
 * Each key's touch area is the whole cell around it, with no gaps between keys, so a tap
 * slightly off a key (common when typing fast) still counts.
 */
const HIT_CLASS = 'group flex min-w-0 px-[3px] py-[4px]'
const KEY_CLASS =
  'grid h-14 w-full place-items-center rounded-[10px] text-[22px] text-ink shadow-[0_1px_0_rgb(62_45_37/0.25)] group-data-[down]:bg-beige'

/** A key. It acts on touch-down, like a real keyboard; Delete repeats while held. */
function Key({
  label,
  onPress,
  children,
  wide,
  accent,
  pressed,
  repeat,
}: {
  label: string
  onPress: () => void
  children: ReactNode
  wide?: boolean
  accent?: boolean
  pressed?: boolean
  repeat?: boolean
}) {
  const press = usePress(onPress, repeat)
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      {...press}
      className={cn(HIT_CLASS, wide ? 'max-w-[8.4rem] flex-[1.6]' : 'max-w-[5.9rem] flex-1')}
    >
      <span
        className={cn(
          KEY_CLASS,
          accent
            ? 'bg-ink text-ink-inverse group-data-[down]:bg-mocha'
            : pressed
              ? 'bg-ink text-ink-inverse'
              : wide
                ? 'bg-sand'
                : 'bg-surface-raised',
        )}
      >
        {children}
      </span>
    </button>
  )
}

export type { KeyPage }
