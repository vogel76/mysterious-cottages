import { useCallback, useEffect, useRef, useState } from 'react'
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import Animated, { FadeOut, ZoomIn, ZoomOut } from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { AcornsIcon, CloseIcon, JoyIcon, PressableScale, Text, colors, iconSize, radius, space } from '../../../ui'
import { GameStartCard, fitCell } from './GameStartCard'
import { useGameSound } from './GameSounds'

/* Catch the acorns: twelve spots in a grid, acorns popping up on them and
   vanishing again unless tapped, coming faster and staying shorter as the
   round goes on, and more of them at once: one at a time at first, often
   two after a quarter of a minute, up to three at once by the end of the
   first minute, the quickest pace. The round has no clock: it ends when
   three hearts are lost, one for every acorn that gets away and one for
   every tap on an empty spot, so a round is as long as the thumb is
   quick. A catch is a point; the rules pay an acorn for two
   (GAME_POINTS_PER_ACORN). A heart lost is shown where it went: an acorn
   that gets away shrinks out and leaves a red cross on its spot for a
   moment, and a tap on an empty spot draws the same cross there, so the
   lost heart is never a puzzle. The board fits the room it has, width and
   height, and how to play waits over it with the start (GameStartCard).
   A catch is heard as a soft bloop and a heart lost as a muffled bump
   (GameSounds). All timing runs on timers in this component and dies
   with it. */

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
/* How many acorns a pop brings: from this share of the ramp on, a second
   one now and then, from the next a third; a pop of several waits a
   little longer before the next, so a burst can be cleared. */
const SECOND_FROM = 0.25
const THIRD_FROM = 0.6
const BURST_BREATH = 1.4
/* A tap this soon after an acorn went is the late tap at it, not a tap
   on an empty spot: the acorn took its heart already. */
const GRACE_MS = 250
/* How long the cross of a lost heart stays on its spot. */
const MARK_MS = 550
const GAP = 8

type Props = { onFinish: (points: number) => void }

type Phase = 'ready' | 'playing' | 'over'

export function AcornsGame({ onFinish }: Props) {
  const { t } = useTranslation()
  const play = useGameSound()
  const [phase, setPhase] = useState<Phase>('ready')
  const [caught, setCaught] = useState(0)
  const [hearts, setHearts] = useState(HEARTS)
  /* Which spots hold an acorn right now: the state draws them, the ref
     answers the taps and the timers without a setter's updater (which
     must stay free of side effects). */
  const [acorns, setAcorns] = useState<Record<number, true>>({})
  /* The crosses of the hearts lost, by spot, each numbered so a second
     one on the same spot enters anew. */
  const [marks, setMarks] = useState<Record<number, number>>({})
  const markSeq = useRef(0)
  const held = useRef<Record<number, true>>({})
  const place = (next: Record<number, true>) => {
    held.current = next
    setAcorns(next)
  }
  /* Every timer of the round, and the timer that takes each acorn away. */
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const away = useRef<Record<number, ReturnType<typeof setTimeout>>>({})
  const vanishedAt = useRef<Record<number, number>>({})
  const startedAt = useRef(0)
  const caughtRef = useRef(0)
  const heartsRef = useRef(HEARTS)
  const overRef = useRef(false)
  /* The board's room decides the spots' size: squares, three to a row,
     as large as both the width and the height allow. */
  const [room, setRoom] = useState({ width: 0, height: 0 })
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setRoom((current) => (current.width === width && current.height === height ? current : { width, height }))
  }
  const cell = fitCell(room.width, room.height, COLUMNS, ROWS, GAP)

  const clearTimers = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    away.current = {}
  }
  useEffect(() => clearTimers, [])

  const progress = () => Math.min(1, Math.max(0, (Date.now() - startedAt.current) / RAMP_MS))
  const lerp = (from: number, to: number) => from + (to - from) * progress()
  /* How many acorns the next pop brings, as the round goes on. */
  const burst = () => {
    const p = progress()
    let count = 1
    if (p >= SECOND_FROM && Math.random() < 0.35 + 0.5 * p) count += 1
    if (p >= THIRD_FROM && Math.random() < p - 0.3) count += 1
    return count
  }

  /* A cross on the spot, gone after its moment. */
  const mark = (spot: number) => {
    markSeq.current += 1
    const seq = markSeq.current
    setMarks((current) => ({ ...current, [spot]: seq }))
    const timer = setTimeout(() => setMarks((current) => (current[spot] === seq ? Object.fromEntries(Object.entries(current).filter(([key]) => Number(key) !== spot)) : current)), MARK_MS)
    timers.current.push(timer)
  }

  /* A heart lost; the last one ends the round with the catches so far. */
  const miss = useCallback(() => {
    if (overRef.current) return
    play('miss')
    heartsRef.current -= 1
    setHearts(heartsRef.current)
    if (heartsRef.current > 0) return
    overRef.current = true
    clearTimers()
    place({})
    setPhase('over')
    onFinish(caughtRef.current)
  }, [onFinish, play])

  const start = () => {
    setPhase('playing')
    setCaught(0)
    caughtRef.current = 0
    setHearts(HEARTS)
    heartsRef.current = HEARTS
    overRef.current = false
    vanishedAt.current = {}
    place({})
    setMarks({})
    startedAt.current = Date.now()
    const without = (spot: number) => Object.fromEntries(Object.entries(held.current).filter(([key]) => Number(key) !== spot)) as Record<number, true>
    /* One acorn on a free spot; left alone, it goes and takes a heart with it. */
    const popOne = () => {
      const free = Array.from({ length: SPOTS }, (_, index) => index).filter((index) => !held.current[index])
      if (free.length === 0) return
      const spot = free[Math.floor(Math.random() * free.length)]!
      const gone = setTimeout(() => {
        delete away.current[spot]
        if (!held.current[spot]) return
        vanishedAt.current[spot] = Date.now()
        place(without(spot))
        mark(spot)
        miss()
      }, lerp(STAY_FROM, STAY_TO))
      timers.current.push(gone)
      away.current[spot] = gone
      place({ ...held.current, [spot]: true })
    }
    const pop = () => {
      if (overRef.current) return
      const count = burst()
      for (let index = 0; index < count; index += 1) popOne()
      const next = setTimeout(pop, lerp(POP_FROM, POP_TO) * (count > 1 ? BURST_BREATH : 1))
      timers.current.push(next)
    }
    pop()
  }

  /* A tap: an acorn there is a catch, an empty spot a miss. */
  const tapAt = useCallback(
    (spot: number) => {
      if (overRef.current) return
      if (!held.current[spot]) {
        if (Date.now() - (vanishedAt.current[spot] ?? 0) >= GRACE_MS) {
          mark(spot)
          miss()
        }
        return
      }
      const gone = away.current[spot]
      if (gone) {
        clearTimeout(gone)
        delete away.current[spot]
      }
      play('catch')
      caughtRef.current += 1
      setCaught(caughtRef.current)
      place(Object.fromEntries(Object.entries(held.current).filter(([key]) => Number(key) !== spot)) as Record<number, true>)
    },
    [miss, play],
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
      <View style={styles.stage} onLayout={onLayout}>
        <View style={[styles.board, { width: cell * COLUMNS + GAP * (COLUMNS - 1) }]} accessibilityRole="none">
          {cell > 0
            ? Array.from({ length: SPOTS }, (_, spot) => {
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
                      <Animated.View entering={ZoomIn.duration(160)} exiting={ZoomOut.duration(280)}>
                        <AcornsIcon size={Math.round(cell * 0.45)} weight="fill" color={colors.accentStrong} />
                      </Animated.View>
                    ) : null}
                    {marks[spot] !== undefined ? (
                      <Animated.View key={marks[spot]} entering={ZoomIn.duration(140)} exiting={FadeOut.duration(220)} style={styles.mark} pointerEvents="none">
                        <CloseIcon size={Math.round(cell * 0.4)} weight="bold" color={colors.danger} />
                      </Animated.View>
                    ) : null}
                  </PressableScale>
                )
              })
            : null}
        </View>
        {phase === 'ready' ? <GameStartCard how={t('mobile:elf.gameAcornsHow')} onStart={start} /> : null}
      </View>
    </View>
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
  /* The room the board has: it is centred in it at the size that fits. */
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  /* The cross of a lost heart, over the spot. */
  mark: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
