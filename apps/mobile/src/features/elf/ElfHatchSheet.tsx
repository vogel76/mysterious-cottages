import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { ELF_STARTERS, NAME_MAX_LENGTH, type ElfStarter } from '@chatynkowo/core'
import { announce } from '../../lib/announce'
import { useCloseModal, useElf } from '../../providers'
import { Button, CheckIcon, PressableScale, SheetRoute, Text, TextField, colors, iconSize, radius, space, type TextFieldHandle } from '../../ui'
import { STARTER_ICONS, elfKey, starterDescriptionKey } from './labels'

/* The hatch: the egg has opened, and the player names the elf and picks
   its element, in a sheet over the Elf tab (the egg itself needed no
   form: it waited in the nest from the first visit). The element cards
   are a radio group; the name falls back to the dictionary's default
   when left blank. The field comes first and is the sheet's own, so the
   keyboard that rises for it extends the sheet and leaves the field in
   view; the done key submits too, for a keyboard that hides the button. Naming marks the first form
   as seen; a sheet pulled down without a name is presented again by the
   tab, since an elf without a name has nothing to answer to. */

export function ElfHatchSheet() {
  const { t } = useTranslation()
  const close = useCloseModal()
  const { state, christen, acknowledgeEvolution } = useElf()
  const field = useRef<TextFieldHandle>(null)
  const [starter, setStarter] = useState<ElfStarter>('forest')
  const [name, setName] = useState('')
  const done = useRef(false)

  /* Presented with nothing to name (a stale push): gone at once. Judged
     once, on mount: the naming itself changes the state and closes the
     sheet on its own, and a second close would pop the tab beneath. */
  const stale = useRef(Boolean(state && state.hatched && state.starter !== null))
  useEffect(() => {
    if (stale.current) close()
  }, [close])

  const title = t('mobile:elf.hatchTitle')
  useEffect(() => {
    announce(title)
  }, [title])

  const submit = () => {
    if (done.current) return
    done.current = true
    christen(name.trim() || t('mobile:elf.defaultName'), starter)
    acknowledgeEvolution()
    close()
  }

  return (
    <SheetRoute scroll onPresented={() => field.current?.focus()}>
      <View style={styles.sheet}>
        <Text variant="eyebrow" align="center">
          {t('mobile:elf.evoKicker')}
        </Text>
        <Text variant="title" align="center" accessibilityRole="header">
          {title}
        </Text>
        <Text tone="soft" align="center">
          {t('mobile:elf.hatchLead')}
        </Text>

        <TextField
          ref={field}
          sheet
          label={t('mobile:elf.nameLabel')}
          placeholder={t('mobile:elf.namePlaceholder')}
          value={name}
          onChangeText={setName}
          maxLength={NAME_MAX_LENGTH}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={submit}
        />

        <View style={styles.group} accessibilityRole="radiogroup">
          <Text variant="eyebrow">{t('mobile:elf.elementLabel')}</Text>
          {ELF_STARTERS.map((id) => {
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

        <Button variant="primary" block onPress={submit}>
          {t('mobile:elf.hatchAction')}
        </Button>
      </View>
    </SheetRoute>
  )
}

const styles = StyleSheet.create({
  sheet: {
    gap: space.lg,
    paddingTop: space.sm,
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
