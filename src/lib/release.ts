import { RELEASE, releaseLabel } from '../release.ts'
import { showNotice } from './notices.ts'

const SEEN_KEY = 'broomit.release'

/** Once after an update has loaded, says which version is now running. */
export function announceRelease(): void {
  try {
    const seen = localStorage.getItem(SEEN_KEY)
    localStorage.setItem(SEEN_KEY, String(RELEASE.number))
    if (seen !== null && seen !== String(RELEASE.number)) {
      showNotice(`Updated to ${releaseLabel()}`)
    }
  } catch {
    // Without storage there is nothing to compare with; the version shows on the home screen.
  }
}

/** The version that is published now (it may be newer than the one running), or null. */
export async function publishedRelease(): Promise<{ number: number; name: string } | null> {
  try {
    const response = await fetch('./release.json', { cache: 'no-store' })
    if (!response.ok) return null
    const value = (await response.json()) as { number?: unknown; name?: unknown }
    return typeof value.number === 'number' && typeof value.name === 'string'
      ? { number: value.number, name: value.name }
      : null
  } catch {
    return null
  }
}
