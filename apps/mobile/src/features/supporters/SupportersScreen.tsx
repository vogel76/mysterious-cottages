import { useCallback, type ReactNode } from 'react'
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import type { SupporterRow as Row } from '@chatynkowo/api'
import { useOnline, useSession, useSupport } from '../../providers'
import { Button, CoffeeIcon, EmptyState, ProfileIcon, SettingsRow, SettingsSection, ShieldIcon, SkeletonRow, Text, WatchAdIcon, colors, iconSize, radius, readable, space, useReadablePadding, useTabBarClearance } from '../../ui'
import { RewardedAdNote } from '../support/RewardedAdNote'
import { rewardedAdNoteKey, useRewardedSupportAd } from '../support/useRewardedSupportAd'
import { SUPPORTER_ROW_HEIGHT, SupporterRow } from './SupporterRow'
import { nextPlaceLine, useSupportStanding } from './useSupportStanding'
import { useSupporters } from './useSupporters'

/* The support ranking (the route /kronika/supporters, pushed on the
   Kronika's stack from the Kronika's card, the support sheet and the
   account screen): who watched the most ads for Chatynkowo, the coffees
   bought beside each name, for the accounts that chose to be in it.

   It is built to be climbed. Above the rows stands the seeker's own
   card: their place, what they gave, how many ads short of the next
   place they are, and the button that plays an ad right here, so the
   place moves while they look at it. An account that is not in the
   ranking gets the way in instead (the question's sheet), a signed-out
   seeker the way to the profile. The tab bar floats over the list, so it
   pads its end by the bar's height. */

const SKELETON_ROWS = 6

export function SupportersScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const online = useOnline()
  const account = useSession()
  const support = useSupport()
  const standing = useSupportStanding()
  const tabBarClearance = useTabBarClearance()
  const sides = useReadablePadding(space.lg)
  const { rows, updatedAt, refreshing, error, refresh } = useSupporters()
  const ad = useRewardedSupportAd(support.receiveAd)
  const adNote = rewardedAdNoteKey(ad.status, online)
  const adBusy = ad.status === 'loading' || ad.status === 'showing'

  const myId = account.profile?.public_id ?? null
  const renderRow = useCallback(({ item, index }: { item: Row; index: number }) => <SupporterRow row={item} place={index + 1} mine={item.public_id === myId} />, [myId])

  const watch = ad.offered ? (
    <>
      <Button variant="primary" block busy={adBusy} disabled={online === false} icon={<WatchAdIcon size={iconSize.md} color={colors.accentInk} />} onPress={ad.watch}>
        {t('mobile:support.adAction')}
      </Button>
      {adNote ? <RewardedAdNote note={adNote} offered align="center" /> : null}
    </>
  ) : null

  /* The seeker's own card. An account whose profile says nothing of the
     ranking (a backend that does not know it yet) is shown nothing. */
  function mine(): ReactNode {
    if (!account.enabled) return null
    if (!account.session) {
      return (
        <SettingsSection>
          <SettingsRow icon={<ProfileIcon size={iconSize.lg} color={colors.accentStrong} />} label={t('mobile:supporters.signIn')} trailing="chevron" onPress={() => router.navigate('/profile')} />
        </SettingsSection>
      )
    }
    if (standing.listed === undefined) return null
    const gave = [t('mobile:support.ledgerAds', { count: standing.ads }), standing.coffees > 0 ? t('mobile:support.ledgerCoffees', { count: standing.coffees }) : null].filter(Boolean).join(', ')
    if (!standing.listed) {
      return (
        <View style={styles.card}>
          <Text tone="soft">{standing.ads + standing.coffees > 0 ? t('mobile:supporters.joinLeadGave', { gave }) : t('mobile:supporters.joinLead')}</Text>
          <Button variant="primary" block onPress={() => router.push('/supporters-ask')}>
            {t('mobile:supporters.join')}
          </Button>
        </View>
      )
    }
    const next = nextPlaceLine(standing, t) ?? t('mobile:supporters.firstAd')
    return (
      <View style={styles.card} accessibilityLiveRegion="polite">
        {standing.place !== null ? (
          <View style={styles.standing} accessible accessibilityLabel={`${t('mobile:supporters.yourPlace')}: ${standing.place}. ${gave}`}>
            <Text variant="display" tone="accent" style={styles.place}>
              {standing.place}
            </Text>
            <View style={styles.standingText}>
              <Text variant="eyebrow">{t('mobile:supporters.yourPlace')}</Text>
              <Text weight="bold">{gave}</Text>
            </View>
          </View>
        ) : null}
        <Text tone="soft">{next}</Text>
        {watch}
      </View>
    )
  }

  const header = (
    <View style={styles.header}>
      <Text tone="soft">{t('mobile:supporters.lead')}</Text>
      {mine()}
    </View>
  )

  /* Rows are never cleared by a refetch, so this only shows before the
     first success: a skeleton while fetching, the reason when it failed,
     the way to the first place when nobody is in the ranking. */
  const empty = error ? (
    <EmptyState
      icon={ShieldIcon}
      title={online === false ? t('mobile:common.offlineNoData') : t('mobile:supporters.loadError')}
      action={{ label: t('mobile:common.retry'), onPress: () => void refresh() }}
    />
  ) : updatedAt === null ? (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={t('mobile:supporters.loading')}>
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <SkeletonRow key={index} />
      ))}
    </View>
  ) : (
    <EmptyState icon={CoffeeIcon} title={t('mobile:supporters.empty')} />
  )

  return (
    <FlatList
      data={rows}
      keyExtractor={(row) => row.public_id}
      renderItem={renderRow}
      getItemLayout={(_, index) => ({ length: SUPPORTER_ROW_HEIGHT, offset: SUPPORTER_ROW_HEIGHT * index, index })}
      /* As in the Kronika: an avatar clipped while loading can stay blank. */
      removeClippedSubviews={false}
      style={styles.list}
      contentInsetAdjustmentBehavior="automatic"
      scrollIndicatorInsets={{ bottom: tabBarClearance }}
      contentContainerStyle={[styles.content, readable, sides, { paddingBottom: space.xxl + tabBarClearance }]}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void refresh()}
          tintColor={colors.accentStrong}
          colors={[colors.accentStrong]}
          progressBackgroundColor={colors.pageRaised}
        />
      }
    />
  )
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: colors.page,
  },
  content: {
    padding: space.lg,
  },
  header: {
    gap: space.lg,
    paddingBottom: space.md,
  },
  /* The support card's look (features/support/SupportCard), so the
     ranking and the sheet it sends to read as one. */
  card: {
    gap: space.md,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  standing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
  },
  place: {
    minWidth: 56,
    textAlign: 'center',
  },
  standingText: {
    flex: 1,
    gap: space.xs,
  },
})
