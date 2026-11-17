import { useTranslation } from 'react-i18next'
import { COFFEE_POINTS, type CoffeeSize } from '../../lib/support-store'
import { Text } from '../../ui'
import { usePlaceWith, useSupportStanding } from '../supporters/useSupportStanding'

/* The line under the coffees of the support sheet: what the chosen
   coffee is worth in the support ranking and, for a seeker who is in it,
   the place it would take them to. The counterpart of the line under an
   ad button (RewardedAdNote), so the ranking is in view where a coffee is
   offered too. Nothing for a seeker the ranking does not concern: no
   account, a backend that does not know the ranking, or an account that
   chose to stay out of it. */

export function CoffeeRankNote({ size }: { size: CoffeeSize }) {
  const { t } = useTranslation()
  const standing = useSupportStanding()
  const points = COFFEE_POINTS[size]
  const place = usePlaceWith(points, 1)
  if (standing.listed === undefined || standing.listed === false) return null
  return (
    <Text variant="small" tone="faint" accessibilityLiveRegion="polite">
      {place !== null ? t('mobile:supporters.coffeeToPlace', { count: points, place }) : t('mobile:supporters.coffeeCounts', { count: points })}
    </Text>
  )
}
