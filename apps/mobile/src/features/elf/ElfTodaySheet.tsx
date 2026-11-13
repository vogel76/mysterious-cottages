import { StyleSheet, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { nextStreakMilestone, REQUEST_ACORNS, type ElfQuest, type ElfRequest, type ElfReward } from '@chatynkowo/core'
import { announce } from '../../lib/announce'
import { useElf, useOnline } from '../../providers'
import { AcornsIcon, Button, CheckIcon, DustIcon, ElfIcon, JarIcon, NextIcon, PressableScale, SheetRoute, StreakIcon, Text, WatchAdIcon, colors, fade, iconSize, radius, space, type Icon } from '../../ui'
import { RewardedAdNote } from '../support/RewardedAdNote'
import { rewardedAdNoteKey, useRewardedSupportAd } from '../support/useRewardedSupportAd'
import { elfKey, requestKey } from './labels'

/* The elf's day, as a sheet over the tab, opened from the quests' ring
   on the side of the cottage and from the purse in the strip.
   The purse first, as three tiles that name their figures (the acorns,
   the star dust, the days in a row: the HUD's chips show the same
   figures by their glyphs alone, so this is where a child learns what
   they are), with the streak's best and its next milestone under them.
   Then the day's quests, one plain row each: a tick circle (empty
   until done), the quest in words with its progress, and its pay at the
   end; the grain of dust for the full set under them. Then the elf's
   request of the day in its own words, the same way. Then the day's
   reward as three cards face down, one of which the player turns (the
   rules hold what each card hides and remember the pick, so the sheet
   shows the turned card and the two missed ones until tomorrow; once
   turned, the card may be doubled with a rewarded ad, once a day, within
   the day's cap of ads, doubleDailyReward), the
   way to the keepsake shelf, and at the end, in a line each, where the
   acorns, the dust and the streak come from and what they are for. One
   kind of mark per row and few pictures, so the eye finds what to read.
   The content scrolls inside the sheet on a short screen. */

export function ElfTodaySheet() {
  const { t } = useTranslation()
  const router = useRouter()
  const { state, claimDailyReward, doubleDailyReward, adsLeft } = useElf()
  const online = useOnline()
  const ad = useRewardedSupportAd(() => {
    if (doubleDailyReward()) announce(t('mobile:elf.rewardDoubled'))
  })
  const adBusy = ad.status === 'loading' || ad.status === 'showing'
  const adNote = rewardedAdNoteKey(ad.status, online)
  const doubled = state?.daily.rewardDoubled ?? false
  const quests = state?.daily.quests ?? []
  const request = state?.daily.request ?? null
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

        {/* The purse: the three figures, each with its name. */}
        <View style={styles.section}>
          <View style={styles.tiles} accessible accessibilityLabel={t('mobile:elf.ledgerAria', { acorns: wallet.acorns, dust: wallet.dust, streak, done: quests.filter((quest) => quest.done).length, total: quests.length })}>
            <Tile Glyph={AcornsIcon} value={wallet.acorns} label={t('mobile:elf.ledgerAcorns')} />
            <Tile Glyph={DustIcon} value={wallet.dust} label={t('mobile:elf.ledgerDust')} />
            <Tile Glyph={StreakIcon} value={streak} label={t('mobile:elf.ledgerStreak')} />
          </View>
          <Text variant="small" tone="faint">
            {t('mobile:elf.ledgerBest', { count: best })}
            {next ? ` ${t('mobile:elf.streakNext', { count: next.days - streak, days: next.days })}` : ''}
          </Text>
        </View>

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

        {request ? (
          <View style={styles.section}>
            <Text weight="bold" accessibilityRole="header">
              {t('mobile:elf.todayRequest')}
            </Text>
            <RequestRow request={request} />
          </View>
        ) : null}

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
          {picked !== null && doubled ? (
            <Text variant="small" weight="bold" tone="accent">
              {t('mobile:elf.rewardDoubled')}
            </Text>
          ) : picked !== null && ad.offered ? (
            <Button
              block
              busy={adBusy}
              disabled={adBusy || online === false || adsLeft <= 0}
              icon={<WatchAdIcon size={iconSize.md} color={colors.accentStrong} />}
              onPress={ad.watch}
            >
              {t('mobile:elf.rewardDouble')}
            </Button>
          ) : null}
          {picked !== null && !doubled ? <RewardedAdNote note={adNote} offered={ad.offered && adsLeft > 0} /> : null}
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
          <Text variant="eyebrow" accessibilityRole="header">
            {t('mobile:elf.ledgerTitle')}
          </Text>
          <Whence Glyph={AcornsIcon} title={t('mobile:elf.ledgerAcorns')} body={t('mobile:elf.ledgerAcornsBody')} />
          <Whence Glyph={DustIcon} title={t('mobile:elf.ledgerDust')} body={t('mobile:elf.ledgerDustBody')} />
          <Whence Glyph={StreakIcon} title={t('mobile:elf.ledgerStreak')} body={t('mobile:elf.ledgerStreakBody')} />
        </View>
      </View>
    </SheetRoute>
  )
}

/* The content of a reward card in words, for a screen reader. */
function rewardLabel(t: (key: string, options: { count: number }) => string, reward: ElfReward): string {
  return reward.kind === 'dust' ? t('mobile:elf.rewardDustAria', { count: reward.amount }) : t('mobile:elf.rewardAcornsAria', { count: reward.amount })
}

/* One figure of the purse: its glyph, the count large, its name under it. */
function Tile({ Glyph, value, label }: { Glyph: Icon; value: number; label: string }) {
  return (
    <View style={styles.tile}>
      <Glyph size={iconSize.md} weight="fill" color={colors.accentStrong} />
      <Text variant="heading">{value}</Text>
      <Text variant="small" tone="faint" align="center" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
        {label}
      </Text>
    </View>
  )
}

/* The tick circle of a row: empty until done. */
function Tick({ done }: { done: boolean }) {
  return <View style={[styles.tick, done && styles.tickDone]}>{done ? <CheckIcon size={iconSize.xs} weight="bold" color={colors.accentInk} /> : null}</View>
}

/* What a row pays: the acorns, and the dust when there is some. */
function Pay({ acorns, dust = 0 }: { acorns: number; dust?: number }) {
  const { t } = useTranslation()
  return (
    <View style={styles.pays}>
      <View style={styles.pay}>
        <Text variant="small" weight="semibold">
          {t('mobile:elf.questPay', { count: acorns })}
        </Text>
        <AcornsIcon size={iconSize.xs} weight="fill" color={colors.accentStrong} />
      </View>
      {dust > 0 ? (
        <View style={styles.pay}>
          <Text variant="small" weight="semibold">
            {t('mobile:elf.questPay', { count: dust })}
          </Text>
          <DustIcon size={iconSize.xs} weight="fill" color={colors.accentStrong} />
        </View>
      ) : null}
    </View>
  )
}

/* One quest: the tick, its name with the progress under it, and its pay
   (the label says "done" and "1 of 2" in words: "1/2" would be read as a
   fraction). */
function QuestRow({ quest }: { quest: ElfQuest }) {
  const { t } = useTranslation()
  const state = quest.done ? t('mobile:elf.questDoneAria') : t('mobile:elf.questProgressAria', { progress: quest.progress, target: quest.target })
  const pay = quest.dust > 0 ? `${t('mobile:elf.rewardAcornsAria', { count: quest.acorns })}, ${t('mobile:elf.rewardDustAria', { count: quest.dust })}` : t('mobile:elf.rewardAcornsAria', { count: quest.acorns })
  return (
    <View style={[styles.row, quest.done && styles.rowDone]} accessible accessibilityLabel={`${t(elfKey('quest', quest.id))}. ${state}. ${pay}`}>
      <Tick done={quest.done} />
      <View style={styles.grow}>
        <Text numberOfLines={2}>{t(elfKey('quest', quest.id))}</Text>
        {!quest.done && quest.target > 1 ? (
          <Text variant="small" tone="faint">
            {t('mobile:elf.questProgress', { progress: quest.progress, target: quest.target })}
          </Text>
        ) : null}
      </View>
      <Pay acorns={quest.acorns} dust={quest.dust} />
    </View>
  )
}

/* The elf's request of the day: its words, the progress and the pay,
   ticked once it came. */
function RequestRow({ request }: { request: ElfRequest }) {
  const { t } = useTranslation()
  const words = t(requestKey(request.id))
  const state = request.done ? t('mobile:elf.questDoneAria') : t('mobile:elf.questProgressAria', { progress: request.progress, target: request.target })
  return (
    <View style={[styles.row, request.done && styles.rowDone]} accessible accessibilityLabel={`${words}. ${state}. ${t('mobile:elf.rewardAcornsAria', { count: REQUEST_ACORNS })}`}>
      <Tick done={request.done} />
      <View style={styles.grow}>
        <Text numberOfLines={2}>{words}</Text>
        {!request.done && request.target > 1 ? (
          <Text variant="small" tone="faint">
            {t('mobile:elf.questProgress', { progress: request.progress, target: request.target })}
          </Text>
        ) : null}
      </View>
      <Pay acorns={REQUEST_ACORNS} />
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

/* Where a figure comes from and what it is for, in a line. */
function Whence({ Glyph, title, body }: { Glyph: Icon; title: string; body: string }) {
  return (
    <View style={styles.whence}>
      <View style={styles.glyph}>
        <Glyph size={iconSize.sm} weight="fill" color={colors.accentStrong} />
      </View>
      <Text variant="small" style={styles.grow}>
        <Text variant="small" weight="bold">
          {title}
        </Text>
        {': '}
        {body}
      </Text>
    </View>
  )
}

const CARD_HEIGHT = 96
const TICK = 24

const styles = StyleSheet.create({
  sheet: {
    gap: space.xl,
    paddingTop: space.sm,
  },
  section: {
    gap: space.sm,
  },
  tiles: {
    flexDirection: 'row',
    gap: space.sm,
  },
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: space.md,
    paddingHorizontal: space.xs,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    backgroundColor: colors.surfaceSoft,
  },
  row: {
    flexDirection: 'row',
    gap: space.md,
    alignItems: 'center',
  },
  rowDone: {
    opacity: 0.7,
  },
  tick: {
    width: TICK,
    height: TICK,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.accentBorder,
    borderRadius: radius.pill,
  },
  tickDone: {
    borderColor: colors.success,
    backgroundColor: colors.success,
  },
  /* The way to the shelf: a row with the press feel of a list. */
  link: {
    paddingVertical: space.xs,
    borderRadius: radius.control,
  },
  grow: {
    flex: 1,
  },
  pays: {
    gap: 2,
    alignItems: 'flex-end',
  },
  pay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
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
  mineInk: {
    color: colors.accentInk,
  },
  missedInk: {
    color: colors.inkFaint,
  },
  /* A line of the ledger's whence: the glyph with its first line. */
  whence: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'flex-start',
  },
  glyph: {
    paddingTop: 2,
  },
  column: {
    flex: 1,
    gap: space.xs,
  },
})
