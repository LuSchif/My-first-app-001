import { Camera, Check, ChevronLeft, Crown, Infinity as Forever, Store, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { navigate } from '../../app/router.ts'
import { Button, TextField } from '../../design/index.ts'
import { releaseLabel } from '../../release.ts'
import { cn } from '../../lib/cn.ts'
import { showNotice } from '../../lib/notices.ts'
import { AppearanceMenu } from '../library/AppearanceMenu.tsx'
import { BackupMenu } from '../library/KeepSafe.tsx'
import { PRODUCTS, priceLabel, type Product } from '../shop/catalog.ts'
import {
  buy,
  manageSubscription,
  realPayments,
  restorePurchases,
  usePurchases,
  useStorePrices,
} from '../shop/purchases.ts'
import { AccountCard } from './AccountCard.tsx'
import { Avatar } from './Avatar.tsx'
import { FriendsCard } from './FriendsCard.tsx'
import { GamesCard } from './GamesCard.tsx'
import { ProfileCard } from './ProfileCard.tsx'
import { avatarPicture } from './avatarPicture.ts'
import { saveProfile, useProfile } from './profile.ts'

/** The profile: name and picture, the Broomit plan, and settings. */
export function ProfileView() {
  return (
    <div className="min-h-full px-4 pt-[calc(2rem+env(safe-area-inset-top))] pb-16 sm:px-8">
      <div className="mx-auto grid max-w-3xl gap-8">
        <button
          type="button"
          onClick={() => navigate({ name: 'library' })}
          className="flex items-center gap-1 justify-self-start rounded-control py-1 pr-2 text-sm font-semibold text-ink-muted hover:bg-hover"
        >
          <ChevronLeft size={18} /> Library
        </button>
        <h1 className="text-4xl font-bold tracking-tight">Profile</h1>
        <You />
        <AccountCard />
        <FriendsCard />
        <GamesCard />
        <Plan />
        <Settings />
      </div>
    </div>
  )
}

/** Name and picture. */
function You() {
  const profile = useProfile()
  const [name, setName] = useState<string | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const shown = name ?? profile.name
  return (
    <ProfileCard title="You">
      <div className="flex flex-wrap items-center gap-5">
        <button
          type="button"
          onClick={() => file.current?.click()}
          aria-label={profile.picture ? 'Change your picture' : 'Add a picture'}
          className="group relative rounded-full"
        >
          <Avatar profile={profile} size={96} />
          <span className="absolute right-0 bottom-0 grid size-9 place-items-center rounded-full bg-ink text-ink-inverse shadow-soft ring-2 ring-surface-raised">
            <Camera size={18} />
          </span>
        </button>
        <input
          ref={file}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const picked = e.target.files?.[0]
            e.target.value = ''
            if (!picked) return
            avatarPicture(picked)
              .then((picture) => saveProfile({ picture }))
              .catch((err: unknown) => {
                console.error(err)
                showNotice('The picture could not be used.')
              })
          }}
        />
        <form
          className="grid min-w-[14rem] flex-1 gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            void saveProfile({ name: shown.trim() }).then(() => {
              setName(null)
              showNotice('Your name is saved.')
            })
          }}
        >
          <TextField
            label="Your name"
            placeholder="e.g. Luis"
            value={shown}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              variant="primary"
              disabled={name === null || name.trim() === profile.name}
            >
              Save name
            </Button>
            {profile.picture ? (
              <Button
                variant="ghost"
                icon={<Trash2 size={18} />}
                onClick={() => void saveProfile({ picture: undefined })}
              >
                Remove picture
              </Button>
            ) : null}
          </div>
        </form>
      </div>
    </ProfileCard>
  )
}

/** The Broomit plan: what is active, and buying it once or yearly. */
function Plan() {
  const purchases = usePurchases()
  const prices = useStorePrices()
  const [busy, setBusy] = useState<string | null>(null)
  const plans = PRODUCTS.filter((p) => p.kind === 'plan')
  const owned = (p: Product) => purchases.find((x) => x.productId === p.id)
  const active = plans.find((p) => owned(p))
  const test = active ? owned(active)?.test : false
  const priceOf = (p: Product) =>
    `${prices.get(p.id) ?? priceLabel(p.price)}${p.yearly ? ' / year' : ''}`
  const get = (p: Product) => {
    setBusy(p.id)
    buy(p)
      .then((result) => {
        if (result === 'purchased') showNotice(`${p.name} is active. Thank you!`)
        if (result === 'pending') showNotice('The purchase waits for approval.')
      })
      .catch((err: unknown) => {
        console.error(err)
        showNotice('The purchase did not go through. Nothing was charged.')
      })
      .finally(() => setBusy(null))
  }
  return (
    <ProfileCard title="Your plan">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'grid size-12 place-items-center rounded-full',
            active ? 'bg-accent text-ink-inverse' : 'bg-surface-sunken text-ink-muted',
          )}
        >
          <Crown size={24} />
        </span>
        <div>
          <p className="text-lg font-bold">{active ? active.name : 'Broomit Free'}</p>
          <p className="text-sm text-ink-muted">
            {active
              ? active.yearly
                ? 'Renews every year.'
                : 'Bought once, yours for good.'
              : 'Choose a plan: once for good, or yearly.'}
            {test ? ' Test purchase in the browser; nothing was charged.' : ''}
          </p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {plans.map((p) => {
          const mine = owned(p)
          return (
            <div
              key={p.id}
              className={cn(
                'grid content-between gap-3 rounded-card p-4 ring-1 ring-line',
                mine && 'ring-2 ring-accent',
              )}
            >
              <div className="grid gap-1">
                <p className="flex items-center gap-2 font-bold">
                  {p.yearly ? <Crown size={18} /> : <Forever size={18} />}
                  {p.name}
                </p>
                <p className="text-2xl font-bold tabular-nums">{priceOf(p)}</p>
                <p className="text-sm text-ink-muted">{p.description}</p>
              </div>
              {mine ? (
                <p className="flex items-center gap-1.5 text-sm font-semibold text-correct">
                  <Check size={16} /> Active
                </p>
              ) : (
                <Button
                  variant={p.yearly ? 'secondary' : 'primary'}
                  disabled={busy !== null || (active !== undefined && !active.yearly)}
                  onClick={() => get(p)}
                >
                  {p.yearly ? 'Subscribe' : 'Buy once'}
                </Button>
              )}
            </div>
          )
        })}
      </div>
      {realPayments() ? (
        <div className="flex flex-wrap gap-2">
          {active?.yearly ? (
            <Button
              onClick={() =>
                manageSubscription().catch((err: unknown) => {
                  console.error(err)
                  showNotice('The subscription settings could not be opened.')
                })
              }
            >
              Manage subscription
            </Button>
          ) : null}
          <Button
            variant="ghost"
            onClick={() =>
              restorePurchases()
                .then(() => showNotice('Your purchases are restored.'))
                .catch((err: unknown) => {
                  console.error(err)
                  showNotice('Purchases could not be restored. Check your connection.')
                })
            }
          >
            Restore purchases
          </Button>
        </div>
      ) : (
        <p className="text-xs text-ink-muted">
          In the browser, buying is a test that charges nothing. Real purchases are made in the
          Broomit app from the App Store.
        </p>
      )}
    </ProfileCard>
  )
}

function Settings() {
  return (
    <ProfileCard title="Settings">
      <ul className="grid divide-y divide-line">
        <Row label="Interface colors" hint="Colors, your own presets and design packs">
          <AppearanceMenu />
        </Row>
        <Row label="Backup" hint="Save everything to a file, or bring it back">
          <BackupMenu onRestored={() => showNotice('Your backup is restored.')} />
        </Row>
        <Row label="Shop" hint="Design packs, planners and templates">
          <Button icon={<Store size={18} />} onClick={() => navigate({ name: 'shop' })}>
            Open
          </Button>
        </Row>
        <Row label="Version" hint="The version running now">
          <span className="text-sm font-semibold">{releaseLabel()}</span>
        </Row>
      </ul>
    </ProfileCard>
  )
}

function Row({
  label,
  hint,
  children,
}: {
  label: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <span>
        <span className="block font-semibold">{label}</span>
        <span className="block text-sm text-ink-muted">{hint}</span>
      </span>
      {children}
    </li>
  )
}
