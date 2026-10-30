import {
  CalendarDays,
  Check,
  ChevronLeft,
  Clock,
  FlaskConical,
  LayoutTemplate,
  NotebookPen,
  Palette,
  Sparkles,
  Sticker,
  Target,
  Waypoints,
} from 'lucide-react'
import { createContext, useContext, useState } from 'react'
import { navigate } from '../../app/router.ts'
import { Button, Dialog, DialogContent } from '../../design/index.ts'
import { designPack, packImage, type DesignPack } from '../../design/packs.ts'
import { applyTheme, loadTheme, saveTheme } from '../../design/theme.ts'
import { cn } from '../../lib/cn.ts'
import { showNotice } from '../../lib/notices.ts'
import { CATEGORIES, PRODUCTS, priceLabel, type Product, type ProductKind } from './catalog.ts'
import { buy, realPayments, restorePurchases, usePurchases, useStorePrices } from './purchases.ts'

/**
 * The Broomit shop: design packs that restyle the whole app, and (coming soon) planners,
 * templates and design elements, free and paid.
 */
export function ShopView() {
  const purchases = usePurchases()
  const prices = useStorePrices()
  const [restoring, setRestoring] = useState(false)
  const owned = new Set(purchases.map((p) => p.productId))
  const [category, setCategory] = useState<ProductKind | 'all'>('all')
  const [open, setOpen] = useState<Product | null>(null)
  const [inUse, setInUse] = useState(() => loadTheme().pack ?? null)
  const packs = PRODUCTS.filter((p) => p.kind === 'design-pack')
  const shown = PRODUCTS.filter(
    (p) => p.kind !== 'plan' && (category === 'all' || p.kind === category),
  )

  const applyPack = (pack: DesignPack | null) => {
    const theme = { ...loadTheme(), pack: pack?.id ?? null }
    applyTheme(theme)
    saveTheme(theme)
    setInUse(pack?.id ?? null)
  }

  return (
    <PricesContext.Provider value={prices}>
      <div className="min-h-full px-4 pt-[calc(2rem+env(safe-area-inset-top))] pb-16 sm:px-8">
        <div className="mx-auto grid max-w-6xl gap-8">
          <header className="grid gap-4">
            <button
              type="button"
              onClick={() => navigate({ name: 'library' })}
              className="flex items-center gap-1 justify-self-start rounded-control py-1 pr-2 text-sm font-semibold text-ink-muted hover:bg-hover"
            >
              <ChevronLeft size={18} /> Library
            </button>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="grid gap-1">
                <h1 className="text-4xl font-bold tracking-tight">Shop</h1>
                <p className="text-ink-muted">
                  Design packs, planners, templates and design elements. Some free, some paid.
                </p>
              </div>
            </div>
            {realPayments() ? (
              <Button
                className="justify-self-start"
                disabled={restoring}
                onClick={() => {
                  setRestoring(true)
                  restorePurchases()
                    .then(() => showNotice('Your purchases are restored.'))
                    .catch((err: unknown) => {
                      console.error(err)
                      showNotice('Purchases could not be restored. Check your connection.')
                    })
                    .finally(() => setRestoring(false))
                }}
              >
                Restore purchases
              </Button>
            ) : (
              <p className="flex items-start gap-2 rounded-card bg-surface-raised p-3 text-sm text-ink-muted ring-1 ring-line">
                <FlaskConical size={18} className="mt-0.5 shrink-0 text-accent" />
                <span>
                  Test mode: in the browser, buying unlocks an item on this device without charging
                  anything. Real purchases are made in the Broomit app from the App Store.
                </span>
              </p>
            )}
          </header>

          <section className="grid gap-4" aria-label="Design packs">
            <h2 className="text-xs font-semibold tracking-[0.14em] text-ink-muted uppercase">
              Design packs
            </h2>
            <ul className="grid gap-4 md:grid-cols-3">
              {packs.map((product) => {
                const pack = designPack(product.pack)!
                return (
                  <li key={product.id}>
                    <PackCard
                      product={product}
                      pack={pack}
                      owned={owned.has(product.id)}
                      inUse={inUse === pack.id}
                      onOpen={() => setOpen(product)}
                    />
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="grid gap-4" aria-label="Everything">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xs font-semibold tracking-[0.14em] text-ink-muted uppercase">
                Everything
              </h2>
              <div role="tablist" aria-label="Categories" className="flex flex-wrap gap-1">
                {CATEGORIES.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={category === value}
                    onClick={() => setCategory(value)}
                    className="h-9 rounded-full px-3 text-sm font-semibold text-ink-muted ring-1 ring-line hover:bg-hover aria-selected:bg-ink aria-selected:text-ink-inverse aria-selected:ring-ink"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-4">
              {shown.map((product) => (
                <li key={product.id}>
                  <ProductCard
                    product={product}
                    owned={owned.has(product.id)}
                    onOpen={() => setOpen(product)}
                  />
                </li>
              ))}
            </ul>
          </section>
        </div>

        <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
          {open ? (
            <ProductDetails
              product={open}
              owned={owned.has(open.id)}
              inUse={open.pack !== undefined && inUse === open.pack}
              onBuy={async () => {
                const result = await buy(open).catch((err: unknown) => {
                  console.error(err)
                  showNotice('The purchase did not go through. Nothing was charged.')
                  return 'failed' as const
                })
                if (result === 'pending') {
                  showNotice(
                    'The purchase waits for approval. It unlocks as soon as it is approved.',
                  )
                }
                if (result !== 'purchased') return
                const pack = designPack(open.pack)
                if (pack) applyPack(pack)
                showNotice(
                  pack ? `${pack.name} is yours, and now in use.` : `${open.name} is yours.`,
                )
              }}
              onUse={(use) => applyPack(use ? (designPack(open.pack) ?? null) : null)}
            />
          ) : null}
        </Dialog>
      </div>
    </PricesContext.Provider>
  )
}

/** A design pack, large: its wallpaper, colors and what it costs (or that it is yours). */
/** The App Store's prices in the app (in the buyer's currency); the catalog's elsewhere. */
const PricesContext = createContext<Map<string, string>>(new Map())

function usePrice(product: Product): string {
  return useContext(PricesContext).get(product.id) ?? priceLabel(product.price)
}

function PackCard({
  product,
  pack,
  owned,
  inUse,
  onOpen,
}: {
  product: Product
  pack: DesignPack
  owned: boolean
  inUse: boolean
  onOpen: () => void
}) {
  const price = usePrice(product)
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${product.name}, ${owned ? 'owned' : price}`}
      className="group grid w-full overflow-hidden rounded-card bg-surface-raised text-left shadow-soft ring-1 ring-line transition-transform duration-200 ease-gentle hover:-translate-y-0.5"
    >
      <span className="relative block aspect-[3/2] overflow-hidden">
        <img
          src={packImage(pack.thumb)}
          alt=""
          className="size-full object-cover transition-transform duration-500 ease-gentle group-hover:scale-105"
        />
        {inUse ? (
          <span className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-surface-raised/90 px-2.5 py-1 text-xs font-semibold shadow-soft">
            <Check size={14} /> In use
          </span>
        ) : null}
      </span>
      <span className="grid gap-2 p-4">
        <span className="flex items-center justify-between gap-2">
          <span className="text-lg font-bold">{product.name}</span>
          <PriceTag product={product} owned={owned} />
        </span>
        <span className="line-clamp-2 text-sm text-ink-muted">{pack.tagline}</span>
        <Palette6 pack={pack} />
      </span>
    </button>
  )
}

function Palette6({ pack, large = false }: { pack: DesignPack; large?: boolean }) {
  return (
    <span className={cn('flex flex-wrap', large ? 'gap-3' : 'gap-1.5')}>
      {pack.palette.map((swatch) => (
        <span key={swatch.color} className="grid justify-items-center gap-1">
          <span
            title={swatch.name}
            className={cn('rounded-full ring-1 ring-line', large ? 'size-10' : 'size-5')}
            style={{ background: swatch.color }}
          />
          {large ? (
            <span className="text-[10px] leading-tight text-ink-muted">
              {swatch.name}
              <br />
              {swatch.color.toUpperCase()}
            </span>
          ) : null}
        </span>
      ))}
    </span>
  )
}

function PriceTag({ product, owned }: { product: Product; owned: boolean }) {
  const price = usePrice(product)
  if (owned) {
    return (
      <span className="flex shrink-0 items-center gap-1 rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-semibold">
        <Check size={14} /> Owned
      </span>
    )
  }
  return (
    <span className="shrink-0 rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-ink-inverse">
      {price}
    </span>
  )
}

const ART_ICONS = {
  calendar: CalendarDays,
  notebook: NotebookPen,
  sticker: Sticker,
  tape: Waypoints,
  target: Target,
  clock: Clock,
  layout: LayoutTemplate,
} as const

/** Any product in the grid; items that are not ready yet say so. */
function ProductCard({
  product,
  owned,
  onOpen,
}: {
  product: Product
  owned: boolean
  onOpen: () => void
}) {
  const price = usePrice(product)
  const pack = designPack(product.pack)
  const soon = product.status === 'coming-soon'
  return (
    <button
      type="button"
      onClick={onOpen}
      className="grid h-full w-full overflow-hidden rounded-card bg-surface-raised text-left shadow-soft ring-1 ring-line transition-transform duration-200 ease-gentle hover:-translate-y-0.5"
    >
      <ProductArt product={product} pack={pack} />
      <span className="grid content-start gap-1 p-3">
        <span className="flex items-start justify-between gap-2">
          <span className="font-semibold">{product.name}</span>
          {soon ? null : <PriceTag product={product} owned={owned} />}
        </span>
        <span className="line-clamp-2 text-sm text-ink-muted">{product.description}</span>
        {soon ? (
          <span className="mt-1 text-xs font-semibold text-ink-subtle">Coming soon · {price}</span>
        ) : null}
      </span>
    </button>
  )
}

function ProductArt({ product, pack }: { product: Product; pack: DesignPack | undefined }) {
  if (pack) {
    return <img src={packImage(pack.thumb)} alt="" className="aspect-[3/2] w-full object-cover" />
  }
  const art = product.art
  const Icon = art ? ART_ICONS[art.icon] : Sparkles
  return (
    <span
      aria-hidden="true"
      className="relative grid aspect-[3/2] w-full place-items-center"
      style={{
        background: art ? `linear-gradient(135deg, ${art.from}, ${art.to})` : undefined,
      }}
    >
      <Icon size={44} strokeWidth={1.5} className="text-white drop-shadow" />
      {product.status === 'coming-soon' ? (
        <span className="absolute top-2 left-2 rounded-full bg-surface-raised/90 px-2.5 py-1 text-xs font-semibold text-ink shadow-soft">
          Coming soon
        </span>
      ) : null}
    </span>
  )
}

/** One product, large: for a design pack its wallpaper, colors, what changes, and buying. */
function ProductDetails({
  product,
  owned,
  inUse,
  onBuy,
  onUse,
}: {
  product: Product
  owned: boolean
  inUse: boolean
  onBuy: () => Promise<void>
  onUse: (use: boolean) => void
}) {
  const price = usePrice(product)
  const [busy, setBusy] = useState(false)
  const pack = designPack(product.pack)
  const soon = product.status === 'coming-soon'
  return (
    <DialogContent title={product.name} className="w-[min(44rem,calc(100%-2rem))]">
      <div className="grid gap-5">
        <div className="overflow-hidden rounded-card ring-1 ring-line">
          {pack ? (
            <img
              src={packImage(pack.wallpaper)}
              alt=""
              className="aspect-[3/2] w-full object-cover"
            />
          ) : (
            <ProductArt product={product} pack={undefined} />
          )}
        </div>
        <p className="text-ink-muted">{product.description}</p>
        {pack ? (
          <>
            <div className="grid gap-2">
              <p className="text-sm font-semibold">Colors</p>
              <Palette6 pack={pack} large />
            </div>
            <div className="grid gap-2">
              <p className="text-sm font-semibold">What you get</p>
              <ul className="grid gap-1.5 text-sm text-ink-muted">
                {[
                  'The wallpaper behind the home screen, folders and the shop',
                  'Every button, panel, menu and dialog in its colors',
                  'The calendar and the editor in the same look',
                  'Switch between your packs any time in Appearance',
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <Palette size={16} className="mt-0.5 shrink-0 text-accent" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : null}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
          {soon ? (
            <span className="text-sm font-semibold text-ink-muted">Coming soon · {price}</span>
          ) : owned ? (
            pack ? (
              inUse ? (
                <>
                  <span className="mr-auto flex items-center gap-1 text-sm font-semibold">
                    <Check size={16} /> In use
                  </span>
                  <Button onClick={() => onUse(false)}>Back to Broomit's look</Button>
                </>
              ) : (
                <Button variant="primary" onClick={() => onUse(true)}>
                  Use this look
                </Button>
              )
            ) : (
              <span className="text-sm font-semibold">Owned</span>
            )
          ) : (
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => {
                setBusy(true)
                void onBuy().finally(() => setBusy(false))
              }}
            >
              {product.price ? `Buy for ${price}` : 'Get it free'}
            </Button>
          )}
        </div>
      </div>
    </DialogContent>
  )
}
