import { forwardRef, useId, type InputHTMLAttributes } from 'react'
import { cn } from '../../lib/cn.ts'

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  /** Hides the label visually; it stays available to screen readers. */
  hideLabel?: boolean
  error?: string
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hideLabel, error, className, id, ...props },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId
  const errorId = `${inputId}-error`
  return (
    <div className="grid gap-1.5">
      <label
        htmlFor={inputId}
        className={cn('text-sm font-medium text-ink', hideLabel && 'sr-only')}
      >
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          'h-11 w-full rounded-control bg-surface-raised px-3.5 text-base text-ink',
          'ring-1 ring-line ring-inset placeholder:text-ink-subtle',
          'transition-shadow duration-150 focus:ring-2 focus:ring-accent focus:outline-none',
          'aria-invalid:ring-danger',
          className,
        )}
        {...props}
      />
      {error ? (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
})
