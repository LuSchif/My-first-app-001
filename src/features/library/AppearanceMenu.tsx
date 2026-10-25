import { Palette } from 'lucide-react'
import { useState } from 'react'
import {
  IconButton,
  ColorPicker,
  ColorSwatch,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Switch,
} from '../../design/index.ts'
import {
  applyTheme,
  loadTheme,
  saveTheme,
  THEME_PRESETS,
  type ThemeSetting,
} from '../../design/theme.ts'

/** The look of the round icon buttons in the library's header. */
const HEADER_BUTTON = 'bg-surface-raised ring-1 ring-line ring-inset hover:bg-surface-sunken'

/** Colors the interface: a preset or any color, light or dark. */
export function AppearanceMenu() {
  const [theme, setTheme] = useState(loadTheme)
  const [custom, setCustom] = useState(
    () => theme.accent !== null && !THEME_PRESETS.some(([, c]) => c === theme.accent),
  )
  const choose = (next: ThemeSetting) => {
    setTheme(next)
    applyTheme(next)
    saveTheme(next)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <IconButton label="Appearance" icon={<Palette size={20} />} className={HEADER_BUTTON} />
      </PopoverTrigger>
      <PopoverContent align="end" className="grid w-80 gap-4">
        <p className="text-sm font-semibold">Interface colors</p>
        <div role="group" aria-label="Themes" className="flex flex-wrap">
          {THEME_PRESETS.map(([name, color]) => (
            <ColorSwatch
              key={name}
              label={name}
              fill={{ type: 'solid', color: color ?? '#b98b65' }}
              selected={!custom && theme.accent === color}
              onSelect={() => {
                setCustom(false)
                choose({ ...theme, accent: color })
              }}
            />
          ))}
        </div>
        <Switch
          label="Your own color"
          hint="Build the interface from any color"
          checked={custom}
          onChange={(on) => {
            setCustom(on)
            if (!on) choose({ ...theme, accent: null })
          }}
        />
        {custom ? (
          <ColorPicker
            value={theme.accent ?? '#b98b65'}
            onChange={(accent) => choose({ ...theme, accent })}
          />
        ) : null}
        <div className="border-t border-line pt-2">
          <Switch
            label="Dark"
            hint="Dark panels around white pages"
            checked={theme.dark}
            onChange={(dark) => choose({ ...theme, dark })}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
