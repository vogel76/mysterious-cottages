import { useEffect } from 'react'
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, type SharedValue } from 'react-native-reanimated'
import { TapHereIcon, colors, iconSize, radius, useReducedMotion } from '../../ui'

/* The tutorial's light on what to do: a gold ring that breathes around
   the control a step asks for (the warm or the feed button on the care
   band, the purse row of the HUD), and a pointer, a tapping hand on a
   gold disc, that bobs over the egg or the elf in the room when the step
   asks for a touch there. Both are for the eyes only (the card says what
   to do and a screen reader reads the card), take no touch, and stand
   still when the system asks for reduced motion. */

const BREATH_MS = 900
/* How far the ring reaches past the control it surrounds. */
const HALO_REACH = 5
const HALO_STROKE = 3
/* The pointer's disc and its gap over the figure's head. */
const POINTER = 48
const POINTER_GAP = 6
const POINTER_BOB = 8

/* 0 to 1 and back, forever; held at rest with reduced motion. */
function useBreath(): SharedValue<number> {
  const reduceMotion = useReducedMotion()
  const breath = useSharedValue(0)
  useEffect(() => {
    if (reduceMotion) {
      breath.value = 0.5
      return
    }
    const easing = Easing.inOut(Easing.ease)
    breath.value = withRepeat(withSequence(withTiming(1, { duration: BREATH_MS, easing }), withTiming(0, { duration: BREATH_MS, easing })), -1)
    return () => cancelAnimation(breath)
  }, [breath, reduceMotion])
  return breath
}

/* The ring around a control: placed by the parent (absolute, reaching a
   little past the control's box; a pill, which fits a round button and
   a row of chips alike). */
export function TutorialHalo({ style }: { style?: StyleProp<ViewStyle> }) {
  const breath = useBreath()
  const animated = useAnimatedStyle(() => ({
    opacity: 0.5 + 0.5 * breath.value,
    transform: [{ scale: 1 + 0.06 * breath.value }],
  }))
  return <Animated.View pointerEvents="none" style={[styles.halo, style, animated]} />
}

/* The hand over the figure: the anchor is the view point just above
   the figure's head, as the scene reports it. */
export function TutorialPointer({ anchor }: { anchor: { x: number; y: number } }) {
  const breath = useBreath()
  const animated = useAnimatedStyle(() => ({
    transform: [{ translateY: -POINTER_BOB * breath.value }],
  }))
  return (
    <Animated.View pointerEvents="none" style={[styles.pointer, { left: anchor.x - POINTER / 2, top: anchor.y - POINTER - POINTER_GAP }, animated]}>
      <TapHereIcon size={iconSize.lg} weight="fill" color={colors.accentInk} />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  halo: {
    position: 'absolute',
    top: -HALO_REACH,
    bottom: -HALO_REACH,
    left: -HALO_REACH,
    right: -HALO_REACH,
    borderWidth: HALO_STROKE,
    borderColor: colors.accent,
    borderRadius: radius.pill,
  },
  pointer: {
    position: 'absolute',
    width: POINTER,
    height: POINTER,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    backgroundColor: colors.accent,
    shadowColor: colors.page,
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
})
