import { Moon, Palette, Plus, X } from 'lucide-react'
import { useState } from 'react'
import {
  Button,
  IconButton,
  TextField,
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
import { NameHint } from './NameHint.tsx'
import {
  loadThemePresets,
  removeThemePreset,
  saveThemePreset,
  type ThemePreset,
} from './themePresets.ts'
import { uniqueName } from './uniqueName.ts'

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
      <PopoverContent
        align="end"
        className="grid max-h-[min(44rem,calc(100dvh-8rem-var(--kb-height,0px)))] w-80 gap-4 overflow-y-auto"
      >
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
        <YourPresets
          theme={theme}
          onApply={(preset) => {
            setCustom(preset.accent !== null && !THEME_PRESETS.some(([, c]) => c === preset.accent))
            choose(preset)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

/** Looks saved under a name: tap one to use it again; the current look can be saved too. */
function YourPresets({
  theme,
  onApply,
}: {
  theme: ThemeSetting
  onApply: (theme: ThemeSetting) => void
}) {
  const [presets, setPresets] = useState(loadThemePresets)
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const taken = presets.map((p) => p.name)
  const same = (p: ThemePreset) => p.theme.accent === theme.accent && p.theme.dark === theme.dark
  const save = () => {
    if (!name.trim()) return
    setPresets(saveThemePreset({ name: uniqueName(name, taken), theme }))
    setName('')
    setNaming(false)
  }
  return (
    <div className="grid gap-3 border-t border-line pt-3">
      <p className="text-sm font-semibold">Your presets</p>
      {presets.length ? (
        <ul className="grid gap-1">
          {presets.map((preset) => (
            <li key={preset.name} className="flex items-center gap-1">
              <button
                type="button"
                aria-pressed={same(preset)}
                data-choice
                onClick={() => onApply(preset.theme)}
                className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-control px-2 text-left text-sm hover:bg-hover aria-pressed:font-semibold"
              >
                <span
                  className="size-6 shrink-0 rounded-full ring-1 ring-line"
                  style={{ background: preset.theme.accent ?? '#b98b65' }}
                />
                <span className="truncate">{preset.name}</span>
                {preset.theme.dark ? (
                  <Moon size={14} aria-label="Dark" className="shrink-0 text-ink-muted" />
                ) : null}
              </button>
              <IconButton
                label={`Remove ${preset.name}`}
                icon={<X size={16} />}
                onClick={() => setPresets(removeThemePreset(preset.name))}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">
          Save the colors you set here under a name, to switch back to them any time.
        </p>
      )}
      {naming ? (
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <TextField
            label="Preset name"
            placeholder="e.g. Exam season"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <NameHint name={name} taken={taken} noun="preset" />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setNaming(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={!name.trim()}>
              Save preset
            </Button>
          </div>
        </form>
      ) : (
        <Button icon={<Plus size={18} />} onClick={() => setNaming(true)}>
          Save current colors…
        </Button>
      )}
    </div>
  )
}
