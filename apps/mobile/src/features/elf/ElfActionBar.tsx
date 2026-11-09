import { useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View, useWindowDimensions, type AccessibilityActionEvent } from 'react-native'
import Animated from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useTranslation } from 'react-i18next'
import { BathIcon, FeedIcon, GiftIcon, LullabyIcon, PressableScale, ProgressRing, SleepIcon, TAB_BAR_OVERHANG, Text, ToyIcon, WakeIcon, WarmIcon, colors, enterUp, iconSize, leaveUp, mapPalette, radius, space, withAlpha, type Icon } from '../../ui'
import { ELF_CARE_NEEDS, ENERGY_LOW, ENERGY_MAX, NEED_WANT_BELOW, type ElfCareAction, type ElfEggAction, type ElfNeedId, type ElfNeeds, type ElfPantryCare, type ElfStage } from '@chatynkowo/core'
import { elfKey } from './labels'
import { TutorialHalo } from './TutorialHalo'

/* The care actions as round buttons on a band of the HUD's chrome that
   sits on the tab bar, split around the tab bar's raised discover key
   (two buttons on each side of it, one on each for the egg; the button
   a tutorial step asks for wears a breathing gold ring, TutorialHalo), so the key
   and the buttons never cover one another and nothing floats over the
   rug: for an egg the two ways to hatch it, for an elf feeding, playing,
   bathing and sleep or wake. The care buttons take the gold face of a
   primary button, the sleep toggle the ghost face, each with a one-word
   label underneath, large enough for a child and clear of the tab bar. Around each care button a ring shows the need the
   care sees to (fullness, joy, cleanliness): green while comfortable,
   gold once the elf would like it seen to (hungry, dirty, or wanting a
   game: NEED_WANT_BELOW), eased to each new value as the needs drift; a
   care's gain floats up over the button as "+25" for a moment. The
   band is measured at the window's width (barSizes): four items and the
   key's gap at full size from 390 points up, and on a narrower window (a
   phone in its zoomed display gives 320) the items narrow and the
   buttons and rings shrink with them, never under a 44-point button, so
   the band never runs off the screen. There is
   no count of the day's care: the elf eats when hungry, bathes when
   dirty and plays while it has the energy. Under the feed and play
   buttons the peddler's gifts in the pantry (treats, toys), a little
   gift mark each: a treat is eaten whenever offered, a toy is played
   with at no energy. While the elf sleeps, or when it would refuse the
   care (full, clean, too tired), the button dims and tells assistive
   tech it is disabled, but it stays pressable: the rules refuse the
   action and the elf says why, so a tap is never met with silence. The
   sleep button wears the ring of the elf's energy for the games and
   play (gold once it runs low: a tired elf yawns, and sleep brings it
   back; full while the star brew works). The feed button
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
  /* Whether each care would be taken now (the rules' careFor). */
  ready: Record<ElfCareAction, boolean>
  /* The peddler's gifts in the pantry: treats and toys. */
  gifts: Record<ElfPantryCare, number>
  /* The elf's energy for the games and play, 0..ENERGY_MAX, for the
     sleep button's ring, and whether the star brew works (the ring full). */
  energy: number
  brewing: boolean
  onCare: (id: ElfCareAction) => void
  onTendEgg: (id: ElfEggAction) => void
  onToggleSleep: () => void
  onFeedDrag?: FeedDragHandler
  /* The button a tutorial step asks for, lit with a breathing ring. */
  highlight?: ElfEggAction | ElfCareAction | null
}

type Action = {
  key: string
  Glyph: Icon
  label: string
  /* The gold primary face, or the ghost face of the sleep toggle. */
  face: 'primary' | 'ghost'
  disabled?: boolean
  /* The need the care sees to, 0..100, for the ring; the sleep button's
     ring shows the energy instead. */
  need?: { id: ElfNeedId; value: number }
  energy?: number
  /* The gifts in the pantry for the care, as marks under the button. */
  gifts?: number
  valueText?: string
  /* Lit for the tutorial. */
  lit?: boolean
  onPress: () => void
}

const BUTTON = 56
/* The ring around a care button: its box and its thickness. */
const RING = 64
const RING_STROKE = 3
/* The least a button shrinks to on a narrow window: a finger's target. */
const BUTTON_MIN = 44
/* A gift's mark under the button. */
const GIFT = 10
/* The press feedback of the round buttons. */
const PRESS_SCALE = 0.9
/* How far the finger travels before a press on the acorn becomes a drag. */
const DRAG_START = 10
/* The ring turns gold where the rules name a want (NEED_WANT_BELOW).
   There is no danger tint: an elf left alone wants, it never suffers. */
/* A rise of at least this much is a care, not a pet: it floats up as "+N". */
const GAIN_SHOWN = 10
const GAIN_MS = 1400

/* The care's state in a word for a screen reader. */
const CARE_WORD: Record<ElfCareAction, [string, string]> = {
  feed: ['mobile:elf.careHungry', 'mobile:elf.careFull'],
  play: ['', 'mobile:elf.careTired'],
  bath: ['mobile:elf.careDirty', 'mobile:elf.careClean'],
}

export function ElfActionBar({ stage, sleeping, needs, ready, gifts, energy, brewing, onCare, onTendEgg, onToggleSleep, onFeedDrag, highlight = null }: ElfActionBarProps) {
  const { t } = useTranslation()
  const bar = barSizes(useWindowDimensions().width)
  const care = (id: ElfCareAction, Glyph: Icon, label: string): Action => {
    const needId = ELF_CARE_NEEDS[id]
    const value = needs[needId]
    const gift = id === 'bath' ? 0 : gifts[id]
    const wordKey = CARE_WORD[id][ready[id] ? 0 : 1]
    const word = wordKey ? ` ${t(wordKey)}.` : ''
    const pantry = gift > 0 ? ` ${t('mobile:elf.careGiftsAria', { count: gift })}` : ''
    return {
      key: id,
      Glyph,
      label,
      face: 'primary',
      disabled: sleeping || !ready[id],
      need: { id: needId, value },
      gifts: id === 'bath' ? undefined : gift,
      valueText: `${t('mobile:elf.needAria', { need: t(elfKey('need', needId)), value: Math.round(value) })}.${word}${pantry}`,
      lit: highlight === id,
      onPress: () => onCare(id),
    }
  }

  const actions: Action[] =
    stage === 'egg'
      ? [
          { key: 'warm', Glyph: WarmIcon, label: t('mobile:elf.actionWarm'), face: 'primary', lit: highlight === 'warm', onPress: () => onTendEgg('warm') },
          { key: 'rock', Glyph: LullabyIcon, label: t('mobile:elf.actionRock'), face: 'primary', lit: highlight === 'rock', onPress: () => onTendEgg('rock') },
        ]
      : [
          care('feed', FeedIcon, t('mobile:elf.actionFeed')),
          care('play', ToyIcon, t('mobile:elf.actionPlay')),
          care('bath', BathIcon, t('mobile:elf.actionBath')),
          sleeping
            ? { key: 'wake', Glyph: WakeIcon, label: t('mobile:elf.actionWake'), face: 'ghost', energy: brewing ? ENERGY_MAX : energy, valueText: t('mobile:elf.energyAria', { value: Math.round(energy) }), onPress: onToggleSleep }
            : { key: 'sleep', Glyph: SleepIcon, label: t('mobile:elf.actionSleep'), face: 'ghost', energy: brewing ? ENERGY_MAX : energy, valueText: t('mobile:elf.energyAria', { value: Math.round(energy) }), onPress: onToggleSleep },
        ]

  /* The first half to the left of the key, the rest to its right. */
  const split = Math.ceil(actions.length / 2)
  const render = (action: Action) =>
    action.key === 'feed' && onFeedDrag ? <DraggableActionButton key={action.key} action={action} bar={bar} onDrag={onFeedDrag} /> : <ActionButton key={action.key} action={action} bar={bar} />
  return (
    <View style={styles.band}>
      <View style={styles.side}>{actions.slice(0, split).map(render)}</View>
      <View style={styles.keyGap} />
      <View style={styles.side}>{actions.slice(split).map(render)}</View>
    </View>
  )
}

function ActionButton({ action, bar }: { action: Action; bar: BarSizes }) {
  const { Glyph, label, face, disabled, need, energy, gifts, valueText, lit, onPress } = action
  const primary = face === 'primary'
  return (
    <View style={[styles.item, { width: bar.item }, disabled && styles.itemDisabled]}>
      <View style={[styles.well, { width: bar.ring, height: bar.ring }]}>
        {need ? <NeedRing size={bar.ring} value={need.value} want={NEED_WANT_BELOW[need.id]} /> : null}
        {energy !== undefined ? <EnergyRing size={bar.ring} value={energy} /> : null}
        {lit ? <TutorialHalo /> : null}
        <PressableScale
          onPress={onPress}
          scaleTo={PRESS_SCALE}
          accessibilityLabel={label}
          accessibilityState={{ disabled: Boolean(disabled) }}
          accessibilityValue={valueText ? { text: valueText } : undefined}
          /* The accent wash is invisible on the gold face; the lighter border
             gold reads as a pressed shade there, as on the primary button. */
          pressedFill={primary ? colors.accentBorder : colors.accentWash}
          style={[styles.button, { width: bar.button, height: bar.button }, primary ? styles.primary : styles.ghost]}
        >
          <Glyph size={bar.icon} weight={primary ? 'fill' : 'duotone'} color={primary ? colors.accentInk : colors.ink} />
        </PressableScale>
        {need ? <NeedGain value={need.value} /> : null}
      </View>
      <GiftMarks count={gifts} />
      <Text variant="small" weight="bold" align="center" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.label}>
        {label}
      </Text>
    </View>
  )
}

/* The need around the button: the arc is the need out of a hundred, in
   the colour of how it stands. The button describes the value, so the
   ring is decoration. */
function NeedRing({ size, value, want }: { size: number; value: number; want: number }) {
  return (
    <View style={styles.ring} pointerEvents="none">
      <ProgressRing size={size} value={value} max={100} stroke={RING_STROKE} color={value >= want ? colors.success : colors.accent} track={withAlpha(mapPalette.chromeInk, 0.2)} decorative />
    </View>
  )
}

/* The energy around the sleep button: full at ENERGY_MAX, gold once low. */
function EnergyRing({ size, value }: { size: number; value: number }) {
  return (
    <View style={styles.ring} pointerEvents="none">
      <ProgressRing size={size} value={value} max={ENERGY_MAX} stroke={RING_STROKE} color={value < ENERGY_LOW ? colors.accent : colors.success} track={withAlpha(mapPalette.chromeInk, 0.2)} decorative />
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

/* The gifts in the pantry under a care button, a mark each (three at
   most, a fourth would crowd the label). A button without gifts keeps the
   row's height, so every label sits on the same line. */
const GIFTS_SHOWN = 3
function GiftMarks({ count = 0 }: { count?: number }) {
  return (
    <View style={styles.dots} pointerEvents="none">
      {Array.from({ length: Math.min(count, GIFTS_SHOWN) }, (_, index) => (
        <GiftIcon key={index} size={GIFT} weight="fill" color={colors.accentStrong} />
      ))}
    </View>
  )
}

/* The feed button: a tap feeds as the others do, a pan hands the acorn to
   the finger. Both gestures run on the JS thread (the tab's handlers are
   JS: the scene's look-at, the rules) and race, so one of them wins per
   touch. The pressable underneath keeps the press feel and the accessible
   name, and feeds on a screen reader's activate; its own press is left to
   the tap gesture so a finger feeds once. */
function DraggableActionButton({ action, bar, onDrag }: { action: Action; bar: BarSizes; onDrag: FeedDragHandler }) {
  const { Glyph, label, disabled, need, gifts, valueText, lit, onPress } = action

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
    <View style={[styles.item, { width: bar.item }, disabled && styles.itemDisabled]}>
      <View style={[styles.well, { width: bar.ring, height: bar.ring }]}>
        {need ? <NeedRing size={bar.ring} value={need.value} want={NEED_WANT_BELOW[need.id]} /> : null}
        {lit ? <TutorialHalo /> : null}
        <GestureDetector gesture={gesture}>
          <PressableScale
            scaleTo={PRESS_SCALE}
            accessibilityLabel={label}
            accessibilityState={{ disabled: Boolean(disabled) }}
            accessibilityValue={valueText ? { text: valueText } : undefined}
            accessibilityActions={[{ name: 'activate' }]}
            onAccessibilityAction={onAccessibilityAction}
            pressedFill={colors.accentBorder}
            style={[styles.button, { width: bar.button, height: bar.button }, styles.primary]}
          >
            <Glyph size={bar.icon} weight="fill" color={colors.accentInk} />
          </PressableScale>
        </GestureDetector>
        {need ? <NeedGain value={need.value} /> : null}
      </View>
      <GiftMarks count={gifts} />
      <Text variant="small" weight="bold" align="center" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.label}>
        {label}
      </Text>
    </View>
  )
}

/* The room the discover key takes in the middle of the band: its width
   and a little air on each side. */
const KEY_GAP = TAB_BAR_OVERHANG * 2 + space.lg

/* The band's measure at a window's width: an item's column, the ring's
   box, the button and its glyph. Four items, the gaps between them, the
   key's gap and the band's edges fit at full size from 390 points up;
   narrower, the column is what a quarter of the rest allows and the
   button and ring shrink in step, the button never under BUTTON_MIN (so
   at 320 points the ring is 50 and the button 44). */
export type BarSizes = { item: number; ring: number; button: number; icon: number }
const ITEM_FULL = RING + space.sm
export function barSizes(width: number): BarSizes {
  const item = Math.min(ITEM_FULL, Math.floor((width - KEY_GAP - 2 * space.sm - 2 * space.xs) / 4))
  const scale = Math.max(BUTTON_MIN / BUTTON, Math.min(1, item / ITEM_FULL))
  return { item, ring: Math.round(RING * scale), button: Math.round(BUTTON * scale), icon: scale < 1 ? iconSize.md : iconSize.lg }
}

const styles = StyleSheet.create({
  band: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: space.sm,
    /* Clear of the tab bar beneath, so a thumb on a label never lands on it. */
    paddingBottom: space.md,
    paddingHorizontal: space.xs,
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
  /* The column's width comes from the band's measure (barSizes). */
  item: {
    alignItems: 'center',
    gap: space.xs,
  },
  itemDisabled: {
    opacity: 0.5,
  },
  /* The button in the middle of its ring's box; the box's size is the bar's. */
  well: {
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
  button: {
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
