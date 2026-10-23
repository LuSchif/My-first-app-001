import * as RadixSlider from '@radix-ui/react-slider'
import { useId } from 'react'

export interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  /** Shown next to the label, e.g. "2.5 pt". */
  format?: (value: number) => string
}

export function Slider({ label, value, min, max, step = 1, onChange, format }: SliderProps) {
  const id = useId()
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between text-sm">
        <span id={id} className="font-medium text-ink">
          {label}
        </span>
        <span className="text-ink-muted tabular-nums">{format ? format(value) : value}</span>
      </div>
      <RadixSlider.Root
        className="relative flex h-8 touch-none items-center select-none"
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => v !== undefined && onChange(v)}
        aria-labelledby={id}
      >
        <RadixSlider.Track className="relative h-1.5 grow rounded-full bg-surface-sunken">
          <RadixSlider.Range className="absolute h-full rounded-full bg-mocha" />
        </RadixSlider.Track>
        <RadixSlider.Thumb
          aria-labelledby={id}
          className="block size-6 rounded-full bg-surface-raised shadow-raised ring-1 ring-line-strong transition-transform duration-150 ease-gentle active:scale-110"
        />
      </RadixSlider.Root>
    </div>
  )
}
