import { useEffect, type ReactNode } from 'react'
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, type SharedValue } from 'react-native-reanimated'
import { TapHereIcon, colors, iconSize, radius, useReducedMotion } from '../../ui'

/* The tutorial's light on what a card speaks of. Three ways, one beat:
   - a gold ring that swells around a control (a button of the care band
     or the rails, the name block, the purse row, the hurry) while a
     second ring runs out from it and fades, like a ripple, so the eye
     finds the control at once;
   - a pulse of the thing itself, for what is to be looked at rather
     than touched (the rings of the care band, which keep their own
     colours: the card explains what the colours mean);
   - a pointer, a tapping hand on a gold disc, that bobs over the egg or
     the elf in the room when the step asks for a touch there.
   All are for the eyes only (the card says what to do and a screen
   reader reads the card), take no touch, and stand still when the system
   asks for reduced motion. */

const BREATH_MS = 700
/* How far the ring reaches past the control it surrounds. */
const HALO_REACH = 5
const HALO_STROKE = 4
/* How far the ring swells, and how far its ripple runs before it is
   gone: in points on every side, so a round button and a wide block (the
   name, the purse row, the hurry) are lit alike. */
const HALO_SWELL = 3
const RIPPLE_RUN = 14
const RIPPLE_STROKE = 3
/* How much a pulsing thing swells. */
const PULSE_SWELL = 0.16
/* The pointer's disc and its gap over the figure's head. */
const POINTER = 48
const POINTER_GAP = 6
const POINTER_BOB = 8

/* 0 to 1 and back, forever, while on; at rest when off or with reduced
   motion. */
function useBreath(on = true): SharedValue<number> {
  const reduceMotion = useReducedMotion()
  const breath = useSharedValue(0)
  useEffect(() => {
    if (!on) {
      breath.value = 0
      return
    }
    if (reduceMotion) {
      breath.value = 0.5
      return
    }
    const easing = Easing.inOut(Easing.ease)
    breath.value = withRepeat(withSequence(withTiming(1, { duration: BREATH_MS, easing }), withTiming(0, { duration: BREATH_MS, easing })), -1)
    return () => cancelAnimation(breath)
  }, [breath, on, reduceMotion])
  return breath
}

/* 0 to 1 and again from 0, forever: the ripple's run. Kept at 0, where
   the ripple is not drawn, with reduced motion. */
function useRipple(): SharedValue<number> {
  const reduceMotion = useReducedMotion()
  const run = useSharedValue(0)
  useEffect(() => {
    if (reduceMotion) {
      run.value = 0
      return
    }
    run.value = withRepeat(withTiming(1, { duration: BREATH_MS * 2, easing: Easing.out(Easing.quad) }), -1)
    return () => cancelAnimation(run)
  }, [run, reduceMotion])
  return run
}

/* The ring around a control: placed by the parent (absolute, reaching a
   little past the control's box; a pill, which fits a round button and
   a row of chips alike). The ring and its ripple grow by their edges,
   not by a scale, so the stroke keeps its width on a block of any shape. */
export function TutorialHalo({ style }: { style?: StyleProp<ViewStyle> }) {
  const breath = useBreath()
  const run = useRipple()
  const ring = useAnimatedStyle(() => {
    const reach = -(HALO_REACH + HALO_SWELL * breath.value)
    return { opacity: 0.65 + 0.35 * breath.value, top: reach, bottom: reach, left: reach, right: reach }
  })
  const ripple = useAnimatedStyle(() => {
    const reach = -(HALO_REACH + RIPPLE_RUN * run.value)
    return { opacity: run.value === 0 ? 0 : 0.7 * (1 - run.value), top: reach, bottom: reach, left: reach, right: reach }
  })
  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.halo, styles.ripple, style, ripple]} />
      <Animated.View pointerEvents="none" style={[styles.halo, style, ring]} />
    </>
  )
}

/* The thing itself, swelling and settling while the card speaks of it;
   still, and at its own size, when the card does not. */
export function TutorialPulse({ on, style, children }: { on: boolean; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const breath = useBreath(on)
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + PULSE_SWELL * breath.value }],
  }))
  return (
    <Animated.View pointerEvents="none" style={[style, animated]}>
      {children}
    </Animated.View>
  )
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
  ripple: {
    borderWidth: RIPPLE_STROKE,
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
