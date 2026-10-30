import { useSyncExternalStore } from 'react'
import { cloud, cloudAvailable } from './client.ts'

/**
 * The Broomit account: signed in with a code sent by email (no password), it has a Broomit
 * ID friends add each other with, and the name and picture from the profile.
 */

export interface CloudProfile {
  id: string
  broomitId: string
  name: string
  picture?: string
}

export type Account =
  | { status: 'unavailable' }
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; email: string; profile: CloudProfile }

interface ProfileRow {
  id: string
  broomit_id: string
  name: string
  picture: string | null
}

export function profileFromRow(row: ProfileRow): CloudProfile {
  return {
    id: row.id,
    broomitId: row.broomit_id,
    name: row.name,
    ...(row.picture ? { picture: row.picture } : {}),
  }
}

let current: Account = cloudAvailable() ? { status: 'loading' } : { status: 'unavailable' }
const listeners = new Set<() => void>()
function set(next: Account): void {
  current = next
  for (const listener of listeners) listener()
}

let started = false
/** Follows the sign-in state, once. */
function start(): void {
  if (started || !cloudAvailable()) return
  started = true
  void cloud().then((sb) => {
    sb.auth.onAuthStateChange((event, session) => {
      if (!session) {
        set({ status: 'signedOut' })
        return
      }
      if (event === 'TOKEN_REFRESHED' && current.status === 'signedIn') return
      // Not awaited inside the callback: Supabase holds a lock while it runs.
      setTimeout(() => void refresh(session.user.id, session.user.email ?? ''), 0)
    })
  })
}

async function refresh(userId: string, email: string): Promise<void> {
  const sb = await cloud()
  const { data, error } = await sb
    .from('profiles')
    .select('id, broomit_id, name, picture')
    .eq('id', userId)
    .single<ProfileRow>()
  if (error) {
    console.error(error)
    return
  }
  set({ status: 'signedIn', email, profile: profileFromRow(data) })
}

function subscribe(listener: () => void): () => void {
  start()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The account, kept up to date. */
export function useAccount(): Account {
  return useSyncExternalStore(subscribe, () => current)
}

export function accountNow(): Account {
  return current
}

/** Sends a sign-in code to an email address; a new address gets a new account. */
export async function sendCode(email: string): Promise<void> {
  const sb = await cloud()
  const { error } = await sb.auth.signInWithOtp({
    email: email.trim(),
    options: { shouldCreateUser: true },
  })
  if (error) throw error
}

/** Signs in with the code from the email. */
export async function verifyCode(email: string, code: string): Promise<void> {
  const sb = await cloud()
  const { error } = await sb.auth.verifyOtp({
    email: email.trim(),
    token: code.replace(/\s/g, ''),
    type: 'email',
  })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  const sb = await cloud()
  const { error } = await sb.auth.signOut()
  if (error) throw error
}

/** Deletes the account on the server, with its friendships and games; notebooks stay. */
export async function deleteAccount(): Promise<void> {
  const sb = await cloud()
  const { error } = await sb.rpc('delete_account')
  if (error) throw error
  await sb.auth.signOut({ scope: 'local' })
}

/** Sends the profile's name and picture to the account, so friends see them. */
export async function shareProfile(name: string, picture: string | undefined): Promise<void> {
  if (current.status !== 'signedIn') return
  const sb = await cloud()
  const { error } = await sb.rpc('update_profile', {
    new_name: name,
    new_picture: picture ?? null,
  })
  if (error) throw error
  const { picture: _old, ...rest } = current.profile
  set({ ...current, profile: { ...rest, name, ...(picture ? { picture } : {}) } })
}
