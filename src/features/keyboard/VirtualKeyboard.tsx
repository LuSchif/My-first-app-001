import { ArrowBigUp, ArrowBigUpDash, ChevronDown, CornerDownLeft, Delete } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { setKeyboardInset } from '../../lib/keyboardInset.ts'
import { cn } from '../../lib/cn.ts'
import {
  backspace,
  close,
  enter,
  keyboardState,
  onKeyboardChange,
  setPage,
  setVirtualKeyboardEnabled,
  toggleShift,
  type,
  type KeyPage,
} from './keyboardStore.ts'

const LETTERS = ['qwertzuiopü', 'asdfghjklöä', 'yxcvbnm']
const NUMBERS = ['1234567890', '-/:;()€&@"', ".,?!'%+="]
const SYMBOLS = ['[]{}#%^*+=', '_\\|~<>$£¥•', ".,?!'`§°"]

/** Broomit's own on-screen keyboard, shown while a text field is its target (see keyboardStore). */
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

  return (
    <div
      ref={ref}
      data-virtual-keyboard=""
      role="group"
      aria-label="Keyboard"
      // Stays usable while a dialog blocks the page behind it.
      style={{ pointerEvents: 'auto' }}
      className="fixed inset-x-0 bottom-0 z-[70] grid gap-2 bg-surface-sunken/97 px-2 pt-1.5 pb-[calc(8px+env(safe-area-inset-bottom))] shadow-overlay backdrop-blur"
    >
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onClick={() => {
            setVirtualKeyboardEnabled(false)
            close()
            window.location.reload()
          }}
          className="h-9 rounded-control px-2 text-xs font-semibold text-ink-muted hover:bg-hover"
        >
          Use the iPad keyboard instead
        </button>
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
          <Key label="Space" grow onPress={() => type(' ')}>
            <span className="text-sm text-ink-muted">space</span>
          </Key>
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

/** A key. It acts on touch-down, like a real keyboard; Delete repeats while held. */
function Key({
  label,
  onPress,
  children,
  wide,
  grow,
  accent,
  pressed,
  repeat,
}: {
  label: string
  onPress: () => void
  children: ReactNode
  wide?: boolean
  grow?: boolean
  accent?: boolean
  pressed?: boolean
  repeat?: boolean
}) {
  const timer = useRef<{
    wait?: ReturnType<typeof setTimeout>
    every?: ReturnType<typeof setInterval>
  }>({})
  const stop = () => {
    clearTimeout(timer.current.wait)
    clearInterval(timer.current.every)
  }
  useEffect(() => stop, [])
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onPointerDown={(e) => {
        e.preventDefault()
        onPress()
        if (repeat) {
          timer.current.wait = setTimeout(() => {
            timer.current.every = setInterval(onPress, 70)
          }, 420)
        }
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onPointerLeave={stop}
      className={cn(
        'grid h-14 select-none place-items-center rounded-[10px] text-[22px] text-ink shadow-[0_1px_0_rgb(62_45_37/0.25)] active:bg-beige',
        grow ? 'flex-[5]' : wide ? 'flex-[1.6]' : 'flex-1',
        'max-w-[5.5rem] min-w-0',
        grow && 'max-w-none',
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
