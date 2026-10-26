import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { ELF_NEEDS, type ElfMood, type ElfNeedId, type ElfNeeds, type ElfStage, type ElfWallet } from '@chatynkowo/core'
import { AcornsIcon, CrossfadeText, DURATIONS, DecorIcon, DustIcon, EASING, EggIcon, IconButton, ReduceMotion, ResetViewIcon, StreakIcon, Text, colors, iconSize, mapPalette, radius, space, type Icon } from '../../ui'
import { NEED_ICONS, elfKey } from './labels'

/* The light HUD over the cottage scene, in the dark chrome of the Atlas's
   cards so the two full-bleed tabs read alike. The top block: the elf's
   name with its form underneath, the decorating button (the panel it
   opens lives inside the tab), the way to start over, the needs as a row
   of small chips (the glyph and a short bar whose colour says how the need
   stands: green while comfortable, gold when the elf would like it seen
   to), or, before the hatch, one chip with
   the egg and how far the hatching has come; and under them the ledger:
   the acorns and the star dust in the purse and the streak of days. Under
   it the mood pill: what the elf is doing (or how to hatch the egg) and
   under that a hint, a passing message when the screen has one (a refused
   action, the sleeping elf, a quest done, the streak, the elf waving for
   attention or greeting a return), otherwise the need the elf wants seen
   to. The hint line keeps its height so the pill never jumps. Both blocks
   sit at the top of the screen, so the elf in the middle of the room is
   never covered; the tab places them and hides the pill while a panel is
   open. */

/* ---------- The top block ---------- */

/* Which panel of the tab is open, if any; the matching button is marked. */
export type ElfPanel = 'none' | 'decor'

export type ElfHudProps = {
  name: string
  stage: ElfStage
  needs: ElfNeeds
  /* Warmth of the egg, 0 to 100. */
  warmth: number
  wallet: ElfWallet
  /* Days visited in a row. */
  streak: number
  panel: ElfPanel
  onDecorate: () => void
  onReset: () => void
}

export function ElfHud({ name, stage, needs, warmth, wallet, streak, panel, onDecorate, onReset }: ElfHudProps) {
  const { t } = useTranslation()
  const hatched = stage !== 'egg'
  return (
    <View style={styles.top} pointerEvents="box-none">
      <View style={styles.topRow} pointerEvents="box-none">
        <View style={[styles.chrome, styles.identity]} accessible accessibilityRole="header">
          <Text weight="bold" variant="compact" numberOfLines={1} style={styles.chromeInk}>
            {name}
          </Text>
          <CrossfadeText value={t(elfKey('stage', stage))} variant="caption" style={styles.stage} />
        </View>
        <View style={styles.controls} pointerEvents="box-none">
          {/* The room can be arranged for the egg and the elf alike. */}
          <IconButton label={t('mobile:elf.decorate')} onPress={onDecorate} active={panel === 'decor'} style={[styles.control, panel === 'decor' && styles.controlActive]}>
            <DecorIcon size={iconSize.md} color={mapPalette.chromeIcon} />
          </IconButton>
          <IconButton label={t('mobile:elf.startOver')} onPress={onReset} style={styles.control}>
            <ResetViewIcon size={iconSize.md} color={mapPalette.chromeIcon} />
          </IconButton>
        </View>
      </View>
      <View style={styles.chips} pointerEvents="none">
        {hatched ? ELF_NEEDS.map((id) => <NeedChip key={id} id={id} value={needs[id]} />) : <EggChip warmth={warmth} />}
      </View>
      <View style={styles.ledger} pointerEvents="none">
        <LedgerChip Glyph={AcornsIcon} value={wallet.acorns} label={t('mobile:elf.acornsAria', { value: wallet.acorns })} />
        <LedgerChip Glyph={DustIcon} value={wallet.dust} label={t('mobile:elf.dustAria', { value: wallet.dust })} />
        <LedgerChip Glyph={StreakIcon} value={streak} label={t('mobile:elf.streakAria', { count: streak })} />
      </View>
    </View>
  )
}

/* The bar turns gold where the rules name a want (under 60). There is no
   danger tint: the needs never fall under the floor of 35, and an elf
   left alone wants, it does not suffer. */
const COMFORTABLE = 60
const BAR_HEIGHT = 4

function fillColor(value: number): string {
  return value >= COMFORTABLE ? colors.success : colors.accent
}

/* One need: the glyph and the bar, eased to each new value (the needs
   drift every few seconds while the elf is on screen, a hair at a time). */
function NeedChip({ id, value }: { id: ElfNeedId; value: number }) {
  const { t } = useTranslation()
  const Glyph = NEED_ICONS[id]
  const percent = Math.round(value)
  const width = useSharedValue(value)

  useEffect(() => {
    width.value = withTiming(value, { duration: DURATIONS.base, easing: EASING.out, reduceMotion: ReduceMotion.System })
  }, [value, width])

  const fillStyle = useAnimatedStyle(() => ({ width: `${width.value}%` }))

  return (
    <View
      style={[styles.chrome, styles.chip]}
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      accessibilityLabel={t('mobile:elf.needAria', { need: t(elfKey('need', id)), value: percent })}
    >
      <Glyph size={iconSize.sm} weight="fill" color={mapPalette.chromeIcon} />
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { backgroundColor: fillColor(value) }, fillStyle]} />
      </View>
    </View>
  )
}

/* Before the hatch: the egg and how far the hatching has come. */
function EggChip({ warmth }: { warmth: number }) {
  const { t } = useTranslation()
  const percent = Math.round(warmth)
  return (
    <View
      style={[styles.chrome, styles.chip]}
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      accessibilityLabel={t('mobile:elf.needAria', { need: t('mobile:elf.hatching'), value: percent })}
    >
      <EggIcon size={iconSize.sm} weight="fill" color={mapPalette.chromeIcon} />
      <Text variant="caption" style={styles.chromeInk}>
        {t('mobile:elf.hatching')}
      </Text>
      <CrossfadeText value={t('mobile:elf.percent', { value: percent })} variant="small" weight="bold" style={styles.chromeInk} />
    </View>
  )
}

/* One figure of the ledger: the glyph and the count, which crossfades
   when a quest pays. */
function LedgerChip({ Glyph, value, label }: { Glyph: Icon; value: number; label: string }) {
  return (
    <View style={[styles.chrome, styles.ledgerChip]} accessible accessibilityLabel={label}>
      <Glyph size={iconSize.sm} weight="fill" color={mapPalette.chromeIcon} />
      <CrossfadeText value={String(value)} variant="small" weight="bold" style={styles.chromeInk} />
    </View>
  )
}

/* ---------- The mood pill ---------- */

export type ElfHint = {
  text: string
  tone: 'soft' | 'accent' | 'danger'
}

export type ElfMoodPillProps = {
  name: string
  stage: ElfStage
  mood: ElfMood
  /* The need the elf would like seen to, when one is under the mark. */
  wantedNeed: ElfNeedId | null
  /* A passing message that outranks the want while it lasts. */
  flash: ElfHint | null
}

const hintColor: Record<ElfHint['tone'], string> = {
  soft: mapPalette.chromeInk,
  accent: colors.accentStrong,
  danger: colors.danger,
}

export function ElfMoodPill({ name, stage, mood, wantedNeed, flash }: ElfMoodPillProps) {
  const { t } = useTranslation()
  const sentence = stage === 'egg' ? t('mobile:elf.moodEgg') : t(elfKey('mood', mood), { name })
  const hint: ElfHint | null = flash ?? (wantedNeed && stage !== 'egg' ? { text: t(elfKey('wants', wantedNeed), { name }), tone: 'accent' } : null)

  return (
    <View style={[styles.chrome, styles.mood]} accessibilityLiveRegion="polite">
      <CrossfadeText value={sentence} variant="small" align="center" style={styles.chromeInk} />
      <View style={styles.hint}>
        {hint ? <CrossfadeText value={hint.text} variant="small" weight="semibold" align="center" style={[{ color: hintColor[hint.tone] }, hint.tone === 'soft' && styles.hintSoft]} /> : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  top: {
    gap: space.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  chrome: {
    borderWidth: 1,
    borderColor: mapPalette.chromeBorder,
    borderRadius: radius.control,
    backgroundColor: mapPalette.chrome,
  },
  identity: {
    flexShrink: 1,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    gap: 1,
  },
  chromeInk: {
    color: mapPalette.chromeInk,
  },
  stage: {
    color: mapPalette.chromeInk,
    opacity: 0.85,
  },
  controls: {
    flexDirection: 'row',
    gap: space.sm,
  },
  /* The control's own border takes the chrome's gold; the open panel's
     button brightens it (the chrome covers IconButton's own active face). */
  control: {
    borderColor: mapPalette.chromeBorder,
    backgroundColor: mapPalette.chrome,
  },
  controlActive: {
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentWash,
  },
  /* One row of three, each chip sharing the width so the needs never wrap
     onto a second line over the room. */
  chips: {
    flexDirection: 'row',
    gap: space.sm,
  },
  chip: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
  },
  track: {
    flex: 1,
    height: BAR_HEIGHT,
    borderRadius: radius.pill,
    backgroundColor: mapPalette.chromeDivider,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  /* The ledger's chips take only the width of their figure. */
  ledger: {
    flexDirection: 'row',
    gap: space.sm,
  },
  ledgerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
  },
  mood: {
    alignSelf: 'center',
    alignItems: 'center',
    gap: 2,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radius.card,
  },
  hint: {
    minHeight: 20,
    alignItems: 'center',
  },
  hintSoft: {
    opacity: 0.85,
  },
})
