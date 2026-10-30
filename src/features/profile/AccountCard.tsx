import { Copy, LogOut, Mail, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button, Dialog, DialogContent, DialogFooter, TextField } from '../../design/index.ts'
import { showNotice } from '../../lib/notices.ts'
import {
  deleteAccount,
  sendCode,
  signOut,
  useAccount,
  verifyCode,
} from '../../storage/cloud/account.ts'
import { cloudError } from '../../storage/cloud/client.ts'
import { ProfileCard } from './ProfileCard.tsx'

/**
 * The Broomit account: signing in with a code by email, then the Broomit ID friends use to
 * add you. Hidden when this build has no Broomit server.
 */
export function AccountCard() {
  const account = useAccount()
  if (account.status === 'unavailable') return null
  return (
    <ProfileCard title="Broomit account">
      {account.status === 'loading' ? (
        <p className="text-sm text-ink-muted">Loading your account…</p>
      ) : account.status === 'signedOut' ? (
        <SignIn />
      ) : (
        <SignedIn email={account.email} broomitId={account.profile.broomitId} />
      )}
    </ProfileCard>
  )
}

function SignIn() {
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = (work: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    work()
      .catch((err: unknown) => setError(cloudError(err)))
      .finally(() => setBusy(false))
  }

  if (sentTo === null) {
    return (
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          const address = email.trim()
          if (!address) return
          run(() => sendCode(address).then(() => setSentTo(address)))
        }}
      >
        <p className="text-sm text-ink-muted">
          Sign in to get your Broomit ID, add friends and play quizzes together. No password: we
          email you a code. Your notebooks stay on this iPad.
        </p>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          error={error ?? undefined}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button
          type="submit"
          variant="primary"
          icon={<Mail size={18} />}
          disabled={busy || !email.includes('@')}
          className="justify-self-start"
        >
          {busy ? 'Sending…' : 'Email me a code'}
        </Button>
      </form>
    )
  }

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        run(() => verifyCode(sentTo, code).then(() => showNotice('You are signed in.')))
      }}
    >
      <p className="text-sm text-ink-muted">
        We sent a code to <span className="font-semibold text-ink">{sentTo}</span>. It can take a
        minute; check the spam folder too.
      </p>
      <TextField
        label="Code from the email"
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="123456"
        maxLength={10}
        value={code}
        error={error ?? undefined}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        className="text-xl tracking-[0.3em] tabular-nums"
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" disabled={busy || code.length < 6}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => {
            setSentTo(null)
            setCode('')
            setError(null)
          }}
        >
          Use another email
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => run(() => sendCode(sentTo))}>
          Send a new code
        </Button>
      </div>
    </form>
  )
}

function SignedIn({ email, broomitId }: { email: string; broomitId: string }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-surface-sunken p-4">
        <div>
          <p className="text-xs font-semibold text-ink-muted">Your Broomit ID</p>
          <p className="font-mono text-3xl font-bold tracking-wider" data-broomit-id={broomitId}>
            {broomitId}
          </p>
          <p className="text-xs text-ink-muted">Friends add you with it.</p>
        </div>
        <Button
          icon={<Copy size={18} />}
          onClick={() =>
            navigator.clipboard
              .writeText(broomitId)
              .then(() => showNotice('Your Broomit ID is copied.'))
              .catch(() => showNotice('Copying is not allowed here.'))
          }
        >
          Copy
        </Button>
      </div>
      <p className="text-sm text-ink-muted">
        Signed in as <span className="font-semibold text-ink">{email}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          icon={<LogOut size={18} />}
          onClick={() =>
            signOut()
              .then(() => showNotice('You are signed out.'))
              .catch((err: unknown) => showNotice(cloudError(err)))
          }
        >
          Sign out
        </Button>
        <Button variant="ghost" icon={<Trash2 size={18} />} onClick={() => setConfirming(true)}>
          Delete account
        </Button>
      </div>
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent
          title="Delete your Broomit account?"
          description="Your Broomit ID, friends and games with friends are deleted for good. Your notebooks, quizzes and purchases on this iPad stay."
        >
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => {
                setBusy(true)
                deleteAccount()
                  .then(() => {
                    setConfirming(false)
                    showNotice('Your account is deleted.')
                  })
                  .catch((err: unknown) => showNotice(cloudError(err)))
                  .finally(() => setBusy(false))
              }}
            >
              Delete account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
