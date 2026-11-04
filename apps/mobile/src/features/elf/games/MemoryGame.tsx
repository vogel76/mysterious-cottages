import { useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import Animated, { FlipInEasyY } from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { AcornsIcon, BathIcon, DustIcon, EggIcon, FeedIcon, JarIcon, LetterIcon, PressableScale, StreakIcon, Text, ToyIcon, colors, iconSize, radius, space, type Icon } from '../../../ui'

/* Memory: twelve cards face down, six pairs of the elf's own pictures
   (the acorns, the dust, the streak, a meal, a toy, a bath, an egg, a
   jar, a letter: six of them drawn for the round). Two cards turn per
   move; a pair stays, a miss turns back after a moment. The round ends
   with the last pair; its points are twenty-four less the moves, so a
   perfect memory (six moves) nearly reaches the pay's cap. */

const FACES: Icon[] = [AcornsIcon, DustIcon, StreakIcon, FeedIcon, ToyIcon, BathIcon, EggIcon, JarIcon, LetterIcon]
const PAIRS = 6
const COLUMNS = 3
const MISS_MS = 700
const POINTS_FROM = 24
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

export function MemoryGame({ onFinish }: Props) {
  const { t } = useTranslation()
  /* The round's deck: six faces drawn from the nine, twice each, shuffled. */
  const deck = useMemo(() => {
    const faces = shuffled(FACES.map((_, index) => index)).slice(0, PAIRS)
    return shuffled([...faces, ...faces])
  }, [])
  const [up, setUp] = useState<number[]>([])
  const [matched, setMatched] = useState<number[]>([])
  const [moves, setMoves] = useState(0)
  const miss = useRef<ReturnType<typeof setTimeout> | null>(null)
  const done = useRef(false)
  /* The board's width decides the cards' size: squares, three to a row. */
  const [cell, setCell] = useState(0)
  const onLayout = (event: LayoutChangeEvent) => setCell(Math.floor((event.nativeEvent.layout.width - GAP * (COLUMNS - 1)) / COLUMNS))
  useEffect(
    () => () => {
      if (miss.current) clearTimeout(miss.current)
    },
    [],
  )

  const turn = (index: number) => {
    if (up.length === 2 || up.includes(index) || matched.includes(index)) return
    const next = [...up, index]
    setUp(next)
    if (next.length < 2) return
    const movesNow = moves + 1
    setMoves(movesNow)
    const [first, second] = next as [number, number]
    if (deck[first] === deck[second]) {
      const all = [...matched, first, second]
      setMatched(all)
      setUp([])
      if (all.length === deck.length && !done.current) {
        done.current = true
        onFinish(Math.max(0, POINTS_FROM - movesNow))
      }
    } else {
      miss.current = setTimeout(() => setUp([]), MISS_MS)
    }
  }

  return (
    <View style={styles.column}>
      <View style={styles.bar}>
        <Text tone="soft">{t('mobile:elf.gameMemoryHow')}</Text>
        <Text weight="bold" accessibilityLiveRegion="polite">
          {t('mobile:elf.gameMoves', { count: moves })}
        </Text>
      </View>
      <View style={styles.board} onLayout={onLayout}>
        {cell > 0 ? deck.map((face, index) => {
          const shown = up.includes(index) || matched.includes(index)
          const Glyph = FACES[face]!
          return (
            <PressableScale
              key={index}
              scaleTo={0.94}
              pressedFill="transparent"
              ripple={false}
              disabled={shown}
              accessibilityLabel={t('mobile:elf.gameCardAria', { n: index + 1 })}
              accessibilityState={{ selected: shown }}
              onPress={() => turn(index)}
              style={[styles.card, { width: cell, height: cell }, shown && styles.cardUp, matched.includes(index) && styles.cardMatched]}
            >
              {shown ? (
                <Animated.View entering={FlipInEasyY.duration(220)}>
                  <Glyph size={iconSize.xl} weight="duotone" color={matched.includes(index) ? colors.accentInk : colors.accentStrong} />
                </Animated.View>
              ) : (
                <View style={styles.back} />
              )}
            </PressableScale>
          )
        }) : null}
      </View>
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
    gap: space.md,
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
