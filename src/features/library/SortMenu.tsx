import { ArrowUpDown, Check } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger, useClosePopover } from '../../design/index.ts'

/** A small menu to choose one of a few orders (or filters). */
export function SortMenu<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: readonly (readonly [T, string])[]
  onChange: (value: T) => void
}) {
  const current = options.find(([v]) => v === value)?.[1] ?? ''
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label}: ${current}`}
          className="flex h-9 items-center gap-1.5 rounded-control px-2.5 text-sm font-semibold text-ink-muted hover:bg-hover"
        >
          <ArrowUpDown size={16} />
          {current}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="grid w-56 gap-0.5 p-2">
        <p className="px-3 pt-1 pb-1.5 text-xs font-semibold tracking-wide text-ink-muted uppercase">
          {label}
        </p>
        <Options value={value} options={options} onChange={onChange} />
      </PopoverContent>
    </Popover>
  )
}

function Options<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: readonly (readonly [T, string])[]
  onChange: (value: T) => void
}) {
  const close = useClosePopover()
  return options.map(([v, text]) => (
    <button
      key={v}
      type="button"
      aria-pressed={v === value}
      onClick={() => {
        onChange(v)
        close()
      }}
      className="flex h-11 items-center justify-between rounded-control px-3 text-left text-sm hover:bg-hover aria-pressed:font-semibold"
    >
      {text}
      {v === value ? <Check size={16} /> : null}
    </button>
  ))
}
