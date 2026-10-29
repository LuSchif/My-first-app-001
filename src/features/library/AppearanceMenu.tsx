import { Moon, Palette, Plus, Store, X } from 'lucide-react'
import { useState } from 'react'
import {
  Button,
  ColorSwatch,
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Switch,
  TextField,
} from '../../design/index.ts'
import {
  applyTheme,
  loadTheme,
  saveTheme,
  THEME_PRESETS,
  type ThemeSetting,
} from '../../design/theme.ts'
import { fillBaseColor, fillToCss, type Fill } from '../../engine/model/fill.ts'
import { FillEditor } from '../folders/FillEditor.tsx'
import { navigate } from '../../app/router.ts'
import { DESIGN_PACKS, packImage, type DesignPackId } from '../../design/packs.ts'
import { usePurchases } from '../shop/purchases.ts'
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

/** A theme's own color or gradient, as a fill for the editor and for previews. */
function themeFill(theme: ThemeSetting): Fill {
  const g = theme.gradient
  if (g && g.type === 'linear') return { type: 'linear', angle: g.angle ?? 135, stops: g.stops }
  if (g) return { type: 'radial', stops: g.stops }
  return { type: 'solid', color: theme.accent ?? '#b98b65' }
}

/** A theme built from a fill: its first color, and the gradient when it is one. */
function fromFill(fill: Fill, dark: boolean): ThemeSetting {
  if (fill.type === 'solid') return { accent: fill.color, dark, gradient: null }
  return {
    accent: fillBaseColor(fill),
    dark,
    gradient:
      fill.type === 'linear'
        ? { type: 'linear', angle: fill.angle, stops: fill.stops }
        : { type: 'radial', stops: fill.stops },
  }
}

function isOwn(theme: ThemeSetting): boolean {
  return (
    Boolean(theme.gradient) ||
    (theme.accent !== null && !THEME_PRESETS.some(([, c]) => c === theme.accent))
  )
}

/** The design packs bought in the shop, each with a switch; and the way to the shop. */
function DesignPacks({
  active,
  onChange,
}: {
  active: DesignPackId | null
  onChange: (pack: DesignPackId | null) => void
}) {
  const purchases = usePurchases()
  const owned = DESIGN_PACKS.filter((pack) =>
    purchases.some((p) => p.productId === `pack.${pack.id}`),
  )
  return (
    <div className="grid gap-2">
      <p className="text-sm font-semibold">Design packs</p>
      {owned.map((pack) => (
        <div
          key={pack.id}
          className="flex items-center gap-2 rounded-control bg-surface-sunken py-1 pr-1 pl-1.5"
        >
          <img
            src={packImage(pack.thumb)}
            alt=""
            className="h-9 w-12 shrink-0 rounded-md object-cover"
          />
          <div className="min-w-0 flex-1">
            <Switch
              label={pack.name}
              checked={active === pack.id}
              onChange={(on) => onChange(on ? pack.id : null)}
            />
          </div>
        </div>
      ))}
      <Button
        variant="ghost"
        className="justify-start"
        icon={<Store size={18} />}
        onClick={() => navigate({ name: 'shop' })}
      >
        {owned.length ? 'More in the shop' : 'Get design packs in the shop'}
      </Button>
    </div>
  )
}

/**
 * Colors the interface: a design pack, one of Broomit's looks, or your own color or color gradient (which can
 * be saved as named presets), light or dark.
 */
export function AppearanceMenu() {
  const [theme, setTheme] = useState(loadTheme)
  const [custom, setCustom] = useState(() => isOwn(theme))
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
        className="grid max-h-[min(48rem,calc(100dvh-8rem-var(--kb-height,0px)))] w-[22rem] gap-4 overflow-y-auto"
      >
        <DesignPacks
          active={theme.pack ?? null}
          onChange={(pack) => {
            if (pack) setCustom(false)
            choose(pack ? { ...theme, pack } : { accent: null, dark: theme.dark, gradient: null })
          }}
        />
        <p className="text-sm font-semibold">Interface colors</p>
        <div role="group" aria-label="Themes" className="flex flex-wrap">
          {THEME_PRESETS.map(([name, color]) => (
            <ColorSwatch
              key={name}
              label={name}
              fill={{ type: 'solid', color: color ?? '#b98b65' }}
              selected={!custom && !theme.pack && theme.accent === color}
              onSelect={() => {
                setCustom(false)
                choose({ accent: color, dark: theme.dark, gradient: null })
              }}
            />
          ))}
        </div>
        <Switch
          label="Your own color"
          hint="One color or a color gradient, saved as presets"
          checked={custom}
          onChange={(on) => {
            setCustom(on)
            if (!on) choose({ accent: null, dark: theme.dark, gradient: null })
          }}
        />
        {custom ? (
          <>
            <FillEditor
              value={themeFill(theme)}
              onChange={(fill) => choose(fromFill(fill, theme.dark))}
            />
            <YourPresets theme={theme} onApply={choose} />
          </>
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

/**
 * Your own looks saved under a name, each with a switch that puts it on; the current look is
 * added with "Add preset".
 */
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
  const same = (p: ThemePreset) =>
    JSON.stringify({ ...p.theme, gradient: p.theme.gradient ?? null }) ===
    JSON.stringify({ ...theme, gradient: theme.gradient ?? null })
  const save = () => {
    if (!name.trim()) return
    setPresets(saveThemePreset({ name: uniqueName(name, taken), theme }))
    setName('')
    setNaming(false)
  }
  return (
    <div className="grid gap-3 rounded-card bg-surface-sunken p-3">
      <p className="text-sm font-semibold">Your presets</p>
      {presets.length ? (
        <ul className="grid gap-1">
          {presets.map((preset) => (
            <li
              key={preset.name}
              className="flex items-center gap-2 rounded-control bg-surface-raised py-1 pr-1 pl-2 ring-1 ring-line"
            >
              <span
                aria-hidden="true"
                className="size-8 shrink-0 rounded-full ring-1 ring-line"
                style={{ background: fillToCss(themeFill(preset.theme)) }}
              />
              <div className="min-w-0 flex-1">
                <Switch
                  label={preset.name}
                  hint={`${preset.theme.gradient ? 'Gradient' : 'Color'}${preset.theme.dark ? ' · dark' : ''}`}
                  checked={same(preset)}
                  onChange={(on) => {
                    if (on) onApply(preset.theme)
                  }}
                />
              </div>
              {preset.theme.dark ? (
                <Moon size={14} aria-hidden="true" className="shrink-0 text-ink-muted" />
              ) : null}
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
          Set a color or gradient above, then add it as a preset to switch back to it any time.
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
          Add preset
        </Button>
      )}
    </div>
  )
}
