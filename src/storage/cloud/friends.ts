import { useEffect, useState } from 'react'
import { useAccount, profileFromRow, type CloudProfile } from './account.ts'
import { cloud } from './client.ts'

/** A friend, or a request one way or the other. */
export interface Friend extends CloudProfile {
  status: 'friend' | 'incoming' | 'outgoing'
}

interface FriendshipRow {
  requester: string
  addressee: string
  status: 'pending' | 'accepted'
}

async function loadFriends(me: string): Promise<Friend[]> {
  const sb = await cloud()
  const { data: links, error } = await sb
    .from('friendships')
    .select('requester, addressee, status')
    .returns<FriendshipRow[]>()
  if (error) throw error
  const others = links.map((l) => (l.requester === me ? l.addressee : l.requester))
  if (!others.length) return []
  const { data: people, error: peopleError } = await sb
    .from('profiles')
    .select('id, broomit_id, name, picture')
    .in('id', others)
  if (peopleError) throw peopleError
  const byId = new Map(people.map((p) => [p.id as string, profileFromRow(p)]))
  return links
    .flatMap((l): Friend[] => {
      const other = l.requester === me ? l.addressee : l.requester
      const profile = byId.get(other)
      if (!profile) return []
      const status =
        l.status === 'accepted' ? 'friend' : l.requester === me ? 'outgoing' : 'incoming'
      return [{ ...profile, status }]
    })
    .sort((a, b) => (a.name || a.broomitId).localeCompare(b.name || b.broomitId))
}

const listeners = new Set<() => void>()
function changed(): void {
  for (const listener of listeners) listener()
}

/** Friends and requests of the signed-in account, kept up to date; null while loading. */
export function useFriends(): Friend[] | null {
  const account = useAccount()
  const me = account.status === 'signedIn' ? account.profile.id : null
  const [friends, setFriends] = useState<Friend[] | null>(null)
  useEffect(() => {
    if (!me) return
    let alive = true
    const load = () =>
      loadFriends(me)
        .then((list) => alive && setFriends(list))
        .catch((err: unknown) => console.error(err))
    void load()
    listeners.add(load)
    const channel = cloud().then((sb) =>
      sb
        .channel(`friends:${me}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, load)
        .subscribe(),
    )
    window.addEventListener('focus', load)
    // In case a live update was missed.
    const timer = setInterval(load, 15000)
    return () => {
      alive = false
      clearInterval(timer)
      listeners.delete(load)
      window.removeEventListener('focus', load)
      void channel.then((c) => c.unsubscribe())
    }
  }, [me])
  return me ? friends : null
}

/** Asks for a friendship by Broomit ID; 'friends' when they had already asked. */
export async function addFriend(code: string): Promise<'requested' | 'friends'> {
  const sb = await cloud()
  const { data, error } = await sb.rpc('add_friend', { code })
  if (error) throw error
  changed()
  return data as 'requested' | 'friends'
}

export async function answerFriend(other: string, accept: boolean): Promise<void> {
  const sb = await cloud()
  const { error } = await sb.rpc('answer_friend', { other, accept })
  if (error) throw error
  changed()
}

export async function removeFriend(other: string): Promise<void> {
  const sb = await cloud()
  const { error } = await sb.rpc('remove_friend', { other })
  if (error) throw error
  changed()
}

/** "k7q3xm2p" → "K7Q3-XM2P", as people type it. */
export function formatBroomitId(text: string): string {
  const clean = text
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8)
  return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean
}
