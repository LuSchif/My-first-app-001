import { formatDate, formatTime } from './decorations.ts'
import type { TextCommandSettings } from './types.ts'

/** What a text command's replacement says right now, with its placeholders filled in. */
export function expandReplacement(text: string, page: number, now = new Date()): string {
  return text
    .replaceAll('{date}', formatDate(now, 'long'))
    .replaceAll('{time}', formatTime(now))
    .replaceAll('{page}', String(page))
}

/**
 * Applies the first text command whose trigger was just typed (ends at `caret`): the new text
 * and caret, or null when none was.
 */
export function applyTextCommand(
  value: string,
  caret: number,
  commands: readonly TextCommandSettings[],
  page: number,
  now = new Date(),
): { value: string; caret: number } | null {
  const head = value.slice(0, caret)
  for (const c of commands) {
    const t = c.trigger
    if (!t) continue
    const hit = c.matchCase
      ? head.endsWith(t)
      : head.toLocaleLowerCase().endsWith(t.toLocaleLowerCase())
    if (!hit) continue
    const text = expandReplacement(c.replacement, page, now)
    const start = head.length - t.length
    return { value: value.slice(0, start) + text + value.slice(caret), caret: start + text.length }
  }
  return null
}
