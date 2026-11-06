import { StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { badgeProgress, badgeStatus, ELF_BADGES, type ElfBadgeId, type ElfReward } from '@chatynkowo/core'
import { useElf, useToast } from '../../providers'
import {
  AcornsIcon,
  ArchetypeBadgeIcon,
  BathIcon,
  Button,
  CheckIcon,
  DustIcon,
  FeedIcon,
  GamesIcon,
  JoyIcon,
  LetterOpenIcon,
  LevelBadgeIcon,
  PeddlerIcon,
  SheetRoute,
  StreakIcon,
  Text,
  TricksIcon,
  colors,
  iconSize,
  radius,
  space,
  type Icon,
} from '../../ui'

/* The badges (the route /elf-badges), from the badges button on the
   side of the cottage: how many
   are earned, and the fifteen in a list, each a row with its picture,
   its name, what it is for, how far it has come as a bar and its reward;
   a badge reached offers its reward to take, a taken one wears a mark.
   The rules count what the badges count and hand out the reward
   (packages/core: ELF_BADGES, badgeProgress, badgeStatus, claimBadge). */

const BADGE_ICON: Record<ElfBadgeId, Icon> = {
  meals10: FeedIcon,
  meals100: FeedIcon,
  baths10: BathIcon,
  pets50: JoyIcon,
  games10: GamesIcon,
  games50: GamesIcon,
  letters5: LetterOpenIcon,
  tricks1: TricksIcon,
  tricksAll: TricksIcon,
  wares10: PeddlerIcon,
  level5: LevelBadgeIcon,
  level10: LevelBadgeIcon,
  streak7: StreakIcon,
  streak30: StreakIcon,
  archetype: ArchetypeBadgeIcon,
}

function badgeKey(id: ElfBadgeId, part: 'name' | 'desc' = 'name'): string {
  return `mobile:elf.badge${id.charAt(0).toUpperCase()}${id.slice(1)}${part === 'desc' ? 'Desc' : ''}`
}

export function ElfBadgesSheet() {
  const { t } = useTranslation()
  const toast = useToast()
  const { state, claimBadge } = useElf()
  if (!state) return <SheetRoute>{null}</SheetRoute>
  const done = ELF_BADGES.filter((badge) => badgeStatus(state, badge.id) !== 'locked').length
  const rewardText = (reward: ElfReward) => t(reward.kind === 'acorns' ? 'mobile:elf.badgeRewardAcorns' : 'mobile:elf.badgeRewardDust', { count: reward.amount })
  const claim = (id: ElfBadgeId) => {
    if (claimBadge(id)) toast.show({ tone: 'success', text: t('mobile:elf.badgeClaimedToast', { name: t(badgeKey(id)) }) })
  }

  return (
    <SheetRoute scroll>
      <View style={styles.column}>
        <View style={styles.head}>
          <Text variant="title" accessibilityRole="header">
            {t('mobile:elf.badgesTitle')}
          </Text>
          <Text weight="bold">{t('mobile:elf.badgesCount', { done, total: ELF_BADGES.length })}</Text>
          <Text tone="soft">{t('mobile:elf.badgesLead')}</Text>
        </View>

        {ELF_BADGES.map((badge) => {
          const status = badgeStatus(state, badge.id)
          const value = Math.min(badge.target, badgeProgress(state, badge.id))
          const Glyph = BADGE_ICON[badge.id]
          const name = t(badgeKey(badge.id))
          const RewardGlyph = badge.reward.kind === 'acorns' ? AcornsIcon : DustIcon
          return (
            <View
              key={badge.id}
              style={[styles.row, status === 'claimed' && styles.rowClaimed]}
              accessible
              accessibilityLabel={`${name}. ${t(badgeKey(badge.id, 'desc'))} ${t('mobile:elf.badgeProgress', { value, target: badge.target })}. ${rewardText(badge.reward)}. ${status === 'claimed' ? t('mobile:elf.badgeClaimed') : ''}`}
            >
              <View style={[styles.picture, status !== 'locked' && styles.pictureEarned]}>
                <Glyph size={iconSize.lg} weight={status !== 'locked' ? 'fill' : 'duotone'} color={status !== 'locked' ? colors.accentInk : colors.accentStrong} />
              </View>
              <View style={styles.words}>
                <Text weight="bold" numberOfLines={1}>
                  {name}
                </Text>
                <Text variant="small" tone="soft">
                  {t(badgeKey(badge.id, 'desc'))}
                </Text>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${Math.round((100 * value) / badge.target)}%` }]} />
                </View>
                <View style={styles.meta}>
                  <Text variant="small" tone="soft">
                    {t('mobile:elf.badgeProgress', { value, target: badge.target })}
                  </Text>
                  <View style={styles.reward}>
                    <RewardGlyph size={iconSize.sm} weight="fill" color={colors.accentStrong} />
                    <Text variant="small" tone="soft">
                      {rewardText(badge.reward)}
                    </Text>
                  </View>
                </View>
              </View>
              {status === 'earned' ? (
                <Button variant="primary" accessibilityLabel={t('mobile:elf.badgeClaimAria', { name })} onPress={() => claim(badge.id)}>
                  {t('mobile:elf.badgeClaim')}
                </Button>
              ) : status === 'claimed' ? (
                <View style={styles.mark}>
                  <CheckIcon size={iconSize.md} weight="bold" color={colors.success} />
                </View>
              ) : null}
            </View>
          )
        })}
      </View>
    </SheetRoute>
  )
}

const styles = StyleSheet.create({
  column: {
    gap: space.md,
    paddingTop: space.sm,
  },
  head: {
    gap: space.xs,
    marginBottom: space.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
  },
  rowClaimed: {
    opacity: 0.75,
  },
  picture: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentWash,
  },
  pictureEarned: {
    backgroundColor: colors.accentStrong,
  },
  words: {
    flex: 1,
    gap: 4,
  },
  /* How far the badge has come, as a bar. */
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.line,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.accentStrong,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  reward: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mark: {
    width: 40,
    alignItems: 'center',
  },
})
