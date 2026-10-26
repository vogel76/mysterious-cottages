import { useEffect, useRef } from 'react'
import { ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import Animated from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { CheckIcon, CloseIcon, IconButton, PressableScale, Text, colors, enterUp, fade, iconSize, leaveDown, mapPalette, radius, space, typeScale, useReducedMotion } from '../../ui'
import type { Decor, SlotId } from './cottage/catalogue'
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
   bed and the window today) and within a slot only those variants, so no
   pick can ask the room for a piece it has no picture of. The thumbnails
   are the sprites themselves (ElfThumb), named after the render they
   show, and a stored id that shares a render with the one offered (the
   moss rug is drawn as the green one) wears the check of the look it has,
   so tapping it does not place what is already there. The names under the
   thumbnails have two lines of fixed height, since most of the
   catalogue's names are longer than a thumbnail is wide. The chip strip
   scrolls to the active slot whenever it changes, because a slot is as
   often picked by a tap in the room as by a chip. Only the active slot's
   strip is mounted, so a handful of thumbnail canvases exist at a time.
   The tab owns the mode, the active slot and what happens on a pick (the
   provider saves, the scene reacts). */

export type ElfPickerProps = {
  decor: Decor
  activeSlot: SlotId
  onSelectSlot: (slot: SlotId) => void
  onPick: (slot: SlotId, id: string) => void
  onDone: () => void
}

/* The furniture the panel offers, in the room's own order: the slots with
   a choice of rendered variants. */
export const DECOR_SLOTS: readonly SlotId[] = SLOTS.map((slot) => slot.id).filter((id) => id !== 'fireplace' && RENDERED_VARIANTS[id].length > 1)

export function ElfPicker({ decor, activeSlot, onSelectSlot, onPick, onDone }: ElfPickerProps) {
  const { t } = useTranslation()
  const ids = RENDERED_VARIANTS[activeSlot]
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
     the room draws for the id. */
  const itemLabel = (id: string) => t(elfKey('item', roomSpriteFor(activeSlot, id)?.variant ?? id))

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
        {DECOR_SLOTS.map((slot) => {
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
            const label = itemLabel(id)
            return (
              <View key={id} style={styles.item}>
                <PressableScale
                  onPress={() => {
                    if (id !== current) onPick(activeSlot, id)
                  }}
                  scaleTo={0.92}
                  accessibilityLabel={label}
                  accessibilityState={{ selected }}
                  style={[styles.thumb, selected && styles.thumbSelected]}
                >
                  <ElfThumb slot={activeSlot} id={id} />
                  {selected ? (
                    <View style={styles.check} pointerEvents="none">
                      <CheckIcon size={iconSize.sm} weight="bold" color={colors.accentInk} />
                    </View>
                  ) : null}
                </PressableScale>
                <Text variant="label" align="center" numberOfLines={2} style={styles.itemLabel}>
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
