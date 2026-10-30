import { navigate } from '../../app/router.ts'
import { Avatar } from './Avatar.tsx'
import { useProfile } from './profile.ts'

/** The round profile picture in the library's header; a tap opens the profile. */
export function ProfileButton() {
  const profile = useProfile()
  return (
    <button
      type="button"
      aria-label={profile.name ? `Profile: ${profile.name}` : 'Profile'}
      onClick={() => navigate({ name: 'profile' })}
      className="rounded-full shadow-soft transition-transform hover:scale-105 active:scale-95"
    >
      <Avatar profile={profile} size={44} />
    </button>
  )
}
