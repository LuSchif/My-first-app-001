import { User } from 'lucide-react'
import { initials } from './profile.ts'

/** The profile picture, or the name's initials, or a person outline, in a circle. */
export function Avatar({
  profile,
  size = 40,
}: {
  profile: { name: string; picture?: string | undefined }
  size?: number
}) {
  const letters = initials(profile.name)
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center overflow-hidden rounded-full bg-accent font-bold text-ink-inverse ring-2 ring-surface-raised"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {profile.picture ? (
        <img src={profile.picture} alt="" className="size-full object-cover" />
      ) : letters ? (
        letters
      ) : (
        <User size={size * 0.5} />
      )}
    </span>
  )
}
