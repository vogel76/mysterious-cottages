import { memo } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import type { SupporterRow as Row } from '@chatynkowo/api'
import { Avatar, Text, colors, enterDown, radius, space } from '../../ui'

/* One line of the supporters' board, the leaderboard's row with other
   figures: place, avatar or initials, name, and under it what the seeker
   gave, in the support sheet's own words (so many coffees, so many ads).
   The height is fixed so the list can lay rows out without measuring. */

export const SUPPORTER_ROW_HEIGHT = 64
const AVATAR = 40

/* Rows of the first screenful slide in one after another. */
const ANIMATED_ROWS = 12
const STAGGER_MS = 40
const MAX_STAGGER_STEPS = 8

type SupporterRowProps = { row: Row; place: number; mine: boolean }

export const SupporterRow = memo(function SupporterRow({ row, place, mine }: SupporterRowProps) {
  const { t } = useTranslation()
  const gave = [
    row.coffees > 0 ? t('mobile:support.ledgerCoffees', { count: row.coffees }) : null,
    row.ads > 0 ? t('mobile:support.ledgerAds', { count: row.ads }) : null,
  ]
    .filter(Boolean)
    .join(', ')
  const name = row.display_name + (mine ? ` ${t('ranking.you')}` : '')
  const entering = place <= ANIMATED_ROWS ? enterDown(Math.min(place - 1, MAX_STAGGER_STEPS) * STAGGER_MS) : undefined
  return (
    <Animated.View entering={entering} style={[styles.row, mine && styles.rowMine]} accessible accessibilityLabel={[`${place}.`, name, gave].join(', ')}>
      <Text variant="heading" tone={place <= 3 ? 'accent' : 'faint'} style={styles.place}>
        {place}
      </Text>
      <Avatar name={row.display_name} uri={row.avatar_url} size={AVATAR} />
      <View style={styles.name}>
        <Text weight={mine ? 'bold' : 'semibold'} numberOfLines={1}>
          {name}
        </Text>
        <Text variant="small" tone="faint" numberOfLines={1}>
          {gave}
        </Text>
      </View>
    </Animated.View>
  )
})

const styles = StyleSheet.create({
  row: {
    height: SUPPORTER_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rowMine: {
    backgroundColor: colors.accentWash,
    borderColor: colors.lineStrong,
  },
  place: {
    width: 32,
    textAlign: 'center',
  },
  name: {
    flex: 1,
  },
})
