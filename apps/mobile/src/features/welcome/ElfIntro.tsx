import { StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { ElfThumb } from '../elf/ElfThumb'
import { ElfIcon, Text, colors, iconSize, space } from '../../ui'

/* The page about the elf companion in the onboarding pager (the welcome
   of a fresh install and the profile's guide): the eyebrow with the elf
   glyph, the title, the young elf's own face (the wardrobe's bare-head
   picture, packed with its atlas) and two short paragraphs, in the words
   of the letters: a tale a child follows. */

const PORTRAIT = 112

export function ElfIntro() {
  const { t } = useTranslation()
  return (
    <View style={styles.section}>
      <View style={styles.eyebrowRow}>
        <ElfIcon size={iconSize.sm} weight="fill" color={colors.accentStrong} />
        <Text variant="eyebrow">{t('mobile:welcome.elfEyebrow')}</Text>
      </View>
      <Text variant="display" accessibilityRole="header">
        {t('mobile:welcome.elfTitle')}
      </Text>
      <View style={styles.portrait} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <ElfThumb slot="hat" id="none" size={PORTRAIT} form="young" />
      </View>
      <Text tone="soft">{t('mobile:welcome.elfBody1')}</Text>
      <Text tone="soft">{t('mobile:welcome.elfBody2')}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    gap: space.md,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  portrait: {
    alignSelf: 'center',
    marginVertical: space.sm,
  },
})
