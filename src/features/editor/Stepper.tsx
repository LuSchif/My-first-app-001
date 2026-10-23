import { Minus, Plus } from 'lucide-react'
import { IconButton } from '../../design/index.ts'

/** A whole number with minus and plus buttons, e.g. a number of rows. */
export function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium">{label}</span>
      <div
        className="flex items-center rounded-control ring-1 ring-line"
        role="group"
        aria-label={label}
      >
        <IconButton
          label={`Fewer ${label.toLowerCase()}`}
          icon={<Minus size={18} />}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
        />
        <span className="w-8 text-center text-sm font-semibold tabular-nums" aria-live="polite">
          {value}
        </span>
        <IconButton
          label={`More ${label.toLowerCase()}`}
          icon={<Plus size={18} />}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
        />
      </div>
    </div>
  )
}
