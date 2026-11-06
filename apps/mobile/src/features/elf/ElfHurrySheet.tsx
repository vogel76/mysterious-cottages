import { useCallback, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ELF_SKIPS, ENERGY_MAX, hatchAt, SKIP_COST, type ElfSkip } from '@chatynkowo/core'
import { useCloseModal, useElf, useOnline } from '../../providers'
import { Button, DustIcon, EggIcon, HurryIcon, SheetRoute, SleepIcon, Text, WatchAdIcon, colors, iconSize, space, type Icon } from '../../ui'
import { rewardedAdNoteKey, useRewardedSupportAd } from '../support/useRewardedSupportAd'
import { durationText, useClock } from './duration'

/* The hurry of a wait (the route /elf-hurry?kind=...), opened right where
   the wait shows: the egg's hurry button and countdown, the games' line
   when the energy is out. One wait, what is left of it, and the ways to
   end it now, as big buttons under each other: for the first egg one
   free button (the first hatch never asks for anything, skipHatchFree),
   otherwise its star dust (SKIP_COST) and one rewarded ad, which counts
   towards the day's cap like every ad. Short of dust, the dust button
   itself leads to the shop, where dust is bought, and a line under the
   buttons says how much there is. Done, the sheet closes on the room,
   where the egg is ready or the elf rested. */

const ICON: Partial<Record<ElfSkip, Icon>> = { hatch: EggIcon, energy: SleepIcon }

export function ElfHurrySheet() {
  const { t } = useTranslation()
  const router = useRouter()
  const close = useCloseModal()
  const online = useOnline()
  const params = useLocalSearchParams<{ kind?: string }>()
  const kind: ElfSkip = (ELF_SKIPS as readonly string[]).includes(params.kind ?? '') ? (params.kind as ElfSkip) : 'hatch'
  const { state, adsLeft, skip, gameRounds } = useElf()
  const now = useClock(true)
  const [failed, setFailed] = useState(false)
  const onRewarded = useCallback(() => {
    if (skip(kind, 'ad')) close()
    else setFailed(true)
  }, [skip, kind, close])
  const ad = useRewardedSupportAd(onRewarded)
  const adBusy = ad.status === 'loading' || ad.status === 'showing'
  const adNote = rewardedAdNoteKey(ad.status, online)
  if (!state) return <SheetRoute>{null}</SheetRoute>

  const dust = state.wallet.dust
  const cost = SKIP_COST[kind]
  const free = kind === 'hatch' && state.freeHatch
  const at = kind === 'hatch' ? hatchAt(state) : null
  const left = at === null ? 0 : at - now
  /* Whether there is still a wait to end. */
  const open = kind === 'hatch' ? !state.hatched && left > 0 : kind === 'energy' ? state.energy < ENERGY_MAX : true
  const title = t(kind === 'hatch' ? 'mobile:elf.hurryHatchTitle' : 'mobile:elf.hurryEnergyTitle')
  const lead =
    kind === 'hatch'
      ? left > 0
        ? t('mobile:elf.hurryHatchLead', { time: durationText(t, left) })
        : t('mobile:elf.hatchSoon')
      : state.energy >= ENERGY_MAX
        ? t('mobile:elf.shopSkipEnergyFull')
        : gameRounds > 0
          ? t('mobile:elf.energyRounds', { count: gameRounds })
          : t('mobile:elf.energyNone')
  const Glyph = ICON[kind] ?? HurryIcon
  const adAllowed = ad.offered && online !== false && adsLeft > 0

  const payFree = () => {
    if (skip(kind, 'free')) close()
  }
  /* Short of dust, the dust button opens the shop in place of this sheet. */
  const short = dust < cost
  const payDust = () => {
    if (short) router.replace('/elf-shop')
    else if (skip(kind, 'dust')) close()
  }

  return (
    <SheetRoute>
      <View style={styles.column}>
        <View style={styles.head}>
          <View style={styles.picture}>
            <Glyph size={iconSize.emblem} weight="duotone" color={colors.accentStrong} />
          </View>
          <Text variant="title" align="center" accessibilityRole="header">
            {title}
          </Text>
          <Text tone="soft" align="center" accessibilityLiveRegion="polite">
            {lead}
          </Text>
          {free && open ? (
            <Text weight="semibold" tone="accent" align="center">
              {t('mobile:elf.hurryHatchFree')}
            </Text>
          ) : null}
        </View>
        {open ? (
          free ? (
            <Button variant="primary" block icon={<HurryIcon size={iconSize.md} weight="fill" color={colors.accentInk} />} onPress={payFree}>
              {t('mobile:elf.hurryFreeAction')}
            </Button>
          ) : (
            <View style={styles.pays}>
              <Button
                variant="primary"
                block
                disabled={adBusy}
                accessibilityLabel={short ? t('mobile:elf.hurryDustShortAria', { what: title, count: cost }) : t('mobile:elf.shopPayDustAria', { what: title, count: cost })}
                icon={<DustIcon size={iconSize.md} weight="fill" color={colors.accentInk} />}
                onPress={payDust}
              >
                {t('mobile:elf.shopPayDust', { count: cost })}
              </Button>
              {ad.offered ? (
                <Button
                  block
                  busy={adBusy}
                  disabled={!adAllowed || adBusy}
                  accessibilityLabel={t('mobile:elf.shopPayAdAria', { what: title })}
                  icon={<WatchAdIcon size={iconSize.md} color={colors.accentStrong} />}
                  onPress={ad.watch}
                >
                  {t('mobile:elf.hurryAdAction')}
                </Button>
              ) : null}
              {short ? (
                <Text variant="small" tone="soft" align="center">
                  {t('mobile:elf.hurryShort', { count: dust })}
                </Text>
              ) : null}
              {adNote ? (
                <Text variant="small" tone="faint" align="center" accessibilityLiveRegion="polite">
                  {t(adNote)}
                </Text>
              ) : null}
              {failed ? (
                <Text variant="small" tone="faint" align="center" accessibilityLiveRegion="polite">
                  {t('mobile:elf.hurryEndedAlready')}
                </Text>
              ) : null}
            </View>
          )
        ) : (
          <Button block onPress={close}>
            {t('mobile:elf.gameBack')}
          </Button>
        )}
      </View>
    </SheetRoute>
  )
}

const PICTURE = 80

const styles = StyleSheet.create({
  column: {
    gap: space.lg,
    paddingTop: space.sm,
  },
  head: {
    alignItems: 'center',
    gap: space.sm,
  },
  picture: {
    width: PICTURE,
    height: PICTURE,
    borderRadius: PICTURE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentWash,
  },
  pays: {
    gap: space.sm,
  },
})
