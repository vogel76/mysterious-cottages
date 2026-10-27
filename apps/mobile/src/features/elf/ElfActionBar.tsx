import { useMemo } from 'react'
import { StyleSheet, View, type AccessibilityActionEvent } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useTranslation } from 'react-i18next'
import { BathIcon, FeedIcon, LullabyIcon, PressableScale, SleepIcon, TAB_BAR_OVERHANG, Text, ToyIcon, WakeIcon, WarmIcon, colors, iconSize, mapPalette, radius, space, type Icon } from '../../ui'
import { ELF_CARE_CAPS, type ElfCareAction, type ElfEggAction, type ElfStage } from '@chatynkowo/core'

/* The care actions as round buttons on a band of the HUD's chrome that
   sits on the tab bar, split around the tab bar's raised discover key
   (two buttons on each side of it, one on each for the egg), so the key
   and the buttons never cover one another and nothing floats over the
   rug: for an egg the two ways to hatch it, for an elf feeding, playing,
   bathing and sleep or wake. The care buttons take
   the gold face of a primary button, the sleep toggle the ghost face, each
   with a short label underneath, and under each care button the dots of
   its daily cap (three feeds, two plays, one bath), lit while they are
   left, so the player sees before tapping what the day still allows.
   While the elf sleeps, or once a cap is used up, the button dims and
   tells assistive tech it is disabled, but it stays pressable: the rules
   refuse the action and the elf says why, so a tap is never met with
   silence. The feed button also lets the acorn
   be dragged: a pan that starts on it reports the finger's position in
   window coordinates to the tab, which floats an acorn under the finger,
   has the elf follow it with its eyes and feeds it when the acorn is
   dropped on it (the pan and the plain tap race, so a still finger stays a
   tap). */

export type FeedDragPhase = 'begin' | 'move' | 'end'
/* The acorn under the finger, in window coordinates. */
export type FeedDragHandler = (phase: FeedDragPhase, x: number, y: number) => void

export type ElfActionBarProps = {
  stage: ElfStage
  sleeping: boolean
  /* How many of each care the day still allows. */
  careLeft: Record<ElfCareAction, number>
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
  /* The daily cap and what is left of it, as dots under the button, and
     the same in words for a screen reader. */
  cap?: { total: number; left: number }
  valueText?: string
  onPress: () => void
}

const BUTTON = 56
const DOT = 6
/* The press feedback of the round buttons. */
const PRESS_SCALE = 0.9
/* How far the finger travels before a press on the acorn becomes a drag. */
const DRAG_START = 10

export function ElfActionBar({ stage, sleeping, careLeft, onCare, onTendEgg, onToggleSleep, onFeedDrag }: ElfActionBarProps) {
  const { t } = useTranslation()
  const care = (id: ElfCareAction, Glyph: Icon, label: string): Action => ({
    key: id,
    Glyph,
    label,
    face: 'primary',
    disabled: sleeping || careLeft[id] === 0,
    cap: { total: ELF_CARE_CAPS[id], left: careLeft[id] },
    valueText: careLeft[id] > 0 ? t('mobile:elf.careLeftAria', { left: careLeft[id], total: ELF_CARE_CAPS[id] }) : t('mobile:elf.careUsedAria'),
    onPress: () => onCare(id),
  })

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
  const { Glyph, label, face, disabled, cap, valueText, onPress } = action
  const primary = face === 'primary'
  return (
    <View style={[styles.item, disabled && styles.itemDisabled]}>
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
      <CapDots cap={cap} />
      <Text variant="label" weight="semibold" align="center" numberOfLines={1} style={styles.label}>
        {label}
      </Text>
    </View>
  )
}

/* The day's cap under a care button: one dot per allowed use, lit while
   it is left. The button's label already says what the dots are for. A
   button without a cap keeps the row's height, so every label sits on
   the same line. */
function CapDots({ cap }: { cap?: { total: number; left: number } }) {
  return (
    <View style={styles.dots} pointerEvents="none">
      {cap ? Array.from({ length: cap.total }, (_, index) => <View key={index} style={[styles.dot, index < cap.left ? styles.dotLeft : styles.dotUsed]} />) : null}
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
  const { Glyph, label, disabled, cap, valueText, onPress } = action

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
    backgroundColor: mapPalette.chrome,
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
    width: BUTTON + space.lg,
    alignItems: 'center',
    gap: space.xs,
  },
  itemDisabled: {
    opacity: 0.5,
  },
  dots: {
    flexDirection: 'row',
    gap: space.xs,
    minHeight: DOT,
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
  /* A used dot keeps its ring, so the cap stays countable. */
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
  /* The label sits on the painted room, not on a surface: a shadow keeps
     it legible over the lit floor. */
  label: {
    textShadowColor: colors.page,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
})
