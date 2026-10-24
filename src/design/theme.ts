/**
 * Interface themes. The default look is tokens.css itself; a theme overrides its color tokens
 * on the root element, all derived from one accent color, so every component follows without
 * knowing about themes. The canvas reads the desk color from the same token.
 */

export interface ThemeSetting {
  /** The color the theme is built from; null for Broomit's own look. */
  accent: string | null
  dark: boolean
}

export const DEFAULT_THEME: ThemeSetting = { accent: null, dark: false }

export const THEME_PRESETS = [
  ['Mocha', null],
  ['Sage', '#6f9a5c'],
  ['Ocean', '#4a7fb5'],
  ['Rose', '#c4677f'],
  ['Lavender', '#8a73c4'],
  ['Terracotta', '#c2633f'],
  ['Graphite', '#6b6b6b'],
] as const

/** Broomit's own accent: the default theme in dark is built from it. */
const MOCHA = '#b98b65'
const KEY = 'broomit.theme'
/** Fired on window after a theme was applied. */
export const THEME_EVENT = 'broomit:theme'

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function hex([r, g, b]: number[]): string {
  return '#' + [r!, g!, b!].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
}

/** `a` with `amount` (0 to 1) of `b` mixed in. */
function mix(a: string, b: string, amount: number): string {
  const x = rgb(a)
  const y = rgb(b)
  return hex(x.map((v, i) => v + (y[i]! - v) * amount))
}

function alpha(color: string, a: number): string {
  const [r, g, b] = rgb(color)
  return `rgb(${r} ${g} ${b} / ${a})`
}

/** The color tokens of a theme, by token name without the `--color-` prefix. */
export function themeColors(setting: ThemeSetting): Record<string, string> | null {
  if (!setting.accent && !setting.dark) return null
  const accent = setting.accent ?? MOCHA
  const black = '#000000'
  const white = '#ffffff'
  if (setting.dark) {
    const surface = mix(accent, black, 0.86)
    const ink = mix(accent, white, 0.9)
    return {
      cream: surface,
      sand: mix(accent, black, 0.7),
      beige: mix(accent, black, 0.55),
      caramel: accent,
      mocha: mix(accent, white, 0.3),
      espresso: ink,
      surface,
      'surface-raised': mix(accent, black, 0.8),
      'surface-sunken': mix(accent, black, 0.9),
      desk: mix(accent, black, 0.92),
      ink,
      'ink-muted': mix(accent, white, 0.6),
      'ink-subtle': mix(accent, white, 0.3),
      'ink-inverse': surface,
      line: mix(accent, black, 0.68),
      'line-strong': mix(accent, black, 0.5),
      accent,
      hover: alpha(white, 0.08),
      pressed: alpha(white, 0.14),
      scrim: alpha(black, 0.5),
    }
  }
  const ink = mix(accent, black, 0.75)
  const surface = mix(accent, white, 0.92)
  return {
    cream: surface,
    sand: mix(accent, white, 0.75),
    beige: mix(accent, white, 0.55),
    caramel: accent,
    mocha: mix(accent, black, 0.35),
    espresso: ink,
    surface,
    'surface-raised': mix(accent, white, 0.97),
    'surface-sunken': mix(accent, white, 0.86),
    desk: mix(accent, white, 0.84),
    ink,
    'ink-muted': mix(accent, black, 0.55),
    'ink-subtle': mix(accent, white, 0.15),
    'ink-inverse': surface,
    line: mix(accent, white, 0.76),
    'line-strong': mix(accent, white, 0.56),
    accent,
    hover: alpha(ink, 0.06),
    pressed: alpha(ink, 0.1),
    scrim: alpha(mix(ink, black, 0.3), 0.32),
  }
}

const applied = new Set<string>()

/** Puts the theme on the page, or back to tokens.css for the default. */
export function applyTheme(setting: ThemeSetting): void {
  const root = document.documentElement
  for (const name of applied) root.style.removeProperty(`--color-${name}`)
  applied.clear()
  const colors = themeColors(setting)
  for (const [name, value] of Object.entries(colors ?? {})) {
    root.style.setProperty(`--color-${name}`, value)
    applied.add(name)
  }
  root.style.colorScheme = setting.dark ? 'dark' : 'light'
  const surface = getComputedStyle(root).getPropertyValue('--color-surface').trim()
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', surface)
  window.dispatchEvent(new Event(THEME_EVENT))
}

export function loadTheme(): ThemeSetting {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (value && typeof value === 'object') {
      const { accent, dark } = value as Record<string, unknown>
      return {
        accent: typeof accent === 'string' && /^#[0-9a-f]{6}$/i.test(accent) ? accent : null,
        dark: dark === true,
      }
    }
  } catch {
    // Unreadable: the default look.
  }
  return DEFAULT_THEME
}

export function saveTheme(setting: ThemeSetting): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(setting))
  } catch {
    // Private browsing or full storage: the theme applies until the app is closed.
  }
}
