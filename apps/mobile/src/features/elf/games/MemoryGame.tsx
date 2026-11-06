import { useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import Animated, { FadeIn, FlipInEasyY } from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { AcornsIcon, BathIcon, DustIcon, EggIcon, GiftIcon, JarIcon, LetterIcon, PressableScale, StreakIcon, Text, ToyIcon, colors, radius, space, type Icon } from '../../../ui'
import { GameStartCard, fitCell } from './GameStartCard'
import { useGameSound } from './GameSounds'

/* Memory: cards face down in pairs of the elf's own pictures (the
   acorns, the dust, the streak, a gift, a toy, a bath, an egg, a jar, a
   letter; the meal's picture is the acorn too, so it stays out). Two cards turn per move; a pair stays, a miss turns back
   after a moment. A round climbs through boards that grow (four pairs,
   then six, eight and ten), each with as many misses allowed as it has
   pairs and two more: the last pair of a board opens the next after a
   breath, one miss too many ends the round, and the last board's last
   pair ends it in glory. Every pair found is a point and every board
   cleared two more; the rules pay an acorn a point (GAME_POINTS_PER_ACORN).
   The cards fit the room they have, width and height, and how to play
   waits over the first board with the start (GameStartCard). A card
   turned, up or back, is a soft paper flick, a pair a rising "ding-ding"
   and a board cleared a little climb of notes (GameSounds). */

const FACES: Icon[] = [AcornsIcon, DustIcon, StreakIcon, GiftIcon, ToyIcon, BathIcon, EggIcon, JarIcon, LetterIcon]
/* The boards of a round, each with its pairs and its columns. */
const STAGES = [
  { pairs: 4, columns: 4 },
  { pairs: 6, columns: 3 },
  { pairs: 8, columns: 4 },
  { pairs: 10, columns: 4 },
] as const
const SPARE_MISSES = 2
const CLEARED_BONUS = 2
const MISS_MS = 700
/* The breath between a board cleared and the next. */
const NEXT_MS = 1100
const GAP = 8

type Props = { onFinish: (points: number) => void }

function shuffled<T>(items: T[]): T[] {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[other]] = [copy[other]!, copy[index]!]
  }
  return copy
}

/* A board's deck: its pairs' faces drawn from the nine, twice each, shuffled. */
function deal(pairs: number): number[] {
  const faces = shuffled(FACES.map((_, index) => index)).slice(0, pairs)
  return shuffled([...faces, ...faces])
}

export function MemoryGame({ onFinish }: Props) {
  const { t } = useTranslation()
  const play = useGameSound()
  const [stage, setStage] = useState(0)
  const spec = STAGES[stage]!
  const deck = useMemo(() => deal(spec.pairs), [spec.pairs, stage])
  const [up, setUp] = useState<number[]>([])
  const [matched, setMatched] = useState<number[]>([])
  const [misses, setMisses] = useState(0)
  const [points, setPoints] = useState(0)
  /* Between boards: the cleared one stays shown for a breath. */
  const [cleared, setCleared] = useState(false)
  /* The first board waits under how to play until the start. */
  const [started, setStarted] = useState(false)
  const miss = useRef<ReturnType<typeof setTimeout> | null>(null)
  const next = useRef<ReturnType<typeof setTimeout> | null>(null)
  const done = useRef(false)
  /* The board's room decides the cards' size: squares, the board's
     columns to a row, as large as both the width and the height allow. */
  const [room, setRoom] = useState({ width: 0, height: 0 })
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setRoom((current) => (current.width === width && current.height === height ? current : { width, height }))
  }
  const cell = fitCell(room.width, room.height, spec.columns, Math.ceil(deck.length / spec.columns), GAP)
  const allowed = spec.pairs + SPARE_MISSES
  useEffect(
    () => () => {
      if (miss.current) clearTimeout(miss.current)
      if (next.current) clearTimeout(next.current)
    },
    [],
  )

  const finish = (score: number) => {
    if (done.current) return
    done.current = true
    onFinish(score)
  }

  const turn = (index: number) => {
    if (!started || cleared || done.current || up.length === 2 || up.includes(index) || matched.includes(index)) return
    const now = [...up, index]
    setUp(now)
    play('flip')
    if (now.length < 2) return
    const [first, second] = now as [number, number]
    if (deck[first] === deck[second]) {
      const all = [...matched, first, second]
      const score = points + 1
      setMatched(all)
      setUp([])
      setPoints(score)
      if (all.length < deck.length) {
        play('right')
        return
      }
      /* The board is cleared: the bonus, then the next board or the end. */
      const total = score + CLEARED_BONUS
      setPoints(total)
      if (stage + 1 >= STAGES.length) {
        play('right')
        finish(total)
        return
      }
      play('cleared')
      setCleared(true)
      next.current = setTimeout(() => {
        next.current = null
        setStage(stage + 1)
        setMatched([])
        setMisses(0)
        setCleared(false)
      }, NEXT_MS)
    } else {
      const missed = misses + 1
      setMisses(missed)
      if (missed > allowed) {
        finish(points)
        return
      }
      miss.current = setTimeout(() => {
        play('flip')
        setUp([])
      }, MISS_MS)
    }
  }

  return (
    <View style={styles.column}>
      <View style={styles.bar}>
        <Text variant="small" weight="bold">
          {t('mobile:elf.gameMemoryStage', { stage: stage + 1, total: STAGES.length })}
        </Text>
        <Text variant="small" weight="bold" accessibilityLiveRegion="polite">
          {t('mobile:elf.gameMemoryPairs', { found: matched.length / 2, total: spec.pairs })}
        </Text>
        <Text variant="small" weight="bold" tone={misses >= allowed ? 'danger' : 'ink'} accessibilityLiveRegion="polite">
          {t('mobile:elf.gameMemoryMisses', { count: misses, max: allowed })}
        </Text>
      </View>
      <View style={styles.stage} onLayout={onLayout}>
        <View key={stage} style={[styles.board, { width: cell * spec.columns + GAP * (spec.columns - 1) }]}>
          {cell > 0
            ? deck.map((face, index) => {
                const shown = up.includes(index) || matched.includes(index)
                const Glyph = FACES[face]!
                return (
                  <PressableScale
                    key={index}
                    scaleTo={0.94}
                    pressedFill="transparent"
                    ripple={false}
                    disabled={!started || shown || cleared}
                    accessibilityLabel={t('mobile:elf.gameCardAria', { n: index + 1 })}
                    accessibilityState={{ selected: shown }}
                    onPress={() => turn(index)}
                    style={[styles.card, { width: cell, height: cell }, shown && styles.cardUp, matched.includes(index) && styles.cardMatched]}
                  >
                    {shown ? (
                      <Animated.View entering={FlipInEasyY.duration(220)}>
                        <Glyph size={Math.round(cell * 0.5)} weight="duotone" color={matched.includes(index) ? colors.accentInk : colors.accentStrong} />
                      </Animated.View>
                    ) : (
                      <View style={styles.back} />
                    )}
                  </PressableScale>
                )
              })
            : null}
        </View>
        {!started ? <GameStartCard how={t('mobile:elf.gameMemoryHow')} onStart={() => setStarted(true)} /> : null}
      </View>
      {cleared ? (
        <Animated.View entering={FadeIn.duration(200)} accessibilityLiveRegion="polite">
          <Text weight="bold" tone="accent" align="center">
            {t('mobile:elf.gameMemoryCleared')}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  column: {
    flex: 1,
    gap: space.md,
  },
  /* The room the board has: it is centred in it at the size that fits. */
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  board: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.accentWash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardUp: {
    backgroundColor: colors.surface,
    borderColor: colors.accentStrong,
  },
  cardMatched: {
    backgroundColor: colors.accentStrong,
  },
  /* The face-down side: a smaller rounded square, like a leaf on the card. */
  back: {
    width: '45%',
    height: '45%',
    borderRadius: radius.control,
    borderWidth: 2,
    borderColor: colors.accentStrong,
    opacity: 0.5,
  },
})
