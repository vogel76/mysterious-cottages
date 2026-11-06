import { useEffect, useState } from 'react'
import type { ElfRest } from '@chatynkowo/core'
import { ELF_DEMO } from '../../config'
import { elfNow } from '../../lib/elf-clock'

/* A wait in the player's words and a clock for the countdowns: the
   egg's chip in the HUD, the shop's skips, the star brew's time left;
   and how rested the elf is, in words. */

type Translate = (key: string, values?: Record<string, number | string>) => string

/* A wait of some milliseconds, to the minute, rounded up: "3 h 12 min",
   "2 h", "40 min". Under a minute it is a minute. */
export function durationText(t: Translate, leftMs: number): string {
  const minutes = Math.max(1, Math.ceil(leftMs / 60000))
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours > 0) return rest > 0 ? t('mobile:elf.durationHours', { hours, minutes: rest }) : t('mobile:elf.durationHoursOnly', { hours })
  return t('mobile:elf.durationMinutes', { minutes })
}

/* How rested the elf is, in words and never as a count of rounds: the
   brew's time left while it works, else restOf's word. */
export function restText(t: Translate, rest: ElfRest, brewUntil: number | null, now: number): string {
  if (brewUntil !== null && brewUntil > now) return t('mobile:elf.restBrew', { time: durationText(t, brewUntil - now) })
  return t(`mobile:elf.rest${rest.charAt(0).toUpperCase()}${rest.slice(1)}`)
}

/* The clock to the minute, while something counts down: a countdown's
   state does not change on the elf's drift, so nothing else would
   re-render it. Idle when there is nothing to count. */
const MINUTE_TICK_MS = 20000
/* A demo build's clock moves a day in twenty minutes, so its countdowns tick every two seconds. */
const DEMO_TICK_MS = 2000

export function useClock(active: boolean): number {
  const [now, setNow] = useState(() => elfNow())
  useEffect(() => {
    if (!active) return
    setNow(elfNow())
    const timer = setInterval(() => setNow(elfNow()), ELF_DEMO ? DEMO_TICK_MS : MINUTE_TICK_MS)
    return () => clearInterval(timer)
  }, [active])
  return now
}
