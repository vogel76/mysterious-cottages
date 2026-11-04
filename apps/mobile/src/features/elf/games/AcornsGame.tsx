import { useCallback, useEffect, useRef, useState } from 'react'
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import Animated, { ZoomIn, ZoomOut } from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { AcornsIcon, Button, JoyIcon, PressableScale, Text, colors, iconSize, radius, space } from '../../../ui'

/* Catch the acorns: twelve spots in a grid, an acorn popping up on one
   of them every so often and vanishing again unless tapped, the pops
   coming faster and staying shorter as the round goes on, until the
   quickest pace a minute in. The round has no clock: it ends when three
   hearts are lost, one for every acorn that gets away and one for every
   tap on an empty spot, so a round is as long as the thumb is quick. A
   catch is a point; the rules pay an acorn for two (GAME_POINTS_PER_ACORN).
   All timing runs on timers in this component and dies with it. */

const HEARTS = 3
const COLUMNS = 3
const ROWS = 4
const SPOTS = COLUMNS * ROWS
/* How long the pace takes to go from the gentlest to the quickest. */
const RAMP_MS = 60_000
/* A pop every so many milliseconds, and how long it stays, at the start
   and at the quickest. */
const POP_FROM = 900
const POP_TO = 380
const STAY_FROM = 1300
const STAY_TO = 650
const GAP = 8

type Props = { onFinish: (points: number) => void }

type Phase = 'ready' | 'playing' | 'over'

export function AcornsGame({ onFinish }: Props) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState<Phase>('ready')
  const [caught, setCaught] = useState(0)
  const [hearts, setHearts] = useState(HEARTS)
  /* Which spots hold an acorn right now: the state draws them, the ref
     answers the taps and the timers without a setter's updater (which
     must stay free of side effects). */
  const [acorns, setAcorns] = useState<Record<number, true>>({})
  const held = useRef<Record<number, true>>({})
  const place = (next: Record<number, true>) => {
    held.current = next
    setAcorns(next)
  }
  /* Every timer of the round, and the timer that takes each acorn away. */
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const away = useRef<Record<number, ReturnType<typeof setTimeout>>>({})
  const startedAt = useRef(0)
  const caughtRef = useRef(0)
  const heartsRef = useRef(HEARTS)
  const overRef = useRef(false)
  /* The board's width decides the spots' size: squares, three to a row. */
  const [cell, setCell] = useState(0)
  const onLayout = (event: LayoutChangeEvent) => setCell(Math.floor((event.nativeEvent.layout.width - GAP * (COLUMNS - 1)) / COLUMNS))

  const clearTimers = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    away.current = {}
  }
  useEffect(() => clearTimers, [])

  const progress = () => Math.min(1, Math.max(0, (Date.now() - startedAt.current) / RAMP_MS))
  const lerp = (from: number, to: number) => from + (to - from) * progress()

  /* A heart lost; the last one ends the round with the catches so far. */
  const miss = useCallback(() => {
    if (overRef.current) return
    heartsRef.current -= 1
    setHearts(heartsRef.current)
    if (heartsRef.current > 0) return
    overRef.current = true
    clearTimers()
    place({})
    setPhase('over')
    onFinish(caughtRef.current)
  }, [onFinish])

  const start = () => {
    setPhase('playing')
    setCaught(0)
    caughtRef.current = 0
    setHearts(HEARTS)
    heartsRef.current = HEARTS
    overRef.current = false
    place({})
    startedAt.current = Date.now()
    const without = (spot: number) => Object.fromEntries(Object.entries(held.current).filter(([key]) => Number(key) !== spot)) as Record<number, true>
    const pop = () => {
      if (overRef.current) return
      const free = Array.from({ length: SPOTS }, (_, index) => index).filter((index) => !held.current[index])
      if (free.length > 0) {
        const spot = free[Math.floor(Math.random() * free.length)]!
        /* Left alone, the acorn goes and takes a heart with it. */
        const gone = setTimeout(() => {
          delete away.current[spot]
          if (!held.current[spot]) return
          place(without(spot))
          miss()
        }, lerp(STAY_FROM, STAY_TO))
        timers.current.push(gone)
        away.current[spot] = gone
        place({ ...held.current, [spot]: true })
      }
      const next = setTimeout(pop, lerp(POP_FROM, POP_TO))
      timers.current.push(next)
    }
    pop()
  }

  /* A tap: an acorn there is a catch, an empty spot a miss. */
  const tapAt = useCallback(
    (spot: number) => {
      if (overRef.current) return
      if (!held.current[spot]) {
        miss()
        return
      }
      const gone = away.current[spot]
      if (gone) {
        clearTimeout(gone)
        delete away.current[spot]
      }
      caughtRef.current += 1
      setCaught(caughtRef.current)
      place(Object.fromEntries(Object.entries(held.current).filter(([key]) => Number(key) !== spot)) as Record<number, true>)
    },
    [miss],
  )

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
      <View style={styles.board} onLayout={onLayout} accessibilityRole="none">
        {cell > 0 ? Array.from({ length: SPOTS }, (_, spot) => {
          const here = acorns[spot] === true
          return (
            <PressableScale
              key={spot}
              scaleTo={0.9}
              pressedFill="transparent"
              ripple={false}
              disabled={phase !== 'playing'}
              accessibilityLabel={here ? t('mobile:elf.gameAcornAria') : t('mobile:elf.gameSpotAria')}
              onPress={() => tapAt(spot)}
              style={[styles.spot, { width: cell, height: cell }]}
            >
              {here ? (
                <Animated.View entering={ZoomIn.duration(160)} exiting={ZoomOut.duration(120)}>
                  <AcornsIcon size={Math.round(cell * 0.45)} weight="fill" color={colors.accentStrong} />
                </Animated.View>
              ) : null}
            </PressableScale>
          )
        }) : null}
      </View>
      {phase === 'ready' ? (
        <View style={styles.ready}>
          <Text tone="soft" align="center">
            {t('mobile:elf.gameAcornsHow')}
          </Text>
          <Button variant="primary" block onPress={start}>
            {t('mobile:elf.gameStart')}
          </Button>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  column: {
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
  board: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  spot: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ready: {
    gap: space.md,
  },
})
