import { STORAGE_KEYS } from '../config'
import { readJson, writeJson } from './storage'

/* The support ledger: how many coffees the player bought (and of which
   size) and how many ads they watched to the end on this device,
   wherever the ad was offered (the support sheet's, and the elf's for
   dust, time or a life: each one supports Chatynkowo the same). The
   ledger is worth points, which the support ranking goes by
   (ledgerPoints): an ad is one, a coffee many times that by its size, so
   a coffee lifts a seeker far and a patient watcher of ads can still
   catch up. It stays on the device unless
   the seeker chose to be in the support ranking; then it goes up to the
   account as this device's count
   (src/features/supporters/SupportExport.tsx). One store
   behind one read of AsyncStorage, the same shape as the reachability
   store (network.ts): subscribers read one snapshot and re-render on a
   change; the hook on top lives in src/features/support. A coffee is what
   the player says arrived (the app cannot see the payment page's
   outcome), an ad is one watched to the end (the ad network's word). */

export type SupportKind = 'coffee' | 'ad'

/* The sizes a coffee comes in (the tips of features/support/tips.ts). */
export type CoffeeSize = 'small' | 'regular' | 'large' | 'pot'
export const COFFEE_SIZES: readonly CoffeeSize[] = ['small', 'regular', 'large', 'pot']

/* What the support ranking counts. An ad is one point; a coffee is worth
   about five points for each zloty of its suggested price (4.99, 9.99,
   19.99 and 49.99), so the smallest coffee equals twenty-five ads and the
   pot two hundred and fifty: buying is by far the quicker way up, and a
   seeker who watches a handful of ads a day still passes a small coffee
   within the week. The weights live here alone: the ledger keeps the
   sizes, the points are worked out from them when they are shown or sent,
   so a change of weights re-scores every coffee on the device's next
   export. */
export const AD_POINTS = 1
export const COFFEE_POINTS: Record<CoffeeSize, number> = { small: 25, regular: 50, large: 100, pot: 250 }
/* A coffee counted before the sizes were kept: taken for the regular one,
   the size the sheet offers first. */
const UNSIZED_COFFEE_POINTS = COFFEE_POINTS.regular

export type SupportLedger = {
  coffees: number
  /* The coffees by size; one counted before the sizes were kept is in
     `coffees` alone. */
  sizes: Record<CoffeeSize, number>
  ads: number
  /* When the last support was given, in milliseconds since the epoch; 0
     for none. */
  lastAt: number
}

const NO_SIZES: Record<CoffeeSize, number> = { small: 0, regular: 0, large: 0, pot: 0 }

export const EMPTY_LEDGER: SupportLedger = { coffees: 0, sizes: NO_SIZES, ads: 0, lastAt: 0 }

/* The points of a ledger's coffees, and of the whole ledger. */
export function ledgerCoffeePoints(ledger: SupportLedger): number {
  const sized = COFFEE_SIZES.reduce((sum, size) => sum + ledger.sizes[size], 0)
  const bySize = COFFEE_SIZES.reduce((sum, size) => sum + ledger.sizes[size] * COFFEE_POINTS[size], 0)
  return bySize + Math.max(0, ledger.coffees - sized) * UNSIZED_COFFEE_POINTS
}

export function ledgerPoints(ledger: SupportLedger): number {
  return ledger.ads * AD_POINTS + ledgerCoffeePoints(ledger)
}

let snapshot: SupportLedger = EMPTY_LEDGER
const listeners = new Set<() => void>()
let reading: Promise<void> | null = null

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

/* A stored ledger brought back to shape; a broken entry counts as empty.
   The sizes never add up to more than the coffees there are. */
function normalize(raw: unknown): SupportLedger {
  if (typeof raw !== 'object' || raw === null) return EMPTY_LEDGER
  const record = raw as Record<string, unknown>
  const stored = typeof record.sizes === 'object' && record.sizes !== null ? (record.sizes as Record<string, unknown>) : {}
  const coffees = count(record.coffees)
  let room = coffees
  const sizes = { ...NO_SIZES }
  for (const size of COFFEE_SIZES) {
    sizes[size] = Math.min(room, count(stored[size]))
    room -= sizes[size]
  }
  return { coffees, sizes, ads: count(record.ads), lastAt: count(record.lastAt) }
}

function addSizes(a: Record<CoffeeSize, number>, b: Record<CoffeeSize, number>): Record<CoffeeSize, number> {
  return { small: a.small + b.small, regular: a.regular + b.regular, large: a.large + b.large, pot: a.pot + b.pot }
}

function publish(next: SupportLedger) {
  snapshot = next
  listeners.forEach((listener) => listener())
}

/* The device is read once, on first use; a record made before the read
   lands is added on top of what was stored. */
function ensureRead(): Promise<void> {
  if (!reading) {
    reading = readJson<unknown>(STORAGE_KEYS.support).then((raw) => {
      const stored = normalize(raw)
      publish({
        coffees: stored.coffees + snapshot.coffees,
        sizes: addSizes(stored.sizes, snapshot.sizes),
        ads: stored.ads + snapshot.ads,
        lastAt: Math.max(stored.lastAt, snapshot.lastAt),
      })
    })
  }
  return reading
}

export function subscribe(listener: () => void): () => void {
  void ensureRead()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getSnapshot(): SupportLedger {
  return snapshot
}

/* One more ad, or one more coffee of a size, saved at once. */
export function recordSupport(support: { kind: 'ad' } | { kind: 'coffee'; size: CoffeeSize }, now = Date.now()): void {
  publish({
    coffees: snapshot.coffees + (support.kind === 'coffee' ? 1 : 0),
    sizes: support.kind === 'coffee' ? { ...snapshot.sizes, [support.size]: snapshot.sizes[support.size] + 1 } : snapshot.sizes,
    ads: snapshot.ads + (support.kind === 'ad' ? 1 : 0),
    lastAt: now,
  })
  void ensureRead().then(() => writeJson(STORAGE_KEYS.support, snapshot))
}
