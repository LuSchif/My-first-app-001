import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn.ts'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
}

const variants: Record<Variant, string> = {
  primary: 'bg-ink text-ink-inverse shadow-soft hover:bg-mocha',
  secondary: 'bg-surface-raised text-ink ring-1 ring-line ring-inset hover:bg-surface-sunken',
  ghost: 'text-ink hover:bg-hover',
  danger: 'bg-danger text-ink-inverse shadow-soft hover:brightness-110',
}

// Both sizes keep a hit area of at least 44 px, the minimum for touch.
const sizes: Record<Size, string> = {
  md: 'h-11 gap-2 px-4 text-sm',
  lg: 'h-12 gap-2.5 px-5 text-base',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-control font-semibold whitespace-nowrap',
        'transition-[background-color,box-shadow,filter,transform] duration-150 ease-gentle',
        'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
}
