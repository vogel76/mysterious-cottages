import { useEffect, useRef } from 'react'
import { ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import Animated from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { decorFindsNeeded } from '@chatynkowo/core'
import { CheckIcon, CloseIcon, IconButton, LockIcon, PressableScale, Text, colors, enterUp, fade, iconSize, leaveDown, mapPalette, radius, space, typeScale, useReducedMotion } from '../../ui'
import { PHOTO_ID, type Decor, type SlotId } from './cottage/catalogue'
import { SLOTS } from './cottage/room'
import { RENDERED_VARIANTS, renderedVariantFor, roomSpriteFor } from './cottage/roomAssets'
import { ElfThumb, THUMB_SIZE } from './ElfThumb'
import { elfKey } from './labels'

/* The decorating panel: one bottom card in the dark chrome of the Atlas,
   rising in place of the action bar inside the Elf tab (not a route: a
   route would unfocus the tab and pause the scene, and the point of the
   panel is the live preview in the room behind it). A header with the
   title and the way out, a strip of chips for the slots, and a strip of
   thumbnails for the active slot: a tap places at once and the placed one
   wears a check. Fixed slots with small catalogues, the way the pets that
   do this well do it. The panel offers only what the art pipeline has
   rendered: the slots with more than one rendered variant (the rug, the
   bed, the window and, once a cottage has been found, the frame with its
   photo) and within a slot only those variants, so no pick can ask the
   room for a piece it has no picture of. The thumbnails
   are the sprites themselves (ElfThumb), named after the render they
   show, and a stored id that shares a render with the one offered (the
   moss rug is drawn as the green one) wears the check of the look it has,
   so tapping it does not place what is already there. The names under the
   thumbnails have two lines of fixed height, since most of the
   catalogue's names are longer than a thumbnail is wide. A piece the
   cottages found have not unlocked yet (the rules' DECOR_UNLOCKS) stays
   in the strip dimmed, with a lock and how many more cottages it takes
   in place of its name; a tap on it lets the elf say so instead of
   placing it. The chip strip
   scrolls to the active slot whenever it changes, because a slot is as
   often picked by a tap in the room as by a chip. Only the active slot's
   strip is mounted, so a handful of thumbnail canvases exist at a time.
   The tab owns the mode, the active slot and what happens on a pick (the
   provider saves, the scene reacts). */

export type ElfPickerProps = {
  decor: Decor
  /* The latest cottage's picture, for the frame's photo thumbnail. */
  photo: string | null
  /* The slots on offer, as the tab decides them (the frame only with a
     photo), in the room's order. */
  slots: readonly SlotId[]
  /* The cottages found, which unlock some of the pieces. */
  foundCount: number
  activeSlot: SlotId
  onSelectSlot: (slot: SlotId) => void
  onPick: (slot: SlotId, id: string) => void
  onDone: () => void
}

/* The furniture the panel can offer, in the room's own order: the slots
   with a choice of rendered variants. The tab narrows it to what is on
   offer right now (the frame only once there is a photo). */
export const DECOR_SLOTS: readonly SlotId[] = SLOTS.map((slot) => slot.id).filter((id) => id !== 'fireplace' && RENDERED_VARIANTS[id].length > 1)

export function ElfPicker({ decor, photo, slots, foundCount, activeSlot, onSelectSlot, onPick, onDone }: ElfPickerProps) {
  const { t } = useTranslation()
  const ids = RENDERED_VARIANTS[activeSlot].filter((id) => id !== PHOTO_ID || photo)
  const current = renderedVariantFor(activeSlot, decor[activeSlot])
  const reduceMotion = useReducedMotion()

  /* The chip strip follows the active slot: each chip reports its x once laid out. */
  const chipStrip = useRef<ScrollView>(null)
  const chipX = useRef<Partial<Record<SlotId, number>>>({})
  const onChipLayout = (slot: SlotId) => (event: LayoutChangeEvent) => {
    chipX.current[slot] = event.nativeEvent.layout.x
    if (slot === activeSlot) chipStrip.current?.scrollTo({ x: Math.max(0, event.nativeEvent.layout.x - space.md), animated: false })
  }
  useEffect(() => {
    const x = chipX.current[activeSlot]
    if (x === undefined) return
    chipStrip.current?.scrollTo({ x: Math.max(0, x - space.md), animated: !reduceMotion })
  }, [activeSlot, reduceMotion])

  /* A thumbnail is named after the render it shows, which is also what
     the room draws for the id; the frame's photo is named for itself. */
  const itemLabel = (id: string) => t(elfKey('item', id === PHOTO_ID ? id : (roomSpriteFor(activeSlot, id)?.variant ?? id)))

  return (
    <Animated.View entering={enterUp()} exiting={leaveDown()} style={styles.card}>
      <View style={styles.header}>
        <Text weight="bold" variant="compact" style={styles.ink} accessibilityRole="header">
          {t('mobile:elf.decorate')}
        </Text>
        <IconButton label={t('mobile:elf.done')} onPress={onDone} style={styles.done}>
          <CloseIcon size={iconSize.md} color={mapPalette.chromeIcon} />
        </IconButton>
      </View>

      <ScrollView ref={chipStrip} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip} keyboardShouldPersistTaps="handled">
        {slots.map((slot) => {
          const active = slot === activeSlot
          return (
            <PressableScale
              key={slot}
              onLayout={onChipLayout(slot)}
              onPress={() => onSelectSlot(slot)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              pressedFill={active ? colors.accentBorder : colors.accentWash}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text variant="small" weight="semibold" style={active ? styles.chipActiveLabel : styles.ink}>
                {t(elfKey('slot', slot))}
              </Text>
            </PressableScale>
          )
        })}
      </ScrollView>

      {/* Keyed by the slot: a new strip fades in while the old one is dropped
          with its canvases. */}
      <Animated.View key={activeSlot} entering={fade()}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip} keyboardShouldPersistTaps="handled">
          {ids.map((id) => {
            const selected = id === current
            /* The piece in the room is the player's whatever the lock says. */
            const needed = selected ? 0 : decorFindsNeeded(activeSlot, id, foundCount)
            const name = itemLabel(id)
            const label = needed > 0 ? t('mobile:elf.lockedLabel', { count: needed }) : name
            return (
              <View key={id} style={styles.item}>
                <PressableScale
                  onPress={() => {
                    if (id !== current) onPick(activeSlot, id)
                  }}
                  scaleTo={0.92}
                  accessibilityLabel={needed > 0 ? `${name}. ${label}` : name}
                  accessibilityState={{ selected }}
                  style={[styles.thumb, selected && styles.thumbSelected]}
                >
                  <View style={needed > 0 ? styles.thumbLocked : undefined}>
                    <ElfThumb slot={activeSlot} id={id} photo={photo} />
                  </View>
                  {selected ? (
                    <View style={styles.check} pointerEvents="none">
                      <CheckIcon size={iconSize.sm} weight="bold" color={colors.accentInk} />
                    </View>
                  ) : null}
                  {needed > 0 ? (
                    <View style={styles.lock} pointerEvents="none">
                      <LockIcon size={iconSize.sm} weight="fill" color={mapPalette.chromeInk} />
                    </View>
                  ) : null}
                </PressableScale>
                <Text variant="label" align="center" numberOfLines={2} style={[styles.itemLabel, needed > 0 && styles.itemLocked]}>
                  {label}
                </Text>
              </View>
            )
          })}
        </ScrollView>
      </Animated.View>
    </Animated.View>
  )
}

const CHECK = 20

const styles = StyleSheet.create({
  card: {
    gap: space.sm,
    paddingVertical: space.md,
    borderWidth: 1,
    borderColor: mapPalette.chromeBorder,
    borderRadius: radius.card,
    backgroundColor: mapPalette.chrome,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: space.lg,
    paddingRight: space.sm,
  },
  ink: {
    color: mapPalette.chromeInk,
  },
  /* Two lines, always the same height, so the strip does not jump between slots. */
  itemLabel: {
    color: mapPalette.chromeInk,
    minHeight: 2 * typeScale.label.lineHeight,
  },
  /* The control's own border takes the chrome's gold, as the HUD's buttons do. */
  done: {
    borderColor: mapPalette.chromeBorder,
    backgroundColor: mapPalette.chrome,
  },
  strip: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.md,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: mapPalette.chromeDivider,
    borderRadius: radius.pill,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accentBorder,
  },
  chipActiveLabel: {
    color: colors.accentInk,
  },
  item: {
    width: THUMB_SIZE + space.sm,
    alignItems: 'center',
    gap: space.xs,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderWidth: 1,
    borderColor: mapPalette.chromeDivider,
    borderRadius: radius.control,
    overflow: 'hidden',
  },
  thumbSelected: {
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentWash,
  },
  /* A locked piece is still seen, faded, so there is something to want;
     the lock and the ring over it keep their strength. */
  thumbLocked: {
    opacity: 0.55,
  },
  itemLocked: {
    opacity: 0.8,
  },
  lock: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: CHECK,
    height: CHECK,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: mapPalette.chrome,
  },
  check: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: CHECK,
    height: CHECK,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
})
