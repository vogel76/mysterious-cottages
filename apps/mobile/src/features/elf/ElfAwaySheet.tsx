import { useEffect, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { announce } from '../../lib/announce'
import { useCloseModal, useContent, useElf } from '../../providers'
import { Button, SheetRoute, Text, colors, radius, space } from '../../ui'
import { ElfThumb } from './ElfThumb'
import { elfKey, plantStageKey } from './labels'
import { letterFrom } from './letters'

/* The 'while you were away' card, as a sheet the tab's card presenter
   opens on the first visit after an absence of two days or more, or one
   that brought a letter or a new stage of the plant: how long it was,
   what the elf found and laid on the windowsill (each find's picture and
   name), the letter that came, with the way to read it, and the plant's
   new stage. A single night with only a find is no card: the elf says it
   in its bubble. However the sheet goes (the button, a drag, the back
   button) the card is done, so the presenter does not bring it back;
   reading the letter opens it over the card, which waits underneath. A
   card presented with nothing to show (a stale push) closes at once. */

const FIND_SIZE = 72

export function ElfAwaySheet() {
  const { t } = useTranslation()
  const router = useRouter()
  const close = useCloseModal()
  const { state, away, dismissAway } = useElf()
  const { cottages } = useContent()

  /* What the card shows, held from the first render: the provider forgets
     it when the sheet goes. */
  const shown = useRef(away)
  const card = shown.current
  const dismissRef = useRef(dismissAway)
  dismissRef.current = dismissAway
  useEffect(() => () => dismissRef.current(), [])
  const stale = useRef(card === null)
  useEffect(() => {
    if (stale.current) close()
  }, [close])

  const title = card ? (card.days === 1 ? t('mobile:elf.awayNight') : t('mobile:elf.awayDays', { count: card.days })) : ''
  useEffect(() => {
    if (title) announce(title)
  }, [title])

  if (!card) return <SheetRoute>{null}</SheetRoute>
  const name = state?.name ?? t('mobile:elf.defaultName')
  const letter = card.letter
  const openLetter = () => letter && router.push({ pathname: '/elf-letter', params: { n: String(letter.n) } })

  return (
    <SheetRoute scroll>
      <View style={styles.sheet}>
        <View style={styles.head}>
          <Text variant="eyebrow" align="center">
            {t('mobile:elf.awayKicker')}
          </Text>
          <Text variant="title" align="center" accessibilityRole="header">
            {title}
          </Text>
        </View>

        {card.found.length > 0 ? (
          <View style={styles.section}>
            <Text weight="bold" accessibilityRole="header">
              {t('mobile:elf.awayFound')}
            </Text>
            <Text tone="soft">{t('mobile:elf.awayFoundLine', { name, count: card.found.length })}</Text>
            <View style={styles.finds}>
              {card.found.map((item, index) => (
                <View key={`${item}:${index}`} style={styles.find} accessible accessibilityLabel={t(elfKey('sill', item))}>
                  <View style={styles.picture}>
                    <ElfThumb slot="sill" id={item} size={FIND_SIZE} />
                  </View>
                  <Text variant="label" align="center" numberOfLines={2}>
                    {t(elfKey('sill', item))}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {letter ? (
          <View style={styles.section}>
            <Text weight="bold" accessibilityRole="header">
              {t('mobile:elf.awayLetter')}
            </Text>
            <View style={styles.row}>
              <View style={styles.picture}>
                <ElfThumb slot="letter" id="envelope" size={FIND_SIZE} />
              </View>
              <Text style={styles.grow} numberOfLines={2}>
                {letterFrom(t, letter, cottages)}
              </Text>
              <Button variant="subtle" onPress={openLetter}>
                {t('mobile:elf.awayLetterRead')}
              </Button>
            </View>
          </View>
        ) : null}

        {card.plantStage !== null ? (
          <View style={styles.section}>
            <Text weight="bold" accessibilityRole="header">
              {t('mobile:elf.awayPlant')}
            </Text>
            <View style={styles.row}>
              <View style={styles.picture}>
                <ElfThumb slot="plant" id={`stage${card.plantStage}`} size={FIND_SIZE} />
              </View>
              <Text style={styles.grow}>{t(plantStageKey(card.plantStage))}</Text>
            </View>
          </View>
        ) : null}

        <Button variant="primary" block onPress={close}>
          {t('mobile:elf.awayDone')}
        </Button>
      </View>
    </SheetRoute>
  )
}

const styles = StyleSheet.create({
  sheet: {
    gap: space.xl,
    paddingTop: space.sm,
  },
  head: {
    gap: space.xs,
  },
  section: {
    gap: space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  grow: {
    flex: 1,
  },
  finds: {
    flexDirection: 'row',
    gap: space.md,
  },
  find: {
    width: FIND_SIZE + space.md,
    alignItems: 'center',
    gap: space.xs,
  },
  picture: {
    borderRadius: radius.control,
    backgroundColor: colors.surfaceSoft,
  },
})
