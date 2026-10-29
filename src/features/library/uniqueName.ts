/**
 * Names are unique among their kind (folders, notebooks, groups of a page, …): a name that is
 * taken gets the next free number, e.g. "Mathe 2". Case and surrounding spaces do not count.
 */
export function uniqueName(name: string, taken: Iterable<string>): string {
  const trimmed = name.trim()
  const used = new Set([...taken].map(key))
  if (!used.has(key(trimmed))) return trimmed
  // "Mathe 2" taken too: count on from the base name.
  const base = trimmed.replace(/\s+\d+$/, '') || trimmed
  for (let n = 2; ; n++) {
    const candidate = `${base} ${n}`
    if (!used.has(key(candidate))) return candidate
  }
}

function key(name: string): string {
  return name.trim().toLocaleLowerCase()
}
