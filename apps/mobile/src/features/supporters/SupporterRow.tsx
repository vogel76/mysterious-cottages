import { memo } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import type { SupporterRow as Row } from '@chatynkowo/api'
import { Avatar, CoffeeIcon, Text, WatchAdIcon, colors, enterDown, iconSize, radius, space } from '../../ui'

/* One line of the support ranking, the leaderboard's row with other
   figures: place, avatar or initials, name, and two figures in columns
   that line up down the list, each a number with its icon: the coffees
   bought, then at the end the number the ranking goes by, the ads
   watched. The two are drawn alike on purpose (a coffee is worth more to
   Chatynkowo than an ad, so it is not a footnote under the name); a
   seeker with no coffee leaves that column empty, so the coffees there
   are stand out. A narrow window drops the avatar to keep room for the
   name. The height is fixed so the list can lay rows out without
   measuring. */

export const SUPPORTER_ROW_HEIGHT = 64
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
  const ads = t('mobile:support.ledgerAds', { count: row.ads })
  const coffees = row.coffees > 0 ? t('mobile:support.ledgerCoffees', { count: row.coffees }) : null
  const name = row.display_name + (mine ? ` ${t('ranking.you')}` : '')
  const entering = place <= ANIMATED_ROWS ? enterDown(Math.min(place - 1, MAX_STAGGER_STEPS) * STAGGER_MS) : undefined
  return (
    <Animated.View entering={entering} style={[styles.row, mine && styles.rowMine]} accessible accessibilityLabel={[`${place}.`, name, ads, coffees].filter(Boolean).join(', ')}>
      <Text variant="heading" tone={place <= 3 ? 'accent' : 'faint'} style={styles.place}>
        {place}
      </Text>
      {compact ? null : <Avatar name={row.display_name} uri={row.avatar_url} size={AVATAR} />}
      <Text weight={mine ? 'bold' : 'semibold'} numberOfLines={1} style={styles.name}>
        {name}
      </Text>
      <View style={[styles.figure, styles.coffees]}>
        {row.coffees > 0 ? (
          <>
            <Text weight="bold">{row.coffees}</Text>
            <CoffeeIcon size={iconSize.md} weight="duotone" color={colors.accentStrong} />
          </>
        ) : null}
      </View>
      <View style={[styles.figure, styles.ads]}>
        <Text weight="bold">{row.ads}</Text>
        <WatchAdIcon size={iconSize.md} weight="duotone" color={colors.accentStrong} />
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
  /* A number and its icon, set to the column's end so the icons line up
     down the list. */
  figure: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: space.xs,
  },
  /* Room for two digits and for three: coffees come by the handful, ads
     by the dozen. */
  coffees: {
    width: 46,
  },
  ads: {
    width: 56,
  },
})
