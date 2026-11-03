import { useEffect, useRef } from 'react'
import { ScrollView, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native'
import Animated from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { decorFindsNeeded, type ElfForm } from '@chatynkowo/core'
import { CheckIcon, LockIcon, PressableScale, TAB_BAR_OVERHANG, Text, colors, fade, iconSize, mapPalette, radius, space, typeScale, useReducedMotion } from '../../ui'
import { PHOTO_ID, WEARABLE_IDS, type Decor, type SlotId } from './cottage/catalogue'
import { RENDERED_VARIANTS, renderedVariantFor } from './cottage/roomAssets'
import { ElfThumb } from './ElfThumb'
import { elfKey } from './labels'

/* The catalogue of the decorating mode: a panel of the HUD's solid chrome
   standing on the tab bar in place of the care band, inside the Elf tab
   (not a route: a route would unfocus the tab and pause the scene, and
   the point is the live preview in the room above it). A row of category
   tabs: the elf's hat first once it has hatched (the room then brings the
   elf to the middle and a tap puts the hat on), then one per place in the
   room with a choice (the walls and the floor first, then the pieces
   from the largest; the places with more than one
   rendered variant, the frame only once a cottage has been found), and
   under it a row of large cards for the active category,
   three to the width (a fourth peeking when there are more): the piece's
   picture on a light card, its name under it, a check on the one in the
   room. A tap on a card places the piece at once; the room above shows
   it, and the place is lit there. A piece the cottages found have not
   unlocked yet (the rules' DECOR_UNLOCKS) stays in the row, dimmed, with
   a lock and how many more cottages it takes in place of its name; a tap
   on it lets the elf say so instead of placing it. The category row
   scrolls to the active tab whenever it changes, since a category is as
   often picked by a tap in the room as by a tab. Only the active
   category's cards are mounted, so a handful of thumbnails exist at a
   time. The tab owns the mode, the active category and what happens on a
   pick (the provider saves, the scene reacts). */

/* A tab of the catalogue: a place of the room, or the elf's hat. */
export type CatalogueTab = SlotId | 'hat'

export type ElfDecorPanelProps = {
  /* The elf's form, whose head the wardrobe's pictures show. */
  form?: ElfForm
  decor: Decor
  /* The hat the elf wears. */
  hat: string
  /* The latest cottage's picture, for the frame's photo card. */
  photo: string | null
  /* The tabs on offer, as the tab decides them (the hat once hatched, the
     frame only with a photo), in the catalogue's order. */
  tabs: readonly CatalogueTab[]
  /* The cottages found, which unlock some of the pieces. */
  foundCount: number
  activeTab: CatalogueTab
  onSelectTab: (tab: CatalogueTab) => void
  onPick: (tab: CatalogueTab, id: string) => void
  onLayout?: (event: LayoutChangeEvent) => void
}

/* The places the catalogue can offer, in its own order: the surfaces,
   then the pieces from the largest, those with a choice of rendered
   variants. The tab narrows it to what is on offer right now (the frame
   only once there is a photo). */
const CATALOGUE_ORDER: readonly SlotId[] = ['wall', 'floor', 'rug', 'bed', 'window', 'picture', 'shelf', 'lantern', 'herbs', 'basket', 'fern', 'candle']
export const DECOR_SLOTS: readonly SlotId[] = CATALOGUE_ORDER.filter((id) => RENDERED_VARIANTS[id].length > 1)

/* Three cards to the width; with more than three a fourth peeks in, so
   the row says it scrolls. */
function cardWidth(screenWidth: number, count: number): number {
  const visible = count > 3 ? 3.3 : 3
  return Math.floor((screenWidth - space.lg - (count > 3 ? 0 : space.lg) - space.sm * Math.ceil(visible - 1)) / visible)
}

export function ElfDecorPanel({ decor, hat, form, photo, tabs, foundCount, activeTab, onSelectTab, onPick, onLayout }: ElfDecorPanelProps) {
  const { t } = useTranslation()
  const { width } = useWindowDimensions()
  const wardrobe = activeTab === 'hat'
  /* What a tab offers, and how much of it the cottages found have unlocked. */
  const offered = (tab: CatalogueTab) => (tab === 'hat' ? WEARABLE_IDS.hat : RENDERED_VARIANTS[tab].filter((id) => id !== PHOTO_ID || photo))
  const unlockedOf = (tab: CatalogueTab, pieces: readonly string[]) => pieces.filter((id) => decorFindsNeeded(tab, id, foundCount) === 0).length
  const ids = offered(activeTab)
  const current = wardrobe ? hat : renderedVariantFor(activeTab, decor[activeTab])
  const reduceMotion = useReducedMotion()
  const card = cardWidth(width, ids.length)
  const thumb = card - 2 * space.sm

  /* The category row follows the active tab: each tab reports its x once laid out. */
  const tabStrip = useRef<ScrollView>(null)
  const tabX = useRef<Partial<Record<CatalogueTab, number>>>({})
  const onTabLayout = (tab: CatalogueTab) => (event: LayoutChangeEvent) => {
    tabX.current[tab] = event.nativeEvent.layout.x
    if (tab === activeTab) tabStrip.current?.scrollTo({ x: Math.max(0, event.nativeEvent.layout.x - space.lg), animated: false })
  }
  useEffect(() => {
    const x = tabX.current[activeTab]
    if (x === undefined) return
    tabStrip.current?.scrollTo({ x: Math.max(0, x - space.lg), animated: !reduceMotion })
  }, [activeTab, reduceMotion])

  /* A card is named after its id, which is also its render; the bare
     head is named as such. */
  const itemLabel = (id: string) => (wardrobe && id === 'none' ? t('mobile:elf.hatNone') : t(elfKey('item', id)))

  return (
    <View style={styles.panel} onLayout={onLayout}>
      <ScrollView ref={tabStrip} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} keyboardShouldPersistTaps="handled">
        {tabs.map((tab) => {
          const active = tab === activeTab
          const name = t(elfKey('slot', tab))
          const pieces = offered(tab)
          const unlocked = unlockedOf(tab, pieces)
          return (
            <PressableScale
              key={tab}
              onLayout={onTabLayout(tab)}
              onPress={() => onSelectTab(tab)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t('mobile:elf.catalogueTabAria', { name, unlocked, total: pieces.length })}
              pressedFill={active ? colors.accentBorder : colors.accentWash}
              style={[styles.tab, active && styles.tabActive]}
            >
              <View style={styles.tabInner}>
                <Text variant="small" weight="semibold" style={active ? styles.tabActiveLabel : styles.ink}>
                  {name}
                </Text>
                {/* The collection's count: how many of the tab's pieces the finds have unlocked. */}
                <Text variant="small" style={active ? styles.tabActiveCount : styles.tabCount}>
                  {unlocked}/{pieces.length}
                </Text>
              </View>
            </PressableScale>
          )
        })}
      </ScrollView>

      {/* Keyed by the category: a new row fades in while the old one is
          dropped with its thumbnails. */}
      <Animated.View key={activeTab} entering={fade()}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards} keyboardShouldPersistTaps="handled">
          {ids.map((id) => {
            const selected = id === current
            /* The piece in the room is the player's whatever the lock says. */
            const needed = selected ? 0 : decorFindsNeeded(activeTab, id, foundCount)
            const name = itemLabel(id)
            const label = needed > 0 ? t('mobile:elf.lockedLabel', { count: needed }) : name
            return (
              <PressableScale
                key={id}
                onPress={() => {
                  if (id !== current) onPick(activeTab, id)
                }}
                scaleTo={0.95}
                accessibilityLabel={needed > 0 ? `${name}. ${label}` : name}
                accessibilityState={{ selected }}
                pressedFill={colors.accentWash}
                style={[styles.card, { width: card }, selected && styles.cardSelected]}
              >
                <View style={[styles.picture, { width: thumb, height: thumb }, needed > 0 && styles.pictureLocked]}>
                  <ElfThumb slot={activeTab} id={id} photo={photo} size={thumb} form={form} />
                </View>
                <Text variant="label" weight="semibold" align="center" numberOfLines={2} style={[styles.name, needed > 0 && styles.nameLocked]}>
                  {label}
                </Text>
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
            )
          })}
        </ScrollView>
      </Animated.View>
    </View>
  )
}

const BADGE = 24

const styles = StyleSheet.create({
  /* Solid chrome edge to edge on the tab bar, like the care band; the
     bottom keeps clear of the discover key's overhang. */
  panel: {
    gap: space.sm,
    paddingTop: space.md,
    paddingBottom: TAB_BAR_OVERHANG + space.sm,
    borderTopWidth: 1,
    borderTopColor: mapPalette.chromeBorder,
    backgroundColor: mapPalette.chromeSolid,
  },
  ink: {
    color: mapPalette.chromeInk,
  },
  tabs: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.lg,
  },
  tab: {
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    borderWidth: 1,
    borderColor: mapPalette.chromeDivider,
    borderRadius: radius.pill,
  },
  tabActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accentBorder,
  },
  tabActiveLabel: {
    color: colors.accentInk,
  },
  tabInner: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.xs,
  },
  tabCount: {
    color: colors.inkFaint,
  },
  tabActiveCount: {
    color: colors.accentInk,
    opacity: 0.8,
  },
  cards: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.lg,
  },
  card: {
    alignItems: 'center',
    gap: space.xs,
    padding: space.sm,
    borderWidth: 1,
    borderColor: mapPalette.chromeDivider,
    borderRadius: radius.card,
  },
  cardSelected: {
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentWash,
  },
  /* The piece on a light card: the renders are lit by the room's day, and
     a dark wood or iron piece would sink into the chrome. */
  picture: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control,
    backgroundColor: mapPalette.parchmentTint,
    overflow: 'hidden',
  },
  /* A locked piece is still seen, faded, so there is something to want;
     the lock over it keeps its strength. */
  pictureLocked: {
    opacity: 0.5,
  },
  /* Two lines, always the same height, so the row does not jump between
     categories. */
  name: {
    color: mapPalette.chromeInk,
    minHeight: 2 * typeScale.label.lineHeight,
  },
  nameLocked: {
    opacity: 0.8,
  },
  check: {
    position: 'absolute',
    top: space.xs,
    right: space.xs,
    width: BADGE,
    height: BADGE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  lock: {
    position: 'absolute',
    top: space.xs,
    left: space.xs,
    width: BADGE,
    height: BADGE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: mapPalette.chromeSolid,
  },
})
