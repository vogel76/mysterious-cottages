import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Text } from '../../ui'
import { useSupportStanding, type SupportStanding } from '../supporters/useSupportStanding'

/* The line under every ad button in the app. When the last request has
   something to say (no network, no ad, cut short: rewardedAdNoteKey),
   that; otherwise what makes the ad worth watching beyond its reward:
   what it does for the seeker in the support ranking, how many ads short
   of the next place they are, or that they lead. One component, so the
   ranking is in view wherever an ad is offered. */

type RewardedAdNoteProps = {
  /* The dictionary key of the request's state, or null when idle. */
  note: string | null
  /* Whether an ad can be asked for above: where it cannot (a build that
     shows no ads, the elf's ads for the day used up), the ranking has
     nothing to say here. */
  offered: boolean
  align?: 'center'
}

/* The ranking's word on one more ad, or null for a seeker it does not
   concern: no account, a backend that does not know the ranking, or an
   account that chose to stay out of it. */
function rankingLine(standing: SupportStanding, t: TFunction): string | null {
  if (standing.listed === undefined || standing.listed === false) return null
  if (standing.place === null) return t('mobile:supporters.adCounts')
  if (standing.toNext === null) return t('mobile:supporters.adLeading')
  return t('mobile:supporters.adToNext', { count: standing.toNext, place: standing.place - 1 })
}

export function RewardedAdNote({ note, offered, align }: RewardedAdNoteProps) {
  const { t } = useTranslation()
  const standing = useSupportStanding()
  const text = note ? t(note) : offered ? rankingLine(standing, t) : null
  if (!text) return null
  return (
    <Text variant="small" tone="faint" align={align} accessibilityLiveRegion="polite">
      {text}
    </Text>
  )
}
