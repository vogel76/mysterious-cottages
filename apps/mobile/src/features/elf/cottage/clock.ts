import { useEffect } from 'react'
import { cancelAnimation, withTiming, type SharedValue } from 'react-native-reanimated'
import { EASING } from '../../../ui'

/* The cottage's clock: how much daylight there is at a given hour, and the
   hook that keeps a shared value at it. The phase is 0 through the night
   (22 to 5), climbs to 1 by 9 in the morning, stays there until 17 and
   falls back to 0 by 21, with a soft shoulder on both ramps so the dawn
   and the dusk linger a moment. The hook reads the device clock on mount
   and every five minutes, so every visit looks a little different and a
   session that spans the dusk sees the room darken by itself; each change
   is eased over a second and a half rather than stepped. Sleep forces
   night, as the lighting does: the value drops to 0 while the elf sleeps
   and comes back when it wakes. Nothing here re-renders anything; the
   value is read by the lighting layer and the window variants. */

export const CLOCK_TICK_MS = 5 * 60 * 1000
const DAY_FADE_MS = 1500
/* The same pace as the lighting's night tint, so the two change together. */
const NIGHT_MS = 800

function smooth(t: number): number {
  const x = Math.min(1, Math.max(0, t))
  return x * x * (3 - 2 * x)
}

/* Daylight at a moment of the day, 0 night .. 1 full day. */
export function dayPhaseAt(date: Date): number {
  const hour = date.getHours() + date.getMinutes() / 60
  if (hour >= 22 || hour < 5) return 0
  if (hour < 9) return smooth((hour - 5) / 4)
  if (hour < 17) return 1
  if (hour < 21) return 1 - smooth((hour - 17) / 4)
  return 0
}

export type DayClockOptions = {
  /* Forced night (the elf sleeps). */
  night: boolean
  reduceMotion: boolean
}

/* Keeps the shared value at the daylight of the device clock. */
export function useDayClock(day: SharedValue<number>, { night, reduceMotion }: DayClockOptions) {
  useEffect(() => {
    if (night) {
      cancelAnimation(day)
      day.value = withTiming(0, { duration: reduceMotion ? 0 : NIGHT_MS, easing: EASING.inOut })
      return
    }
    let first = true
    const tick = () => {
      const phase = dayPhaseAt(new Date())
      cancelAnimation(day)
      /* The first reading after a wake (or the mount) comes in at the
         night tint's pace; the five-minute ticks drift more slowly. */
      day.value = withTiming(phase, { duration: reduceMotion ? 0 : first ? NIGHT_MS : DAY_FADE_MS, easing: EASING.inOut })
      first = false
    }
    tick()
    const interval = setInterval(tick, CLOCK_TICK_MS)
    return () => clearInterval(interval)
  }, [day, night, reduceMotion])
}
