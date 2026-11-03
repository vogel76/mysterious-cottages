import { StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { RewardLevel } from '@chatynkowo/core'
import { ChronicleIcon, MarkdownView, NextIcon, PressableScale, ProgressRing, RewardIcon, Text, colors, iconSize, radius, space } from '../../ui'

/* The head of the Kronika grid: the subtitle with the chronicle emblem, the
   progress card (finds out of the total as a ring, the next level to earn;
   pressing it opens the cottage directory), the Ranking's card in the same
   form (it opens the leaderboard on the Kronika's stack) and the intro the
   editor published for the collection. */

const RING_SIZE = 64

export type CollectionHeaderProps = {
  found: number
  total: number
  /* The first level still locked and how many finds it still needs; null
     once everything is earned. */
  next: { level: RewardLevel; remaining: number } | null
  /* Markdown from the reward config. */
  intro: string
  /* Plain fallback shown when there is no intro. */
  note: string | null
  /* The elf's lessons, the cottages it has taken in, once it has hatched;
     null without the elf. */
  lessons: { name: string; count: number } | null
  /* Opens the list of every cottage, found and still waiting. */
  onOpenList: () => void
  /* Opens the Ranking. */
  onOpenRanking: () => void
}

export function CollectionHeader({ found, total, next, intro, note, lessons, onOpenList, onOpenRanking }: CollectionHeaderProps) {
  const { t } = useTranslation()
  /* Nothing to say about levels until the cottages are known. */
  const quest = total <= 0 ? null : next ? t('quest.nextLevel', { name: next.level.name, count: next.remaining }) : t('quest.allFound')
  const progress = t('mobile:atlas.progress', { found, total })
  const lessonsLine = lessons ? (lessons.count ? t('mobile:kronika.elfLessons', { name: lessons.name, count: lessons.count }) : t('mobile:kronika.elfLessonsNone', { name: lessons.name })) : null

  return (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Text variant="eyebrow" style={styles.subtitle}>
          {t('mobile:kronika.subtitle')}
        </Text>
        <ChronicleIcon size={iconSize.emblem} weight="duotone" color={colors.accentStrong} />
      </View>
      <PressableScale
        onPress={onOpenList}
        accessibilityLabel={[t('mobile:kronika.progressAria', { found, total }), quest, lessonsLine, t('mobile:kronika.openListAria')].filter(Boolean).join('. ')}
        style={styles.card}
      >
        <ProgressRing size={RING_SIZE} value={found} max={total} label={String(found)} />
        <View style={styles.cardText}>
          <Text weight="bold">{progress}</Text>
          {quest ? (
            <Text variant="small" tone="soft">
              {quest}
            </Text>
          ) : null}
          {lessonsLine ? (
            <Text variant="small" tone="soft">
              {lessonsLine}
            </Text>
          ) : null}
        </View>
        <NextIcon size={iconSize.md} color={colors.inkFaint} />
      </PressableScale>
      <PressableScale onPress={onOpenRanking} accessibilityLabel={`${t('ranking.title')}. ${t('mobile:kronika.rankingCard')}`} accessibilityHint={t('mobile:kronika.rankingCardAria')} style={styles.card}>
        <View style={styles.emblem}>
          <RewardIcon size={iconSize.xl} weight="duotone" color={colors.accentStrong} />
        </View>
        <View style={styles.cardText}>
          <Text weight="bold">{t('ranking.title')}</Text>
          <Text variant="small" tone="soft">
            {t('mobile:kronika.rankingCard')}
          </Text>
        </View>
        <NextIcon size={iconSize.md} color={colors.inkFaint} />
      </PressableScale>
      {intro ? <MarkdownView>{intro}</MarkdownView> : note ? <Text tone="soft">{note}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    gap: space.lg,
    paddingBottom: space.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  subtitle: {
    flex: 1,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  cardText: {
    flex: 1,
    gap: space.xs,
  },
  /* The trophy in the ring's place, so the two cards line up. */
  emblem: {
    width: RING_SIZE,
    alignItems: 'center',
  },
})
