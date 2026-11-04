import { useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View, type AccessibilityActionEvent } from 'react-native'
import Animated from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useTranslation } from 'react-i18next'
import { BathIcon, FeedIcon, GiftIcon, LullabyIcon, PressableScale, ProgressRing, SleepIcon, TAB_BAR_OVERHANG, Text, ToyIcon, WakeIcon, WarmIcon, colors, enterUp, iconSize, leaveUp, mapPalette, radius, space, withAlpha, type Icon } from '../../ui'
import { ELF_CARE_NEEDS, type ElfCareAction, type ElfEggAction, type ElfNeedId, type ElfNeeds, type ElfStage } from '@chatynkowo/core'
import { elfKey } from './labels'

/* The care actions as round buttons on a band of the HUD's chrome that
   sits on the tab bar, split around the tab bar's raised discover key
   (two buttons on each side of it, one on each for the egg), so the key
   and the buttons never cover one another and nothing floats over the
   rug: for an egg the two ways to hatch it, for an elf feeding, playing,
   bathing and sleep or wake. The care buttons take the gold face of a
   primary button, the sleep toggle the ghost face, each with a short
   label underneath. Around each care button a ring shows the need the
   care sees to (fullness, joy, cleanliness): green while comfortable,
   gold once the elf would like it seen to, eased to each new value as
   the needs drift; a care's gain floats up over the button as "+25" for
   a moment. Under each care button the dots of its charges (three
   feeds, two plays, one bath, each back some hours after it was spent,
   the rules say how many), lit while they are left, so the player
   sees before tapping what the day still allows, and after them the
   peddler's gifts in the pantry for that care (a treat, a toy, a soap),
   each a little gift mark instead of a dot: a gift is taken whatever
   the charges and the belly, so a bought treat is eaten at once. While
   the elf sleeps, or once a cap is used up with no gift at hand, the
   button dims and tells assistive tech it is disabled, but it stays
   pressable: the rules refuse the action and the elf says why, so a tap
   is never met with silence. The feed button
   also lets the acorn be dragged: a pan that starts on it reports the
   finger's position in window coordinates to the tab, which floats an
   acorn under the finger, has the elf follow it with its eyes and feeds
   it when the acorn is dropped on it (the pan and the plain tap race, so
   a still finger stays a tap). */

export type FeedDragPhase = 'begin' | 'move' | 'end'
/* The acorn under the finger, in window coordinates. */
export type FeedDragHandler = (phase: FeedDragPhase, x: number, y: number) => void

export type ElfActionBarProps = {
  stage: ElfStage
  sleeping: boolean
  /* The needs, 0..100, for the rings around the care buttons. */
  needs: ElfNeeds
  /* How many of each care the day still allows. */
  careLeft: Record<ElfCareAction, number>
  /* The charges each care has (the tree can add one). */
  careCharges: Record<ElfCareAction, number>
  /* The peddler's gifts in the pantry, one care each. */
  gifts: Record<ElfCareAction, number>
  onCare: (id: ElfCareAction) => void
  onTendEgg: (id: ElfEggAction) => void
  onToggleSleep: () => void
  onFeedDrag?: FeedDragHandler
}

type Action = {
  key: string
  Glyph: Icon
  label: string
  /* The gold primary face, or the ghost face of the sleep toggle. */
  face: 'primary' | 'ghost'
  disabled?: boolean
  /* The need the care sees to, 0..100, for the ring. */
  need?: { id: ElfNeedId; value: number }
  /* The charges and what is left of them, as dots under the button, the
     gifts after them, and the same in words for a screen reader. */
  cap?: { total: number; left: number; gifts: number }
  valueText?: string
  onPress: () => void
}

const BUTTON = 56
/* The ring around a care button: its box and its thickness. */
const RING = 64
const RING_STROKE = 3
const DOT = 6
/* A gift's mark under the button, a little bigger than a dot. */
const GIFT = 10
/* The press feedback of the round buttons. */
const PRESS_SCALE = 0.9
/* How far the finger travels before a press on the acorn becomes a drag. */
const DRAG_START = 10
/* The ring turns gold where the rules name a want (under 60). There is no
   danger tint: the needs never fall under the floor of 35, and an elf
   left alone wants, it does not suffer. */
const COMFORTABLE = 60
/* A rise of at least this much is a care, not a pet: it floats up as "+N". */
const GAIN_SHOWN = 10
const GAIN_MS = 1400

export function ElfActionBar({ stage, sleeping, needs, careLeft, careCharges, gifts, onCare, onTendEgg, onToggleSleep, onFeedDrag }: ElfActionBarProps) {
  const { t } = useTranslation()
  const care = (id: ElfCareAction, Glyph: Icon, label: string): Action => {
    const needId = ELF_CARE_NEEDS[id]
    const value = needs[needId]
    const left = careLeft[id] > 0 ? t('mobile:elf.careLeftAria', { left: careLeft[id], total: careCharges[id] }) : t('mobile:elf.careUsedAria')
    const pantry = gifts[id] > 0 ? ` ${t('mobile:elf.careGiftsAria', { count: gifts[id] })}` : ''
    return {
      key: id,
      Glyph,
      label,
      face: 'primary',
      disabled: sleeping || (careLeft[id] === 0 && gifts[id] === 0),
      need: { id: needId, value },
      cap: { total: careCharges[id], left: careLeft[id], gifts: gifts[id] },
      valueText: `${t('mobile:elf.needAria', { need: t(elfKey('need', needId)), value: Math.round(value) })}. ${left}${pantry}`,
      onPress: () => onCare(id),
    }
  }

  const actions: Action[] =
    stage === 'egg'
      ? [
          { key: 'warm', Glyph: WarmIcon, label: t('mobile:elf.actionWarm'), face: 'primary', onPress: () => onTendEgg('warm') },
          { key: 'rock', Glyph: LullabyIcon, label: t('mobile:elf.actionRock'), face: 'primary', onPress: () => onTendEgg('rock') },
        ]
      : [
          care('feed', FeedIcon, t('mobile:elf.actionFeed')),
          care('play', ToyIcon, t('mobile:elf.actionPlay')),
          care('bath', BathIcon, t('mobile:elf.actionBath')),
          sleeping
            ? { key: 'wake', Glyph: WakeIcon, label: t('mobile:elf.actionWake'), face: 'ghost', onPress: onToggleSleep }
            : { key: 'sleep', Glyph: SleepIcon, label: t('mobile:elf.actionSleep'), face: 'ghost', onPress: onToggleSleep },
        ]

  /* The first half to the left of the key, the rest to its right. */
  const split = Math.ceil(actions.length / 2)
  const render = (action: Action) =>
    action.key === 'feed' && onFeedDrag ? <DraggableActionButton key={action.key} action={action} onDrag={onFeedDrag} /> : <ActionButton key={action.key} action={action} />
  return (
    <View style={styles.band}>
      <View style={styles.side}>{actions.slice(0, split).map(render)}</View>
      <View style={styles.keyGap} />
      <View style={styles.side}>{actions.slice(split).map(render)}</View>
    </View>
  )
}

function ActionButton({ action }: { action: Action }) {
  const { Glyph, label, face, disabled, need, cap, valueText, onPress } = action
  const primary = face === 'primary'
  return (
    <View style={[styles.item, disabled && styles.itemDisabled]}>
      <View style={styles.well}>
        {need ? <NeedRing value={need.value} /> : null}
        <PressableScale
          onPress={onPress}
          scaleTo={PRESS_SCALE}
          accessibilityLabel={label}
          accessibilityState={{ disabled: Boolean(disabled) }}
          accessibilityValue={valueText ? { text: valueText } : undefined}
          /* The accent wash is invisible on the gold face; the lighter border
             gold reads as a pressed shade there, as on the primary button. */
          pressedFill={primary ? colors.accentBorder : colors.accentWash}
          style={[styles.button, primary ? styles.primary : styles.ghost]}
        >
          <Glyph size={iconSize.lg} weight={primary ? 'fill' : 'duotone'} color={primary ? colors.accentInk : colors.ink} />
        </PressableScale>
        {need ? <NeedGain value={need.value} /> : null}
      </View>
      <CapDots cap={cap} />
      <Text variant="label" weight="semibold" align="center" numberOfLines={1} style={styles.label}>
        {label}
      </Text>
    </View>
  )
}

/* The need around the button: the arc is the need out of a hundred, in
   the colour of how it stands. The button describes the value, so the
   ring is decoration. */
function NeedRing({ value }: { value: number }) {
  return (
    <View style={styles.ring} pointerEvents="none">
      <ProgressRing size={RING} value={value} max={100} stroke={RING_STROKE} color={value >= COMFORTABLE ? colors.success : colors.accent} track={withAlpha(mapPalette.chromeInk, 0.2)} decorative />
    </View>
  )
}

/* A care's gain, floating up over the button for a moment. The drift only
   lowers a need, so a rise is the player's doing. Its own timer: the
   drift changes the value every few seconds, and a timer tied to the
   effect would be cancelled by it before it fired. */
function NeedGain({ value }: { value: number }) {
  const { t } = useTranslation()
  const [gain, setGain] = useState<{ amount: number; key: number } | null>(null)
  const previous = useRef(value)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const rise = value - previous.current
    previous.current = value
    if (rise < GAIN_SHOWN) return
    setGain((current) => ({ amount: Math.round(rise), key: (current?.key ?? 0) + 1 }))
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      timer.current = null
      setGain(null)
    }, GAIN_MS)
  }, [value])
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )
  if (!gain) return null
  return (
    <Animated.View key={gain.key} entering={enterUp()} exiting={leaveUp()} style={styles.gain} pointerEvents="none">
      <Text variant="small" weight="bold" style={styles.gainInk}>
        {t('mobile:elf.needGain', { value: gain.amount })}
      </Text>
    </Animated.View>
  )
}

/* The charges under a care button: one dot per charge, lit while it is
   back, then a gift mark for each gift in the pantry. The button's label
   already says what the dots are for. A button without a cap keeps the
   row's height, so every label sits on the same line. */
function CapDots({ cap }: { cap?: { total: number; left: number; gifts: number } }) {
  return (
    <View style={styles.dots} pointerEvents="none">
      {cap ? Array.from({ length: cap.total }, (_, index) => <View key={index} style={[styles.dot, index < cap.left ? styles.dotLeft : styles.dotUsed]} />) : null}
      {cap ? Array.from({ length: cap.gifts }, (_, index) => <GiftIcon key={`gift-${index}`} size={GIFT} weight="fill" color={colors.accentStrong} />) : null}
    </View>
  )
}

/* The feed button: a tap feeds as the others do, a pan hands the acorn to
   the finger. Both gestures run on the JS thread (the tab's handlers are
   JS: the scene's look-at, the rules) and race, so one of them wins per
   touch. The pressable underneath keeps the press feel and the accessible
   name, and feeds on a screen reader's activate; its own press is left to
   the tap gesture so a finger feeds once. */
function DraggableActionButton({ action, onDrag }: { action: Action; onDrag: FeedDragHandler }) {
  const { Glyph, label, disabled, need, cap, valueText, onPress } = action

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .runOnJS(true)
      .minDistance(DRAG_START)
      .onStart((event) => onDrag('begin', event.absoluteX, event.absoluteY))
      .onUpdate((event) => onDrag('move', event.absoluteX, event.absoluteY))
      .onEnd((event) => onDrag('end', event.absoluteX, event.absoluteY))
    const tap = Gesture.Tap()
      .runOnJS(true)
      .maxDuration(400)
      .maxDistance(DRAG_START)
      .onEnd((_event, success) => {
        if (success) onPress()
      })
    return Gesture.Race(pan, tap)
  }, [onDrag, onPress])

  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'activate') onPress()
  }

  return (
    <View style={[styles.item, disabled && styles.itemDisabled]}>
      <View style={styles.well}>
        {need ? <NeedRing value={need.value} /> : null}
        <GestureDetector gesture={gesture}>
          <PressableScale
            scaleTo={PRESS_SCALE}
            accessibilityLabel={label}
            accessibilityState={{ disabled: Boolean(disabled) }}
            accessibilityValue={valueText ? { text: valueText } : undefined}
            accessibilityActions={[{ name: 'activate' }]}
            onAccessibilityAction={onAccessibilityAction}
            pressedFill={colors.accentBorder}
            style={[styles.button, styles.primary]}
          >
            <Glyph size={iconSize.lg} weight="fill" color={colors.accentInk} />
          </PressableScale>
        </GestureDetector>
        {need ? <NeedGain value={need.value} /> : null}
      </View>
      <CapDots cap={cap} />
      <Text variant="label" weight="semibold" align="center" numberOfLines={1} style={styles.label}>
        {label}
      </Text>
    </View>
  )
}

/* The room the discover key takes in the middle of the band: its width
   and a little air on each side. */
const KEY_GAP = TAB_BAR_OVERHANG * 2 + space.lg

const styles = StyleSheet.create({
  band: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: space.sm,
    paddingBottom: space.xs,
    borderTopWidth: 1,
    borderTopColor: mapPalette.chromeBorder,
    backgroundColor: mapPalette.chromeSolid,
  },
  side: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space.sm,
  },
  keyGap: {
    width: KEY_GAP,
  },
  item: {
    width: RING + space.md,
    alignItems: 'center',
    gap: space.xs,
  },
  itemDisabled: {
    opacity: 0.5,
  },
  /* The button in the middle of its ring's box. */
  well: {
    width: RING,
    height: RING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  /* The gain rises from the ring's top. */
  gain: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -12,
    alignItems: 'center',
  },
  gainInk: {
    color: colors.success,
    textShadowColor: colors.page,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: GIFT,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  dotLeft: {
    backgroundColor: colors.accent,
  },
  /* A spent dot keeps its ring, so the charges stay countable. */
  dotUsed: {
    backgroundColor: 'transparent',
    opacity: 0.6,
  },
  button: {
    width: BUTTON,
    height: BUTTON,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radius.pill,
  },
  primary: {
    backgroundColor: colors.accent,
    borderColor: colors.accentBorder,
  },
  ghost: {
    backgroundColor: colors.ghost,
    borderColor: colors.lineStrong,
  },
  label: {
    color: mapPalette.chromeInk,
  },
})
