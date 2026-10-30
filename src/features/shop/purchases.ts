import { registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import { useEffect, useState } from 'react'
import { designPack } from '../../design/packs.ts'
import { applyTheme, loadTheme, saveTheme } from '../../design/theme.ts'
import { isNativeApp } from '../../lib/install.ts'
import { db } from '../../storage/db.ts'
import { PRODUCTS, type Product, type Purchase } from './catalog.ts'

/**
 * Buying in the shop. In the App Store app, purchases go through Apple (StoreKit 2, in
 * `ios/App/App/Store.swift`): Apple shows its purchase sheet, signs the transaction, and the
 * app asks StoreKit what is owned. In a browser there is no App Store: buying is a test
 * purchase, unlocked on that device, marked `test`, and nothing is charged. Test purchases
 * never count in the app.
 */

interface StorePlugin {
  products(options: { ids: string[] }): Promise<{
    products: { id: string; title: string; price: string }[]
  }>
  buy(options: { id: string }): Promise<{ status: 'purchased' | 'pending' | 'cancelled' }>
  owned(): Promise<{ ids: string[] }>
  restore(): Promise<{ ids: string[] }>
  manage(): Promise<void>
  addListener(event: 'changed', listener: () => void): Promise<PluginListenerHandle>
}

const Store = registerPlugin<StorePlugin>('Store')

/** Whether purchases are real (the App Store app) rather than tests (a browser). */
export function realPayments(): boolean {
  return isNativeApp()
}

export type BuyResult = 'purchased' | 'pending' | 'cancelled'

const listeners = new Set<() => void>()
function changed(): void {
  for (const listener of listeners) listener()
}

/** Buys (or, if free, takes) a product. */
export async function buy(product: Product): Promise<BuyResult> {
  if (product.status !== 'available') return 'cancelled'
  if (product.price > 0 && realPayments()) {
    if (!product.appStoreId) throw new Error('This item is not in the App Store yet.')
    const { status } = await Store.buy({ id: product.appStoreId })
    if (status === 'purchased') await syncWithStore()
    return status
  }
  const purchase: Purchase = {
    productId: product.id,
    at: Date.now(),
    test: product.price > 0,
  }
  await db.purchases.put(purchase)
  changed()
  return 'purchased'
}

/**
 * Makes the stored purchases match what the App Store says is owned: new ones (bought on
 * another iPad, restored, approved later) are added, refunded ones removed. A design pack in
 * use that is no longer owned is taken off.
 */
export async function syncWithStore(restore = false): Promise<void> {
  if (!realPayments()) return
  const { ids } = restore ? await Store.restore() : await Store.owned()
  const owned = new Set(ids)
  const stored = new Map((await db.purchases.toArray()).map((p) => [p.productId, p]))
  for (const product of PRODUCTS) {
    if (!product.appStoreId) continue
    const has = owned.has(product.appStoreId)
    const record = stored.get(product.id)
    if (has && (!record || record.test)) {
      await db.purchases.put({ productId: product.id, at: Date.now(), test: false })
    } else if (!has && record && !record.test) {
      await db.purchases.delete(product.id)
    }
  }
  const theme = loadTheme()
  const pack = designPack(theme.pack)
  if (pack && !owned.has(PRODUCTS.find((p) => p.pack === pack.id)?.appStoreId ?? '')) {
    const next = { ...theme, pack: null }
    applyTheme(next)
    saveTheme(next)
  }
  changed()
}

/** Apple's own sheet to change or cancel a subscription (in the app). */
export function manageSubscription(): Promise<void> {
  return Store.manage()
}

/** "Restore purchases": asks the App Store again for everything bought with this Apple ID. */
export function restorePurchases(): Promise<void> {
  return syncWithStore(true)
}

/** Once at start in the app: catches up with the App Store, and follows later changes. */
export function watchStore(): void {
  if (!realPayments()) return
  syncWithStore().catch((err: unknown) => console.error(err))
  void Store.addListener('changed', () => {
    syncWithStore().catch((err: unknown) => console.error(err))
  })
}

/** Whether a purchase counts here: in the app, only real ones. */
function counts(purchase: Purchase): boolean {
  return !realPayments() || !purchase.test
}

/** What is owned, kept up to date. */
export function usePurchases(): Purchase[] {
  const [list, setList] = useState<Purchase[]>([])
  useEffect(() => {
    let alive = true
    const load = () =>
      db.purchases
        .toArray()
        .then((all) => alive && setList(all.filter(counts)))
        .catch((err: unknown) => console.error(err))
    void load()
    listeners.add(load)
    return () => {
      alive = false
      listeners.delete(load)
    }
  }, [])
  return list
}

/** In the app, the App Store's prices (in the buyer's currency), by product id. */
export function useStorePrices(): Map<string, string> {
  const [prices, setPrices] = useState(new Map<string, string>())
  useEffect(() => {
    if (!realPayments()) return
    let alive = true
    const ids = PRODUCTS.flatMap((p) => (p.appStoreId ? [p.appStoreId] : []))
    Store.products({ ids })
      .then(({ products }) => {
        if (!alive) return
        const byStoreId = new Map(products.map((p) => [p.id, p.price]))
        setPrices(
          new Map(
            PRODUCTS.flatMap((p) => {
              const price = p.appStoreId && byStoreId.get(p.appStoreId)
              return price ? [[p.id, price] as const] : []
            }),
          ),
        )
      })
      .catch((err: unknown) => console.error(err))
    return () => {
      alive = false
    }
  }, [])
  return prices
}
