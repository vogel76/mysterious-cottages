import { StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { type ElfMood, type ElfNeedId, type ElfRank, type ElfStage, type ElfWallet, type ElfPath } from '@chatynkowo/core'
import { AcornsIcon, ActivitiesIcon, CrossfadeText, DecorIcon, DustIcon, EggIcon, NextIcon, PressableScale, QuestIcon, ShopIcon, StreakIcon, Text, colors, iconSize, mapPalette, radius, space, type Icon } from '../../ui'
import { durationText, useClock } from './duration'
import { elfKey, pathKey, rankKey } from './labels'

/* The strip over the cottage, in the dark chrome of the Atlas's cards so
   the two full-bleed tabs read alike: two rows, and the room starts under
   them, never behind them. The first row: the elf's name with its form,
   the mood in a line underneath (what the elf is doing, or, for the egg,
   how it hatches, or the need it wants seen to when one is under the
   mark), and the decorating button (the mode it opens lives inside the
   tab; starting over lives in the profile, out of the way of a child's
   thumb). The second row is the ledger: the acorns and the star dust in
   the purse, the streak of days and the day's quests done out of three
   (with a dot while the day's reward waits to be picked), one pressable
   row that opens the day's sheet (/elf-today); before the hatch it starts
   with the egg and how long until it hatches (the warmth the player gives
   it shows in the scene's glow, not here: it does not decide the hatch).
   The needs themselves are not here: they ring the care buttons at the
   bottom (ElfActionBar), where the care is. What the elf has to say in the
   moment (a refusal, a good night, a greeting, a quest done) is in the
   speech bubble over its head (ElfSpeech). */

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
  /* The hub has something new (the peddler's basket unbought, a badge's reward to take): a dot on its button. */
  activitiesFresh: boolean
  /* The rank the tree gives the elf, after its form; a tap on the name
     block opens the tree. Absent for the egg. */
  rank: ElfRank | null
  /* The archetype chosen in the tree, shown in the rank's place. */
  archetype: ElfPath | null
  onTree: () => void
  /* The ledger was tapped: the day's sheet (the quests, the reward to
     pick, the streak, and what the figures mean). */
  onLedger: () => void
}

export function ElfHud({ name, stage, mood, wantedNeed, hatchAt, wallet, streak, questsDone, rewardWaiting, onDecorate, onShop, onActivities, activitiesFresh, rank, archetype, onTree, onLedger }: ElfHudProps) {
  const { t } = useTranslation()
  const egg = stage === 'egg' && hatchAt !== null
  return (
    <View style={styles.top} pointerEvents="box-none">
      <View style={styles.topRow} pointerEvents="box-none">
        <PressableScale
          onPress={onTree}
          disabled={rank === null}
          accessibilityRole="header"
          accessibilityHint={rank === null ? undefined : t('mobile:elf.treeHint')}
          pressedFill="transparent"
          ripple={false}
          style={[styles.chrome, styles.identity]}
        >
          {/* The name, the form and the rank share a line, so the block
              stays two lines tall next to the buttons. */}
          <View style={styles.nameRow}>
            {name ? (
              <Text weight="bold" variant="compact" numberOfLines={1} style={styles.chromeInk}>
                {name}
              </Text>
            ) : null}
            <CrossfadeText value={rank ? `${t(elfKey('stage', stage))} · ${archetype ? t(pathKey(archetype)) : t(rankKey(rank))}` : t(elfKey('stage', stage))} variant="caption" style={styles.stage} />
          </View>
          <MoodLine name={name} stage={stage} mood={mood} hatchAt={hatchAt} wantedNeed={wantedNeed} />
        </PressableScale>
        {/* The activities, the shop of star dust, then the decorating:
            squares as tall as the name block beside them; the room can be
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
          <CrossfadeText value={t('mobile:elf.questsChip', { done: questsDone, total: QUESTS_TOTAL })} variant="small" weight="bold" style={styles.chromeInk} />
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
      <CrossfadeText value={when} variant="small" weight="bold" style={styles.chromeInk} />
    </PressableScale>
  )
}

/* One figure of the ledger: the glyph and the count, which crossfades
   when a quest pays; the row's label names them all for a screen reader. */
function LedgerChip({ Glyph, value }: { Glyph: Icon; value: number }) {
  return (
    <View style={[styles.chrome, styles.ledgerChip]}>
      <Glyph size={iconSize.sm} weight="fill" color={mapPalette.chromeIcon} />
      <CrossfadeText value={String(value)} variant="small" weight="bold" style={styles.chromeInk} />
    </View>
  )
}

/* ---------- The mood line ---------- */

type MoodLineProps = {
  name: string
  stage: ElfStage
  mood: ElfMood
  /* When the egg is ready to hatch; null once hatched. */
  hatchAt: number | null
  wantedNeed: ElfNeedId | null
}

/* What the elf is doing, in the name block: the mood's sentence, or the
   need the elf wants seen to, which says more. The egg's sentence stays
   the same until the hatch is due: the chip carries the countdown, and a
   line that changed every minute would be read out every minute. */
function MoodLine({ name: given, stage, mood, hatchAt, wantedNeed }: MoodLineProps) {
  const { t } = useTranslation()
  /* An elf still to be named (the hatch sheet is up) goes by the plain name. */
  const name = given || t('mobile:elf.defaultName')
  const hatch = useHatchWhen(stage === 'egg' ? hatchAt : null)
  const want = wantedNeed && stage !== 'egg' ? t(elfKey('wants', wantedNeed), { name }) : null
  const sentence = hatch ? (hatch.due ? t('mobile:elf.moodEggDue') : t('mobile:elf.moodEgg')) : t(elfKey('mood', mood), { name })
  return <CrossfadeText value={want ?? sentence} variant="small" numberOfLines={2} style={want ? styles.want : styles.chromeInk} />
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
    alignItems: 'baseline',
    gap: space.sm,
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
    gap: 1,
  },
  chromeInk: {
    color: mapPalette.chromeInk,
  },
  stage: {
    color: mapPalette.chromeInk,
    opacity: 0.85,
  },
  /* The decorating button: a square the height of the name block, in the
     chrome. */
  control: {
    aspectRatio: 1,
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
  /* The reward waiting: a gold dot on the quests chip's corner. */
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
