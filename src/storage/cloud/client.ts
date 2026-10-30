import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * The Broomit server (Supabase): accounts, friends and quizzes played with friends. Notebooks
 * stay on the device. The address and the public key come from the build (VITE_SUPABASE_URL,
 * VITE_SUPABASE_KEY) or from the values below; the key is public by design, every table is
 * guarded by row level security (see supabase/migrations).
 */
const URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? ''
const KEY = (import.meta.env.VITE_SUPABASE_KEY as string | undefined) ?? ''

/** Whether this build knows a Broomit server; without one, account features stay hidden. */
export function cloudAvailable(): boolean {
  return Boolean(URL && KEY)
}

let client: Promise<SupabaseClient> | null = null

/** The server's client, loaded on first use so the app starts without it. */
export function cloud(): Promise<SupabaseClient> {
  if (!cloudAvailable()) return Promise.reject(new Error('No Broomit server is set up.'))
  client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(URL, KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'broomit.account' },
    }),
  )
  return client
}

/** A readable message for a failed server call. */
export function cloudError(err: unknown): string {
  if (!navigator.onLine) return 'You are offline. Try again when you are online.'
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message
  }
  return 'Something went wrong. Please try again.'
}
