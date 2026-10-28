import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { SILL_ITEMS } from '@chatynkowo/core'
import { useContent, useElf, useProgress } from '../../providers'
import { JarIcon, LetterIcon, LetterOpenIcon, NextIcon, PressableScale, SheetRoute, Text, colors, iconSize, radius, space } from '../../ui'
import { ElfThumb } from './ElfThumb'
import { elfKey } from './labels'
import { letterFrom } from './letters'

/* The keepsake shelf, as a sheet over the tab, opened from the shelf in
   the room, the finds on the windowsill or the elf's day: what the
   journey and the days have left in the cottage. The jars, one per
   cottage found, newest first, each with its occupant and motto and
   opening the cottage's story; the windowsill's treasures, every kind the
   elf can find with how many it has (a kind not found yet is a dim
   picture without its name); and the letters, newest first, each opening
   on its own sheet, the unread ones marked. The content scrolls inside the
   sheet on a short screen. */

const TREASURE_SIZE = 64

export function ElfShelfSheet() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const { state } = useElf()
  const { state: progress } = useProgress()
  const { cottages, total } = useContent()
  /* The cottages found as jars, newest first. */
  const jars = useMemo(
    () =>
      Object.entries(progress.found)
        .map(([slug, find]) => {
          const cottage = cottages.find((candidate) => candidate.slug === slug)
          return {
            slug,
            at: find.foundAt,
            title: cottage?.title ?? slug,
            occupant: cottage?.occupant ?? '',
            virtue: cottage?.virtue.toLocaleLowerCase(i18n.language) ?? '',
            date: new Date(find.foundAt).toLocaleDateString(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' }),
          }
        })
        .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)),
    [progress.found, cottages, i18n.language],
  )
  const collection = state?.collection ?? {}
  const treasures = SILL_ITEMS.reduce((sum, item) => sum + (collection[item] ?? 0), 0)
  const letters = useMemo(() => [...(state?.letters ?? [])].reverse(), [state?.letters])
  const openStory = (slug: string) => router.push({ pathname: '/story/[slug]', params: { slug } })
  const openLetter = (n: number) => router.push({ pathname: '/elf-letter', params: { n: String(n) } })

  return (
    <SheetRoute scroll>
      <View style={styles.sheet}>
        <Text variant="eyebrow" accessibilityRole="header">
          {t('mobile:elf.shelfTitle')}
        </Text>

        <View style={styles.section}>
          <Text weight="bold" accessibilityRole="header">
            {t('mobile:elf.shelfJars')}
          </Text>
          <Text variant="small" tone="faint">
            {jars.length ? t('mobile:elf.shelfJarsLine', { count: jars.length, total }) : t('mobile:elf.shelfJarsEmpty')}
          </Text>
          {jars.map((jar) => (
            <PressableScale
              key={jar.slug}
              onPress={() => openStory(jar.slug)}
              accessibilityLabel={`${jar.title}, ${jar.occupant}. ${t('mobile:elf.shelfVirtue', { virtue: jar.virtue })}. ${jar.date}`}
              accessibilityHint={t('mobile:elf.jarHint')}
              style={[styles.row, styles.pressRow]}
            >
              <JarIcon size={iconSize.md} weight="fill" color={colors.accentStrong} />
              <View style={styles.column}>
                <Text numberOfLines={2}>{jar.title}</Text>
                <Text variant="small" tone="soft" numberOfLines={2}>
                  {jar.occupant ? `${jar.occupant} · ` : ''}
                  {t('mobile:elf.shelfVirtue', { virtue: jar.virtue })}
                </Text>
                <Text variant="small" tone="faint">
                  {jar.date}
                </Text>
              </View>
              <NextIcon size={iconSize.sm} color={colors.inkFaint} />
            </PressableScale>
          ))}
        </View>

        <View style={styles.section}>
          <Text weight="bold" accessibilityRole="header">
            {t('mobile:elf.shelfTreasures')}
          </Text>
          <Text variant="small" tone="faint">
            {t('mobile:elf.shelfTreasuresLine', { count: treasures })}
          </Text>
          <View style={styles.treasures}>
            {SILL_ITEMS.map((item) => {
              const count = collection[item] ?? 0
              const name = count > 0 ? t(elfKey('sill', item)) : t('mobile:elf.shelfTreasureUnknown')
              return (
                <View key={item} style={styles.treasure} accessible accessibilityLabel={count > 0 ? `${name}, ${count}` : name}>
                  <View style={[styles.treasurePicture, count === 0 && styles.unknown]}>
                    <ElfThumb slot="sill" id={item} size={TREASURE_SIZE} />
                  </View>
                  <Text variant="label" align="center" tone={count > 0 ? undefined : 'faint'} numberOfLines={2}>
                    {count > 0 ? `${name} · ${count}` : name}
                  </Text>
                </View>
              )
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text weight="bold" accessibilityRole="header">
            {t('mobile:elf.shelfLetters')}
          </Text>
          {letters.length === 0 ? (
            <Text variant="small" tone="faint">
              {t('mobile:elf.shelfLettersEmpty')}
            </Text>
          ) : null}
          {letters.map((letter) => {
            const from = letterFrom(t, letter, cottages)
            const date = new Date(`${letter.day}T12:00:00`).toLocaleDateString(i18n.language, { day: 'numeric', month: 'long' })
            const Glyph = letter.read ? LetterOpenIcon : LetterIcon
            return (
              <PressableScale
                key={letter.n}
                onPress={() => openLetter(letter.n)}
                accessibilityLabel={`${from}, ${date}${letter.read ? '' : `, ${t('mobile:elf.shelfLetterUnread')}`}`}
                style={[styles.row, styles.pressRow]}
              >
                <Glyph size={iconSize.md} weight={letter.read ? 'regular' : 'fill'} color={letter.read ? colors.inkFaint : colors.accentStrong} />
                <View style={styles.column}>
                  <Text numberOfLines={1} weight={letter.read ? undefined : 'bold'}>
                    {from}
                  </Text>
                  <Text variant="small" tone="faint">
                    {letter.read ? date : `${date} · ${t('mobile:elf.shelfLetterUnread')}`}
                  </Text>
                </View>
                <NextIcon size={iconSize.sm} color={colors.inkFaint} />
              </PressableScale>
            )
          })}
        </View>
      </View>
    </SheetRoute>
  )
}

const styles = StyleSheet.create({
  sheet: {
    gap: space.xl,
    paddingTop: space.sm,
  },
  section: {
    gap: space.sm,
  },
  row: {
    flexDirection: 'row',
    gap: space.md,
    alignItems: 'center',
  },
  /* A row that opens something: the press feel of a list. */
  pressRow: {
    paddingVertical: space.xs,
    borderRadius: radius.control,
  },
  column: {
    flex: 1,
    gap: 2,
  },
  /* Four treasures to a row. */
  treasures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: space.md,
  },
  treasure: {
    width: '25%',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: 2,
  },
  treasurePicture: {
    borderRadius: radius.control,
    backgroundColor: colors.surfaceSoft,
  },
  unknown: {
    opacity: 0.3,
  },
})
