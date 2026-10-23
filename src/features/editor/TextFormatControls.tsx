import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Italic,
  Minus,
  Plus,
  Underline,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { Editor } from '../../engine/editor/Editor.ts'
import type { FontFamily, TextStyle } from '../../engine/model/types.ts'
import { FONT_LABELS, FONT_STACKS } from '../../engine/render/text.ts'
import { cn } from '../../lib/cn.ts'
import {
  Button,
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Slider,
  SwatchGrid,
} from '../../design/index.ts'

const SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64, 80, 96]
const ICON = { size: 20, strokeWidth: 1.75 }

/**
 * Font, size, emphasis, color, alignment and spacing for text. Used in the floating format bar
 * while typing, and in the text tool's settings for the next new box.
 */
export function TextFormatControls({
  editor,
  style,
  onDone,
}: {
  editor: Editor
  style: TextStyle
  onDone?: () => void
}) {
  const set = (patch: Partial<TextStyle>) => editor.setTextStyle(patch)
  const step = (dir: 1 | -1) => {
    const next =
      dir > 0
        ? (SIZES.find((s) => s > style.size) ?? style.size)
        : ([...SIZES].reverse().find((s) => s < style.size) ?? style.size)
    set({ size: next })
  }

  return (
    // Buttons here must not take focus from the text field, or the keyboard would close.
    <div
      className="flex flex-wrap items-center gap-1"
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).closest('[data-keep-focus]')) e.preventDefault()
      }}
    >
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex h-11 items-center gap-1.5 rounded-control px-3 text-sm font-semibold hover:bg-hover"
            style={{ fontFamily: FONT_STACKS[style.font] }}
          >
            {FONT_LABELS[style.font]}
            <ChevronDown size={16} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="grid w-56 gap-1 p-2">
          {(Object.keys(FONT_LABELS) as FontFamily[]).map((font) => (
            <button
              key={font}
              type="button"
              aria-pressed={style.font === font}
              onClick={() => set({ font })}
              className="h-11 rounded-control px-3 text-left text-lg hover:bg-hover aria-pressed:bg-surface-sunken"
              style={{ fontFamily: FONT_STACKS[font] }}
            >
              {FONT_LABELS[font]}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      <div className="flex items-center" role="group" aria-label="Font size">
        <IconButton
          label="Smaller"
          icon={<Minus {...ICON} />}
          onClick={() => step(-1)}
          data-keep-focus
        />
        <span className="w-9 text-center text-sm font-semibold tabular-nums">
          {Math.round(style.size)}
        </span>
        <IconButton
          label="Larger"
          icon={<Plus {...ICON} />}
          onClick={() => step(1)}
          data-keep-focus
        />
      </div>

      <Divider />
      <Toggle label="Bold" active={style.bold} onClick={() => set({ bold: !style.bold })}>
        <Bold {...ICON} />
      </Toggle>
      <Toggle label="Italic" active={style.italic} onClick={() => set({ italic: !style.italic })}>
        <Italic {...ICON} />
      </Toggle>
      <Toggle
        label="Underline"
        active={style.underline}
        onClick={() => set({ underline: !style.underline })}
      >
        <Underline {...ICON} />
      </Toggle>

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Text color"
            className="grid size-11 place-items-center rounded-control hover:bg-hover"
          >
            <span
              className="size-6 rounded-full ring-1 ring-line-strong"
              style={{ background: style.color, opacity: style.opacity }}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent className="grid w-80 gap-4">
          <SwatchGrid value={style.color} onChange={(color) => set({ color })} />
          <Slider
            label="Opacity"
            value={Math.round(style.opacity * 100)}
            min={10}
            max={100}
            onChange={(v) => set({ opacity: v / 100 })}
            format={(v) => `${v}%`}
          />
        </PopoverContent>
      </Popover>

      <Divider />
      <Toggle
        label="Align left"
        active={style.align === 'left'}
        onClick={() => set({ align: 'left' })}
      >
        <AlignLeft {...ICON} />
      </Toggle>
      <Toggle
        label="Align center"
        active={style.align === 'center'}
        onClick={() => set({ align: 'center' })}
      >
        <AlignCenter {...ICON} />
      </Toggle>
      <Toggle
        label="Align right"
        active={style.align === 'right'}
        onClick={() => set({ align: 'right' })}
      >
        <AlignRight {...ICON} />
      </Toggle>

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="h-11 rounded-control px-3 text-sm font-semibold tabular-nums hover:bg-hover"
          >
            Spacing {style.lineHeight.toFixed(1)}
          </button>
        </PopoverTrigger>
        <PopoverContent className="grid gap-4">
          <Slider
            label="Line spacing"
            value={style.lineHeight}
            min={1}
            max={2.5}
            step={0.05}
            onChange={(lineHeight) => set({ lineHeight })}
            format={(v) => v.toFixed(2)}
          />
        </PopoverContent>
      </Popover>

      {onDone ? (
        <>
          <Divider />
          <Button variant="primary" onClick={onDone}>
            Done
          </Button>
        </>
      ) : null}
    </div>
  )
}

function Toggle({
  label,
  active,
  onClick,
  children,
}: {
  label: string
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <IconButton label={label} icon={children} active={active} onClick={onClick} data-keep-focus />
  )
}

function Divider() {
  return <span className={cn('mx-1 h-7 w-px bg-line')} />
}
