import type { ThemeSetting } from '../../design/theme.ts'

/** Interface looks the user named and saved, to switch back to later (kept on this device). */
export interface ThemePreset {
  name: string
  theme: ThemeSetting
}

const KEY = 'broomit.themePresets'
const LIMIT = 24

export function loadThemePresets(): ThemePreset[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(value) ? value.filter(isPreset) : []
  } catch {
    return []
  }
}

/** Adds a preset at the end (its name is already unique). */
export function saveThemePreset(preset: ThemePreset): ThemePreset[] {
  const next = [...loadThemePresets(), preset].slice(-LIMIT)
  write(next)
  return next
}

export function removeThemePreset(name: string): ThemePreset[] {
  const next = loadThemePresets().filter((p) => p.name !== name)
  write(next)
  return next
}

function write(presets: ThemePreset[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(presets))
  } catch {
    // Not stored; the look still applies now.
  }
}

function isPreset(value: unknown): value is ThemePreset {
  if (!value || typeof value !== 'object') return false
  const { name, theme } = value as { name?: unknown; theme?: { accent?: unknown; dark?: unknown } }
  return (
    typeof name === 'string' &&
    !!theme &&
    (theme.accent === null || typeof theme.accent === 'string') &&
    typeof theme.dark === 'boolean'
  )
}
