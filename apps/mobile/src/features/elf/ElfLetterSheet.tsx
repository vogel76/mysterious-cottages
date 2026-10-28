import { useEffect, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useCloseModal, useContent, useElf, useProgress } from '../../providers'
import { AtlasIcon, Button, NotebookIcon, SheetRoute, Text, colors, iconSize, radius, space } from '../../ui'
import { letterText } from './letters'

/* A letter from the elves of the cottages, as a sheet over the tab: from
   the envelope on the floor, the 'while you were away' card or the
   keepsake shelf, with the letter's number as the route's param. The
   letter on a sheet of paper (the greeting to the elf by name, the words,
   the signature), and the way on: a cottage found (an invitation's too,
   once the player has been there) opens its story, one not found yet is
   shown on the map; the forest's letters lead nowhere.
   Opening it marks it read, which takes the envelope off the floor. A
   number the elf has no letter for (a stale link) closes the sheet. */

export function ElfLetterSheet({ n }: { n: number }) {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const close = useCloseModal()
  const { state, readLetter } = useElf()
  const { cottages } = useContent()
  const { state: progress } = useProgress()
  const letter = state?.letters.find((candidate) => candidate.n === n) ?? null
  const cottage = letter?.slug ? cottages.find((candidate) => candidate.slug === letter.slug) : undefined

  /* Read once it is open; judged once, so a sheet without a letter closes once. */
  const handled = useRef(false)
  useEffect(() => {
    if (handled.current || !state) return
    handled.current = true
    if (letter) readLetter(letter.n)
    else close()
  }, [state, letter, readLetter, close])

  if (!letter || !state) return <SheetRoute>{null}</SheetRoute>
  const text = letterText(t, letter, cottage, state.name, i18n.language)
  const date = new Date(`${letter.day}T12:00:00`).toLocaleDateString(i18n.language, { day: 'numeric', month: 'long' })
  const found = Boolean(cottage && progress.found[cottage.slug])
  const openStory = () => cottage && router.push({ pathname: '/story/[slug]', params: { slug: cottage.slug } })
  const showMap = () => cottage && router.dismissTo({ pathname: '/', params: { focus: cottage.slug } })

  return (
    <SheetRoute scroll>
      <View style={styles.sheet}>
        <View style={styles.head}>
          <Text variant="eyebrow">
            {t('mobile:elf.letterKicker')} · {date}
          </Text>
          <Text variant="title" accessibilityRole="header">
            {text.from}
          </Text>
        </View>
        <View style={styles.paper}>
          <Text weight="bold">{text.greeting}</Text>
          <Text>{text.body}</Text>
          <Text weight="semibold" align="right" tone="soft">
            {text.sign}
          </Text>
        </View>
        {cottage && found ? (
          <Button variant="primary" block icon={<NotebookIcon size={iconSize.md} color={colors.accentInk} />} onPress={openStory}>
            {t('mobile:elf.letterOpenStory')}
          </Button>
        ) : null}
        {cottage && !found ? (
          <Button variant="primary" block icon={<AtlasIcon size={iconSize.md} color={colors.accentInk} />} onPress={showMap}>
            {t('mobile:elf.letterShowMap')}
          </Button>
        ) : null}
      </View>
    </SheetRoute>
  )
}

const styles = StyleSheet.create({
  sheet: {
    gap: space.lg,
    paddingTop: space.sm,
  },
  head: {
    gap: space.xs,
  },
  /* The letter itself: a sheet of paper on the sheet. */
  paper: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    backgroundColor: colors.surfaceSoft,
  },
})
