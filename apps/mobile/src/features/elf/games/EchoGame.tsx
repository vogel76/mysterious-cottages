import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import { useTranslation } from 'react-i18next'
import { AcornsIcon, Button, DustIcon, ForestIcon, JoyIcon, PressableScale, Text, colors, radius, space, type Icon } from '../../../ui'

/* The forest echo: four tiles with the elf's pictures, and a melody the
   elf hums by lighting them one after another; the player echoes it by
   tapping the tiles in the same order. Each round the melody grows by
   one note (the earlier notes stay), and a round echoed right is a
   point; a wrong tile ends the round with the points so far, and the
   melody cannot grow past its longest. Between the humming and the
   echo the line under the tiles says whose turn it is. All timing runs
   on timers in this component and dies with it. */

const TILES: { Glyph: Icon; tint: string }[] = [
  { Glyph: AcornsIcon, tint: colors.accent },
  { Glyph: ForestIcon, tint: colors.success },
  { Glyph: DustIcon, tint: colors.accentStrong },
  { Glyph: JoyIcon, tint: colors.danger },
]
const LONGEST = 20
/* How long a note lights, the gap between notes, and the breath before
   the elf hums and before the next round. */
const NOTE_MS = 520
const GAP_MS = 180
const BREATH_MS = 700
const COLUMNS = 2
const GAP = 12

type Props = { onFinish: (points: number) => void }

type Phase = 'ready' | 'humming' | 'echo' | 'over'

export function EchoGame({ onFinish }: Props) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState<Phase>('ready')
  const [melody, setMelody] = useState<number[]>([])
  const [lit, setLit] = useState<number | null>(null)
  const [points, setPoints] = useState(0)
  const echoed = useRef(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const overRef = useRef(false)
  const [cell, setCell] = useState(0)
  const onLayout = (event: LayoutChangeEvent) => setCell(Math.floor((event.nativeEvent.layout.width - GAP * (COLUMNS - 1)) / COLUMNS))

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

  /* The elf hums the melody, one note at a time, then hands over. */
  const hum = (notes: number[]) => {
    setPhase('humming')
    echoed.current = 0
    notes.forEach((tile, index) => {
      later(BREATH_MS + index * (NOTE_MS + GAP_MS), () => setLit(tile))
      later(BREATH_MS + index * (NOTE_MS + GAP_MS) + NOTE_MS, () => setLit(null))
    })
    later(BREATH_MS + notes.length * (NOTE_MS + GAP_MS), () => setPhase('echo'))
  }

  const grow = (notes: number[]) => {
    const next = [...notes, Math.floor(Math.random() * TILES.length)]
    setMelody(next)
    hum(next)
  }

  const start = () => {
    overRef.current = false
    setPoints(0)
    grow([])
  }

  const finish = (score: number) => {
    if (overRef.current) return
    overRef.current = true
    setPhase('over')
    setLit(null)
    onFinish(score)
  }

  const tap = (tile: number) => {
    if (phase !== 'echo' || overRef.current) return
    setLit(tile)
    later(NOTE_MS / 2, () => setLit(null))
    if (melody[echoed.current] !== tile) {
      finish(points)
      return
    }
    echoed.current += 1
    if (echoed.current < melody.length) return
    /* The whole melody echoed: a point, and a longer one. */
    const score = points + 1
    setPoints(score)
    if (melody.length >= LONGEST) {
      finish(score)
      return
    }
    setPhase('humming')
    later(BREATH_MS, () => grow(melody))
  }

  return (
    <View style={styles.column}>
      <View style={styles.bar}>
        <Text variant="small" weight="bold" accessibilityLiveRegion="polite">
          {t('mobile:elf.gameEchoRound', { count: points })}
        </Text>
        <Text variant="small" weight="bold" tone={phase === 'echo' ? 'accent' : 'soft'} accessibilityLiveRegion="polite">
          {phase === 'humming' ? t('mobile:elf.gameEchoListen') : phase === 'echo' ? t('mobile:elf.gameEchoYourTurn') : ''}
        </Text>
      </View>
      <View style={styles.board} onLayout={onLayout}>
        {cell > 0
          ? TILES.map(({ Glyph, tint }, index) => {
              const on = lit === index
              return (
                <PressableScale
                  key={index}
                  scaleTo={0.94}
                  pressedFill="transparent"
                  ripple={false}
                  disabled={phase !== 'echo'}
                  accessibilityLabel={t('mobile:elf.gameEchoTileAria', { n: index + 1 })}
                  onPress={() => tap(index)}
                  style={[styles.tile, { width: cell, height: cell, borderColor: tint }, on && { backgroundColor: tint }]}
                >
                  <Glyph size={Math.round(cell * 0.45)} weight={on ? 'fill' : 'duotone'} color={on ? colors.accentInk : tint} />
                </PressableScale>
              )
            })
          : null}
      </View>
      {phase === 'ready' ? (
        <View style={styles.ready}>
          <Text tone="soft" align="center">
            {t('mobile:elf.gameEchoHow')}
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
    gap: space.md,
  },
  board: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  tile: {
    borderRadius: radius.card,
    borderWidth: 2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ready: {
    gap: space.md,
  },
})
