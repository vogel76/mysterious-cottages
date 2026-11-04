import { useCallback, useRef, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { careCharges, careLeft, careNextAt, DUST, ELF_CARE_ACTIONS, hatchAt, shopItems, SKIP_COST, type ElfCareAction, type ElfShopItem, type ElfSkip } from '@chatynkowo/core'
import { storeNoteKey, useCloseModal, useElf, useOnline, useSupport, useToast } from '../../providers'
import { Button, DustIcon, PressableScale, SheetRoute, Text, WatchAdIcon, colors, iconSize, radius, space } from '../../ui'
import { packLabelKey } from '../support/tips'
import { rewardedAdNoteKey, useRewardedSupportAd } from '../support/useRewardedSupportAd'
import { isSlotId } from './cottage/catalogue'
import { durationText, useClock } from './duration'
import { ElfThumb } from './ElfThumb'
import { elfKey } from './labels'

/* The shop of star dust (the route /elf-shop), from the shop button on
   the elf's bar and the egg's chip: the balance, the two ways to get more
   dust beyond the streaks and quest sets of the rules (a rewarded ad, the
   same unit as the support sheet's, paying DUST.ad up to DUST.adCap ads
   a day, and the store's packs, consumable products the support provider
   sells beside the coffees and credits on payment), then the skips of the
   waiting the rules allow (the egg before its hour, a care's charges
   before their time, the next form before its days), each for its dust
   (SKIP_COST) or for one ad, which counts towards the same daily cap,
   and last the furniture and hats the finds still lock (shopItems: the
   unlock table's entries the player has neither reached, been granted by
   the tree nor bought), each with its catalogue thumbnail, the cottages
   it still needs and its price in dust. A skip bought closes the sheet,
   so the player sees the egg ready, the charges back or the elf grow in
   the room; a piece bought stays, with a toast pointing at the decorating
   panel. The store's receipt reaches the wallet through the provider (a
   toast says how much), the ad's through the elf provider, right here,
   with a line under the button. */

type AdFor = 'dust' | ElfSkip

export function ElfShopSheet() {
  const { t } = useTranslation()
  const online = useOnline()
  const close = useCloseModal()
  const support = useSupport()
  const { state, stage, finds, adsLeft, earnAdDust, skip, nextForm, buyItem } = useElf()
  const toast = useToast()
  const [earned, setEarned] = useState(0)
  const now = useClock(true)

  /* One rewarded ad at a time; what it was asked for decides its reward. */
  const adFor = useRef<AdFor>('dust')
  const onRewarded = useCallback(() => {
    if (adFor.current === 'dust') setEarned(earnAdDust())
    else if (skip(adFor.current, 'ad')) close()
  }, [earnAdDust, skip, close])
  const ad = useRewardedSupportAd(onRewarded)
  const adBusy = ad.status === 'loading' || ad.status === 'showing'
  const adNote = rewardedAdNoteKey(ad.status, online)
  const storeNote = storeNoteKey(support, online)
  const dust = state?.wallet.dust ?? 0
  const watchFor = (purpose: AdFor) => {
    adFor.current = purpose
    setEarned(0)
    ad.watch()
  }
  const buyWithDust = (kind: ElfSkip) => {
    if (skip(kind, 'dust')) close()
  }
  const adAllowed = ad.offered && online !== false && adsLeft > 0
  const items = state ? shopItems(state, finds.length) : []
  const buy = (item: ElfShopItem, name: string) => {
    if (buyItem(item.slot, item.id)) toast.show({ tone: 'success', text: t('mobile:elf.shopItemBought', { name }) })
  }

  /* The skips on offer right now, in the order of the elf's life. */
  const skips: { kind: ElfSkip; title: string; detail: string; open: boolean }[] = []
  if (state && stage === 'egg') {
    const at = hatchAt(state)
    const left = at === null ? 0 : at - now
    skips.push({ kind: 'hatch', title: t('mobile:elf.shopSkipHatch'), detail: left > 0 ? t('mobile:elf.shopSkipHatchWhen', { time: durationText(t, left) }) : t('mobile:elf.hatchSoon'), open: left > 0 })
  }
  if (state && stage !== 'egg') {
    for (const id of ELF_CARE_ACTIONS) {
      const left = careLeft(state, id, now)
      const next = careNextAt(state, id, now)
      const total = careCharges(state, id)
      skips.push({
        kind: id,
        title: t(careTitleKey(id)),
        detail: left >= total || next === null ? t('mobile:elf.shopSkipCareFull') : t('mobile:elf.shopSkipCareWhen', { left, total, time: durationText(t, next - now) }),
        open: left < total,
      })
    }
    if (nextForm) {
      const form = t(elfKey('stage', nextForm.form))
      const detail =
        nextForm.days === null
          ? t('mobile:elf.shopSkipGrowFinds', { form, count: nextForm.finds })
          : nextForm.days > 0
            ? t('mobile:elf.shopSkipGrowWhen', { form, count: nextForm.days })
            : t('mobile:elf.shopSkipGrowDue', { form })
      skips.push({ kind: 'grow', title: t('mobile:elf.shopSkipGrow'), detail, open: nextForm.days !== null && nextForm.days > 0 })
    }
  }

  return (
    <SheetRoute scroll>
      <View style={styles.column}>
        <View style={styles.head}>
          <Text variant="eyebrow">{t('mobile:elf.shopKicker')}</Text>
          <Text variant="title" accessibilityRole="header">
            {t('mobile:elf.shopTitle')}
          </Text>
          <View style={styles.balance}>
            <DustIcon size={iconSize.md} weight="fill" color={colors.accentStrong} />
            <Text weight="bold">{t('mobile:elf.shopBalance', { count: dust })}</Text>
          </View>
          <Text tone="soft">{t('mobile:elf.shopLead')}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardTitle}>
            <WatchAdIcon size={iconSize.lg} weight="duotone" color={colors.accentStrong} />
            <Text variant="heading" accessibilityRole="header">
              {t('mobile:elf.shopEarnTitle')}
            </Text>
          </View>
          {ad.offered ? (
            <>
              <Button
                variant="primary"
                block
                busy={adBusy && adFor.current === 'dust'}
                disabled={!adAllowed || adBusy}
                icon={<WatchAdIcon size={iconSize.md} color={colors.accentInk} />}
                onPress={() => watchFor('dust')}
              >
                {t('mobile:elf.shopAdAction', { dust: DUST.ad })}
              </Button>
              <Text variant="small" tone="soft" accessibilityLiveRegion="polite">
                {earned > 0 ? `${t('mobile:elf.shopDustAdded', { dust: earned })} · ` : ''}
                {adsLeft > 0 ? t('mobile:elf.shopAdLeft', { count: adsLeft }) : t('mobile:elf.shopAdDone')}
              </Text>
              {adNote ? (
                <Text variant="small" tone="faint" accessibilityLiveRegion="polite">
                  {t(adNote)}
                </Text>
              ) : null}
            </>
          ) : (
            <Text variant="small" tone="faint">
              {t('mobile:support.adNotInBuild')}
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardTitle}>
            <DustIcon size={iconSize.lg} weight="duotone" color={colors.accentStrong} />
            <Text variant="heading" accessibilityRole="header">
              {t('mobile:elf.shopPacksTitle')}
            </Text>
          </View>
          {support.status === 'connecting' ? (
            <ActivityIndicator color={colors.accentStrong} accessibilityLabel={t('mobile:support.coffeeConnecting')} style={styles.spinner} />
          ) : support.status === 'unavailable' || support.dustMenu.length === 0 ? (
            <Text variant="small" tone="faint">
              {t('mobile:elf.shopPacksUnavailable')}
            </Text>
          ) : (
            <>
              {support.dustMenu.map(({ pack, product }) => {
                const name = t(packLabelKey(pack.id))
                const buying = support.buying === product.id
                return (
                  <PressableScale
                    key={product.id}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: online === false || support.buying !== null, busy: buying }}
                    accessibilityLabel={t('mobile:elf.shopPackAria', { name, dust: pack.dust, price: product.displayPrice })}
                    disabled={online === false || support.buying !== null}
                    onPress={() => support.buy(product.id)}
                    style={styles.row}
                  >
                    <View style={styles.rowWords}>
                      <Text weight="bold" numberOfLines={1}>
                        {name}
                      </Text>
                      <View style={styles.rowDust}>
                        <DustIcon size={iconSize.sm} weight="fill" color={colors.accentStrong} />
                        <Text variant="small" tone="soft">
                          {pack.dust}
                        </Text>
                      </View>
                    </View>
                    {buying ? <ActivityIndicator color={colors.accentStrong} /> : <Text weight="semibold">{product.displayPrice}</Text>}
                  </PressableScale>
                )
              })}
              {storeNote ? (
                <Text variant="small" tone="faint" accessibilityLiveRegion="polite">
                  {t(storeNote)}
                </Text>
              ) : null}
            </>
          )}
        </View>

        {skips.length ? (
          <View style={styles.card}>
            <Text variant="heading" accessibilityRole="header">
              {t('mobile:elf.shopSkipsTitle')}
            </Text>
            <Text variant="small" tone="soft">
              {t('mobile:elf.shopSkipsLead')}
            </Text>
            {skips.map((entry) => {
              const cost = SKIP_COST[entry.kind]
              const short = dust < cost
              const adHere = adBusy && adFor.current === entry.kind
              return (
                <View key={entry.kind} style={styles.row}>
                  <View style={styles.rowWords}>
                    <Text weight="bold" numberOfLines={1}>
                      {entry.title}
                    </Text>
                    <Text variant="small" tone="soft">
                      {entry.detail}
                    </Text>
                    {entry.open && short ? (
                      <Text variant="small" tone="faint">
                        {t('mobile:elf.shopPayShort')}
                      </Text>
                    ) : null}
                  </View>
                  {entry.open ? (
                    <View style={styles.pays}>
                      <Button
                        variant="primary"
                        disabled={short || adBusy}
                        accessibilityLabel={t('mobile:elf.shopPayDustAria', { what: entry.title, cost })}
                        icon={<DustIcon size={iconSize.sm} weight="fill" color={colors.accentInk} />}
                        onPress={() => buyWithDust(entry.kind)}
                      >
                        {t('mobile:elf.shopPayDust', { cost })}
                      </Button>
                      {ad.offered ? (
                        <Button
                          busy={adHere}
                          disabled={!adAllowed || adBusy}
                          accessibilityLabel={t('mobile:elf.shopPayAdAria', { what: entry.title })}
                          icon={<WatchAdIcon size={iconSize.sm} color={colors.accentStrong} />}
                          onPress={() => watchFor(entry.kind)}
                        >
                          {t('mobile:elf.shopPayAd')}
                        </Button>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              )
            })}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text variant="heading" accessibilityRole="header">
            {t('mobile:elf.shopItemsTitle')}
          </Text>
          <Text variant="small" tone="soft">
            {t('mobile:elf.shopItemsLead')}
          </Text>
          {items.length === 0 ? (
            <Text variant="small" tone="faint">
              {t('mobile:elf.shopItemsAll')}
            </Text>
          ) : (
            items.map((item) => {
              /* The rules' table names the app's catalogue; a slot it does not know is not shown. */
              const slot = item.slot === 'hat' ? 'hat' : isSlotId(item.slot) ? item.slot : null
              if (!slot) return null
              const name = t(elfKey('item', item.id))
              const short = dust < item.cost
              return (
                <View key={`${item.slot}:${item.id}`} style={styles.row}>
                  <View style={styles.thumb}>
                    <ElfThumb slot={slot} id={item.id} size={THUMB} form={stage === 'egg' ? undefined : stage} />
                  </View>
                  <View style={styles.rowWords}>
                    <Text weight="bold" numberOfLines={1}>
                      {name}
                    </Text>
                    <Text variant="small" tone="soft">
                      {t(elfKey('slot', slot))} · {t('mobile:elf.shopItemFinds', { count: item.finds })}
                    </Text>
                    {short ? (
                      <Text variant="small" tone="faint">
                        {t('mobile:elf.shopPayShort')}
                      </Text>
                    ) : null}
                  </View>
                  <Button
                    variant="primary"
                    disabled={short}
                    accessibilityLabel={t('mobile:elf.shopItemBuyAria', { name, cost: item.cost })}
                    icon={<DustIcon size={iconSize.sm} weight="fill" color={colors.accentInk} />}
                    onPress={() => buy(item, name)}
                  >
                    {t('mobile:elf.shopPayDust', { cost: item.cost })}
                  </Button>
                </View>
              )
            })
          )}
        </View>
      </View>
    </SheetRoute>
  )
}

/* The side of a piece's thumbnail in the items card, points. */
const THUMB = 56

function careTitleKey(id: ElfCareAction): string {
  return `mobile:elf.shopSkip${id.charAt(0).toUpperCase()}${id.slice(1)}`
}

const styles = StyleSheet.create({
  column: {
    gap: space.lg,
    paddingTop: space.sm,
  },
  head: {
    gap: space.xs,
  },
  balance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    marginTop: space.xs,
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
    alignSelf: 'center',
    marginVertical: space.sm,
  },
  /* A pack or a skip: its words on the left, the price or the two ways
     to pay on the right. */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.control,
    backgroundColor: colors.pageRaised,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.control,
    overflow: 'hidden',
  },
  rowWords: {
    flex: 1,
    gap: 2,
  },
  rowDust: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  pays: {
    gap: space.xs,
    alignItems: 'stretch',
  },
})
