import { useMemo, useSyncExternalStore } from 'react'
import type { TFunction } from 'i18next'
import { ledgerPoints } from '../../lib/support-store'
import { getBoard, subscribeBoard } from '../../lib/supporters-board'
import { useSession } from '../../providers'
import { useSupportLedger } from '../support/useSupportLedger'

/* Where the seeker stands in the support ranking, for every place that
   speaks of it: the ranking's own card, the note under an ad button, the
   Kronika's card, the note under the coffees. Read from the shared rows
   (lib/supporters-board); the figures fall back to this device's ledger
   until the seeker is on the board. */

export type SupportStanding = {
  /* The seeker's answer about the ranking: true or false once given, null
     when not asked yet, undefined when there is no account or the backend
     does not know the ranking. */
  listed: boolean | null | undefined
  /* The 1-based place, or null when not on the board (not listed, nothing
     given yet, or the rows are not in). */
  place: number | null
  /* What the ranking goes by: an ad is a point, a coffee its points by
     size (lib/support-store.ts). */
  points: number
  ads: number
  coffees: number
  /* How many more points put the seeker above the one just ahead (as
     many ads, or one coffee if it is worth that much); null for the
     leader and for a seeker who is not on the board. */
  toNext: number | null
}

export function useSupportStanding(): SupportStanding {
  const { profile } = useSession()
  const ledger = useSupportLedger()
  const { rows } = useSyncExternalStore(subscribeBoard, getBoard, getBoard)
  const myId = profile?.public_id ?? null
  const listed = profile ? profile.listed_as_supporter : undefined

  return useMemo(() => {
    const index = myId && listed ? rows.findIndex((row) => row.public_id === myId) : -1
    if (index < 0) return { listed, place: null, points: ledgerPoints(ledger), ads: ledger.ads, coffees: ledger.coffees, toNext: null }
    const mine = rows[index]
    const ahead = index > 0 ? rows[index - 1] : null
    /* The order is by points, then by coffees: with more coffees a tie in
       points is already enough. */
    const toNext = ahead ? Math.max(1, ahead.points - mine.points + (mine.coffees > ahead.coffees ? 0 : 1)) : null
    return { listed, place: index + 1, points: mine.points, ads: mine.ads, coffees: mine.coffees, toNext }
  }, [rows, myId, listed, ledger])
}

/* What the seeker's place asks of them next, in words: how many points
   short of the place above they are, or that they lead; null when they
   are not on the board. */
export function nextPlaceLine(standing: SupportStanding, t: TFunction): string | null {
  if (standing.place === null) return null
  if (standing.toNext === null) return t('mobile:supporters.leading')
  return t('mobile:supporters.toNext', { count: standing.toNext, place: standing.place - 1 })
}

/* The place a listed seeker would hold with so many more points and
   coffees (a coffee about to be bought), or null when that is no better
   than where they stand, or when they are not in the ranking. A tie is
   counted against the seeker unless the coffees break it, as the board
   does. */
export function usePlaceWith(points: number, coffees: number): number | null {
  const { profile } = useSession()
  const standing = useSupportStanding()
  const { rows } = useSyncExternalStore(subscribeBoard, getBoard, getBoard)
  const myId = profile?.public_id ?? null
  return useMemo(() => {
    if (standing.listed !== true || !myId) return null
    const mine = standing.points + points
    const mineCoffees = standing.coffees + coffees
    const ahead = rows.filter((row) => row.public_id !== myId && (row.points > mine || (row.points === mine && row.coffees >= mineCoffees))).length
    const place = ahead + 1
    return standing.place === null || place < standing.place ? place : null
  }, [rows, myId, standing, points, coffees])
}
