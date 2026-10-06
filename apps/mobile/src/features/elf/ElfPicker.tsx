import { useEffect, useMemo, useRef } from 'react'
import { ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import Animated from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { CheckIcon, CloseIcon, IconButton, PressableScale, Text, colors, enterUp, fade, iconSize, leaveDown, mapPalette, radius, space, typeScale, useReducedMotion } from '../../ui'
import { DECOR_IDS, type Decor, type SlotId } from './cottage/items'
import { SLOTS } from './cottage/room'
import { RENDERED_VARIANTS, renderedVariantFor, roomSpriteFor } from './cottage/roomAssets'
import { WEARABLE_IDS, WEARABLE_SLOTS } from './cottage/wearables'
import { ElfThumb, THUMB_SIZE } from './ElfThumb'
import { elfKey } from './labels'
import type { Outfit, StarterId, WearableSlot } from './rules'

/* The wardrobe and the decorating panel: one bottom card in the dark
   chrome of the Atlas, rising in place of the action bar inside the Elf
   tab (not a route: a route would unfocus the tab and pause the scene,
   and the point of the panel is the live preview in the room behind it).
   A header with the title and the way out, a strip of chips for the slots
   (the wearable slots, or every furniture slot but the fireplace), and a
   strip of thumbnails for the active slot: a tap equips or places at once,
   the equipped one wears a check, and tapping it again takes it off where
   the slot allows 'none'. Fixed slots with small catalogues, the way the
   pets that do this well do it. The names under the thumbnails have two
   lines of fixed height, since most of the catalogue's names are longer
   than a thumbnail is wide. The chip strip scrolls to the active slot
   whenever it changes, because in the decorating mode a slot is as often
   picked by a tap in the room as by a chip, and ten chips do not fit a
   phone. Only the active slot's strip is mounted, so a handful of
   thumbnail canvases exist at a time. The tab owns the mode, the active
   slot and what happens on a pick (the provider saves, the scene reacts).

   While the scene draws the rendered art (the tab passes `sprites`), the
   decorating panel offers only what the art pipeline has rendered: the
   slots with more than one rendered variant (the rug, the bed and the
   window today) and within a slot only those variants, so no pick can ask
   the room for a piece it has no picture of. The thumbnails are then the
   sprites themselves (ElfThumb), named after the render they show, and a
   stored id that shares a render with the one offered (the moss rug is
   drawn as the green one) wears the check of the look it has, so tapping
   it does not place what is already there. The vector catalogue stays
   the list for the vector room. */

export type PickerMode = 'wardrobe' | 'decor'
export type PickerSlot = WearableSlot | SlotId

export type ElfPickerProps = {
  mode: PickerMode
  /* Whether the scene draws the rendered art: the catalogue is then the
     rendered variants, the thumbnails the sprites. */
  sprites: boolean
  starter: StarterId
  outfit: Outfit
  decor: Decor
  activeSlot: PickerSlot
  onSelectSlot: (slot: PickerSlot) => void
  /* A pick; the id is 'none' when the equipped item is tapped off. */
  onPick: (slot: PickerSlot, id: string) => void
  onDone: () => void
}

/* The furniture that can be swapped, in the room's own order. */
export const EDITABLE_DECOR_SLOTS: readonly SlotId[] = SLOTS.map((slot) => slot.id).filter((id) => id !== 'fireplace')

/* The same, narrowed to the slots with a choice of rendered variants. */
export const RENDERED_DECOR_SLOTS: readonly SlotId[] = EDITABLE_DECOR_SLOTS.filter((id) => (RENDERED_VARIANTS[id] ?? []).length > 1)

/* The slots the decorating panel offers in a mode of the scene. */
export function decorSlotsFor(sprites: boolean): readonly SlotId[] {
  return sprites ? RENDERED_DECOR_SLOTS : EDITABLE_DECOR_SLOTS
}

/* The variants of a furniture slot in a mode of the scene. */
function decorIdsFor(slot: SlotId, sprites: boolean): readonly string[] {
  return (sprites ? RENDERED_VARIANTS[slot] : DECOR_IDS[slot]) ?? []
}

const NONE = 'none'

export function ElfPicker({ mode, sprites, starter, outfit, decor, activeSlot, onSelectSlot, onPick, onDone }: ElfPickerProps) {
  const { t } = useTranslation()
  const wardrobe = mode === 'wardrobe'
  const slots: readonly PickerSlot[] = wardrobe ? WEARABLE_SLOTS : decorSlotsFor(sprites)
  const ids: readonly string[] = useMemo(
    () => (wardrobe ? (WEARABLE_IDS[activeSlot as WearableSlot] ?? []) : decorIdsFor(activeSlot as SlotId, sprites)),
    [wardrobe, activeSlot, sprites],
  )
  const current = wardrobe ? outfit[activeSlot as WearableSlot] : sprites ? renderedVariantFor(activeSlot as SlotId, decor[activeSlot as SlotId]) : decor[activeSlot as SlotId]
  const allowsNone = ids.includes(NONE)
  const reduceMotion = useReducedMotion()

  /* The chip strip follows the active slot: each chip reports its x once laid out. */
  const chipStrip = useRef<ScrollView>(null)
  const chipX = useRef<Partial<Record<PickerSlot, number>>>({})
  const onChipLayout = (slot: PickerSlot) => (event: LayoutChangeEvent) => {
    chipX.current[slot] = event.nativeEvent.layout.x
    if (slot === activeSlot) chipStrip.current?.scrollTo({ x: Math.max(0, event.nativeEvent.layout.x - space.md), animated: false })
  }
  useEffect(() => {
    const x = chipX.current[activeSlot]
    if (x === undefined) return
    chipStrip.current?.scrollTo({ x: Math.max(0, x - space.md), animated: !reduceMotion })
  }, [activeSlot, reduceMotion])

  /* In sprite mode a thumbnail is named after the render it shows, which
     is also what the room draws for the id. */
  const itemLabel = (id: string) => {
    if (id === NONE) return t('mobile:elf.none')
    const render = sprites && !wardrobe ? roomSpriteFor(activeSlot as SlotId, id)?.variant : undefined
    return t(elfKey('item', render ?? id))
  }

  const pick = (id: string) => {
    if (id !== current) onPick(activeSlot, id)
    else if (allowsNone && id !== NONE) onPick(activeSlot, NONE)
  }

  return (
    <Animated.View entering={enterUp()} exiting={leaveDown()} style={styles.card}>
      <View style={styles.header}>
        <Text weight="bold" variant="compact" style={styles.ink} accessibilityRole="header">
          {t(wardrobe ? 'mobile:elf.wardrobe' : 'mobile:elf.decorate')}
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
            const label = itemLabel(id)
            return (
              <View key={id} style={styles.item}>
                <PressableScale
                  onPress={() => pick(id)}
                  scaleTo={0.92}
                  accessibilityLabel={label}
                  accessibilityState={{ selected }}
                  accessibilityHint={selected && allowsNone && id !== NONE ? t('mobile:elf.removeHint') : undefined}
                  style={[styles.thumb, selected && styles.thumbSelected]}
                >
                  {wardrobe ? (
                    <ElfThumb kind="wearable" slot={activeSlot as WearableSlot} id={id} starter={starter} outfit={outfit} />
                  ) : (
                    <ElfThumb kind="decor" slot={activeSlot as SlotId} id={id} sprite={sprites} />
                  )}
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
