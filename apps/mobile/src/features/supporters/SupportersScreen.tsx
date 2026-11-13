import { useCallback, type ReactNode } from 'react'
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import type { SupporterRow as Row } from '@chatynkowo/api'
import { useOnline, useSession } from '../../providers'
import { Button, CoffeeIcon, EmptyState, ProfileIcon, SettingsRow, SettingsSection, ShieldIcon, SkeletonRow, Text, colors, iconSize, readable, space, useReadablePadding, useTabBarClearance } from '../../ui'
import { useSupportLedger } from '../support/useSupportLedger'
import { SUPPORTER_ROW_HEIGHT, SupporterRow } from './SupporterRow'
import { useSupporters } from './useSupporters'

/* The supporters' board (the route /kronika/supporters, pushed on the
   Kronika's stack from the support sheet and the account screen): who
   gave the elves how many coffees and ads, for the accounts that chose to
   be on it, the most coffees first. Above the rows, one line on what the
   board is and the seeker's own standing: the way to the profile when
   signed out, the way onto the board (the question's sheet) for an
   account that is not on it, and what it shows for one that is. The tab
   bar floats over the list, so it pads its end by the bar's height. */

const SKELETON_ROWS = 6

export function SupportersScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const online = useOnline()
  const account = useSession()
  const ledger = useSupportLedger()
  const tabBarClearance = useTabBarClearance()
  const sides = useReadablePadding(space.lg)
  const { rows, updatedAt, refreshing, error, refresh } = useSupporters()

  const myId = account.profile?.public_id ?? null
  const renderRow = useCallback(({ item, index }: { item: Row; index: number }) => <SupporterRow row={item} place={index + 1} mine={item.public_id === myId} />, [myId])

  /* The seeker's own standing. An account whose profile says nothing of
     the board (a backend that does not know it yet) is shown nothing. */
  function standing(): ReactNode {
    if (!account.enabled) return null
    if (!account.session) {
      return (
        <SettingsSection>
          <SettingsRow icon={<ProfileIcon size={iconSize.lg} color={colors.accentStrong} />} label={t('mobile:supporters.signIn')} trailing="chevron" onPress={() => router.navigate('/profile')} />
        </SettingsSection>
      )
    }
    const listed = account.profile?.listed_as_supporter
    if (listed === undefined) return null
    if (!listed) {
      return (
        <Button variant="primary" block onPress={() => router.push('/supporters-ask')}>
          {t('mobile:supporters.join')}
        </Button>
      )
    }
    const gave = [
      ledger.coffees > 0 ? t('mobile:support.ledgerCoffees', { count: ledger.coffees }) : null,
      ledger.ads > 0 ? t('mobile:support.ledgerAds', { count: ledger.ads }) : null,
    ].filter(Boolean)
    return (
      <Text variant="small" tone="soft" accessibilityLiveRegion="polite">
        {gave.length ? t('mobile:supporters.listed', { gave: gave.join(', ') }) : t('mobile:supporters.listedEmpty')}
      </Text>
    )
  }

  const header = (
    <View style={styles.header}>
      <View style={styles.lead}>
        <Text variant="eyebrow">{t('mobile:support.eyebrow')}</Text>
        <Text tone="soft">{t('mobile:supporters.lead')}</Text>
      </View>
      {standing()}
    </View>
  )

  /* Rows are never cleared by a refetch, so this only shows before the
     first success: a skeleton while fetching, the reason when it failed,
     the way to the first coffee when nobody is on the board. */
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
    <EmptyState icon={CoffeeIcon} title={t('mobile:supporters.empty')} action={{ label: t('mobile:support.action'), onPress: () => router.push('/support') }} />
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
  lead: {
    gap: space.xs,
  },
})
