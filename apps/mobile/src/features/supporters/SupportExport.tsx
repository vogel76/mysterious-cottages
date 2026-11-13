import { useCallback, useEffect, useRef } from 'react'
import { retryDelay } from '@chatynkowo/core'
import { deviceId, notifySupportExported } from '../../lib/support-export'
import { pushSupportLedger } from '../../lib/sync'
import { useForeground, useOnline, useReconnect, useSession } from '../../providers'
import { useSupportLedger } from '../support/useSupportLedger'

/* Sends this device's support ledger (the coffees and the ads given here)
   to the account, for a seeker who chose to be on the supporters' board
   and for nobody else: an account that was not asked, or said no, keeps
   its ledger on the device. Mounted once, under the providers; it draws
   nothing.

   The ledger goes up as this device's whole count, written over the
   device's own row, so sending it twice changes nothing: once per launch
   (which also puts back a row the account dropped when it left the board
   from another phone), and again after every coffee or ad. A push the
   backend did not take is tried again as the finds are (ProgressProvider):
   on a reconnect, on a return to the foreground and, while the app stays
   open, after a growing pause. */

type Sent = { userId: string; coffees: number; ads: number }

export function SupportExport() {
  const { session, profile } = useSession()
  const ledger = useSupportLedger()
  const online = useOnline()
  const listed = profile?.listed_as_supporter === true
  const userId = session?.user.id

  /* The latest of everything, for the one routine every trigger calls. */
  const latest = useRef({ session, listed, ledger, online })
  useEffect(() => {
    latest.current = { session, listed, ledger, online }
  })

  /* What the account took from this device in this run. */
  const sent = useRef<Sent | null>(null)
  const sending = useRef(false)
  const failures = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mounted = useRef(true)
  const again = useRef(() => {})
  useEffect(
    () => () => {
      mounted.current = false
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const run = useCallback(async () => {
    const { session: active, listed: wanted, ledger: counts, online: reachable } = latest.current
    if (!active || !wanted || sending.current || reachable === false) return
    if (counts.coffees + counts.ads === 0) return
    const last = sent.current
    if (last && last.userId === active.user.id && last.coffees === counts.coffees && last.ads === counts.ads) return
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    sending.current = true
    let took = false
    try {
      took = await pushSupportLedger(active, await deviceId(), counts)
    } finally {
      sending.current = false
    }
    if (!mounted.current) return
    if (!took) {
      failures.current += 1
      timer.current = setTimeout(() => {
        timer.current = null
        again.current()
      }, retryDelay(failures.current))
      return
    }
    sent.current = { userId: active.user.id, coffees: counts.coffees, ads: counts.ads }
    failures.current = 0
    notifySupportExported()
    /* A coffee or an ad given while the push was in flight goes up next. */
    again.current()
  }, [])
  useEffect(() => {
    again.current = () => void run()
  }, [run])

  /* Leaving the board forgets what was sent, so joining again sends it. */
  useEffect(() => {
    if (!listed) sent.current = null
  }, [listed])

  useEffect(() => {
    void run()
  }, [run, userId, listed, ledger.coffees, ledger.ads, online])

  const wake = useCallback(() => {
    failures.current = 0
    void run()
  }, [run])
  useReconnect(wake)
  useForeground(wake)

  return null
}
