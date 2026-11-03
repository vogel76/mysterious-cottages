import { useEffect, useState } from 'react'

/* A wait in the player's words and a clock for the countdowns: the
   egg's chip in the HUD, the shop's skips, the elf's line when a care
   has no charge back yet. */

type Translate = (key: string, values?: Record<string, number>) => string

/* A wait of some milliseconds, to the minute, rounded up: "3 h 12 min",
   "2 h", "40 min". Under a minute it is a minute. */
export function durationText(t: Translate, leftMs: number): string {
  const minutes = Math.max(1, Math.ceil(leftMs / 60000))
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours > 0) return rest > 0 ? t('mobile:elf.durationHours', { hours, minutes: rest }) : t('mobile:elf.durationHoursOnly', { hours })
  return t('mobile:elf.durationMinutes', { minutes })
}

/* The clock to the minute, while something counts down: a countdown's
   state does not change on the elf's drift, so nothing else would
   re-render it. Idle when there is nothing to count. */
const MINUTE_TICK_MS = 20000

export function useClock(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), MINUTE_TICK_MS)
    return () => clearInterval(timer)
  }, [active])
  return now
}
