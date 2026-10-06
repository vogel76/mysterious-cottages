import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useElf } from '../../providers'
import { Button, CheckIcon, EggIcon, GlowPulse, PressableScale, Text, TextField, colors, iconSize, radius, space } from '../../ui'
import { STARTER_ICONS, elfKey, starterDescriptionKey } from './labels'
import { NAME_MAX_LENGTH, STARTERS, type StarterId } from './rules'

/* The first visit to the Elf tab: the egg has appeared, the player picks
   its element from the three starters and gives it a name, then takes it
   in. The element cards are a radio group; the name falls back to the
   dictionary's default when left blank. */

const EMBLEM = 72
const GLOW_MARGIN = 32

export function ElfAdoption() {
  const { t } = useTranslation()
  const { adopt } = useElf()
  const [starter, setStarter] = useState<StarterId>('forest')
  const [name, setName] = useState('')

  const submit = () => adopt(name.trim() || t('mobile:elf.defaultName'), starter)

  return (
    <View style={styles.column}>
      <View style={styles.hero}>
        <GlowPulse size={EMBLEM + GLOW_MARGIN}>
          <View style={styles.emblem}>
            <EggIcon size={iconSize.emblem} weight="duotone" color={colors.accentStrong} />
          </View>
        </GlowPulse>
        <Text variant="title" align="center" accessibilityRole="header">
          {t('mobile:elf.adoptTitle')}
        </Text>
        <Text tone="soft" align="center">
          {t('mobile:elf.adoptLead')}
        </Text>
      </View>

      <View style={styles.group} accessibilityRole="radiogroup">
        <Text variant="eyebrow">{t('mobile:elf.adoptElement')}</Text>
        {STARTERS.map((id) => {
          const Glyph = STARTER_ICONS[id]
          const selected = id === starter
          return (
            <PressableScale
              key={id}
              accessibilityRole="radio"
              accessibilityState={{ selected, checked: selected }}
              accessibilityLabel={`${t(elfKey('starter', id))}. ${t(starterDescriptionKey(id))}`}
              onPress={() => setStarter(id)}
              style={[styles.card, selected && styles.cardSelected]}
            >
              <View style={styles.glyph}>
                <Glyph size={iconSize.xl} weight={selected ? 'fill' : 'duotone'} color={colors.accentStrong} />
              </View>
              <View style={styles.cardText}>
                <Text weight="bold">{t(elfKey('starter', id))}</Text>
                <Text variant="small" tone="soft">
                  {t(starterDescriptionKey(id))}
                </Text>
              </View>
              {selected ? <CheckIcon size={iconSize.md} weight="bold" color={colors.accentStrong} /> : <View style={styles.checkSpace} />}
            </PressableScale>
          )
        })}
      </View>

      <TextField
        label={t('mobile:elf.adoptName')}
        placeholder={t('mobile:elf.adoptNamePlaceholder')}
        value={name}
        onChangeText={setName}
        maxLength={NAME_MAX_LENGTH}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={submit}
      />

      <Button variant="primary" block onPress={submit}>
        {t('mobile:elf.adoptAction')}
      </Button>

      <Text variant="small" tone="faint" align="center">
        {t('mobile:elf.prototypeNote')}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  column: {
    gap: space.xl,
  },
  hero: {
    alignItems: 'center',
    gap: space.md,
    paddingTop: space.md,
  },
  emblem: {
    width: EMBLEM,
    height: EMBLEM,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.pageRaised,
  },
  group: {
    gap: space.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  cardSelected: {
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentWash,
  },
  glyph: {
    width: iconSize.xl,
    alignItems: 'center',
  },
  cardText: {
    flex: 1,
    gap: space.xs,
  },
  checkSpace: {
    width: iconSize.md,
  },
})
