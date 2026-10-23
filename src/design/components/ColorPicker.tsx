import { useState } from 'react'
import { ColorSwatch } from './ColorSwatch.tsx'
import { ColorWheel } from './ColorWheel.tsx'
import { PRIMARY_COLORS } from '../palette.ts'

const WHEEL_FILL = {
  type: 'linear' as const,
  angle: 90,
  stops: [
    { offset: 0, color: '#f2cf4a' },
    { offset: 0.33, color: '#e0715f' },
    { offset: 0.66, color: '#8063b4' },
    { offset: 1, color: '#4a80c0' },
  ],
}

/** Compact color choice: twelve standard colors, and a color wheel for everything else. */
export function ColorPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (hex: string) => void
}) {
  const isPrimary = PRIMARY_COLORS.some(([, c]) => c === value)
  const [wheel, setWheel] = useState(!isPrimary)
  return (
    <div className="grid gap-3">
      <div role="group" aria-label="Colors" className="grid grid-cols-7 justify-items-center">
        {PRIMARY_COLORS.map(([name, color]) => (
          <ColorSwatch
            key={color}
            size="sm"
            label={name}
            fill={{ type: 'solid', color }}
            selected={value === color}
            onSelect={() => onChange(color)}
          />
        ))}
        <ColorSwatch
          size="sm"
          label={wheel ? 'Hide color wheel' : 'Custom color'}
          fill={isPrimary ? WHEEL_FILL : { type: 'solid', color: value }}
          selected={!isPrimary || wheel}
          onSelect={() => setWheel(!wheel)}
        />
      </div>
      {wheel ? <ColorWheel value={value} onChange={onChange} /> : null}
    </div>
  )
}
