import { useCallback, useEffect, useRef, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import type { SupporterRow } from '@chatynkowo/api'
import { onSupportExported } from '../../lib/support-export'
import { fetchSupporters } from '../../lib/sync'
import { useForeground, useReconnect } from '../../providers'

/* The supporters' board as its screen sees it, the leaderboard's hook
   (features/ranking/useLeaderboard) made small: loaded when the screen
   gains focus and the rows are missing, failed or older than a minute,
   on a return to the foreground, on reconnect, and once this device's
   ledger reached the account or the seeker joined or left. Rows on screen
   are never cleared by a refetch; only the newest request may land. */

export type SupportersState = {
  rows: SupporterRow[]
  /* When the rows on screen were fetched; null until the first success. */
  updatedAt: number | null
  /* A refresh the seeker asked for is in flight. */
  refreshing: boolean
  /* The last request failed; the rows already shown stay. */
  error: boolean
  refresh: (options?: { silent?: boolean }) => Promise<void>
}

const STALE_MS = 60_000

export function useSupporters(): SupportersState {
  const [rows, setRows] = useState<SupporterRow[]>([])
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)

  const requestId = useRef(0)
  const inFlight = useRef(false)
  const focused = useRef(false)
  const dirty = useRef(false)
  const updatedAtRef = useRef<number | null>(null)
  const errorRef = useRef(false)

  const load = useCallback(async (silent: boolean) => {
    const id = ++requestId.current
    inFlight.current = true
    dirty.current = false
    if (!silent) {
      setRefreshing(true)
      setError(false)
    }
    try {
      const next = await fetchSupporters()
      if (requestId.current !== id) return
      const now = Date.now()
      updatedAtRef.current = now
      errorRef.current = false
      setRows(next)
      setUpdatedAt(now)
      setError(false)
    } catch (reason) {
      if (requestId.current !== id) return
      console.error('[support] board', reason)
      errorRef.current = true
      setError(true)
    } finally {
      if (requestId.current === id) {
        inFlight.current = false
        setRefreshing(false)
      }
    }
  }, [])

  const loadIfStale = useCallback(() => {
    if (inFlight.current) return
    const at = updatedAtRef.current
    if (at === null || errorRef.current || dirty.current || Date.now() - at > STALE_MS) void load(true)
  }, [load])

  useFocusEffect(
    useCallback(() => {
      focused.current = true
      loadIfStale()
      return () => {
        focused.current = false
        if (inFlight.current) {
          requestId.current += 1
          inFlight.current = false
          setRefreshing(false)
        }
      }
    }, [loadIfStale]),
  )

  useForeground(
    () => {
      if (focused.current) loadIfStale()
    },
    { minIntervalMs: STALE_MS },
  )

  useReconnect(() => {
    if (focused.current) loadIfStale()
  })

  /* What this device gave reached the account, or the seeker's place on
     the board changed: the board has moved. */
  useEffect(
    () =>
      onSupportExported(() => {
        dirty.current = true
        if (focused.current) loadIfStale()
      }),
    [loadIfStale],
  )

  const refresh = useCallback(
    async (options?: { silent?: boolean }) => {
      await load(Boolean(options?.silent))
    },
    [load],
  )

  return { rows, updatedAt, refreshing, error, refresh }
}
