import { useCallback, useEffect, useRef, useState } from 'react'
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import Animated, { Easing, FadeOut, ZoomIn, cancelAnimation, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import { useTranslation } from 'react-i18next'
import { CloseIcon, DustIcon, JoyIcon, StarRainGameIcon, StormIcon, Text, colors, iconSize, radius, space } from '../../../ui'
import { GameStartCard } from './GameStartCard'

/* The star rain: stars fall from the top of the board and the player
   moves a basket along its foot with a finger (a drag, or a touch where
   it should go) to catch them; storm clouds fall among them and are to
   be kept out of the basket. A star caught is a point (the rules pay an
   acorn for two, GAME_POINTS_PER_ACORN); a heart goes when a star
   reaches the ground beside the basket or a storm lands in it, marked
   with a red cross where it happened, and the third ends the round. The
   rain thickens as the round goes on: the stars come oftener and fall
   faster until the quickest pace a minute in, and the storms join after
   the first few seconds, more of them as it goes. Each falling thing
   is an animation of its own on the UI thread, a straight fall over its
   time, and the catch is decided once, when it reaches the basket's
   rim: so the game needs no frame loop, only a timer per falling thing.
   How to play waits over the board with the start (GameStartCard). All
   timing runs on timers in this component and dies with it. */

const HEARTS = 3
/* How long the pace takes to go from the gentlest to the quickest. */
const RAMP_MS = 60_000
/* A new thing falls every so many milliseconds, and falls for so long,
   at the start and at the quickest. */
const SPAWN_FROM = 1100
const SPAWN_TO = 430
const FALL_FROM = 2800
const FALL_TO = 1300
/* The storms join this long into the round, and their share of what
   falls grows from the first value to the second. */
const STORMS_AFTER_MS = 7000
const STORM_SHARE_FROM = 0.15
const STORM_SHARE_TO = 0.35
/* The falling things' side, the basket's size, and how far past the
   basket's edge a thing still counts as caught. */
const THING = 44
const BASKET_WIDTH = 92
const BASKET_HEIGHT = 58
const SLACK = THING * 0.25
/* How long the cross of a lost heart stays. */
const MARK_MS = 600

type Props = { onFinish: (points: number) => void }

type Phase = 'ready' | 'playing' | 'over'

type Thing = { id: number; kind: 'star' | 'storm'; x: number; fall: number }
type Mark = { id: number; x: number; y: number }

export function StarRainGame({ onFinish }: Props) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState<Phase>('ready')
  const [caught, setCaught] = useState(0)
  const [hearts, setHearts] = useState(HEARTS)
  const [things, setThings] = useState<Thing[]>([])
  const [marks, setMarks] = useState<Mark[]>([])
  const [room, setRoom] = useState({ width: 0, height: 0 })
  const roomRef = useRef(room)
  roomRef.current = room
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setRoom((current) => (current.width === width && current.height === height ? current : { width, height }))
  }

  /* The basket's centre: a shared value for the drawing, a ref for the catches. */
  const basketX = useSharedValue(0)
  const basketRef = useRef(0)
  const basketPulse = useSharedValue(1)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const startedAt = useRef(0)
  const caughtRef = useRef(0)
  const heartsRef = useRef(HEARTS)
  const overRef = useRef(false)
  const seq = useRef(0)
  /* The things still falling, by id: a thing caught at the rim leaves
     it, so the ground knows what got away. */
  const falling = useRef(new Set<number>())

  /* The basket starts in the middle once the board is measured. */
  useEffect(() => {
    if (room.width <= 0 || phase !== 'ready') return
    basketRef.current = room.width / 2
    basketX.value = room.width / 2
  }, [room.width, phase, basketX])

  const later = (ms: number, run: () => void) => {
    const timer = setTimeout(run, ms)
    timers.current.push(timer)
  }
  const clearTimers = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }
  useEffect(() => clearTimers, [])

  const progress = () => Math.min(1, Math.max(0, (Date.now() - startedAt.current) / RAMP_MS))
  const lerp = (from: number, to: number) => from + (to - from) * progress()

  const mark = (x: number, y: number) => {
    seq.current += 1
    const id = seq.current
    setMarks((current) => [...current, { id, x, y }])
    later(MARK_MS, () => setMarks((current) => current.filter((entry) => entry.id !== id)))
  }

  /* A heart lost; the last one ends the round with the catches so far. */
  const miss = useCallback(() => {
    if (overRef.current) return
    heartsRef.current -= 1
    setHearts(heartsRef.current)
    if (heartsRef.current > 0) return
    overRef.current = true
    clearTimers()
    setThings([])
    setPhase('over')
    onFinish(caughtRef.current)
  }, [onFinish])

  const start = () => {
    const { width, height } = roomRef.current
    if (width <= 0 || height <= 0) return
    setPhase('playing')
    setCaught(0)
    caughtRef.current = 0
    setHearts(HEARTS)
    heartsRef.current = HEARTS
    overRef.current = false
    setThings([])
    setMarks([])
    falling.current = new Set()
    startedAt.current = Date.now()
    /* Where the falling things' top reaches the basket's rim, as a share of the fall. */
    const rimShare = (height - BASKET_HEIGHT - THING * 0.4 + THING) / (height + THING)
    const drop = () => {
      if (overRef.current) return
      seq.current += 1
      const id = seq.current
      const stormy = Date.now() - startedAt.current > STORMS_AFTER_MS && Math.random() < lerp(STORM_SHARE_FROM, STORM_SHARE_TO)
      const kind: Thing['kind'] = stormy ? 'storm' : 'star'
      const x = THING / 2 + 4 + Math.random() * Math.max(1, width - THING - 8)
      const fall = lerp(FALL_FROM, FALL_TO)
      falling.current.add(id)
      setThings((current) => [...current, { id, kind, x, fall }])
      /* At the rim: in the basket or past it. */
      later(fall * rimShare, () => {
        if (overRef.current) return
        const inBasket = Math.abs(x - basketRef.current) <= BASKET_WIDTH / 2 + SLACK
        if (!inBasket) return
        falling.current.delete(id)
        setThings((current) => current.filter((thing) => thing.id !== id))
        if (kind === 'star') {
          caughtRef.current += 1
          setCaught(caughtRef.current)
          basketPulse.value = withSequence(withTiming(1.12, { duration: 90 }), withTiming(1, { duration: 140 }))
        } else {
          mark(basketRef.current, height - BASKET_HEIGHT / 2)
          miss()
        }
      })
      /* On the ground: a star that got away takes a heart. */
      later(fall, () => {
        if (overRef.current || !falling.current.delete(id)) return
        setThings((current) => current.filter((thing) => thing.id !== id))
        if (kind === 'star') {
          mark(x, height - THING / 2)
          miss()
        }
      })
      later(lerp(SPAWN_FROM, SPAWN_TO), drop)
    }
    drop()
  }

  /* The finger moves the basket, kept inside the board. */
  const gesture = Gesture.Pan()
    .runOnJS(true)
    .enabled(phase === 'playing')
    .minDistance(0)
    .onBegin((event) => moveBasket(event.x))
    .onUpdate((event) => moveBasket(event.x))
  function moveBasket(x: number) {
    if (phase !== 'playing') return
    const width = roomRef.current.width
    const clamped = Math.min(width - BASKET_WIDTH / 2, Math.max(BASKET_WIDTH / 2, x))
    basketRef.current = clamped
    basketX.value = clamped
  }

  const basketStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: basketX.value - BASKET_WIDTH / 2 }, { scale: basketPulse.value }],
  }))

  return (
    <View style={styles.column}>
      <View style={styles.bar}>
        <View style={styles.hearts} accessible accessibilityLabel={t('mobile:elf.gameHearts', { count: hearts, total: HEARTS })}>
          {Array.from({ length: HEARTS }, (_, index) => (
            <JoyIcon key={index} size={iconSize.md} weight={index < hearts ? 'fill' : 'regular'} color={index < hearts ? colors.danger : colors.inkFaint} />
          ))}
        </View>
        <Text weight="bold" accessibilityLiveRegion="polite">
          {t('mobile:elf.gameScore', { count: caught })}
        </Text>
      </View>
      <GestureHandlerRootView style={styles.stage}>
        <GestureDetector gesture={gesture}>
          <View style={styles.sky} onLayout={onLayout} accessible accessibilityLabel={t('mobile:elf.gameStarsBoardAria')}>
            {room.height > 0
              ? things.map((thing) => <Falling key={thing.id} thing={thing} height={room.height} />)
              : null}
            {marks.map((entry) => (
              <Animated.View key={entry.id} entering={ZoomIn.duration(140)} exiting={FadeOut.duration(220)} style={[styles.mark, { left: entry.x - THING / 2, top: entry.y - THING / 2 }]} pointerEvents="none">
                <CloseIcon size={THING * 0.8} weight="bold" color={colors.danger} />
              </Animated.View>
            ))}
            <Animated.View style={[styles.basket, basketStyle]} pointerEvents="none">
              <StarRainGameIcon size={BASKET_HEIGHT * 0.75} weight="fill" color={colors.accentStrong} />
            </Animated.View>
          </View>
        </GestureDetector>
        {/* Outside the drag's area, so the start takes its own touch. */}
        {phase === 'ready' ? <GameStartCard how={t('mobile:elf.gameStarsHow')} onStart={start} /> : null}
      </GestureHandlerRootView>
    </View>
  )
}

/* One falling thing: a straight fall from above the board to its foot
   over its own time, on the UI thread; gone when the game takes it. */
function Falling({ thing, height }: { thing: Thing; height: number }) {
  const y = useSharedValue(-THING)
  useEffect(() => {
    y.value = withTiming(height, { duration: thing.fall, easing: Easing.linear })
    return () => cancelAnimation(y)
  }, [y, height, thing.fall])
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }))
  const star = thing.kind === 'star'
  return (
    <Animated.View style={[styles.thing, { left: thing.x - THING / 2 }, style]} pointerEvents="none">
      {star ? <DustIcon size={THING} weight="fill" color={colors.accentStrong} /> : <StormIcon size={THING} weight="fill" color={colors.inkSoft} />}
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
  stage: {
    flex: 1,
  },
  /* The sky the things fall through, the basket along its foot. */
  sky: {
    flex: 1,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  thing: {
    position: 'absolute',
    top: 0,
    width: THING,
    height: THING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  basket: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: BASKET_WIDTH,
    height: BASKET_HEIGHT,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  mark: {
    position: 'absolute',
    width: THING,
    height: THING,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
