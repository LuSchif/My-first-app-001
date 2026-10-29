/** Whether a draft differs from what it started as. */
export function changed(before: unknown, after: unknown): boolean {
  return JSON.stringify(before) !== JSON.stringify(after)
}
