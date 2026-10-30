/** A section of the profile page. */
export function ProfileCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 rounded-panel bg-surface-raised p-5 shadow-soft ring-1 ring-line sm:p-6">
      <h2 className="text-xs font-semibold tracking-[0.14em] text-ink-muted uppercase">{title}</h2>
      {children}
    </section>
  )
}
