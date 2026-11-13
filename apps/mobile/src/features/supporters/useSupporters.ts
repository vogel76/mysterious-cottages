import { useCallback, useRef, useState, useSyncExternalStore } from 'react'
import { useFocusEffect } from 'expo-router'
import { getBoard, loadBoard, subscribeBoard, type SupportersBoard } from '../../lib/supporters-board'
import { useForeground, useReconnect } from '../../providers'

/* The support ranking as its screen sees it: the shared rows
   (lib/supporters-board), read again when the screen gains focus and they
   are missing, failed or older than a minute, on a return to the
   foreground and on reconnect. A change of the seeker's own standing (an
   ad counted, a coffee, joining or leaving) reloads them from
   SupportRankWatch, wherever the seeker is. */

export type SupportersState = SupportersBoard & {
  /* A refresh the seeker asked for is in flight. */
  refreshing: boolean
  refresh: () => Promise<void>
}

const STALE_MS = 60_000

export function useSupporters(): SupportersState {
  const board = useSyncExternalStore(subscribeBoard, getBoard, getBoard)
  const [refreshing, setRefreshing] = useState(false)
  const focused = useRef(false)

  const loadIfStale = useCallback(() => {
    const { updatedAt, error } = getBoard()
    if (updatedAt === null || error || Date.now() - updatedAt > STALE_MS) void loadBoard()
  }, [])

  useFocusEffect(
    useCallback(() => {
      focused.current = true
      loadIfStale()
      return () => {
        focused.current = false
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

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await loadBoard()
    } finally {
      setRefreshing(false)
    }
  }, [])

  return { ...board, refreshing, refresh }
}
