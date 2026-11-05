import { StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { badgesToClaim, badgeStatus, ELF_BADGES, ELF_GAMES, ELF_TRICKS, peddlerWares, trickStatus, tricksToTrain } from '@chatynkowo/core'
import { useElf } from '../../providers'
import { BadgesIcon, NextIcon, PeddlerIcon, PressableScale, SheetRoute, SleepIcon, Text, TricksIcon, colors, iconSize, radius, space, type Icon } from '../../ui'
import { GAME_ICON, gameKey } from './games/games'
import { trickKey } from './tricks'
import { elfNow } from '../../lib/elf-clock'

/* The activities hub (the route /elf-activities), from the activities
   button on the elf's bar: what there is to do with the elf, one row
   each with a word on where it stands, opening its own sheet or screen:
   the skills, the three games (with the elf's energy for them under the
   lead), the peddler and the badges. */

type Activity = { key: string; icon: Icon; title: string; hint: string; open: () => void }

export function ElfActivitiesSheet() {
  const { t } = useTranslation()
  const router = useRouter()
  const { state, gameRounds } = useElf()
  if (!state) return <SheetRoute>{null}</SheetRoute>
  const now = elfNow()
  const learned = ELF_TRICKS.filter((trick) => trickStatus(state, trick.id) === 'learned').length
  const learning = ELF_TRICKS.filter((trick) => trickStatus(state, trick.id) === 'learning').length
  /* A trick in learning that still waits for today's practice names itself. */
  const toTrain = tricksToTrain(state, now)[0] ?? null
  const unbought = peddlerWares(state, now).filter((ware) => !ware.bought).length
  const toClaim = badgesToClaim(state).length
  const earned = ELF_BADGES.filter((badge) => badgeStatus(state, badge.id) !== 'locked').length
  const activities: Activity[] = [
    {
      key: 'tricks',
      icon: TricksIcon,
      title: t('mobile:elf.activityTricks'),
      hint: toTrain ? t('mobile:elf.activityTricksTrain', { name: t(trickKey(toTrain)) }) : learning > 0 ? t('mobile:elf.activityTricksLearning', { count: learning }) : t('mobile:elf.activityTricksHint', { learned, total: ELF_TRICKS.length }),
      open: () => router.replace('/elf-tricks'),
    },
    ...ELF_GAMES.map((id): Activity => {
      const best = state.games[id]?.best ?? 0
      return {
        key: id,
        icon: GAME_ICON[id],
        title: t(gameKey(id)),
        hint: best > 0 ? t('mobile:elf.gameBest', { count: best }) : t(`${gameKey(id)}Hint`),
        open: () => router.replace({ pathname: '/elf-game/[id]', params: { id } }),
      }
    }),
    {
      key: 'peddler',
      icon: PeddlerIcon,
      title: t('mobile:elf.activityPeddler'),
      hint: unbought > 0 ? t('mobile:elf.activityPeddlerHint', { count: unbought }) : t('mobile:elf.activityPeddlerEmpty'),
      open: () => router.replace('/elf-peddler'),
    },
    {
      key: 'badges',
      icon: BadgesIcon,
      title: t('mobile:elf.activityBadges'),
      hint: toClaim > 0 ? t('mobile:elf.activityBadgesClaim', { count: toClaim }) : t('mobile:elf.activityBadgesHint', { done: earned, total: ELF_BADGES.length }),
      open: () => router.replace('/elf-badges'),
    },
  ]

  return (
    <SheetRoute>
      <View style={styles.column}>
        <View style={styles.head}>
          <Text variant="eyebrow">{t('mobile:elf.activitiesKicker')}</Text>
          <Text variant="title" accessibilityRole="header">
            {t('mobile:elf.activitiesTitle')}
          </Text>
          <Text tone="soft">{t('mobile:elf.activitiesLead')}</Text>
          <View style={styles.energy}>
            <SleepIcon size={iconSize.md} weight="duotone" color={gameRounds > 0 ? colors.accentStrong : colors.inkFaint} />
            <Text weight="semibold" tone={gameRounds > 0 ? 'ink' : 'soft'}>
              {gameRounds > 0 ? t('mobile:elf.energyRounds', { count: gameRounds }) : t('mobile:elf.energyNone')}
            </Text>
          </View>
        </View>
        {activities.map(({ key, icon: Glyph, title, hint, open }) => (
          <PressableScale key={key} accessibilityRole="button" accessibilityLabel={`${title}. ${hint}`} onPress={open} style={styles.row}>
            <View style={styles.picture}>
              <Glyph size={iconSize.lg} weight="duotone" color={colors.accentStrong} />
            </View>
            <View style={styles.words}>
              <Text weight="bold" numberOfLines={1}>
                {title}
              </Text>
              <Text variant="small" tone="soft">
                {hint}
              </Text>
            </View>
            <NextIcon size={iconSize.md} color={colors.inkFaint} />
          </PressableScale>
        ))}
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
  /* The elf's energy for the games, under the lead. */
  energy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    marginTop: space.xs,
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
  picture: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentWash,
  },
  words: {
    flex: 1,
    gap: 2,
  },
})
