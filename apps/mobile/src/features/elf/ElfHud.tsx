import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { CrossfadeText, DURATIONS, DecorIcon, EASING, EggIcon, IconButton, ReduceMotion, ResetViewIcon, Text, WardrobeIcon, colors, iconSize, mapPalette, radius, space } from '../../ui'
import { NEED_ICONS, elfKey } from './labels'
import { NEEDS, type Mood, type NeedId, type Needs, type Stage } from './rules'

/* The light HUD over the cottage scene, in the dark chrome of the Atlas's
   cards so the two full-bleed tabs read alike. The top block: the elf's
   name with its form underneath, the wardrobe and the decorating buttons
   (the panels they open live inside the tab; the tab says whether the
   wardrobe is offered at all, since the rendered elf has nothing to wear
   yet), the way to start over, and
   the needs as a row of small chips (the glyph and a short bar whose
   colour says how urgent the need is: green while comfortable, gold when
   it wants attention, the danger tint when low), or, before the hatch, one
   chip with the egg and how far the hatching has come. Under it the mood
   pill: what the elf is doing (or how to hatch the egg) and under that a
   hint, a passing message when the screen has one (a refused action, the
   sleeping elf, a new level, the elf waving for attention or greeting a
   return), otherwise the need most in want when one is low. The hint line
   keeps its height so the pill never jumps. Both blocks sit at the top of
   the screen, so the elf in the middle of the room is never covered; the
   tab places them and hides the pill while a panel is open. */

/* ---------- The top block ---------- */

/* Which panel of the tab is open, if any; the matching button is marked. */
export type ElfPanel = 'none' | 'wardrobe' | 'decor'

export type ElfHudProps = {
  name: string
  stage: Stage
  needs: Needs
  /* Warmth of the egg, 0 to 100. */
  warmth: number
  panel: ElfPanel
  /* Whether the wardrobe button is shown: a hatched elf drawn as the
     vector puppet. The rendered elf keeps the button hidden until the art
     pipeline renders hat layers (its face and hood are baked into the body
     frames today, so a wearable would change nothing). */
  wardrobe: boolean
  onWardrobe: () => void
  onDecorate: () => void
  onReset: () => void
}

export function ElfHud({ name, stage, needs, warmth, panel, wardrobe, onWardrobe, onDecorate, onReset }: ElfHudProps) {
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
          {/* An egg has nothing to wear yet, nor has the rendered elf (see
              the prop); the room can be arranged for both. */}
          {wardrobe ? (
            <IconButton label={t('mobile:elf.wardrobe')} onPress={onWardrobe} active={panel === 'wardrobe'} style={[styles.control, panel === 'wardrobe' && styles.controlActive]}>
              <WardrobeIcon size={iconSize.md} color={mapPalette.chromeIcon} />
            </IconButton>
          ) : null}
          <IconButton label={t('mobile:elf.decorate')} onPress={onDecorate} active={panel === 'decor'} style={[styles.control, panel === 'decor' && styles.controlActive]}>
            <DecorIcon size={iconSize.md} color={mapPalette.chromeIcon} />
          </IconButton>
          <IconButton label={t('mobile:elf.startOver')} onPress={onReset} style={styles.control}>
            <ResetViewIcon size={iconSize.md} color={mapPalette.chromeIcon} />
          </IconButton>
        </View>
      </View>
      <View style={styles.chips} pointerEvents="none">
        {hatched ? NEEDS.map((id) => <NeedChip key={id} id={id} value={needs[id]} />) : <EggChip warmth={warmth} />}
      </View>
    </View>
  )
}

/* The HUD's own thresholds for the bar colour; the rules read the mood from
   the average of the needs (28 sad, 72 happy) and call a single need out
   under LOW_NEED, so a bar can turn before the rules say anything. */
const COMFORTABLE = 55
const WANTING = 25
const BAR_HEIGHT = 4

function fillColor(value: number): string {
  if (value > COMFORTABLE) return colors.success
  if (value >= WANTING) return colors.accent
  return colors.danger
}

/* One need: the glyph and the bar, eased to each new value (the needs
   drift every second, so the bars are always in slow motion while the elf
   is awake). */
function NeedChip({ id, value }: { id: NeedId; value: number }) {
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

/* ---------- The mood pill ---------- */

export type ElfHint = {
  text: string
  tone: 'soft' | 'accent' | 'danger'
}

export type ElfMoodPillProps = {
  name: string
  stage: Stage
  mood: Mood
  /* The need below the low mark that most wants attention. */
  lowNeed: NeedId | null
  /* A passing message that outranks the low need while it lasts. */
  flash: ElfHint | null
}

const hintColor: Record<ElfHint['tone'], string> = {
  soft: mapPalette.chromeInk,
  accent: colors.accentStrong,
  danger: colors.danger,
}

export function ElfMoodPill({ name, stage, mood, lowNeed, flash }: ElfMoodPillProps) {
  const { t } = useTranslation()
  const sentence = stage === 'egg' ? t('mobile:elf.moodEgg') : t(elfKey('mood', mood), { name })
  const hint: ElfHint | null = flash ?? (lowNeed && stage !== 'egg' ? { text: t(elfKey('low', lowNeed), { name }), tone: 'danger' } : null)

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
  /* One row of four, each chip sharing the width so the needs never wrap
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
