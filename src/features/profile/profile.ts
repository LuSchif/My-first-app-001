import { useEffect, useState } from 'react'
import { db } from '../../storage/db.ts'

/** The person using Broomit on this device: a name and a picture, kept in backups. */
export interface Profile {
  id: 'me'
  name: string
  /** A small square JPEG data URL, or none. */
  picture?: string
}

const EMPTY: Profile = { id: 'me', name: '' }
const listeners = new Set<(profile: Profile) => void>()

export async function saveProfile(patch: Partial<Omit<Profile, 'id'>>): Promise<Profile> {
  const current = (await db.profile.get('me')) ?? EMPTY
  const next: Profile = { ...current, ...patch, id: 'me' }
  if (!next.picture) delete next.picture
  await db.profile.put(next)
  for (const listener of listeners) listener(next)
  return next
}

/** The profile, kept up to date. */
export function useProfile(): Profile {
  const [profile, setProfile] = useState<Profile>(EMPTY)
  useEffect(() => {
    let alive = true
    db.profile
      .get('me')
      .then((p) => alive && p && setProfile(p))
      .catch((err: unknown) => console.error(err))
    const listener = (p: Profile) => setProfile(p)
    listeners.add(listener)
    return () => {
      alive = false
      listeners.delete(listener)
    }
  }, [])
  return profile
}

/** "Luis Schiffter" → "LS"; nothing for an empty name. */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toLocaleUpperCase())
    .join('')
}
