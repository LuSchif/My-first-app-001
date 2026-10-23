import { useId } from 'react'
import { cn } from '../../lib/cn.ts'

/** An on/off setting with its label; the whole row is the touch target. */
export function Switch({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  const id = useId()
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={id}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-control px-1 text-left"
    >
      <span id={id}>
        <span className="block text-sm font-semibold">{label}</span>
        {hint ? <span className="block text-xs text-ink-muted">{hint}</span> : null}
      </span>
      <span
        className={cn(
          'relative h-7 w-12 shrink-0 rounded-full transition-colors duration-150',
          checked ? 'bg-ink' : 'bg-line-strong',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 size-6 rounded-full bg-surface-raised shadow-soft transition-transform duration-150 ease-gentle',
            checked && 'translate-x-5',
          )}
        />
      </span>
    </button>
  )
}
