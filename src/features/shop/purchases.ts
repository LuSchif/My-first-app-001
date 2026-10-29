import { useEffect, useState } from 'react'
import { db } from '../../storage/db.ts'
import type { Product, Purchase } from './catalog.ts'

/**
 * Buying in the shop. A payment provider (a checkout of a payment service, or the App Store
 * in a native wrapper) plugs in here with `setPaymentProvider`; everything else asks only
 * whether something is owned. Until one is connected, buying is a test purchase: the item is
 * unlocked on this device, marked as a test, and nothing is charged.
 */

export interface PaymentProvider {
  /** Takes the payment; resolves true once it went through. */
  checkout: (product: Product) => Promise<boolean>
}

let provider: PaymentProvider | null = null

export function setPaymentProvider(next: PaymentProvider | null): void {
  provider = next
}

/** Whether real payments are connected; without, the shop says purchases are tests. */
export function paymentsConnected(): boolean {
  return provider !== null
}

const listeners = new Set<() => void>()

/** Buys (or, if free, takes) a product; resolves whether it is now owned. */
export async function buy(product: Product): Promise<boolean> {
  if (product.status !== 'available') return false
  let test = false
  if (product.price > 0) {
    if (provider) {
      if (!(await provider.checkout(product))) return false
    } else {
      test = true
    }
  }
  const purchase: Purchase = { productId: product.id, at: Date.now(), test }
  await db.purchases.put(purchase)
  for (const listener of listeners) listener()
  return true
}

/** What is owned, kept up to date. */
export function usePurchases(): Purchase[] {
  const [list, setList] = useState<Purchase[]>([])
  useEffect(() => {
    let alive = true
    const load = () =>
      db.purchases
        .toArray()
        .then((all) => alive && setList(all))
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
