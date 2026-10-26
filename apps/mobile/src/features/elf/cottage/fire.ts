import { useCallback, useEffect, useMemo } from 'react'
import { ReduceMotion, cancelAnimation, useSharedValue, withRepeat, withSequence, withTiming, type SharedValue } from 'react-native-reanimated'
import { EASING } from '../../../ui'

/* The hearth's life as shared values, on the UI thread: the flicker of the
   fire in an uneven loop, which the glow painted over the plate's hearth
   breathes with (./Lighting), and the time of day the cottage clock writes
   (./clock: 0 at night, 1 in full daylight, held at night while the elf
   sleeps). Neither rebuilds a path. With reduce motion on, or while the tab
   is out of focus, the flicker holds at the middle and the fire simply
   stands. flare() answers a tap on the hearth: the flames leap for a
   moment before the loop takes over again, a single eased movement rather
   than a loop, so a reduce motion reader still gets the flare. The fire
   itself is baked into the rendered plate; this is only what the picture
   cannot do by itself. */

export type FireMotion = {
  /* The height and brightness of the flames, in an uneven loop; a flare
     briefly takes it above 1. */
  flicker: SharedValue<number>
  /* Daylight, 0 night .. 1 full day, from the clock (0 while asleep). */
  day: SharedValue<number>
}

export type FireControls = FireMotion & {
  /* The flames leap for a moment (a tap on the hearth). */
  flare: () => void
}

/* The idle flicker, restarted after a flare. */
function flickerLoop() {
  return withRepeat(
    withSequence(
      withTiming(1, { duration: 380, easing: EASING.inOut }),
      withTiming(0.25, { duration: 440, easing: EASING.inOut }),
      withTiming(0.8, { duration: 260, easing: EASING.inOut }),
      withTiming(0, { duration: 540, easing: EASING.inOut }),
    ),
    -1,
    false,
  )
}

/* How high the flare reaches and how long it lasts. */
const FLARE = { peak: 1.7, upMs: 180, downMs: 520 } as const
const NEVER_REDUCE = { reduceMotion: ReduceMotion.Never } as const

export function useFireMotion({ reduceMotion, paused }: { reduceMotion: boolean; paused: boolean }): FireControls {
  const flicker = useSharedValue(0.5)
  const day = useSharedValue(0)
  const still = reduceMotion || paused

  useEffect(() => {
    if (still) {
      cancelAnimation(flicker)
      flicker.value = 0.5
      return
    }
    flicker.value = flickerLoop()
    return () => cancelAnimation(flicker)
  }, [still, flicker])

  const flare = useCallback(() => {
    if (paused) return
    cancelAnimation(flicker)
    /* A single eased leap, never a loop: it keeps its duration under the
       system's reduce motion setting, which would otherwise finish both
       steps at once and show nothing. */
    const settle = reduceMotion ? withTiming(0.5, { duration: FLARE.downMs, easing: EASING.inOut, ...NEVER_REDUCE }) : withSequence(withTiming(0.4, { duration: FLARE.downMs, easing: EASING.inOut }), flickerLoop())
    flicker.value = withSequence(withTiming(FLARE.peak, { duration: FLARE.upMs, easing: EASING.out, ...NEVER_REDUCE }), settle)
  }, [flicker, paused, reduceMotion])

  return useMemo(() => ({ flicker, day, flare }), [flicker, day, flare])
}
