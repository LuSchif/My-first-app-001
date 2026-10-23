import { Check } from 'lucide-react'
import { fillToCss, prefersLightText, type Fill } from '../../engine/model/fill.ts'
import { cn } from '../../lib/cn.ts'

export interface ColorSwatchProps {
  fill: Fill
  label: string
  selected?: boolean
  onSelect?: () => void
  size?: 'sm' | 'md' | 'lg'
}

const sizes = { sm: 'size-7', md: 'size-9', lg: 'size-12' }

/** One pickable color or gradient. The 44 px hit area is kept even for the small size. */
export function ColorSwatch({ fill, label, selected, onSelect, size = 'md' }: ColorSwatchProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={onSelect}
      className="group grid min-h-11 min-w-11 place-items-center rounded-full"
    >
      <span
        className={cn(
          'grid place-items-center rounded-full shadow-[inset_0_0_0_1px_rgb(62_45_37/0.14)]',
          'transition-transform duration-150 ease-gentle group-active:scale-90',
          selected && 'ring-2 ring-ink ring-offset-2 ring-offset-surface-raised',
          sizes[size],
        )}
        style={{ background: fillToCss(fill) }}
      >
        {selected ? (
          <Check
            size={size === 'sm' ? 14 : 18}
            strokeWidth={2.5}
            className={prefersLightText(fill) ? 'text-white' : 'text-ink'}
          />
        ) : null}
      </span>
    </button>
  )
}
