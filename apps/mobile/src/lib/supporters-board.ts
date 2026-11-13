import type { SupporterRow } from '@chatynkowo/api'
import { fetchSupporters } from './sync'

/* The support ranking as last read, kept in one store for the whole app:
   its own screen shows the rows, and the places that offer an ad (the
   support sheet, the elf's sheets, the Kronika's card) read the seeker's
   standing from the same rows. One request at a time; rows already here
   are never cleared by a request that fails. The same shape as the
   reachability store (network.ts). */

export type SupportersBoard = {
  rows: SupporterRow[]
  /* When the rows were read; null until the first success. */
  updatedAt: number | null
  /* The last request failed; the rows stay. */
  error: boolean
}

let board: SupportersBoard = { rows: [], updatedAt: null, error: false }
const listeners = new Set<() => void>()
let loading: Promise<void> | null = null

export function subscribeBoard(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getBoard(): SupportersBoard {
  return board
}

/* Reads the ranking again. Resolves once the request has landed, whatever
   it brought; a second call while one is in flight waits for the same. */
export function loadBoard(): Promise<void> {
  loading ??= fetchSupporters()
    .then(
      (rows) => {
        board = { rows, updatedAt: Date.now(), error: false }
      },
      (reason: unknown) => {
        console.error('[support] ranking', reason)
        board = { ...board, error: true }
      },
    )
    .finally(() => {
      loading = null
      listeners.forEach((listener) => listener())
    })
  return loading
}
