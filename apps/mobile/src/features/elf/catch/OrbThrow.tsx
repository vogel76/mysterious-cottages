import { forwardRef, useImperativeHandle } from 'react'
import { StyleSheet } from 'react-native'
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated'
import { DURATIONS, EASING, OrbIcon, ReduceMotion, colors, iconSize, useReducedMotion } from '../../../ui'

/* The magic orb in flight: a gold disc that leaves the throw button, arcs
   towards where the elf stands at the moment of the throw, shrinks as it
   goes away from the player and fades out as it lands. It sits over the
   whole screen and is driven imperatively, so a throw costs no render.
   Reduced motion skips the flight: the orb appears where it lands and
   fades. The decision is made here, so the animations themselves never
   collapse. Hidden until the first throw. */

export const ORB_SIZE = 40
/* The flight, after which the screen resolves the throw. */
export const ORB_FLY_MS = 500
const ORB_FADE_MS = 120
const LANDED_SCALE = 0.7

export type OrbFlight = {
  fromX: number
  fromY: number
  toX: number
  toY: number
}

export type OrbThrowHandle = {
  throwTo: (flight: OrbFlight) => void
}

const NO_REDUCE = { reduceMotion: ReduceMotion.Never } as const

export const OrbThrow = forwardRef<OrbThrowHandle>(function OrbThrow(_props, ref) {
  const reduceMotion = useReducedMotion()
  const x = useSharedValue(0)
  const y = useSharedValue(0)
  const scale = useSharedValue(1)
  const opacity = useSharedValue(0)

  useImperativeHandle(
    ref,
    () => ({
      throwTo: ({ fromX, fromY, toX, toY }) => {
        cancelAnimation(x)
        cancelAnimation(y)
        cancelAnimation(scale)
        cancelAnimation(opacity)
        const half = ORB_SIZE / 2
        if (reduceMotion) {
          x.value = toX - half
          y.value = toY - half
          scale.value = LANDED_SCALE
          opacity.value = withTiming(1, { duration: DURATIONS.fast, ...NO_REDUCE })
          opacity.value = withDelay(ORB_FLY_MS - ORB_FADE_MS, withTiming(0, { duration: ORB_FADE_MS, ...NO_REDUCE }))
          return
        }
        x.value = fromX - half
        y.value = fromY - half
        scale.value = 1
        opacity.value = 1
        x.value = withTiming(toX - half, { duration: ORB_FLY_MS, easing: EASING.out, ...NO_REDUCE })
        y.value = withTiming(toY - half, { duration: ORB_FLY_MS, easing: EASING.out, ...NO_REDUCE })
        scale.value = withTiming(LANDED_SCALE, { duration: ORB_FLY_MS, easing: EASING.out, ...NO_REDUCE })
        opacity.value = withDelay(ORB_FLY_MS - ORB_FADE_MS, withTiming(0, { duration: ORB_FADE_MS, ...NO_REDUCE }))
      },
    }),
    [reduceMotion, x, y, scale, opacity],
  )

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }))

  return (
    <Animated.View pointerEvents="none" style={[styles.orb, style]}>
      <OrbIcon size={iconSize.md} weight="duotone" color={colors.accentInk} />
    </Animated.View>
  )
})

const styles = StyleSheet.create({
  orb: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: ORB_SIZE,
    height: ORB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: ORB_SIZE / 2,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    backgroundColor: colors.accent,
    shadowColor: colors.accentStrong,
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
})
