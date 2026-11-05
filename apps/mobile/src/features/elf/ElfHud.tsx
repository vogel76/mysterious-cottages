import { StyleSheet, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { type ElfMood, type ElfNeedId, type ElfStage, type ElfWallet, type ElfPath } from '@chatynkowo/core'
import { AcornsIcon, ActivitiesIcon, DecorIcon, DustIcon, EggIcon, LevelBadgeIcon, NextIcon, PressableScale, QuestIcon, ShopIcon, StreakIcon, Text, colors, fade, iconSize, mapPalette, radius, space, type Icon, type TextProps } from '../../ui'
import { durationText, useClock } from './duration'
import { elfKey, pathKey } from './labels'

/* The strip over the cottage, in the dark chrome of the Atlas's cards so
   the two full-bleed tabs read alike: two rows, and the room starts under
   them, never behind them. The first row: the name block (the elf's
   name, or "the egg", with the level in a gold pill at the end of the
   line, which wears a dot while the elf may grow; under it the form
   and, once chosen, the nature, or, when there is one, what the elf
   asks for in gold: the need it wants seen to, or that it may grow, or,
   for the egg, how it hatches; and a thin bar of the experience towards
   the next level along the foot), which opens the tree of development,
   and the buttons: the activities,
   the shop and the decorating (the mode it opens lives inside the tab;
   starting over lives in the profile, out of the way of a child's
   thumb). The second row is the ledger: the acorns and the star dust in
   the purse, the streak of days and the day's quests done out of three
   (with a dot while the day's reward waits to be picked), one pressable
   row that opens the day's sheet (/elf-today); before the hatch it starts
   with the egg and how long until it hatches (the warmth the player gives
   it shows in the scene's glow, not here: it does not decide the hatch).
   The needs themselves are not here: they ring the care buttons at the
   bottom (ElfActionBar), where the care is. What the elf has to say in the
   moment (a refusal, a good night, a greeting, a quest done) is in the
   speech bubble over its head (ElfSpeech). Every text here is plain and
   in its ordinary case, so a child reads it at a glance; a value that
   changes fades in anew and leaves nothing behind (no exit animation and
   no layout transition, which can leave a ghost of the old words on a
   strip that re-renders every few seconds). */

/* Which panel of the tab is open, if any; the HUD leaves while one is. */
export type ElfPanel = 'none' | 'decor'

export type ElfHudProps = {
  name: string
  stage: ElfStage
  mood: ElfMood
  /* The need the elf would like seen to, when one is under the mark. */
  wantedNeed: ElfNeedId | null
  /* When the egg hatches on its own; null once hatched. */
  hatchAt: number | null
  wallet: ElfWallet
  /* Days visited in a row. */
  streak: number
  /* The day's quests done, out of three, and whether its reward still
     waits to be picked. */
  questsDone: number
  rewardWaiting: boolean
  onDecorate: () => void
  /* Opens the shop of star dust. */
  onShop: () => void
  /* Opens the activities hub (the tricks, the games, the peddler, the badges). */
  onActivities: () => void
  /* The hub has something new (the peddler's basket unbought, a badge's
     reward to take, a trick's practice today): a dot on its button. */
  activitiesFresh: boolean
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
  /* The ledger was tapped: the day's sheet (the quests, the reward to
     pick, the streak, and what the figures mean). */
  onLedger: () => void
}

export function ElfHud({ name, stage, mood, wantedNeed, hatchAt, wallet, streak, questsDone, rewardWaiting, onDecorate, onShop, onActivities, activitiesFresh, level, xpFraction, archetype, growthReady, request, onTree, onLedger }: ElfHudProps) {
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
          <StatusLine name={name} stage={stage} mood={mood} whatItIs={whatItIs} hatchAt={hatchAt} wantedNeed={wantedNeed} growthReady={growthReady} request={request} />
          {/* The experience towards the next level, along the block's foot. */}
          {level !== null ? (
            <View style={styles.xpTrack}>
              <View style={[styles.xpFill, { width: `${Math.round(100 * Math.min(1, Math.max(0, xpFraction)))}%` }]} />
            </View>
          ) : null}
        </PressableScale>
        {/* The activities, the shop of star dust, then the decorating:
            buttons as tall as the name block beside them; the room can be
            arranged for the egg and the elf alike, the activities wait for
            the hatch. */}
        {!egg ? (
          <PressableScale
            onPress={onActivities}
            accessibilityLabel={`${t('mobile:elf.activitiesOpen')}${activitiesFresh ? `. ${t('mobile:elf.activitiesFreshAria')}` : ''}`}
            style={[styles.chrome, styles.control]}
          >
            <ActivitiesIcon size={iconSize.lg} color={mapPalette.chromeIcon} />
            {activitiesFresh ? <View style={styles.freshDot} /> : null}
          </PressableScale>
        ) : null}
        <PressableScale onPress={onShop} accessibilityLabel={t('mobile:elf.shopOpen')} style={[styles.chrome, styles.control]}>
          <ShopIcon size={iconSize.lg} color={mapPalette.chromeIcon} />
        </PressableScale>
        <PressableScale onPress={onDecorate} accessibilityLabel={t('mobile:elf.decorate')} style={[styles.chrome, styles.control]}>
          <DecorIcon size={iconSize.lg} color={mapPalette.chromeIcon} />
        </PressableScale>
      </View>
      {/* The row hugs its chips and gives only the scale as feedback: a
          fill or a ripple would paint the gaps between the pills. */}
      <PressableScale
        onPress={onLedger}
        accessibilityLabel={`${t('mobile:elf.ledgerAria', { acorns: wallet.acorns, dust: wallet.dust, streak, done: questsDone, total: QUESTS_TOTAL })}${rewardWaiting ? ` ${t('mobile:elf.rewardWaitingAria')}` : ''}`}
        accessibilityHint={t('mobile:elf.ledgerHint')}
        hitSlop={{ top: 8, bottom: 8 }}
        pressedFill="transparent"
        ripple={false}
        style={styles.ledger}
      >
        {egg ? <EggChip hatchAt={hatchAt} onPress={onShop} /> : null}
        <LedgerChip Glyph={AcornsIcon} value={wallet.acorns} />
        <LedgerChip Glyph={DustIcon} value={wallet.dust} />
        <LedgerChip Glyph={StreakIcon} value={streak} />
        <View style={[styles.chrome, styles.ledgerChip]}>
          <QuestIcon size={iconSize.sm} weight="fill" color={mapPalette.chromeIcon} />
          <FadeText value={t('mobile:elf.questsChip', { done: questsDone, total: QUESTS_TOTAL })} variant="small" weight="bold" style={styles.chromeInk} />
          {/* The caret says the row opens something. */}
          <NextIcon size={iconSize.xs} weight="bold" color={mapPalette.chromeIcon} />
          {rewardWaiting ? <View style={styles.rewardDot} /> : null}
        </View>
      </PressableScale>
    </View>
  )
}

/* The quests a day deals, as the chip counts them. */
const QUESTS_TOTAL = 3
/* The width of a button beside the name block. A fixed width, not a
   square from the block's height: Yoga lays the row out in one pass, so
   a button whose width followed its height would leave the block
   measured too wide, its second line of text cut off once the buttons
   took their room. */
const CONTROL = 60

/* A text of the strip whose value changes in place: the new value fades
   in, keyed by its content; the old one simply goes (no exit animation,
   no layout transition: nothing can linger over the new words). */
function FadeText({ value, ...rest }: TextProps & { value: string }) {
  return (
    <Animated.View key={value} entering={fade()} style={styles.fadeLine}>
      <Text {...rest}>{value}</Text>
    </Animated.View>
  )
}

/* The egg's countdown in words (duration.ts keeps the clock). */
function useHatchWhen(hatchAt: number | null): { when: string; due: boolean } | null {
  const { t } = useTranslation()
  const now = useClock(hatchAt !== null)
  if (hatchAt === null) return null
  const left = hatchAt - now
  if (left <= 0) return { when: t('mobile:elf.hatchSoon'), due: true }
  return { when: t('mobile:elf.hatchIn', { time: durationText(t, left) }), due: false }
}

/* Before the hatch: the egg and how long until it hatches, first in the
   ledger row; a tap opens the shop, where the wait can be bought off. */
function EggChip({ hatchAt, onPress }: { hatchAt: number; onPress: () => void }) {
  const { t } = useTranslation()
  const hatch = useHatchWhen(hatchAt)
  const when = hatch?.when ?? ''
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={t('mobile:elf.hatchAria', { when })}
      accessibilityHint={hatch?.due ? undefined : t('mobile:elf.hatchSkipHint')}
      style={[styles.chrome, styles.ledgerChip]}
    >
      <EggIcon size={iconSize.sm} weight="fill" color={mapPalette.chromeIcon} />
      <FadeText value={when} variant="small" weight="bold" style={styles.chromeInk} />
    </PressableScale>
  )
}

/* One figure of the ledger: the glyph and the count, which fades in anew
   when a quest pays; the row's label names them all for a screen reader. */
function LedgerChip({ Glyph, value }: { Glyph: Icon; value: number }) {
  return (
    <View style={[styles.chrome, styles.ledgerChip]}>
      <Glyph size={iconSize.sm} weight="fill" color={mapPalette.chromeIcon} />
      <FadeText value={String(value)} variant="small" weight="bold" style={styles.chromeInk} />
    </View>
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
function StatusLine({ name: given, stage, mood, whatItIs, hatchAt, wantedNeed, growthReady, request }: StatusLineProps) {
  const { t } = useTranslation()
  /* An elf still to be named (the hatch sheet is up) goes by the plain name. */
  const name = given || t('mobile:elf.defaultName')
  const hatch = useHatchWhen(stage === 'egg' ? hatchAt : null)
  if (hatch) return <FadeText value={hatch.due ? t('mobile:elf.moodEggDue') : t('mobile:elf.moodEgg')} variant="small" numberOfLines={2} style={hatch.due ? styles.want : styles.chromeInk} />
  const asks = wantedNeed ? t(elfKey('wants', wantedNeed), { name }) : growthReady ? t('mobile:elf.hudGrowReady') : request ?? (mood === 'misses' ? t(elfKey('mood', mood), { name }) : null)
  return <FadeText value={asks ?? whatItIs} variant="small" numberOfLines={2} style={asks ? styles.want : styles.stage} />
}

const styles = StyleSheet.create({
  top: {
    gap: space.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
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
  /* The name block takes the width the controls leave, so the mood line
     has room for two lines. */
  identity: {
    flex: 1,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
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
  /* A button beside the name block: a fixed width, as tall as the block. */
  control: {
    width: CONTROL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* The ledger's chips take only the width of their figure, and the row
     only that of its chips. */
  ledger: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: space.sm,
  },
  ledgerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
  },
  /* Something new behind the activities button: a dot in its corner. */
  freshDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accentInk,
    backgroundColor: colors.accentStrong,
  },
  /* The reward waiting: a gold dot on the quests chip's corner. */
  rewardDot: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accentInk,
    backgroundColor: colors.accentStrong,
  },
  want: {
    color: colors.accentStrong,
  },
})
