import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { STORE_NAME } from '../../lib/billing'
import { storeNoteKey, useCloseModal, useOnline, useSupport } from '../../providers'
import { Button, CoffeeIcon, PressableScale, SheetRoute, Text, WatchAdIcon, colors, iconSize, radius, space } from '../../ui'
import { RewardedAdNote } from './RewardedAdNote'
import { DEFAULT_TIP, tipLabelKey } from './tips'
import { rewardedAdNoteKey, useRewardedSupportAd } from './useRewardedSupportAd'
import { useSupportLedger } from './useSupportLedger'

/* The support sheet (the route /support), opened by the support card
   (SupportCard.tsx: a tale's end, the Kronika, the profile) and the
   celebration card: the two voluntary ways to support Chatynkowo, side
   by side and equal. A coffee for the elf is a purchase through the store
   the app came from (SupportProvider holds the connection and the menu
   with the store's prices; the store's own payment sheet takes the
   payment). An ad is a rewarded ad the player asks for and watches to
   the end, which the ad network confirms. Either way the receipt is the
   provider's: the ledger counts it and a toast says thanks; this sheet
   only closes when it hears of one. Nothing
   is unlocked by either, and the sheet says so. A build that cannot
   reach its store, or an ad unit, says that way is not available. */

export function SupportSheet() {
  const { t } = useTranslation()
  const router = useRouter()
  const close = useCloseModal()
  const online = useOnline()
  const support = useSupport()
  const ledger = useSupportLedger()
  const [tip, setTip] = useState<string | null>(null)

  useEffect(() => support.onReceived(() => close()), [support, close])

  const ad = useRewardedSupportAd(support.receiveAd)

  /* The default size, or the first one the store sells. */
  const chosen = tip ?? support.menu.find((item) => item.tip.id === DEFAULT_TIP)?.product.id ?? support.menu[0]?.product.id ?? null

  const coffeeNote = storeNoteKey(support, online)
  const adNote = rewardedAdNoteKey(ad.status, online)
  const given = [
    ledger.coffees > 0 ? t('mobile:support.ledgerCoffees', { count: ledger.coffees }) : null,
    ledger.ads > 0 ? t('mobile:support.ledgerAds', { count: ledger.ads }) : null,
  ].filter(Boolean)

  return (
    <SheetRoute scroll>
      <View style={styles.column}>
        <View style={styles.head}>
          <Text variant="eyebrow">{t('mobile:support.eyebrow')}</Text>
          <Text variant="title" accessibilityRole="header">
            {t('mobile:support.title')}
          </Text>
          <Text tone="soft">{t('mobile:support.lead')}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardTitle}>
            <CoffeeIcon size={iconSize.lg} weight="duotone" color={colors.accentStrong} />
            <Text variant="heading" accessibilityRole="header">
              {t('mobile:support.coffeeTitle')}
            </Text>
          </View>
          {support.status === 'connecting' ? (
            <ActivityIndicator color={colors.accentStrong} accessibilityLabel={t('mobile:support.coffeeConnecting')} style={styles.spinner} />
          ) : support.status === 'unavailable' ? (
            <Text variant="small" tone="faint">
              {t('mobile:support.coffeeUnavailable')}
            </Text>
          ) : (
            <>
              <Text variant="small" tone="soft">
                {t('mobile:support.coffeeLead', { store: STORE_NAME })}
              </Text>
              <View style={styles.menu} accessibilityRole="radiogroup">
                {support.menu.map(({ tip: entry, product }) => {
                  const selected = product.id === chosen
                  const label = t(tipLabelKey(entry.id))
                  return (
                    <PressableScale
                      key={product.id}
                      accessibilityRole="radio"
                      accessibilityState={{ selected, checked: selected }}
                      accessibilityLabel={t('mobile:support.tipChoiceAria', { label, amount: product.displayPrice })}
                      onPress={() => setTip(product.id)}
                      style={[styles.option, selected && styles.optionSelected]}
                    >
                      <Text weight="bold" numberOfLines={1}>
                        {product.displayPrice}
                      </Text>
                      <Text variant="small" tone={selected ? 'accent' : 'soft'} numberOfLines={1}>
                        {label}
                      </Text>
                    </PressableScale>
                  )
                })}
              </View>
              <Button
                variant="primary"
                block
                busy={support.buying !== null}
                disabled={online === false || chosen === null}
                icon={<CoffeeIcon size={iconSize.md} weight="fill" color={colors.accentInk} />}
                onPress={() => {
                  if (chosen) support.buy(chosen)
                }}
              >
                {t('mobile:support.tipAction')}
              </Button>
              {coffeeNote ? (
                <Text variant="small" tone="faint" accessibilityLiveRegion="polite">
                  {t(coffeeNote)}
                </Text>
              ) : null}
            </>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardTitle}>
            <WatchAdIcon size={iconSize.lg} weight="duotone" color={colors.accentStrong} />
            <Text variant="heading" accessibilityRole="header">
              {t('mobile:support.adTitle')}
            </Text>
          </View>
          {ad.offered ? (
            <>
              <Text variant="small" tone="soft">
                {t('mobile:support.adLead')}
              </Text>
              <Button
                block
                busy={ad.status === 'loading' || ad.status === 'showing'}
                disabled={online === false}
                icon={<WatchAdIcon size={iconSize.md} color={colors.accentStrong} />}
                onPress={ad.watch}
              >
                {t('mobile:support.adAction')}
              </Button>
              <RewardedAdNote note={adNote} offered />
            </>
          ) : (
            <Text variant="small" tone="faint">
              {t('mobile:support.adNotInBuild')}
            </Text>
          )}
        </View>

        {given.length ? (
          <Text variant="small" tone="soft" align="center">
            {t('mobile:support.ledgerTitle')}: {given.join(', ')}
          </Text>
        ) : null}
        {/* The way to the support ranking: the sheet closes first, so
            the ranking opens on the Kronika's stack and not on top of it. */}
        <Button
          variant="subtle"
          block
          onPress={() => {
            close()
            router.navigate('/kronika/supporters', { withAnchor: true })
          }}
        >
          {t('mobile:supporters.open')}
        </Button>
        <Text variant="small" tone="faint" align="center">
          {t('mobile:support.note')}
        </Text>
      </View>
    </SheetRoute>
  )
}

const styles = StyleSheet.create({
  column: {
    gap: space.xl,
    paddingTop: space.sm,
  },
  head: {
    gap: space.xs,
  },
  card: {
    gap: space.md,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  cardTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  spinner: {
    paddingVertical: space.md,
  },
  /* The menu as two columns of two. */
  menu: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  option: {
    flexGrow: 1,
    flexBasis: '45%',
    gap: 2,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.control,
    backgroundColor: colors.pageRaised,
  },
  optionSelected: {
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentWash,
  },
})
