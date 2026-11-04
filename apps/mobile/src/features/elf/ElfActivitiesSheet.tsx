import { StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { ELF_GAMES, ELF_TRICKS, trickStatus } from '@chatynkowo/core'
import { useElf } from '../../providers'
import { NextIcon, PressableScale, SheetRoute, Text, TricksIcon, colors, iconSize, radius, space, type Icon } from '../../ui'
import { GAME_ICON, gameKey } from './games/games'

/* The activities hub (the route /elf-activities), from the activities
   button on the elf's bar: what there is to do with the elf from the
   couch, one row each with a word on where it stands, opening its own
   sheet or screen: the tricks and the two games; the peddler and the
   badges join as they come. */

type Activity = { key: string; icon: Icon; title: string; hint: string; open: () => void }

export function ElfActivitiesSheet() {
  const { t } = useTranslation()
  const router = useRouter()
  const { state, gamePlaysLeft } = useElf()
  if (!state) return <SheetRoute>{null}</SheetRoute>
  const learned = ELF_TRICKS.filter((trick) => trickStatus(state, trick.id) === 'learned').length
  const learning = ELF_TRICKS.filter((trick) => trickStatus(state, trick.id) === 'learning').length
  const activities: Activity[] = [
    {
      key: 'tricks',
      icon: TricksIcon,
      title: t('mobile:elf.activityTricks'),
      hint: learning > 0 ? t('mobile:elf.activityTricksLearning', { count: learning }) : t('mobile:elf.activityTricksHint', { learned, total: ELF_TRICKS.length }),
      open: () => router.replace('/elf-tricks'),
    },
    ...ELF_GAMES.map((id): Activity => {
      const left = gamePlaysLeft(id)
      const best = state.games[id]?.best ?? 0
      return {
        key: id,
        icon: GAME_ICON[id],
        title: t(gameKey(id)),
        hint: `${left > 0 ? t('mobile:elf.gamePlaysLeft', { count: left }) : t('mobile:elf.gamePlaysNone')}${best > 0 ? ` · ${t('mobile:elf.gameBest', { count: best })}` : ''}`,
        open: () => router.replace({ pathname: '/elf-game/[id]', params: { id } }),
      }
    }),
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
