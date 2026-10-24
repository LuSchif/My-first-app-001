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
    // Touches on the keyboard are keys only: iPadOS must not read fast taps as a double-tap
    // zoom, a scroll or a text selection, which would swallow them.
    const block = (e: TouchEvent) => e.preventDefault()
    el.addEventListener('touchstart', block, { passive: false })
    return () => {
      observer.disconnect()
      el.removeEventListener('touchstart', block)
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
      className="fixed inset-x-0 bottom-0 z-[70] grid gap-1 bg-surface-sunken/97 px-1 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom))] shadow-overlay backdrop-blur select-none"
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

/** Space; sliding a finger along it moves the caret instead, like on the iPad's keyboard. */
function SpaceKey() {
  const drag = useRef<{ id: number; x: number; moved: boolean } | null>(null)
  return (
    <button
      type="button"
      aria-label="Space"
      onPointerDown={(e) => {
        e.preventDefault()
        e.currentTarget.setPointerCapture?.(e.pointerId)
        e.currentTarget.dataset.down = ''
        drag.current = { id: e.pointerId, x: e.clientX, moved: false }
      }}
      onPointerMove={(e) => {
        const d = drag.current
        if (!d || d.id !== e.pointerId) return
        // A small slip while typing fast is still a space.
        if (!d.moved && Math.abs(e.clientX - d.x) < SPACE_SLIDE_PX) return
        if (!d.moved) {
          d.moved = true
          d.x = e.clientX
        }
        while (Math.abs(e.clientX - d.x) >= SPACE_STEP_PX) {
          const direction = e.clientX > d.x ? 1 : -1
          moveCaret(direction)
          d.x += direction * SPACE_STEP_PX
        }
      }}
      onPointerUp={(e) => {
        delete e.currentTarget.dataset.down
        const d = drag.current
        drag.current = null
        if (d && d.id === e.pointerId && !d.moved) type(' ')
      }}
      onPointerCancel={(e) => {
        delete e.currentTarget.dataset.down
        // The touch was taken away before it ended; it was still meant as a space.
        if (drag.current && !drag.current.moved) type(' ')
        drag.current = null
      }}
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
  const hold = useHold(onPress ?? (() => {}), repeat)
  const touched = useRef(false)
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      // Touches are cancelled on the keyboard, so they never become clicks: act on lifting.
      // A trackpad or mouse still clicks.
      onPointerUp={(e) => {
        touched.current = e.pointerType !== 'mouse'
        if (touched.current) onClick?.()
      }}
      onClick={() => {
        if (!touched.current) onClick?.()
        touched.current = false
      }}
      {...(onPress ? hold : {})}
      className="grid h-10 min-w-10 place-items-center rounded-control px-2 text-sm font-semibold text-ink hover:bg-hover data-[down]:bg-pressed disabled:text-ink-subtle"
    >
      {children}
    </button>
  )
}

/** Pointer handlers that act on touch-down and, with `repeat`, again while held. */
function useHold(onPress: () => void, repeat?: boolean) {
  const timer = useRef<{
    wait?: ReturnType<typeof setTimeout>
    every?: ReturnType<typeof setInterval>
  }>({})
  const stop = (e?: PointerEvent<HTMLElement>) => {
    if (e) delete e.currentTarget.dataset.down
    clearTimeout(timer.current.wait)
    clearInterval(timer.current.every)
  }
  useEffect(() => stop, [])
  return {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      e.preventDefault()
      // Shown pressed until lifted; :active is unreliable once touches are cancelled.
      e.currentTarget.dataset.down = ''
      onPress()
      if (repeat) {
        timer.current.wait = setTimeout(() => {
          timer.current.every = setInterval(onPress, 70)
        }, 420)
      }
    },
    onPointerUp: stop,
    onPointerCancel: stop,
    onPointerLeave: stop,
  }
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
  const hold = useHold(onPress, repeat)
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      {...hold}
      className={cn(HIT_CLASS, wide ? 'flex-[1.6] max-w-[8.4rem]' : 'flex-1 max-w-[5.9rem]')}
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
