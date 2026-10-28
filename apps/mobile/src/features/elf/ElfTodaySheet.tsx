import { StyleSheet, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { nextStreakMilestone, type ElfQuest, type ElfReward } from '@chatynkowo/core'
import { announce } from '../../lib/announce'
import { useElf } from '../../providers'
import { AcornsIcon, CheckIcon, DustIcon, ElfIcon, JarIcon, NextIcon, PressableScale, SheetRoute, StreakIcon, Text, colors, fade, iconSize, radius, space, type Icon } from '../../ui'
import { QUEST_ICONS, elfKey } from './labels'

/* The elf's day, as a sheet over the tab, opened from the HUD's ledger:
   the three quests dealt for the day with their progress and their pay
   (done ones ticked) and the grain of dust for the full set; the day's
   reward as three cards face down, one of which the player turns (the
   rules hold what each card hides and remember the pick, so the sheet
   shows the turned card and the two missed ones until tomorrow); the way
   to the keepsake shelf (the jars of the cottages found, the windowsill's
   treasures, the letters); the streak with its longest and the next
   milestone; and at the end what the ledger's figures are and earn, for
   whoever still wonders. The content scrolls inside the sheet on a short
   screen. */

export function ElfTodaySheet() {
  const { t } = useTranslation()
  const router = useRouter()
  const { state, claimDailyReward } = useElf()
  const quests = state?.daily.quests ?? []
  const rewards = state?.daily.rewardOptions ?? []
  const picked = state?.daily.rewardPicked ?? null
  const bonus = state?.daily.bonusGranted ?? false
  const wallet = state?.wallet ?? { acorns: 0, dust: 0 }
  const streak = state?.streak ?? 0
  const best = state?.bestStreak ?? 0
  const next = nextStreakMilestone(streak)
  /* The pick, with the card's content spoken to a screen reader: the
     card itself only changes its label. */
  const pick = (index: number) => {
    claimDailyReward(index)
    const reward = rewards[index]
    if (reward) announce(t('mobile:elf.rewardMineAria', { reward: rewardLabel(t, reward) }))
  }
  return (
    <SheetRoute scroll>
      <View style={styles.sheet}>
        <Text variant="eyebrow" accessibilityRole="header">
          {t('mobile:elf.todayTitle')}
        </Text>

        <View style={styles.section}>
          <Text weight="bold" accessibilityRole="header">
            {t('mobile:elf.todayQuests')}
          </Text>
          {quests.map((quest) => (
            <QuestRow key={quest.id} quest={quest} />
          ))}
          <View style={styles.setLine}>
            {bonus ? <CheckIcon size={iconSize.sm} weight="bold" color={colors.success} /> : <DustIcon size={iconSize.sm} weight="fill" color={colors.accentStrong} />}
            <Text variant="small" tone={bonus ? undefined : 'faint'}>
              {bonus ? t('mobile:elf.questSetDone') : t('mobile:elf.questSetLine')}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text weight="bold" accessibilityRole="header">
            {t('mobile:elf.todayReward')}
          </Text>
          <Text variant="small" tone="faint">
            {picked === null ? t('mobile:elf.rewardPick') : t('mobile:elf.rewardPicked')}
          </Text>
          <View style={styles.cards}>
            {rewards.map((reward, index) => (
              <RewardCard key={index} index={index} reward={reward} picked={picked} onPick={pick} />
            ))}
          </View>
        </View>

        <PressableScale onPress={() => router.push('/elf-shelf')} accessibilityLabel={`${t('mobile:elf.shelfOpen')}. ${t('mobile:elf.shelfOpenHint')}`} style={[styles.row, styles.link]}>
          <JarIcon size={iconSize.md} weight="fill" color={colors.accentStrong} />
          <View style={styles.column}>
            <Text weight="bold">{t('mobile:elf.shelfOpen')}</Text>
            <Text variant="small" tone="faint">
              {t('mobile:elf.shelfOpenHint')}
            </Text>
          </View>
          <NextIcon size={iconSize.sm} color={colors.inkFaint} />
        </PressableScale>

        <View style={styles.section}>
          <Text weight="bold" accessibilityRole="header">
            {t('mobile:elf.todayStreak')}
          </Text>
          <View style={styles.row}>
            <StreakIcon size={iconSize.md} weight="fill" color={colors.accentStrong} />
            <View style={styles.column}>
              <Text>{t('mobile:elf.streakLine', { count: streak })}</Text>
              <Text variant="small" tone="faint">
                {t('mobile:elf.ledgerBest', { count: best })}
                {next ? ` ${t('mobile:elf.streakNext', { count: next.days - streak, days: next.days })}` : ''}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text variant="eyebrow" accessibilityRole="header">
            {t('mobile:elf.ledgerTitle')}
          </Text>
          <Figure Glyph={AcornsIcon} title={t('mobile:elf.ledgerAcorns')} value={wallet.acorns} body={t('mobile:elf.ledgerAcornsBody')} />
          <Figure Glyph={DustIcon} title={t('mobile:elf.ledgerDust')} value={wallet.dust} body={t('mobile:elf.ledgerDustBody')} />
          <Figure Glyph={StreakIcon} title={t('mobile:elf.ledgerStreak')} value={streak} body={t('mobile:elf.ledgerStreakBody')} />
        </View>
      </View>
    </SheetRoute>
  )
}

/* The content of a reward card in words, for a screen reader. */
function rewardLabel(t: (key: string, options: { count: number }) => string, reward: ElfReward): string {
  return reward.kind === 'dust' ? t('mobile:elf.rewardDustAria', { count: reward.amount }) : t('mobile:elf.rewardAcornsAria', { count: reward.amount })
}

/* One quest: its glyph, its name, the progress or the tick, and its pay
   (the label says "done" and "1 of 2" in words: "1/2" would be read as a
   fraction). */
function QuestRow({ quest }: { quest: ElfQuest }) {
  const { t } = useTranslation()
  const Glyph = QUEST_ICONS[quest.event]
  const state = quest.done ? t('mobile:elf.questDoneAria') : t('mobile:elf.questProgressAria', { progress: quest.progress, target: quest.target })
  const pay = quest.dust > 0 ? `${t('mobile:elf.rewardAcornsAria', { count: quest.acorns })}, ${t('mobile:elf.rewardDustAria', { count: quest.dust })}` : t('mobile:elf.rewardAcornsAria', { count: quest.acorns })
  return (
    <View style={[styles.row, quest.done && styles.rowDone]} accessible accessibilityLabel={`${t(elfKey('quest', quest.id))}. ${state}. ${pay}`}>
      <Glyph size={iconSize.md} weight="fill" color={quest.done ? colors.success : colors.accentStrong} />
      <Text style={styles.grow} numberOfLines={2}>
        {t(elfKey('quest', quest.id))}
      </Text>
      {quest.done ? (
        <CheckIcon size={iconSize.sm} weight="bold" color={colors.success} />
      ) : (
        <Text variant="small" tone="faint">
          {t('mobile:elf.questProgress', { progress: quest.progress, target: quest.target })}
        </Text>
      )}
      <View style={styles.pay}>
        <AcornsIcon size={iconSize.xs} weight="fill" color={colors.accentStrong} />
        <Text variant="small" weight="semibold">
          {t('mobile:elf.questPay', { count: quest.acorns })}
        </Text>
      </View>
      {quest.dust > 0 ? (
        <View style={styles.pay}>
          <DustIcon size={iconSize.xs} weight="fill" color={colors.accentStrong} />
          <Text variant="small" weight="semibold">
            {t('mobile:elf.questPay', { count: quest.dust })}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

/* One of the day's three cards: face down until the pick, then the one
   picked turned and lit, the others turned and dimmed, so the player
   sees what the day held. One pressable for both faces, so the focus of
   a screen reader stays on the card through the turn; turned, it is
   disabled and says whose it is. */
function RewardCard({ index, reward, picked, onPick }: { index: number; reward: ElfReward; picked: number | null; onPick: (index: number) => void }) {
  const { t } = useTranslation()
  const turned = picked !== null
  const mine = picked === index
  const Glyph: Icon = reward.kind === 'dust' ? DustIcon : AcornsIcon
  const label = !turned ? t('mobile:elf.rewardCardAria', { index: index + 1 }) : t(mine ? 'mobile:elf.rewardMineAria' : 'mobile:elf.rewardMissedAria', { reward: rewardLabel(t, reward) })
  return (
    <PressableScale
      onPress={() => onPick(index)}
      disabled={turned}
      accessibilityLabel={label}
      accessibilityState={{ disabled: turned, selected: mine }}
      style={[styles.card, !turned ? styles.cardDown : mine ? styles.cardMine : styles.cardMissed]}
    >
      {turned ? (
        <Animated.View entering={fade()} style={styles.face}>
          <Glyph size={iconSize.lg} weight="fill" color={mine ? colors.accentInk : colors.inkFaint} />
          <Text variant="compact" weight="bold" style={mine ? styles.mineInk : styles.missedInk}>
            {reward.amount}
          </Text>
        </Animated.View>
      ) : (
        <ElfIcon size={iconSize.lg} weight="duotone" color={colors.accentStrong} />
      )}
    </PressableScale>
  )
}

/* One figure of the ledger explained: the glyph, the count as it stands,
   how it is earned and what it is for. */
function Figure({ Glyph, title, value, body }: { Glyph: Icon; title: string; value: number; body: string }) {
  return (
    <View style={styles.figure}>
      <View style={styles.glyph}>
        <Glyph size={iconSize.md} weight="fill" color={colors.accentStrong} />
      </View>
      <View style={styles.column}>
        <Text weight="bold">
          {title}: {value}
        </Text>
        <Text variant="small">{body}</Text>
      </View>
    </View>
  )
}

const CARD_HEIGHT = 96

const styles = StyleSheet.create({
  sheet: {
    gap: space.xl,
    paddingTop: space.sm,
  },
  section: {
    gap: space.sm,
  },
  row: {
    flexDirection: 'row',
    gap: space.md,
    alignItems: 'center',
  },
  rowDone: {
    opacity: 0.7,
  },
  /* The way to the shelf: a row with the press feel of a list. */
  link: {
    paddingVertical: space.xs,
    borderRadius: radius.control,
  },
  grow: {
    flex: 1,
  },
  pay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minWidth: 44,
    justifyContent: 'flex-end',
  },
  setLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingTop: space.xs,
  },
  cards: {
    flexDirection: 'row',
    gap: space.md,
  },
  card: {
    flex: 1,
    height: CARD_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    borderWidth: 1,
    borderRadius: radius.card,
  },
  cardDown: {
    borderColor: colors.accentBorder,
    backgroundColor: colors.surfaceSoft,
  },
  cardMine: {
    borderColor: colors.accentBorder,
    backgroundColor: colors.accent,
  },
  cardMissed: {
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  face: {
    alignItems: 'center',
    gap: space.xs,
  },
  /* An explanation runs to several lines: the glyph stays with the title. */
  figure: {
    flexDirection: 'row',
    gap: space.md,
    alignItems: 'flex-start',
  },
  mineInk: {
    color: colors.accentInk,
  },
  missedInk: {
    color: colors.inkFaint,
  },
  /* The glyph lines up with the first line of the title. */
  glyph: {
    paddingTop: 2,
  },
  column: {
    flex: 1,
    gap: space.xs,
  },
})
