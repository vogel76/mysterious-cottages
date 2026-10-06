import { useEffect, useMemo } from 'react'
import { DashPathEffect, Group, RoundedRect } from '@shopify/react-native-skia'
import { cancelAnimation, useDerivedValue, useSharedValue, withRepeat, withSequence, withTiming, type SharedValue } from 'react-native-reanimated'
import { EASING, colors, withAlpha } from '../../../ui'
import type { SlotId } from './items'
import type { Slot } from './room'

/* The outlines of edit mode: a dashed rounded frame over the hit box of
   every slot whose furniture can be swapped, so the player sees what is a
   piece and where to tap. The scene hands in the slot table it converts
   its taps through (the vector room's, or the rendered room's with the
   drawn pieces' boxes) and the filter it accepts taps with, so the
   frames, the taps and the panel always name the same slots and the same
   boxes. The frames breathe together on one shared
   opacity; the selected slot's frame stops breathing, turns the accent
   colour and gets a faint accent wash inside, so the sheet below and the
   room agree on what is being chosen. The fireplace has one variant and
   gets no frame. With reduce motion on the frames hold still at their
   mid brightness. Drawn in room units inside the room transform, in the
   front layer, so no furniture covers a frame. */

const PULSE_MS = 1100
const CORNER = 28
const STROKE = 5
const DASH = [22, 14]

export type SlotMarkersProps = {
  /* The slots of the room, with the hit boxes the frames follow. */
  slots: readonly Slot[]
  /* Which of them can be picked, and so get a frame. */
  accept: (slot: SlotId) => boolean
  selected: SlotId | null
  reduceMotion: boolean
}

function Marker({ slot, selected, pulse }: { slot: Slot; selected: boolean; pulse: SharedValue<number> }) {
  const opacity = useDerivedValue(() => (selected ? 0.95 : 0.3 + 0.4 * pulse.value))
  const { hit } = slot
  const x = slot.x + hit.x
  const y = slot.y + hit.y
  return (
    <Group opacity={opacity}>
      {selected ? <RoundedRect x={x} y={y} width={hit.width} height={hit.height} r={CORNER} color={withAlpha(colors.accent, 0.14)} /> : null}
      <RoundedRect x={x} y={y} width={hit.width} height={hit.height} r={CORNER} style="stroke" strokeWidth={STROKE} color={selected ? colors.accentStrong : withAlpha('#ffffff', 0.85)}>
        <DashPathEffect intervals={DASH} />
      </RoundedRect>
    </Group>
  )
}

export function SlotMarkers({ slots, accept, selected, reduceMotion }: SlotMarkersProps) {
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

  const markers = useMemo(
    () => slots.filter((slot) => accept(slot.id)).map((slot) => <Marker key={slot.id} slot={slot} selected={slot.id === selected} pulse={pulse} />),
    [slots, accept, selected, pulse],
  )

  return <Group>{markers}</Group>
}
