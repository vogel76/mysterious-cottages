import { useCallback, useEffect, useRef, useState } from 'react'
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import Animated, { ZoomIn, ZoomOut } from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { AcornsIcon, Button, GameClockIcon, PressableScale, Text, colors, iconSize, radius, space } from '../../../ui'

/* Catch the acorns: twelve spots in a grid, an acorn popping up on one
   of them every so often and vanishing again unless tapped, thirty
   seconds of it, the pops coming faster and staying shorter as the round
   goes on. A tap on an acorn counts a point; the points of a round are
   half the taps (rounded), so a quick thumb reaches the pay's cap. All
   timing runs on timers in this component and dies with it. */

const ROUND_MS = 30_000
const COLUMNS = 3
const ROWS = 4
const SPOTS = COLUMNS * ROWS
/* A pop every so many milliseconds, and how long it stays, at the start
   and at the end of the round. */
const POP_FROM = 900
const POP_TO = 420
const STAY_FROM = 1300
const STAY_TO = 750
const TICK_MS = 100
const GAP = 8

type Props = { onFinish: (points: number) => void }

type Phase = 'ready' | 'playing' | 'over'

export function AcornsGame({ onFinish }: Props) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState<Phase>('ready')
  const [left, setLeft] = useState(ROUND_MS)
  const [taps, setTaps] = useState(0)
  /* Which spots hold an acorn right now, with the timer that takes it away. */
  const [acorns, setAcorns] = useState<Record<number, true>>({})
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const endAt = useRef(0)
  const tapsRef = useRef(0)
  /* The board's width decides the spots' size: squares, three to a row. */
  const [cell, setCell] = useState(0)
  const onLayout = (event: LayoutChangeEvent) => setCell(Math.floor((event.nativeEvent.layout.width - GAP * (COLUMNS - 1)) / COLUMNS))

  const clearTimers = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }
  useEffect(() => clearTimers, [])

  const progress = () => Math.min(1, Math.max(0, 1 - (endAt.current - Date.now()) / ROUND_MS))
  const lerp = (from: number, to: number) => from + (to - from) * progress()

  const start = () => {
    setPhase('playing')
    setTaps(0)
    tapsRef.current = 0
    setAcorns({})
    endAt.current = Date.now() + ROUND_MS
    setLeft(ROUND_MS)
    const tick = setInterval(() => {
      const remaining = endAt.current - Date.now()
      if (remaining <= 0) {
        clearInterval(tick)
        clearTimers()
        setAcorns({})
        setLeft(0)
        setPhase('over')
        onFinish(Math.round(tapsRef.current / 2))
        return
      }
      setLeft(remaining)
    }, TICK_MS)
    timers.current.push(tick as unknown as ReturnType<typeof setTimeout>)
    const pop = () => {
      if (Date.now() >= endAt.current) return
      setAcorns((current) => {
        const free = Array.from({ length: SPOTS }, (_, index) => index).filter((index) => !current[index])
        if (free.length === 0) return current
        const spot = free[Math.floor(Math.random() * free.length)]!
        const away = setTimeout(() => setAcorns((later) => (later[spot] ? Object.fromEntries(Object.entries(later).filter(([key]) => Number(key) !== spot)) : later)), lerp(STAY_FROM, STAY_TO))
        timers.current.push(away)
        return { ...current, [spot]: true }
      })
      const next = setTimeout(pop, lerp(POP_FROM, POP_TO))
      timers.current.push(next)
    }
    pop()
  }

  const catchAt = useCallback((spot: number) => {
    setAcorns((current) => {
      if (!current[spot]) return current
      tapsRef.current += 1
      setTaps(tapsRef.current)
      return Object.fromEntries(Object.entries(current).filter(([key]) => Number(key) !== spot))
    })
  }, [])

  return (
    <View style={styles.column}>
      <View style={styles.bar}>
        <View style={styles.stat}>
          <GameClockIcon size={iconSize.md} color={colors.accentStrong} />
          <Text weight="bold" accessibilityLiveRegion="polite">
            {t('mobile:elf.gameTime', { count: Math.ceil(left / 1000) })}
          </Text>
        </View>
        <Text weight="bold" accessibilityLiveRegion="polite">
          {t('mobile:elf.gameScore', { count: taps })}
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
              onPress={() => catchAt(spot)}
              style={[styles.spot, { width: cell, height: cell }]}
            >
              {here ? (
                <Animated.View entering={ZoomIn.duration(160)} exiting={ZoomOut.duration(120)}>
                  <AcornsIcon size={40} weight="fill" color={colors.accentStrong} />
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
  stat: {
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
