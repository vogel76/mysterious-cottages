import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { type ElfMood, type ElfNeedId, type ElfStage, type ElfWallet, type ElfPath } from '@chatynkowo/core'
import { AcornsIcon, DustIcon, EggIcon, GetMoreIcon, HurryIcon, LevelBadgeIcon, PressableScale, StreakIcon, Text, colors, fade, iconSize, mapPalette, radius, space, type Icon, type TextProps } from '../../ui'
import { durationText, useClock } from './duration'
import { elfKey, pathKey } from './labels'
import { TutorialHalo } from './TutorialHalo'

/* The strip over the cottage, in the dark chrome of the Atlas's cards so
   the two full-bleed tabs read alike, laid out the way a game's home
   screen is: who the elf is on the left, the purse on the right, and the
   room starts under it, never behind it. The name block holds the elf's
   name (or "the egg") with the level in a gold pill at the end of the
   line, which wears a dot while the elf may grow; under it what the elf
   asks for in gold (the need it wants seen to, that it may grow, its
   request of the day, that it misses the player), or else its form and,
   once chosen, its nature; and a thin bar of the experience towards the
   next level along the foot. A tap on it opens the tree of development.
   The purse is a column of three pills, each a glyph and its figure: the
   acorns and the days in a row open the day's sheet (/elf-today), where
   the figures are named and explained, and the star dust wears the plus
   that opens the shop, the way games put the way to more of a currency
   on the currency itself. Before the hatch a second row holds the egg's
   countdown, in one width and figures of one width so the row never
   shifts, and beside it the gold "hurry" button, which opens the
   skip of the wait (/elf-hurry): the first egg's is free, and the button
   says so. Everything else the elf does is one tap away on the round
   buttons along the sides of the room (ElfRails) and on the care band
   at the bottom (ElfActionBar); what the elf says in the moment is in
   its speech bubble (ElfSpeech). Every text here is plain and in its
   ordinary case, so a child reads it at a glance; a value that changes
   fades in anew and leaves nothing behind (no exit animation and no
   layout transition, which can leave a ghost of the old words on a strip
   that re-renders every few seconds). */

/* Which panel of the tab is open, if any; the HUD leaves while one is. */
export type ElfPanel = 'none' | 'decor'

/* What a tutorial step can light on the strip. */
export type HudSpot = 'name' | 'purse' | 'hurry'

export type ElfHudProps = {
  name: string
  stage: ElfStage
  mood: ElfMood
  /* The need the elf would like seen to, when one is under the mark. */
  wantedNeed: ElfNeedId | null
  /* When the egg hatches on its own; null once hatched. */
  hatchAt: number | null
  /* The first egg's wait is skipped for free. */
  freeHatch: boolean
  /* The egg is ready to crack (its hour came, a cottage was found, the
     wait was bought): the countdown says "now" and the hurry goes, without
     waiting for the countdown's clock to tick. */
  hatchReady: boolean
  wallet: ElfWallet
  /* Days visited in a row. */
  streak: number
  /* The elf's level and how far its experience has come towards the next
     level (0..1); the level is null for the egg, which has none. A tap on
     the name block opens the tree. */
  level: number | null
  xpFraction: number
  /* The nature chosen in the tree, named after the form. */
  archetype: ElfPath | null
  /* The elf may grow to its next form: the mood line says so and the
     level wears a dot. */
  growthReady: boolean
  /* The elf's request of the day, in its words, while it is open. */
  request: string | null
  onTree: () => void
  /* The acorns or the streak tapped: the day's sheet. */
  onPurse: () => void
  /* The star dust tapped: the shop. */
  onShop: () => void
  /* The egg's hurry: the skip of its wait. */
  onHurry: () => void
  /* What a tutorial step lights. */
  lit?: HudSpot | null
}

export function ElfHud({ name, stage, mood, wantedNeed, hatchAt, freeHatch, hatchReady, wallet, streak, level, xpFraction, archetype, growthReady, request, onTree, onPurse, onShop, onHurry, lit = null }: ElfHudProps) {
  const { t } = useTranslation()
  const egg = stage === 'egg' && hatchAt !== null
  const form = t(elfKey('stage', stage))
  const whatItIs = archetype ? `${form} · ${t(pathKey(archetype))}` : form
  /* The egg goes by its own word; an elf still to be named by the plain name. */
  const shownName = stage === 'egg' ? form : name || t('mobile:elf.defaultName')
  return (
    <View style={styles.top} pointerEvents="box-none">
      <View style={styles.topRow} pointerEvents="box-none">
        <PressableScale
          onPress={onTree}
          disabled={level === null}
          accessibilityRole="header"
          accessibilityLabel={level === null ? `${name || form}. ${whatItIs}` : `${name}. ${whatItIs}. ${t('mobile:elf.hudLevel', { level })}${growthReady ? `. ${t('mobile:elf.hudGrowReady')}` : ''}`}
          accessibilityHint={level === null ? undefined : t('mobile:elf.treeHint')}
          pressedFill="transparent"
          ripple={false}
          style={[styles.chrome, styles.identity]}
        >
          {lit === 'name' ? <TutorialHalo style={styles.haloBlock} /> : null}
          <View style={styles.identityWords}>
            {/* The name and the level share a line. */}
            <View style={styles.nameRow}>
              <Text weight="bold" variant="compact" numberOfLines={1} style={[styles.chromeInk, styles.name]}>
                {shownName}
              </Text>
              {level !== null ? (
                <View style={styles.level}>
                  <LevelBadgeIcon size={iconSize.xs} weight="fill" color={colors.accentInk} />
                  <Text variant="label" weight="bold" style={styles.levelInk}>
                    {t('mobile:elf.hudLevel', { level })}
                  </Text>
                  {growthReady ? <View style={styles.growDot} /> : null}
                </View>
              ) : null}
            </View>
            <StatusLine name={name} stage={stage} mood={mood} whatItIs={whatItIs} hatchAt={hatchAt} hatchReady={hatchReady} wantedNeed={wantedNeed} growthReady={growthReady} request={request} />
          </View>
          {/* The experience towards the next level, along the block's foot. */}
          {level !== null ? (
            <View style={styles.xpTrack}>
              <View style={[styles.xpFill, { width: `${Math.round(100 * Math.min(1, Math.max(0, xpFraction)))}%` }]} />
            </View>
          ) : null}
        </PressableScale>
        {/* The purse: the acorns, the star dust with its plus, the days in a row. */}
        <View style={styles.purse} pointerEvents="box-none">
          {lit === 'purse' ? <TutorialHalo style={styles.haloBlock} /> : null}
          <PursePill Glyph={AcornsIcon} value={wallet.acorns} label={t('mobile:elf.purseAcornsAria', { count: wallet.acorns })} onPress={onPurse} />
          <PursePill Glyph={DustIcon} value={wallet.dust} label={t('mobile:elf.purseDustAria', { count: wallet.dust })} onPress={onShop} more />
          <PursePill Glyph={StreakIcon} value={streak} label={t('mobile:elf.purseStreakAria', { count: streak })} onPress={onPurse} />
        </View>
      </View>
      {egg ? (
        <View style={styles.eggRow} pointerEvents="box-none">
          <EggChip hatchAt={hatchAt} ready={hatchReady} onPress={onHurry} />
          <HurryButton hatchAt={hatchAt} ready={hatchReady} free={freeHatch} lit={lit === 'hurry'} onPress={onHurry} />
        </View>
      ) : null}
    </View>
  )
}

/* A text of the strip whose value changes in place: the new value fades
   in, keyed by its content; the old one simply goes (no exit animation,
   no layout transition: nothing can linger over the new words). */
function FadeText({ value, lineStyle, ...rest }: TextProps & { value: string; lineStyle?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View key={value} entering={fade()} style={[styles.fadeLine, lineStyle]}>
      <Text {...rest}>{value}</Text>
    </Animated.View>
  )
}

/* The egg's countdown in words (duration.ts keeps the clock); a ready egg
   is due at once, whatever the clock last said. */
function useHatchWhen(hatchAt: number | null, ready = false): { when: string; due: boolean } | null {
  const { t } = useTranslation()
  const now = useClock(hatchAt !== null && !ready)
  if (hatchAt === null) return null
  const left = hatchAt - now
  if (ready || left <= 0) return { when: t('mobile:elf.hatchSoon'), due: true }
  return { when: t('mobile:elf.hatchIn', { time: durationText(t, left) }), due: false }
}

/* Before the hatch: the egg and how long until it hatches; a tap opens
   the skip of the wait, like the button beside it. */
function EggChip({ hatchAt, ready, onPress }: { hatchAt: number; ready: boolean; onPress: () => void }) {
  const { t } = useTranslation()
  const hatch = useHatchWhen(hatchAt, ready)
  const when = hatch?.when ?? ''
  return (
    <PressableScale
      onPress={onPress}
      disabled={hatch?.due}
      accessibilityLabel={t('mobile:elf.hatchAria', { when })}
      accessibilityHint={hatch?.due ? undefined : t('mobile:elf.hatchSkipHint')}
      style={[styles.chrome, styles.pill]}
    >
      <EggIcon size={iconSize.sm} weight="fill" color={mapPalette.chromeIcon} />
      {/* One width for every count, in figures of one width: the row would otherwise shift each minute. */}
      <FadeText value={when} variant="small" weight="bold" style={[styles.chromeInk, styles.figures]} lineStyle={styles.countdownLine} />
    </PressableScale>
  )
}

/* The gold button beside the countdown: the skip of the wait, free for
   the first egg; gone once the egg is ready. */
function HurryButton({ hatchAt, ready, free, lit, onPress }: { hatchAt: number; ready: boolean; free: boolean; lit: boolean; onPress: () => void }) {
  const { t } = useTranslation()
  const hatch = useHatchWhen(hatchAt, ready)
  if (!hatch || hatch.due) return null
  const label = t(free ? 'mobile:elf.hurryFreeChip' : 'mobile:elf.hurryAction')
  return (
    <View pointerEvents="box-none">
      {lit ? <TutorialHalo /> : null}
      <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} pressedFill={colors.accentBorder} style={styles.hurry}>
        <HurryIcon size={iconSize.sm} weight="fill" color={colors.accentInk} />
        <Text variant="small" weight="bold" style={styles.levelInk}>
          {label}
        </Text>
      </PressableScale>
    </View>
  )
}

/* One figure of the purse: the glyph and the count, which fades in anew
   when it changes; the star dust's pill wears the plus of the shop. */
function PursePill({ Glyph, value, label, onPress, more = false }: { Glyph: Icon; value: number; label: string; onPress: () => void; more?: boolean }) {
  const { t } = useTranslation()
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={more ? t('mobile:elf.purseShopHint') : t('mobile:elf.purseHint')}
      hitSlop={{ top: 3, bottom: 3 }}
      style={[styles.chrome, styles.pill, styles.pursePill]}
    >
      <Glyph size={iconSize.sm} weight="fill" color={mapPalette.chromeIcon} />
      <View style={styles.purseFigure}>
        <FadeText value={String(value)} variant="small" weight="bold" style={[styles.chromeInk, styles.figures]} />
      </View>
      {more ? (
        <View style={styles.more}>
          <GetMoreIcon size={iconSize.xs} weight="bold" color={colors.accentInk} />
        </View>
      ) : null}
    </PressableScale>
  )
}

/* ---------- The status line ---------- */

type StatusLineProps = {
  name: string
  stage: ElfStage
  mood: ElfMood
  /* The form and, once chosen, the nature. */
  whatItIs: string
  /* When the egg is ready to hatch; null once hatched. */
  hatchAt: number | null
  hatchReady: boolean
  wantedNeed: ElfNeedId | null
  growthReady: boolean
  request: string | null
}

/* The second line of the name block: the need the elf wants seen to
   (the care comes first), else that it may grow, else its request of
   the day, else that it misses the player, in gold; otherwise what the elf is (its form and nature).
   The egg's line says how it hatches and stays the same until the hatch
   is due: the chip carries the countdown, and a line that changed every
   minute would be read out every minute. */
function StatusLine({ name: given, stage, mood, whatItIs, hatchAt, hatchReady, wantedNeed, growthReady, request }: StatusLineProps) {
  const { t } = useTranslation()
  /* An elf still to be named (the hatch sheet is up) goes by the plain name. */
  const name = given || t('mobile:elf.defaultName')
  const hatch = useHatchWhen(stage === 'egg' ? hatchAt : null, hatchReady)
  if (hatch) return <FadeText value={hatch.due ? t('mobile:elf.moodEggDue') : t('mobile:elf.moodEgg')} variant="small" numberOfLines={2} style={hatch.due ? styles.want : styles.chromeInk} />
  const asks = wantedNeed ? t(elfKey('wants', wantedNeed), { name }) : growthReady ? t('mobile:elf.hudGrowReady') : request ?? (mood === 'misses' ? t(elfKey('mood', mood), { name }) : null)
  return <FadeText value={asks ?? whatItIs} variant="small" numberOfLines={2} style={asks ? styles.want : styles.stage} />
}

/* The purse's figures and the countdown keep one width whatever they say. */
const PURSE_FIGURE = 40
const COUNTDOWN_WIDTH = 100
const MORE = 18

const styles = StyleSheet.create({
  top: {
    gap: space.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: space.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  chrome: {
    borderWidth: 1,
    borderColor: mapPalette.chromeBorder,
    borderRadius: radius.control,
    backgroundColor: mapPalette.chrome,
  },
  /* The name block takes the width the purse leaves, so the mood line
     has room for two lines. */
  identity: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    gap: 2,
  },
  /* The words at the top of the block, the experience along its foot. */
  identityWords: {
    gap: 2,
  },
  chromeInk: {
    color: mapPalette.chromeInk,
  },
  fadeLine: {
    flexShrink: 1,
  },
  name: {
    flexShrink: 1,
  },
  stage: {
    color: mapPalette.chromeInk,
    opacity: 0.85,
  },
  /* The level: a gold pill at the end of the line, the ink of the gold
     buttons on it. */
  level: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 1,
    paddingHorizontal: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  levelInk: {
    color: colors.accentInk,
  },
  /* The elf may grow: a green dot on the pill's corner. */
  growDot: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 9,
    height: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accentInk,
    backgroundColor: colors.success,
  },
  /* The experience towards the next level: a thin gold line along the foot. */
  xpTrack: {
    marginTop: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: mapPalette.chromeBorder,
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  /* The purse: three pills under one another, as tall together as the
     name block beside them. */
  purse: {
    justifyContent: 'space-between',
    gap: space.xs,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
  },
  pursePill: {
    paddingRight: 6,
  },
  purseFigure: {
    minWidth: PURSE_FIGURE,
  },
  figures: {
    fontVariant: ['tabular-nums'],
  },
  /* The plus on the star dust: a small gold disc. */
  more: {
    width: MORE,
    height: MORE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  /* The egg's row: the countdown and the hurry. */
  eggRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  countdownLine: {
    minWidth: COUNTDOWN_WIDTH,
  },
  hurry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: 6,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  /* A tutorial's ring around a block rather than a round button. */
  haloBlock: {
    borderRadius: radius.control + 5,
  },
  want: {
    color: colors.accentStrong,
  },
})
