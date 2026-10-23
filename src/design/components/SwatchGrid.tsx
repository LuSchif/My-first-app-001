import { SWATCH_ROWS } from '../palette.ts'
import { ColorSwatch } from './ColorSwatch.tsx'

/** The full Broomit color palette, one hue family per row. */
export function SwatchGrid({
  value,
  onChange,
}: {
  value: string | null
  onChange: (color: string) => void
}) {
  return (
    <div role="group" aria-label="Colors" className="grid gap-0.5">
      {SWATCH_ROWS.map((row) => (
        <div key={row.name} className="flex flex-wrap">
          {row.colors.map((color) => (
            <ColorSwatch
              key={color}
              size="sm"
              label={`${row.name} ${color}`}
              fill={{ type: 'solid', color }}
              selected={value === color}
              onSelect={() => onChange(color)}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
