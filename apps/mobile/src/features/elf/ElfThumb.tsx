import { memo, useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { Canvas, Group, Image, useImage } from '@shopify/react-native-skia'
import { useSharedValue, type SharedValue } from 'react-native-reanimated'
import { ElfPuppet, puppetHitBox } from './cottage/ElfPuppet'
import { decorItem, type SlotId } from './cottage/items'
import type { FireMotion } from './cottage/items/Fireplace'
import type { PuppetMotion } from './cottage/motion'
import { SLOTS } from './cottage/room'
import { roomSpriteFor } from './cottage/roomAssets'
import type { Outfit, StarterId, WearableSlot } from './rules'

/* One thumbnail of the pickers: a small Skia canvas that draws either a
   piece of furniture from the decor catalogue or the elf itself wearing
   one wearable of the wardrobe, so the player sees the real drawing before
   choosing it (the live preview is the room behind the panel). The scene's
   drawings take their life from shared values; here every value is built
   once at rest and never animated (the fire stands, the puppet holds its
   still pose), so a strip of thumbnails costs nothing per frame. A decor
   thumb fits the item's bounds into the square with a little padding; a
   wearable thumb fits the whole baby figure, wearing the current outfit
   with the one slot replaced, and 'none' is simply the figure without the
   item. The pickers mount only the active slot's strip, so a handful of
   canvases exist at a time.

   While the scene draws the rendered art, a decor thumb shows the piece's
   own sprite, the transparent crop the room draws (cottage/roomAssets),
   fitted into the square the same way; a piece without a rendered sprite
   falls back to its vector drawing, so the strip is never blank. The crops
   are small (a few hundred pixels a side), so Skia's useImage decoding
   them per thumbnail is cheap, unlike the sheets and the painting, which
   are shared. */

export const THUMB_SIZE = 72
const PADDING = 6
const INNER = THUMB_SIZE - 2 * PADDING

/* The rest value of every control of the puppet and of the fire: the still
   pose of the scene's reduced-motion branch. Typed against the motion
   types, so a control added there is a compile error here, not a thumb
   drawn with a missing value. */
const PUPPET_REST: Record<keyof PuppetMotion, number> = {
  breath: 0.5,
  bob: 0,
  squash: 1,
  tilt: 0,
  blink: 0,
  look: 0,
  lookY: 0,
  mouth: 0,
  glow: 0,
  headTilt: 0,
  earWiggle: 0,
  hoodSwing: 0,
  armL: 0,
  armR: 0,
  lidDroop: 0,
  grin: 0,
  browLift: 0,
}
const FIRE_REST: Record<keyof FireMotion, number> = { flicker: 0.5, sway: 0.5, candle: 0.5, swing: 0, day: 0 }

/* One shared value per entry of a rest table, never animated. The table is
   a module constant, so the hook count is constant; the object is memoised
   once so the Skia nodes keep their bindings. */
function useStillValues<K extends string>(rest: Record<K, number>): Record<K, SharedValue<number>> {
  const values = {} as Record<K, SharedValue<number>>
  for (const key of Object.keys(rest) as K[]) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    values[key] = useSharedValue(rest[key])
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => values, [])
}

function useStillPuppetMotion(): PuppetMotion {
  return useStillValues(PUPPET_REST)
}

function useStillFireMotion(): FireMotion {
  return useStillValues(FIRE_REST)
}

export type DecorThumbProps = {
  kind: 'decor'
  slot: SlotId
  id: string
  /* Whether the thumb shows the rendered sprite when the piece has one. */
  sprite?: boolean
}
export type WearableThumbProps = { kind: 'wearable'; slot: WearableSlot; id: string; starter: StarterId; outfit: Outfit }
export type ElfThumbProps = DecorThumbProps | WearableThumbProps

export const ElfThumb = memo(function ElfThumb(props: ElfThumbProps) {
  return <View style={styles.thumb}>{props.kind === 'decor' ? <DecorThumb {...props} /> : <WearableThumb {...props} />}</View>
})

function DecorThumb(props: DecorThumbProps) {
  const sprite = props.sprite ? roomSpriteFor(props.slot, props.id) : null
  return sprite ? <SpriteDecorThumb module={sprite.module} width={sprite.width} height={sprite.height} /> : <VectorDecorThumb {...props} />
}

/* The rendered crop, fitted into the padded square and centred: the
   Image node's contain fit keeps its proportions, which is all the room
   itself does with it. */
function SpriteDecorThumb({ module, width, height }: { module: number; width: number; height: number }) {
  const image = useImage(module)
  const rect = useMemo(() => {
    const scale = Math.min(INNER / Math.max(1, width), INNER / Math.max(1, height))
    const fitted = { width: width * scale, height: height * scale }
    return { x: (THUMB_SIZE - fitted.width) / 2, y: (THUMB_SIZE - fitted.height) / 2, ...fitted }
  }, [width, height])
  return <Canvas style={styles.canvas}>{image ? <Image image={image} fit="contain" x={rect.x} y={rect.y} width={rect.width} height={rect.height} /> : null}</Canvas>
}

function VectorDecorThumb({ slot, id }: DecorThumbProps) {
  const fire = useStillFireMotion()
  const item = decorItem(slot, id)
  /* The item draws around its real slot's anchor; the transform moves the
     middle of its bounds to the middle of the square and scales it in. */
  const roomSlot = useMemo(() => SLOTS.find((entry) => entry.id === slot) ?? SLOTS[0], [slot])
  const transform = useMemo(() => {
    const { bounds } = item
    const scale = Math.min(INNER / Math.max(1, bounds.width), INNER / Math.max(1, bounds.height))
    const centerX = roomSlot.x + bounds.x + bounds.width / 2
    const centerY = roomSlot.y + bounds.y + bounds.height / 2
    return [{ translateX: THUMB_SIZE / 2 - centerX * scale }, { translateY: THUMB_SIZE / 2 - centerY * scale }, { scale }]
  }, [item, roomSlot])
  const Item = item.Component
  return (
    <Canvas style={styles.canvas}>
      <Group transform={transform}>
        <Item slot={roomSlot} fire={fire} />
      </Group>
    </Canvas>
  )
}

function WearableThumb({ slot, id, starter, outfit }: WearableThumbProps) {
  const motion = useStillPuppetMotion()
  const worn = useMemo<Outfit>(() => ({ ...outfit, [slot]: id }), [outfit, slot, id])
  /* The baby figure, feet at the origin, fitted by its hit box (ears and
     hood tip included) into the square. */
  const transform = useMemo(() => {
    const box = puppetHitBox('baby')
    const scale = Math.min(INNER / box.width, INNER / box.height)
    const centerX = box.x + box.width / 2
    const centerY = box.y + box.height / 2
    return [{ translateX: THUMB_SIZE / 2 - centerX * scale }, { translateY: THUMB_SIZE / 2 - centerY * scale }, { scale }]
  }, [])
  return (
    <Canvas style={styles.canvas}>
      <Group transform={transform}>
        <ElfPuppet stage="baby" starter={starter} mood="ok" sleeping={false} motion={motion} origin={ORIGIN} outfit={worn} />
      </Group>
    </Canvas>
  )
}

const ORIGIN = { x: 0, y: 0 }

const styles = StyleSheet.create({
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
  },
  canvas: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
  },
})
