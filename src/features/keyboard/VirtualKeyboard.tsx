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
  setVirtualKeyboardEnabled,
  toggleShift,
  type,
  type KeyPage,
} from './keyboardStore.ts'

const LETTERS = ['qwertzuiopü', 'asdfghjklöä', 'yxcvbnm']
const NUMBERS = ['1234567890', '-/:;()€&@"', ".,?!'%+="]
const SYMBOLS = ['[]{}#%^*+=', '_\\|~<>$£¥•', ".,?!'`§°"]

/** Steps of this many pixels on the space bar move the caret by one character. */
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
    return () => observer.disconnect()
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
      style={{ pointerEvents: 'auto' }}
      className="fixed inset-x-0 bottom-0 z-[70] grid gap-2 bg-surface-sunken/97 px-2 pt-1.5 pb-[calc(8px+env(safe-area-inset-bottom))] shadow-overlay backdrop-blur"
    >
      <div className="mx-auto flex w-full max-w-[64rem] items-center gap-1 px-1">
        <div className="mr-auto flex min-w-0 items-baseline gap-2">
          <span className="truncate text-sm font-semibold text-ink">Broomit Keyboard</span>
          <button
            type="button"
            onClick={() => {
              setVirtualKeyboardEnabled(false)
              close()
              window.location.reload()
            }}
            className="truncate rounded-control px-1 text-xs text-ink-muted underline-offset-2 hover:underline"
          >
            Use the iPad keyboard
          </button>
        </div>
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
        <button
          type="button"
          aria-label="Hide keyboard"
          onClick={close}
          className="grid h-9 w-12 place-items-center rounded-control text-ink hover:bg-hover"
        >
          <ChevronDown size={22} />
        </button>
      </div>
      <div className="mx-auto grid w-full max-w-[64rem] gap-2">
        {rows.map((row, r) => (
          <div key={r} className="flex justify-center gap-1.5">
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
        <div className="flex justify-center gap-1.5">
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
        drag.current = { id: e.pointerId, x: e.clientX, moved: false }
      }}
      onPointerMove={(e) => {
        const d = drag.current
        if (!d || d.id !== e.pointerId) return
        while (Math.abs(e.clientX - d.x) >= SPACE_STEP_PX) {
          const direction = e.clientX > d.x ? 1 : -1
          moveCaret(direction)
          d.x += direction * SPACE_STEP_PX
          d.moved = true
        }
      }}
      onPointerUp={(e) => {
        const d = drag.current
        drag.current = null
        if (d && d.id === e.pointerId && !d.moved) type(' ')
      }}
      onPointerCancel={() => (drag.current = null)}
      className={cn(KEY_CLASS, 'max-w-none flex-[5] bg-surface-raised')}
    >
      <span className="text-sm text-ink-muted">space</span>
    </button>
  )
}

/** A button in the strip above the keys; `onPress` acts on touch-down (and repeats if asked). */
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
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      {...(onPress ? hold : {})}
      className="grid h-9 min-w-9 place-items-center rounded-control px-2 text-sm font-semibold text-ink hover:bg-hover active:bg-pressed disabled:text-ink-subtle"
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
  const stop = () => {
    clearTimeout(timer.current.wait)
    clearInterval(timer.current.every)
  }
  useEffect(() => stop, [])
  return {
    onPointerDown: (e: PointerEvent) => {
      e.preventDefault()
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

const KEY_CLASS =
  'grid h-14 min-w-0 select-none place-items-center rounded-[10px] text-[22px] text-ink shadow-[0_1px_0_rgb(62_45_37/0.25)] active:bg-beige'

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
      className={cn(
        KEY_CLASS,
        wide ? 'flex-[1.6]' : 'flex-1',
        'max-w-[5.5rem]',
        wide && 'max-w-[8rem]',
        accent
          ? 'bg-ink text-ink-inverse active:bg-mocha'
          : pressed
            ? 'bg-ink text-ink-inverse'
            : wide
              ? 'bg-sand'
              : 'bg-surface-raised',
      )}
    >
      {children}
    </button>
  )
}

export type { KeyPage }
