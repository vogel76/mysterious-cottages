import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { ELF_NEEDS, type ElfMood, type ElfNeedId, type ElfNeeds, type ElfStage, type ElfWallet } from '@chatynkowo/core'
import { AcornsIcon, CrossfadeText, DURATIONS, DecorIcon, DustIcon, EASING, EggIcon, IconButton, InfoIcon, PressableScale, ReduceMotion, ResetViewIcon, StreakIcon, Text, colors, enterUp, iconSize, leaveUp, mapPalette, radius, space, type Icon } from '../../ui'
import { NEED_ICONS, elfKey } from './labels'

/* The light HUD over the cottage scene, in the dark chrome of the Atlas's
   cards so the two full-bleed tabs read alike. The top block: the elf's
   name with its form underneath, the decorating button (the panel it
   opens lives inside the tab), the way to start over, the needs as a row
   of small chips (the glyph and a short bar whose colour says how the need
   stands: green while comfortable, gold when the elf would like it seen
   to; a care's gain floats up over the chip as "+25" for a moment), or,
   before the hatch, one chip with the egg and how long until it hatches
   (the warmth the player gives it shows in the scene's glow, not here: it
   does not decide the hatch); and under them the ledger: the acorns and
   the star dust in the purse and the streak of days, one pressable row
   that opens the sheet saying what they are and what they earn
   (/elf-ledger), with an info glyph at its end so it reads as a way in.
   Under it the mood pill: what the elf is doing (or when the egg hatches)
   and under that the need the elf wants seen to, when one is under the
   mark; the line keeps its height so the pill never jumps. What the elf
   has to say in the moment (a refusal, a good night, a greeting, a quest
   done) is not here but in the speech bubble over its head (ElfSpeech).
   Both blocks sit at the top of the screen, so the elf in the middle of
   the room is never covered; the tab places them and hides the pill while
   a panel is open. */

/* ---------- The top block ---------- */

/* Which panel of the tab is open, if any; the matching button is marked. */
export type ElfPanel = 'none' | 'decor'

export type ElfHudProps = {
  name: string
  stage: ElfStage
  needs: ElfNeeds
  /* When the egg hatches on its own; null once hatched. */
  hatchAt: number | null
  wallet: ElfWallet
  /* Days visited in a row. */
  streak: number
  panel: ElfPanel
  onDecorate: () => void
  /* The ledger was tapped: the sheet that explains its figures. */
  onLedger: () => void
  onReset: () => void
}

export function ElfHud({ name, stage, needs, hatchAt, wallet, streak, panel, onDecorate, onLedger, onReset }: ElfHudProps) {
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
        {hatched || hatchAt === null ? ELF_NEEDS.map((id) => <NeedChip key={id} id={id} value={needs[id]} />) : <EggChip hatchAt={hatchAt} />}
      </View>
      {/* The row hugs its chips and gives only the scale as feedback: a
          fill or a ripple would paint the gaps between the pills. */}
      <PressableScale
        onPress={onLedger}
        accessibilityLabel={t('mobile:elf.ledgerAria', { acorns: wallet.acorns, dust: wallet.dust, streak })}
        pressedFill="transparent"
        ripple={false}
        style={styles.ledger}
      >
        <LedgerChip Glyph={AcornsIcon} value={wallet.acorns} />
        <LedgerChip Glyph={DustIcon} value={wallet.dust} />
        <LedgerChip Glyph={StreakIcon} value={streak} />
        <View style={[styles.chrome, styles.ledgerChip]}>
          <InfoIcon size={iconSize.sm} color={mapPalette.chromeIcon} />
        </View>
      </PressableScale>
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

/* A rise of at least this much is a care, not a pet: it floats up as "+N". */
const GAIN_SHOWN = 10
const GAIN_MS = 1400

/* One need: the glyph and the bar, eased to each new value (the needs
   drift every few seconds while the elf is on screen, a hair at a time);
   a care's gain floats up over the chip for a moment. */
function NeedChip({ id, value }: { id: ElfNeedId; value: number }) {
  const { t } = useTranslation()
  const Glyph = NEED_ICONS[id]
  const percent = Math.round(value)
  const width = useSharedValue(value)
  const [gain, setGain] = useState<{ amount: number; key: number } | null>(null)
  const previous = useRef(value)
  /* Its own timer: the drift changes the value every few seconds, and a
     timer tied to the effect would be cancelled by it before it fired. */
  const gainTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    width.value = withTiming(value, { duration: DURATIONS.base, easing: EASING.out, reduceMotion: ReduceMotion.System })
  }, [value, width])

  /* The drift only lowers a need, so a rise is the player's doing. */
  useEffect(() => {
    const rise = value - previous.current
    previous.current = value
    if (rise < GAIN_SHOWN) return
    setGain((current) => ({ amount: Math.round(rise), key: (current?.key ?? 0) + 1 }))
    if (gainTimer.current) clearTimeout(gainTimer.current)
    gainTimer.current = setTimeout(() => {
      gainTimer.current = null
      setGain(null)
    }, GAIN_MS)
  }, [value])
  useEffect(
    () => () => {
      if (gainTimer.current) clearTimeout(gainTimer.current)
    },
    [],
  )

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
      {gain ? (
        <Animated.View key={gain.key} entering={enterUp()} exiting={leaveUp()} style={styles.gain} pointerEvents="none">
          <Text variant="small" weight="bold" style={styles.gainInk}>
            {t('mobile:elf.needGain', { value: gain.amount })}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  )
}

/* The clock to the minute, for the egg's countdown: an egg's state does
   not change on the drift, so nothing else would re-render it. Idle
   without an egg. */
const MINUTE_TICK_MS = 20000
function useHatchWhen(hatchAt: number | null): { when: string; due: boolean } | null {
  const { t } = useTranslation()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (hatchAt === null) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), MINUTE_TICK_MS)
    return () => clearInterval(timer)
  }, [hatchAt])
  if (hatchAt === null) return null
  const left = hatchAt - now
  if (left <= 0) return { when: t('mobile:elf.hatchSoon'), due: true }
  const minutes = Math.ceil(left / 60000)
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  const time = hours > 0 ? (rest > 0 ? t('mobile:elf.durationHours', { hours, minutes: rest }) : t('mobile:elf.durationHoursOnly', { hours })) : t('mobile:elf.durationMinutes', { minutes })
  return { when: t('mobile:elf.hatchIn', { time }), due: false }
}

/* Before the hatch: the egg and how long until it hatches. */
function EggChip({ hatchAt }: { hatchAt: number }) {
  const { t } = useTranslation()
  const hatch = useHatchWhen(hatchAt)
  const when = hatch?.when ?? ''
  return (
    <View style={[styles.chrome, styles.chip]} accessible accessibilityLabel={t('mobile:elf.hatchAria', { when })}>
      <EggIcon size={iconSize.sm} weight="fill" color={mapPalette.chromeIcon} />
      <Text variant="caption" style={styles.chromeInk}>
        {t('mobile:elf.hatching')}
      </Text>
      <CrossfadeText value={when} variant="small" weight="bold" style={styles.chromeInk} />
    </View>
  )
}

/* One figure of the ledger: the glyph and the count, which crossfades
   when a quest pays; the row's label names them all for a screen reader. */
function LedgerChip({ Glyph, value }: { Glyph: Icon; value: number }) {
  return (
    <View style={[styles.chrome, styles.ledgerChip]}>
      <Glyph size={iconSize.sm} weight="fill" color={mapPalette.chromeIcon} />
      <CrossfadeText value={String(value)} variant="small" weight="bold" style={styles.chromeInk} />
    </View>
  )
}

/* ---------- The mood pill ---------- */

type Hint = {
  text: string
  tone: 'soft' | 'accent' | 'danger'
}

export type ElfMoodPillProps = {
  name: string
  stage: ElfStage
  mood: ElfMood
  /* When the egg hatches on its own; null once hatched. The egg's
     sentence counts the hours down and names the other way out: the
     first cottage found. */
  hatchAt: number | null
  /* The need the elf would like seen to, when one is under the mark. */
  wantedNeed: ElfNeedId | null
}

const hintColor: Record<Hint['tone'], string> = {
  soft: mapPalette.chromeInk,
  accent: colors.accentStrong,
  danger: colors.danger,
}

export function ElfMoodPill({ name, stage, mood, hatchAt, wantedNeed }: ElfMoodPillProps) {
  const { t } = useTranslation()
  const hatch = useHatchWhen(stage === 'egg' ? hatchAt : null)
  const sentence = hatch ? (hatch.due ? t('mobile:elf.moodEggDue', { name }) : t('mobile:elf.moodEgg', { name, when: hatch.when })) : t(elfKey('mood', mood), { name })
  const hint: Hint | null = wantedNeed && stage !== 'egg' ? { text: t(elfKey('wants', wantedNeed), { name }), tone: 'accent' } : null

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
  /* The gain rises from the chip's middle, half over its top edge: any
     higher and it would run into the name block above the first chip. */
  gain: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -10,
    alignItems: 'center',
  },
  gainInk: {
    color: colors.success,
    textShadowColor: colors.page,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
  /* The ledger's chips take only the width of their figure, and the row
     only that of its chips. */
  ledger: {
    alignSelf: 'flex-start',
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
