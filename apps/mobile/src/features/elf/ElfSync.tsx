import { useCallback, useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { Json } from '@chatynkowo/api'
import { normalizeElf, retryDelay, syncElf, type ElfState, type ElfSyncBase } from '@chatynkowo/core'
import { ELF_DEMO, ELF_ENABLED, STORAGE_KEYS } from '../../config'
import { elfNow } from '../../lib/elf-clock'
import { readJson, writeJson } from '../../lib/storage'
import { fetchElf, pushElf } from '../../lib/sync'
import { useElf, useForeground, useOnline, useReconnect, useSession, useToast } from '../../providers'

/* Keeps the elf on the signed-in account: the elf, its acorns and its
   star dust live on the device and, for a player with an account, on the
   account too, so a reinstall or another phone brings them back. Mounted
   once, under the providers; it draws nothing. A seeker without an
   account keeps the elf on the device alone, and a demo build (its clock
   runs fast) never sends its elf anywhere.

   One routine, `meet`, reads the account's elf and lets the rules decide
   (core's syncElf: send the device's, take the account's, or make one of
   two) from what each holds and from what this device and this account
   last agreed on (kept under STORAGE_KEYS.elfSync). It runs when the
   account or the stored elf first comes in, on every return to the
   foreground and reconnect (another phone may have played meanwhile), a
   few seconds after the player changed something, and at once when the
   app leaves the front. A write names the revision it was made over; if
   another phone wrote first the account is read again. A meeting the
   backend did not take is tried again after a growing pause, as the
   finds are.

   An elf the account wrote with a newer version of the rules than this
   build reads is left alone on both sides: nothing is taken and nothing
   is written over it. */

/* How long after the player's last change the elf goes up: a run of
   taps is one write. */
const SETTLE_MS = 4000
/* How often a write that lost to another phone is decided anew in one
   meeting. */
const ROUNDS = 3

type Agreed = { userId: string; rev: number; changedAt: number }

export function ElfSync() {
  return ELF_ENABLED && !ELF_DEMO ? <Sync /> : null
}

function Sync() {
  const { t } = useTranslation()
  const toast = useToast()
  const { session } = useSession()
  const { state, loaded, replace } = useElf()
  const online = useOnline()
  const userId = session?.user.id

  /* The latest of everything, for the one routine every trigger calls. */
  const latest = useRef({ session, state, loaded, online, replace })
  latest.current = { session, state, loaded, online, replace }

  const meeting = useRef(false)
  const again = useRef(false)
  const failures = useRef(0)
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null)
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mounted = useRef(true)
  /* The elf's last change the account is known to hold: a change to
     anything else is the player's and goes up. */
  const agreedChange = useRef<number | null>(null)
  const run = useRef<() => void>(() => {})
  useEffect(
    () => () => {
      mounted.current = false
      if (retry.current) clearTimeout(retry.current)
      if (settle.current) clearTimeout(settle.current)
    },
    [],
  )

  const meet = useCallback(async () => {
    if (meeting.current) {
      again.current = true
      return
    }
    const { session: active, loaded: ready, online: reachable } = latest.current
    if (!active || !ready || reachable === false) return
    if (retry.current) {
      clearTimeout(retry.current)
      retry.current = null
    }
    meeting.current = true
    again.current = false
    let failed = false
    try {
      const user = active.user.id
      const stored = await readJson<Agreed>(STORAGE_KEYS.elfSync)
      let base: ElfSyncBase = stored && stored.userId === user ? { rev: stored.rev, changedAt: stored.changedAt } : null
      const agree = async (rev: number, elf: ElfState) => {
        base = { rev, changedAt: elf.changedAt }
        agreedChange.current = elf.changedAt
        await writeJson(STORAGE_KEYS.elfSync, { userId: user, rev, changedAt: elf.changedAt } satisfies Agreed)
      }
      for (let round = 0; round < ROUNDS; round += 1) {
        const record = await fetchElf(active)
        const now = elfNow()
        const theirs = record ? normalizeElf(record.state, now) : null
        /* Written by rules this build does not read: leave both alone. */
        if (record && !theirs) break
        const local = latest.current.state
        const step = syncElf(local, record && theirs ? { state: theirs, rev: record.rev } : null, base, now)
        if (step.do === 'nothing') {
          if (local && base) agreedChange.current = base.changedAt
          break
        }
        if (step.do === 'adopt') {
          latest.current.replace(step.state)
          await agree(step.rev, step.state)
          if (step.arrived && mounted.current) toast.show({ tone: 'success', text: t('mobile:elf.syncArrived') })
          break
        }
        /* Two elves made one: the device takes it before it goes up. */
        if (step.state !== local) latest.current.replace(step.state)
        const rev = await pushElf(active, step.state as unknown as Json, step.state.changedAt, step.baseRev)
        if (rev !== null) {
          await agree(rev, step.state)
          if (step.arrived && mounted.current) toast.show({ tone: 'success', text: t('mobile:elf.syncArrived') })
          break
        }
        /* Another phone wrote first: read the account again. */
      }
      failures.current = 0
    } catch (error) {
      console.error('[elf] sync', error)
      failed = true
    } finally {
      meeting.current = false
    }
    if (!mounted.current) return
    if (failed) {
      failures.current += 1
      retry.current = setTimeout(() => {
        retry.current = null
        run.current()
      }, retryDelay(failures.current))
      return
    }
    /* Something changed while the meeting was on. */
    if (again.current) run.current()
  }, [toast, t])
  run.current = () => void meet()

  /* The account or the stored elf came in. */
  useEffect(() => {
    if (userId && loaded) void meet()
  }, [userId, loaded, meet])

  /* The player changed something: up it goes once the taps settle. */
  const changedAt = state?.changedAt ?? null
  useEffect(() => {
    if (!userId || !loaded || changedAt === null || changedAt === agreedChange.current) return
    if (settle.current) clearTimeout(settle.current)
    settle.current = setTimeout(() => {
      settle.current = null
      run.current()
    }, SETTLE_MS)
  }, [userId, loaded, changedAt])

  /* Leaving the front sends what is waiting at once. */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active' || !settle.current) return
      clearTimeout(settle.current)
      settle.current = null
      run.current()
    })
    return () => subscription.remove()
  }, [])

  const wake = useCallback(() => {
    failures.current = 0
    void meet()
  }, [meet])
  useReconnect(wake)
  useForeground(wake)

  return null
}
