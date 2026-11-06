import { useCallback, useEffect, useRef, useState } from 'react'
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import Animated, { Easing, FadeOut, ZoomIn, cancelAnimation, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import { useTranslation } from 'react-i18next'
import { CloseIcon, DustIcon, JoyIcon, StarRainGameIcon, StormIcon, Text, colors, iconSize, radius, space } from '../../../ui'
import { GameStartCard } from './GameStartCard'
import { useGameSound } from './GameSounds'

/* The star rain: stars fall from the top of the board and the player
   moves a basket along its foot with a finger (a drag, or a touch where
   it should go) to catch them; storm clouds fall among them and are to
   be kept out of the basket. A star caught is a point (the rules pay an
   acorn for two, GAME_POINTS_PER_ACORN); a heart goes when a star
   reaches the ground beside the basket or a storm lands in it, marked
   with a red cross where it happened, and the third ends the round. The
   rain is quick from the start and thickens as the round goes on: the
   stars come oftener and fall faster until the quickest pace three
   quarters of a minute in, the storms join after three seconds and grow
   to almost half of what falls, stars begin to fall slantwise, and a
   storm often falls right beside a star, so the basket has to be placed,
   not just swept. The basket is drawn at its true width, and a star
   that still overlaps its edge counts, so a near miss is seen to be one. A star caught twinkles, a storm caught
   rumbles and a star on the ground bumps (GameSounds). Each falling
   thing is an animation of its own on the UI thread, a fall over its
   time (slanted by its drift), and the catch is decided once, when it
   reaches the basket's opening, where it then is: so the game needs no
   frame loop, only a timer per falling thing.
   How to play waits over the board with the start (GameStartCard). All
   timing runs on timers in this component and dies with it. */

const HEARTS = 3
/* How long the pace takes to go from the gentlest to the quickest. */
const RAMP_MS = 45_000
/* A new thing falls every so many milliseconds, and falls for so long,
   at the start and at the quickest. */
const SPAWN_FROM = 850
const SPAWN_TO = 330
const FALL_FROM = 2300
const FALL_TO = 950
/* The storms join this long into the round, and their share of what
   falls grows from the first value to the second. */
const STORMS_AFTER_MS = 3000
const STORM_SHARE_FROM = 0.25
const STORM_SHARE_TO = 0.45
/* From this share of the ramp a star may fall slantwise, drifting across
   up to this share of the board; from the next, a storm may fall right
   beside a star, this many basket widths away. */
const SLANT_FROM = 0.2
const SLANT_MAX = 0.35
const PAIR_FROM = 0.3
const PAIR_GAP = [0.85, 1.25] as const
/* The falling things' side, the basket's width, and how far past the
   basket's edge a star's middle may be and still count as caught: a
   star still overlapping the edge by a good part of itself is in, while
   a storm is caught only with its middle over the basket, so brushing
   the rim never costs a heart. */
const THING = 44
const BASKET_WIDTH = 64
const SLACK = THING * 0.3
/* The basket's picture fills seven eighths of its box across, its foot
   is 40 of the box's 256 units above the box's bottom and its opening
   136 above its foot: the box is sized so the picture is as wide as the
   catch, set so the foot stands on the board's foot, and a thing is
   judged when its middle reaches the opening. */
const BASKET_BOX = Math.round(BASKET_WIDTH / 0.875)
const BASKET_FOOT = Math.round((BASKET_BOX * 40) / 256)
const BASKET_RIM = Math.round((BASKET_BOX * 136) / 256)
/* How long the cross of a lost heart stays. */
const MARK_MS = 600

type Props = { onFinish: (points: number) => void }

type Phase = 'ready' | 'playing' | 'over'

/* Where a thing starts across the board, and how far it drifts by the ground. */
type Thing = { id: number; kind: 'star' | 'storm'; x: number; drift: number; fall: number }
type Mark = { id: number; x: number; y: number }

export function StarRainGame({ onFinish }: Props) {
  const { t } = useTranslation()
  const play = useGameSound()
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
    /* Where the falling things' middle reaches the basket's opening, as a
       share of the fall (a thing's top goes from -THING to the height). */
    const rimShare = (height - BASKET_RIM + THING / 2) / (height + THING)
    const inside = (x: number) => Math.min(width - THING / 2 - 4, Math.max(THING / 2 + 4, x))
    /* One thing falling from x, drifting by drift on its way down. */
    const dropOne = (kind: Thing['kind'], x: number, drift: number, fall: number) => {
      seq.current += 1
      const id = seq.current
      falling.current.add(id)
      setThings((current) => [...current, { id, kind, x, drift, fall }])
      /* At the rim, where it then is: in the basket or past it. */
      later(fall * rimShare, () => {
        if (overRef.current) return
        const atRim = x + drift * rimShare
        const inBasket = Math.abs(atRim - basketRef.current) <= BASKET_WIDTH / 2 + (kind === 'star' ? SLACK : 0)
        if (!inBasket) return
        falling.current.delete(id)
        setThings((current) => current.filter((thing) => thing.id !== id))
        if (kind === 'star') {
          play('twinkle')
          caughtRef.current += 1
          setCaught(caughtRef.current)
          basketPulse.value = withSequence(withTiming(1.12, { duration: 90 }), withTiming(1, { duration: 140 }))
        } else {
          play('storm')
          mark(basketRef.current, height - BASKET_RIM / 2)
          miss()
        }
      })
      /* On the ground: a star that got away takes a heart. */
      later(fall, () => {
        if (overRef.current || !falling.current.delete(id)) return
        setThings((current) => current.filter((thing) => thing.id !== id))
        if (kind === 'star') {
          play('miss')
          mark(x + drift, height - THING / 2)
          miss()
        }
      })
    }
    const drop = () => {
      if (overRef.current) return
      const p = progress()
      const fall = lerp(FALL_FROM, FALL_TO)
      const x = inside(THING / 2 + 4 + Math.random() * Math.max(1, width - THING - 8))
      const stormy = Date.now() - startedAt.current > STORMS_AFTER_MS && Math.random() < lerp(STORM_SHARE_FROM, STORM_SHARE_TO)
      if (stormy) dropOne('storm', x, 0, fall)
      else if (p >= PAIR_FROM && Math.random() < 0.3 + 0.4 * p) {
        /* A star with a storm right beside it: the basket must be placed. */
        const side = x > width / 2 ? -1 : 1
        const gap = BASKET_WIDTH * (PAIR_GAP[0] + Math.random() * (PAIR_GAP[1] - PAIR_GAP[0]))
        dropOne('star', x, 0, fall)
        dropOne('storm', inside(x + side * gap), 0, fall)
      } else {
        /* A star, slantwise now and then once the rain has picked up. */
        const slant = p >= SLANT_FROM && Math.random() < 0.5
        const reach = slant ? (Math.random() < 0.5 ? -1 : 1) * width * SLANT_MAX * (0.4 + 0.6 * Math.random()) : 0
        const drift = inside(x + reach) - x
        dropOne('star', x, drift, fall)
      }
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
    transform: [{ translateX: basketX.value - BASKET_BOX / 2 }, { scale: basketPulse.value }],
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
              <StarRainGameIcon size={BASKET_BOX} weight="fill" color={colors.accentStrong} />
            </Animated.View>
          </View>
        </GestureDetector>
        {/* Outside the drag's area, so the start takes its own touch. */}
        {phase === 'ready' ? <GameStartCard how={t('mobile:elf.gameStarsHow')} onStart={start} /> : null}
      </GestureHandlerRootView>
    </View>
  )
}

/* One falling thing: a fall from above the board to its foot over its
   own time, slanted by its drift, on the UI thread; gone when the game
   takes it. */
function Falling({ thing, height }: { thing: Thing; height: number }) {
  const y = useSharedValue(-THING)
  const dx = useSharedValue(0)
  useEffect(() => {
    y.value = withTiming(height, { duration: thing.fall, easing: Easing.linear })
    dx.value = withTiming(thing.drift, { duration: thing.fall, easing: Easing.linear })
    return () => {
      cancelAnimation(y)
      cancelAnimation(dx)
    }
  }, [y, dx, height, thing.fall, thing.drift])
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: dx.value }, { translateY: y.value }] }))
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
    bottom: -BASKET_FOOT,
    left: 0,
    width: BASKET_BOX,
    height: BASKET_BOX,
  },
  mark: {
    position: 'absolute',
    width: THING,
    height: THING,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
