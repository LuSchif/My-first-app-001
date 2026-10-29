import { useState, type ReactNode } from 'react'
import { Button, DialogContent } from '../../design/index.ts'
import { cn } from '../../lib/cn.ts'

/**
 * The frame of every object editor (table, chart, graph, picture): the live preview at the
 * top, the settings scrolling under it, and Cancel and Done always in view at the bottom.
 * Closing with changes not yet saved (the X, Escape, the backdrop) asks whether to save them.
 */
export function EditDialog({
  title,
  className,
  preview,
  tabs,
  dirty,
  onSave,
  onCancel,
  children,
}: {
  title: string
  className?: string
  /** Stays at the top while the settings scroll. */
  preview?: ReactNode
  /** Tabs between parts of the settings, under the preview. */
  tabs?: ReactNode
  /** Whether anything was changed. */
  dirty: boolean
  /** Saves and closes. */
  onSave: () => void
  /** Closes without saving. */
  onCancel: () => void
  children: ReactNode
}) {
  const [asking, setAsking] = useState(false)
  const close = () => (dirty ? setAsking(true) : onCancel())
  return (
    <DialogContent
      title={title}
      onClose={close}
      className={cn('flex h-[min(54rem,calc(100%-2rem-var(--kb-height,0px)))] flex-col', className)}
    >
      {preview ? <div className="mb-4 shrink-0">{preview}</div> : null}
      {tabs ? <div className="mb-4 shrink-0">{tabs}</div> : null}
      <div className="relative -mx-6 min-h-0 flex-1 overflow-y-auto px-6 pb-4">{children}</div>
      <div className="-mx-6 -mb-6 flex shrink-0 items-center justify-end gap-2 border-t border-line px-6 py-4">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" onClick={onSave}>
          Done
        </Button>
      </div>
      {asking ? (
        <div className="absolute inset-0 z-20 grid animate-fade-in place-items-center rounded-panel bg-scrim p-6">
          <div
            role="alertdialog"
            aria-label="Unsaved changes"
            className="grid w-full max-w-sm animate-pop-in gap-4 rounded-card bg-surface-raised p-5 shadow-overlay"
          >
            <div className="grid gap-1">
              <p className="text-lg font-bold">Save your changes?</p>
              <p className="text-sm text-ink-muted">
                You changed this {title.replace(/^Edit /, '').toLowerCase()}. Without saving, the
                changes are lost.
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={onCancel}>
                Discard
              </Button>
              <Button onClick={() => setAsking(false)}>Keep editing</Button>
              <Button variant="primary" onClick={onSave}>
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </DialogContent>
  )
}

/** Tabs between parts of an editor's settings. */
export function EditTabs<T extends string>({
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
  return (
    <div role="tablist" aria-label={label} className="flex gap-1">
      {options.map(([name, text]) => (
        <button
          key={name}
          role="tab"
          type="button"
          aria-selected={value === name}
          onClick={() => onChange(name)}
          className="h-10 rounded-control px-4 text-sm font-semibold ring-1 ring-line aria-selected:bg-ink aria-selected:text-ink-inverse aria-selected:ring-ink"
        >
          {text}
        </button>
      ))}
    </div>
  )
}

/** A titled part of an editor's settings. */
export function EditSection({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: ReactNode
}) {
  return (
    <section className="grid gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
      {hint ? <p className="text-xs text-ink-muted">{hint}</p> : null}
    </section>
  )
}
