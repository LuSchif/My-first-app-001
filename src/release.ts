/**
 * This version of Broomit: shown on the home screen, in the editor's control center and in the
 * update banner, so it is clear which version is running. Every published version gets the next
 * number and a name of its own (see CLAUDE.md); the build copies it to `release.json`, which
 * the running app reads to name the version an update brings.
 */
export const RELEASE = { number: 6, name: 'Picture Frame' } as const

export function releaseLabel(release: { number: number; name: string } = RELEASE): string {
  return `Version ${release.number} · ${release.name}`
}
