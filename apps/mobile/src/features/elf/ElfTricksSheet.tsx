import { StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { ELF_TRICKS, trickStatus, trickTrainedToday, type ElfTrickId } from '@chatynkowo/core'
import { useCloseModal, useElf, useToast } from '../../providers'
import { AcornsIcon, Button, CheckIcon, SheetRoute, Text, colors, iconSize, radius, space } from '../../ui'
import { TRICK_ICON, trickKey } from './tricks'
import { elfNow } from '../../lib/elf-clock'

/* The elf's tricks (the route /elf-tricks), from the activities hub: the
   acorns at hand and the six tricks, each a row with its picture, its
   name, what the elf does and where it stands. A trick not yet bought
   offers its price in acorns, and the purchase is followed at once by
   the first practice (the sheet closes and the elf is seen trying the
   trick in the room; a sleeping elf keeps the trick for the morning,
   the toast says so), so nothing is left to guess; one in learning says
   how many practices are left and offers the day's, once a day (the
   rules refuse a second, and a sleeping elf), and says to come back
   tomorrow once it had it; a learned one offers to be shown. Practice
   and a show close the sheet and hand the trick to the tab, which plays
   the reaction in the room with the elf's line. The rules hold the
   catalogue, the prices and the sessions (packages/core: ELF_TRICKS,
   buyTrick, trainTrick, tricksToTrain). */

export function ElfTricksSheet() {
  const { t } = useTranslation()
  const close = useCloseModal()
  const toast = useToast()
  const { state, buyTrick, trainTrick, playTrick } = useElf()
  if (!state) return <SheetRoute>{null}</SheetRoute>
  const acorns = state.wallet.acorns
  const now = elfNow()

  const buy = (id: ElfTrickId) => {
    if (!buyTrick(id)) return
    const name = t(trickKey(id))
    const outcome = trainTrick(id)
    if (outcome === 'trained' || outcome === 'learned') {
      toast.show({ tone: 'success', text: t('mobile:elf.trickBoughtToast', { name }) })
      playTrick(id, outcome)
      close()
    } else toast.show({ tone: 'success', text: t('mobile:elf.trickBoughtAsleepToast', { name }) })
  }
  const train = (id: ElfTrickId) => {
    const outcome = trainTrick(id)
    if (outcome === 'trained' || outcome === 'learned') {
      playTrick(id, outcome)
      close()
    } else if (outcome === 'asleep') toast.show({ tone: 'info', text: t('mobile:elf.trickAsleep') })
  }
  const show = (id: ElfTrickId) => {
    if (state.sleeping) {
      toast.show({ tone: 'info', text: t('mobile:elf.trickAsleep') })
      return
    }
    playTrick(id, 'shown')
    close()
  }

  return (
    <SheetRoute scroll>
      <View style={styles.column}>
        <View style={styles.head}>
          <Text variant="eyebrow">{t('mobile:elf.activitiesKicker')}</Text>
          <Text variant="title" accessibilityRole="header">
            {t('mobile:elf.tricksTitle')}
          </Text>
          <View style={styles.balance}>
            <AcornsIcon size={iconSize.md} weight="fill" color={colors.accentStrong} />
            <Text weight="bold">{t('mobile:elf.tricksBalance', { count: acorns })}</Text>
          </View>
          <Text tone="soft">{t('mobile:elf.tricksLead')}</Text>
        </View>

        {ELF_TRICKS.map((spec) => {
          const status = trickStatus(state, spec.id)
          const Glyph = TRICK_ICON[spec.id]
          const name = t(trickKey(spec.id))
          const sessions = state.tricks[spec.id]?.sessions ?? 0
          const trainedToday = trickTrainedToday(state, spec.id, now)
          const short = acorns < spec.acorns
          return (
            <View key={spec.id} style={styles.row}>
              <View style={[styles.picture, status === 'learned' && styles.pictureLearned]}>
                <Glyph size={iconSize.lg} weight={status === 'learned' ? 'fill' : 'duotone'} color={status === 'learned' ? colors.accentInk : colors.accentStrong} />
              </View>
              <View style={styles.words}>
                <Text weight="bold" numberOfLines={1}>
                  {name}
                </Text>
                <Text variant="small" tone="soft">
                  {t(trickKey(spec.id, 'desc'))}
                </Text>
                {status === 'learning' ? (
                  <>
                    <Text variant="small" tone="accent">
                      {t('mobile:elf.trickProgress', { done: sessions, total: spec.sessions })}
                    </Text>
                    <Text variant="small" tone="soft">
                      {trainedToday ? t('mobile:elf.trickTrainedTodayHint') : t('mobile:elf.trickTrainHint', { count: spec.sessions - sessions })}
                    </Text>
                  </>
                ) : status === 'unowned' && short ? (
                  <Text variant="small" tone="faint">
                    {t('mobile:elf.trickBuyShort')}
                  </Text>
                ) : null}
              </View>
              {status === 'unowned' ? (
                <Button
                  variant="primary"
                  disabled={short}
                  accessibilityLabel={t('mobile:elf.trickBuyAria', { name, count: spec.acorns })}
                  icon={<AcornsIcon size={iconSize.sm} weight="fill" color={colors.accentInk} />}
                  onPress={() => buy(spec.id)}
                >
                  {t('mobile:elf.acornsPrice', { count: spec.acorns })}
                </Button>
              ) : status === 'learning' ? (
                <Button variant="primary" disabled={trainedToday} accessibilityLabel={t('mobile:elf.trickTrainAria', { name })} onPress={() => train(spec.id)}>
                  {trainedToday ? t('mobile:elf.trickTrainedToday') : t('mobile:elf.trickTrain')}
                </Button>
              ) : (
                <Button accessibilityLabel={t('mobile:elf.trickShowAria', { name })} icon={<CheckIcon size={iconSize.sm} weight="bold" color={colors.accentStrong} />} onPress={() => show(spec.id)}>
                  {t('mobile:elf.trickShow')}
                </Button>
              )}
            </View>
          )
        })}
      </View>
    </SheetRoute>
  )
}

const styles = StyleSheet.create({
  column: {
    gap: space.md,
    paddingTop: space.sm,
  },
  head: {
    gap: space.xs,
    marginBottom: space.xs,
  },
  balance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
  },
  picture: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentWash,
  },
  pictureLearned: {
    backgroundColor: colors.accentStrong,
  },
  words: {
    flex: 1,
    gap: 2,
  },
})
