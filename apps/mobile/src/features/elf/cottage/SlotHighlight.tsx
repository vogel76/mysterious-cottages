import { useEffect } from 'react'
import { Group, RoundedRect } from '@shopify/react-native-skia'
import { cancelAnimation, useDerivedValue, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated'
import { EASING, colors, withAlpha } from '../../../ui'
import type { Slot } from './room'

/* The place the decorating catalogue is choosing for, lit in the room: a
   soft wash of the accent over the piece's box and a solid rim around it,
   breathing slowly, so the player sees where the card they tap goes. Only
   that place is lit; the rest of the room is left as it is. With reduce
   motion on the light holds still. Drawn in room units inside the room
   transform, in front of everything. */

const PULSE_MS = 1200
const CORNER = 24
const STROKE = 4
/* The light reaches a little beyond the piece. */
const PAD = 10

export type SlotHighlightProps = {
  slot: Slot
  reduceMotion: boolean
}

export function SlotHighlight({ slot, reduceMotion }: SlotHighlightProps) {
  const pulse = useSharedValue(0.5)
  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(pulse)
      pulse.value = 0.5
      return
    }
    pulse.value = withRepeat(withSequence(withTiming(1, { duration: PULSE_MS, easing: EASING.inOut }), withTiming(0, { duration: PULSE_MS, easing: EASING.inOut })), -1, false)
    return () => cancelAnimation(pulse)
  }, [pulse, reduceMotion])
  const opacity = useDerivedValue(() => 0.55 + 0.45 * pulse.value)
  const { hit } = slot
  const x = slot.x + hit.x - PAD
  const y = slot.y + hit.y - PAD
  const width = hit.width + 2 * PAD
  const height = hit.height + 2 * PAD
  return (
    <Group opacity={opacity}>
      <RoundedRect x={x} y={y} width={width} height={height} r={CORNER} color={withAlpha(colors.accent, 0.16)} />
      <RoundedRect x={x} y={y} width={width} height={height} r={CORNER} style="stroke" strokeWidth={STROKE} color={colors.accentStrong} />
    </Group>
  )
}
