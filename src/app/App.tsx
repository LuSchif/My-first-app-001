export function App() {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-3 px-4">
      <h1 className="text-4xl font-semibold tracking-tight">Broomit</h1>
      <p className="text-ink-muted">Write. Organize. Create.</p>
      <nav className="mt-6 flex flex-wrap justify-center gap-3">
        <a
          href="./ink-test.html"
          className="rounded-control bg-ink px-5 py-3 font-semibold text-ink-inverse shadow-soft"
        >
          Open ink test
        </a>
        <a
          href="./design.html"
          className="rounded-control bg-surface-raised px-5 py-3 font-semibold text-ink ring-1 ring-line"
        >
          Design system
        </a>
      </nav>
    </main>
  )
}
