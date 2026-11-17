import { memo } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import type { SupporterRow as Row } from '@chatynkowo/api'
import { Avatar, CoffeeIcon, Text, WatchAdIcon, colors, enterDown, iconSize, radius, space } from '../../ui'

/* One line of the support ranking, the leaderboard's row with other
   figures: place, avatar or initials, the name, and at the end the
   number the ranking goes by, the points. Under the name stand the two
   things the points come from, each a number with its icon and drawn
   alike: the coffees bought and the ads watched (a seeker with no coffee
   shows the ads alone, so the coffees there are stand out). A narrow
   window drops the avatar to keep room for the name. The height is fixed
   so the list can lay rows out without measuring. */

export const SUPPORTER_ROW_HEIGHT = 72
const AVATAR = 40

/* Rows of the first screenful slide in one after another. */
const ANIMATED_ROWS = 12
const STAGGER_MS = 40
const MAX_STAGGER_STEPS = 8

type SupporterRowProps = {
  row: Row
  place: number
  mine: boolean
  /* The narrow window's form (useNarrow, read once by the screen). */
  compact: boolean
}

export const SupporterRow = memo(function SupporterRow({ row, place, mine, compact }: SupporterRowProps) {
  const { t } = useTranslation()
  const points = t('mobile:supporters.pointsAria', { count: row.points })
  const ads = t('mobile:support.ledgerAds', { count: row.ads })
  const coffees = row.coffees > 0 ? t('mobile:support.ledgerCoffees', { count: row.coffees }) : null
  const name = row.display_name + (mine ? ` ${t('ranking.you')}` : '')
  const entering = place <= ANIMATED_ROWS ? enterDown(Math.min(place - 1, MAX_STAGGER_STEPS) * STAGGER_MS) : undefined
  return (
    <Animated.View entering={entering} style={[styles.row, mine && styles.rowMine]} accessible accessibilityLabel={[`${place}.`, name, points, coffees, ads].filter(Boolean).join(', ')}>
      <Text variant="heading" tone={place <= 3 ? 'accent' : 'faint'} style={styles.place}>
        {place}
      </Text>
      {compact ? null : <Avatar name={row.display_name} uri={row.avatar_url} size={AVATAR} />}
      <View style={styles.who}>
        <Text weight={mine ? 'bold' : 'semibold'} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.gave}>
          {row.coffees > 0 ? (
            <View style={styles.figure}>
              <CoffeeIcon size={iconSize.sm} weight="duotone" color={colors.accentStrong} />
              <Text variant="small" weight="semibold" tone="soft">
                {row.coffees}
              </Text>
            </View>
          ) : null}
          <View style={styles.figure}>
            <WatchAdIcon size={iconSize.sm} weight="duotone" color={colors.accentStrong} />
            <Text variant="small" weight="semibold" tone="soft">
              {row.ads}
            </Text>
          </View>
        </View>
      </View>
      <Text weight="bold" tone={mine ? 'accent' : undefined} numberOfLines={1}>
        {t('mobile:supporters.points', { points: row.points })}
      </Text>
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
  /* The name over what the seeker gave. */
  who: {
    flex: 1,
    gap: 2,
  },
  gave: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  /* An icon and its number. */
  figure: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
})
