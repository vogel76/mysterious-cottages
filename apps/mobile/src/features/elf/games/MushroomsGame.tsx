import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming, type SharedValue } from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { AcornsIcon, JoyIcon, PressableScale, Text, colors, iconSize, space } from '../../../ui'
import { GameStartCard } from './GameStartCard'

/* Under which mushroom? The elf hides an acorn under one of the toadstool
   caps on the board, shows it for a moment, lowers the cap and shuffles
   the caps around, swapping two at a time (one hops over the other);
   then the player taps the cap the acorn is under. Found, it is a point
   and the next round shuffles more and faster; from the fifth round a
   fourth cap joins. A wrong cap lifts to show nothing, the right one
   lifts to show where the acorn was, and a heart goes; the third ends
   the round. The acorn is on the board only while it is shown and when
   the caps are lifted to tell the round: through the shuffle and the
   choice it is not drawn at all, so a cap hopping over another never
   lets it peek out from under its rim. A point pays an acorn (GAME_POINTS_PER_ACORN). The caps
   are drawn (a red dome with white spots), not pictures, and move on the
   UI thread; the board fits the room it has, and how to play waits over
   it with the start (GameStartCard). All timing runs on timers in this
   component and dies with it. */

const HEARTS = 3
const MAX_CAPS = 4
/* From this round (counted from 0) the board has four caps. */
const FOUR_FROM = 4
/* How long the acorn is shown before the shuffle, how long a cap takes
   to lift or settle, and the breaths after a find and after a miss. */
const SHOW_MS = 1100
const LIFT_MS = 260
const FOUND_MS = 900
const MISSED_MS = 1500
/* A round's shuffle: so many swaps, each so long, both growing with the round. */
const swaps = (round: number) => Math.min(14, 3 + round)
const swapMs = (round: number) => Math.max(210, 520 - round * 30)
/* The largest cap, and the share of its slot a cap takes. */
const MAX_CAP = 112
const SLOT_SHARE = 0.82

/* The toadstool's own colours: the art of the board, like the room's particles. */
const CAP_RED = '#c8553d'
const CAP_RIM = '#e9dcc0'
const SPOT = '#f6ecd8'
/* The spots on a cap, as shares of its width: left, top, diameter. */
const SPOTS = [
  [0.2, 0.28, 0.15],
  [0.52, 0.14, 0.13],
  [0.66, 0.42, 0.11],
  [0.36, 0.5, 0.09],
] as const

type Props = { onFinish: (points: number) => void }

type Phase = 'ready' | 'showing' | 'shuffling' | 'pick' | 'reveal' | 'over'

export function MushroomsGame({ onFinish }: Props) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState<Phase>('ready')
  const [points, setPoints] = useState(0)
  const [hearts, setHearts] = useState(HEARTS)
  const [count, setCount] = useState(3)
  /* Which cap hides the acorn, and which one the player lifted. */
  const [acorn, setAcorn] = useState(0)
  const [room, setRoom] = useState({ width: 0, height: 0 })
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setRoom((current) => (current.width === width && current.height === height ? current : { width, height }))
  }
  /* Each cap's left edge and lift, four of each whatever the round uses. */
  const x0 = useSharedValue(0)
  const x1 = useSharedValue(0)
  const x2 = useSharedValue(0)
  const x3 = useSharedValue(0)
  const l0 = useSharedValue(0)
  const l1 = useSharedValue(0)
  const l2 = useSharedValue(0)
  const l3 = useSharedValue(0)
  const xs = [x0, x1, x2, x3]
  const lifts = [l0, l1, l2, l3]
  /* Which slot each cap stands in, and the round's state for the timers. */
  const slotOf = useRef<number[]>([0, 1, 2, 3])
  const roundRef = useRef(0)
  const pointsRef = useRef(0)
  const heartsRef = useRef(HEARTS)
  const acornRef = useRef(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const later = (ms: number, run: () => void) => {
    const timer = setTimeout(run, ms)
    timers.current.push(timer)
  }
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout)
    },
    [],
  )

  /* A cap's side for the caps on the board, and a slot's cap left edge. */
  const capFor = (caps: number) => (room.width > 0 ? Math.floor(Math.min(MAX_CAP, (room.width / caps) * SLOT_SHARE, room.height * 0.4)) : 0)
  const leftOf = (slot: number, caps: number) => (room.width / caps) * (slot + 0.5) - capFor(caps) / 2
  const cap = capFor(count)
  const capHeight = Math.round(cap * 0.72)

  const startRound = (round: number) => {
    const caps = round >= FOUR_FROM ? 4 : 3
    roundRef.current = round
    setCount(caps)
    slotOf.current = [0, 1, 2, 3]
    for (let index = 0; index < MAX_CAPS; index += 1) {
      xs[index]!.value = leftOf(index, caps)
      lifts[index]!.value = 0
    }
    const hidden = Math.floor(Math.random() * caps)
    acornRef.current = hidden
    setAcorn(hidden)
    setPhase('showing')
    const lift = Math.round(capFor(caps) * 0.55)
    /* Shown, then hidden, then shuffled. */
    lifts[hidden]!.value = withTiming(-lift, { duration: LIFT_MS, easing: Easing.out(Easing.quad) })
    later(SHOW_MS, () => {
      lifts[hidden]!.value = withTiming(0, { duration: LIFT_MS, easing: Easing.in(Easing.quad) })
    })
    later(SHOW_MS + LIFT_MS + 120, () => shuffle(round, caps))
  }

  const shuffle = (round: number, caps: number) => {
    setPhase('shuffling')
    const each = swapMs(round)
    const total = swaps(round)
    const hop = Math.round(capFor(caps) * 0.22)
    for (let step = 0; step < total; step += 1) {
      later(step * (each + 40), () => {
        const a = Math.floor(Math.random() * caps)
        let b = Math.floor(Math.random() * (caps - 1))
        if (b >= a) b += 1
        const capA = slotOf.current.indexOf(a)
        const capB = slotOf.current.indexOf(b)
        slotOf.current[capA] = b
        slotOf.current[capB] = a
        const timing = { duration: each, easing: Easing.inOut(Easing.quad) }
        xs[capA]!.value = withTiming(leftOf(b, caps), timing)
        xs[capB]!.value = withTiming(leftOf(a, caps), timing)
        /* The one hops over the other. */
        lifts[capA]!.value = withSequence(withTiming(-hop, { duration: each / 2 }), withTiming(0, { duration: each / 2 }))
      })
    }
    later(total * (each + 40) + 60, () => setPhase('pick'))
  }

  const start = () => {
    if (room.width <= 0) return
    pointsRef.current = 0
    heartsRef.current = HEARTS
    setPoints(0)
    setHearts(HEARTS)
    startRound(0)
  }

  /* A cap tapped: lifted; the acorn under it is a point, an empty one
     costs a heart and the right cap shows where it was. */
  const pick = (index: number) => {
    if (phase !== 'pick') return
    setPhase('reveal')
    const lift = Math.round(cap * 0.55)
    lifts[index]!.value = withTiming(-lift, { duration: LIFT_MS, easing: Easing.out(Easing.quad) })
    if (index === acornRef.current) {
      pointsRef.current += 1
      setPoints(pointsRef.current)
      later(FOUND_MS, () => startRound(roundRef.current + 1))
      return
    }
    later(LIFT_MS + 150, () => {
      lifts[acornRef.current]!.value = withTiming(-lift, { duration: LIFT_MS, easing: Easing.out(Easing.quad) })
    })
    heartsRef.current -= 1
    setHearts(heartsRef.current)
    if (heartsRef.current > 0) {
      later(MISSED_MS, () => startRound(roundRef.current + 1))
      return
    }
    later(MISSED_MS, () => {
      setPhase('over')
      onFinish(pointsRef.current)
    })
  }

  const status = phase === 'showing' || phase === 'shuffling' ? t('mobile:elf.gameMushroomsWatch') : phase === 'pick' ? t('mobile:elf.gameMushroomsPick') : ''

  return (
    <View style={styles.column}>
      <View style={styles.bar}>
        <View style={styles.hearts} accessible accessibilityLabel={t('mobile:elf.gameHearts', { count: hearts, total: HEARTS })}>
          {Array.from({ length: HEARTS }, (_, index) => (
            <JoyIcon key={index} size={iconSize.md} weight={index < hearts ? 'fill' : 'regular'} color={index < hearts ? colors.danger : colors.inkFaint} />
          ))}
        </View>
        <Text weight="bold" accessibilityLiveRegion="polite">
          {t('mobile:elf.gameScore', { count: points })}
        </Text>
      </View>
      <Text variant="small" weight="bold" align="center" tone={phase === 'pick' ? 'accent' : 'soft'} accessibilityLiveRegion="polite" style={styles.status}>
        {status}
      </Text>
      <View style={styles.stage} onLayout={onLayout}>
        {cap > 0
          ? Array.from({ length: count }, (_, index) => (
              <Mushroom
                key={index}
                index={index}
                size={cap}
                height={capHeight}
                top={room.height / 2 - capHeight / 2}
                x={xs[index]!}
                lift={lifts[index]!}
                hidesAcorn={index === acorn && (phase === 'showing' || phase === 'reveal' || phase === 'over')}
                enabled={phase === 'pick'}
                onPress={() => pick(index)}
              />
            ))
          : null}
        {phase === 'ready' ? <GameStartCard how={t('mobile:elf.gameMushroomsHow')} onStart={start} /> : null}
      </View>
    </View>
  )
}

/* One cap on the board, the acorn under it when it hides one: the cap
   moves along the ground (x) and lifts (lift) on the UI thread. */
function Mushroom({ index, size, height, top, x, lift, hidesAcorn, enabled, onPress }: { index: number; size: number; height: number; top: number; x: SharedValue<number>; lift: SharedValue<number>; hidesAcorn: boolean; enabled: boolean; onPress: () => void }) {
  const { t } = useTranslation()
  const place = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))
  const raise = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }] }))
  return (
    <Animated.View style={[styles.unit, { top, width: size, height }, place]}>
      <PressableScale onPress={onPress} disabled={!enabled} scaleTo={0.95} pressedFill="transparent" ripple={false} accessibilityLabel={t('mobile:elf.gameMushroomsCapAria', { n: index + 1 })} style={styles.fill}>
        {/* The ground's shadow and the acorn under the cap. */}
        <View style={[styles.shadow, { width: size * 0.9, height: size * 0.16, left: size * 0.05, bottom: -size * 0.06 }]} />
        {hidesAcorn ? (
          <View style={styles.acorn}>
            <AcornsIcon size={Math.round(size * 0.42)} weight="fill" color={colors.accentStrong} />
          </View>
        ) : null}
        <Animated.View style={[styles.cap, { width: size, height, borderTopLeftRadius: size / 2, borderTopRightRadius: size / 2, borderBottomLeftRadius: size * 0.14, borderBottomRightRadius: size * 0.14 }, raise]}>
          {SPOTS.map(([left, spotTop, diameter], spot) => (
            <View key={spot} style={[styles.spot, { left: left * size, top: spotTop * size, width: diameter * size, height: diameter * size, borderRadius: (diameter * size) / 2 }]} />
          ))}
          <View style={[styles.rim, { height: size * 0.1, borderBottomLeftRadius: size * 0.14, borderBottomRightRadius: size * 0.14 }]} />
        </Animated.View>
      </PressableScale>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  column: {
    flex: 1,
    gap: space.md,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hearts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  /* One line high whatever it says, so the board never moves. */
  status: {
    minHeight: 20,
  },
  stage: {
    flex: 1,
  },
  unit: {
    position: 'absolute',
    left: 0,
  },
  fill: {
    flex: 1,
  },
  shadow: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  acorn: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  cap: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    overflow: 'hidden',
    backgroundColor: CAP_RED,
  },
  spot: {
    position: 'absolute',
    backgroundColor: SPOT,
  },
  rim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: CAP_RIM,
  },
})
