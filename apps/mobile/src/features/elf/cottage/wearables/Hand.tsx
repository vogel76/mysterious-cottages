import { useMemo } from 'react'
import { Circle, Group, Line, Oval, Path, RadialGradient, Rect, RoundedRect, rect, vec, type SkPath } from '@shopify/react-native-skia'
import { useDerivedValue } from 'react-native-reanimated'
import { COLORS, n, svg } from '../puppet/geometry'
import type { WearableProps } from './index'

/* What the elf holds in its right hand, drawn inside the right arm's
   group right after the mitten, so it swings with every wave, scratch and
   clap: a small lantern hanging from the hand with a glow that breathes,
   an acorn, or a closed book. 'none' leaves the hand empty. */

export type HandItemProps = WearableProps & { id: string }

type HandShapes = {
  handle: SkPath
  lantern: { x: number; y: number; width: number; height: number }
  acornCap: SkPath
  flame: SkPath
}

function buildShapes(hand: { x: number; y: number }, handR: number, H: number): HandShapes {
  const top = hand.y + handR * 0.6
  const handle = svg(`M ${n(hand.x)},${n(hand.y)} Q ${n(hand.x + 0.02 * H)},${n(top + 0.01 * H)} ${n(hand.x)},${n(top + 0.03 * H)}`)
  const lantern = { x: hand.x - 0.04 * H, y: top + 0.03 * H, width: 0.08 * H, height: 0.1 * H }
  const acornY = hand.y + handR * 0.8
  const acornCap = svg(`M ${n(hand.x - 0.03 * H)},${n(acornY + 0.01 * H)} Q ${n(hand.x)},${n(acornY - 0.03 * H)} ${n(hand.x + 0.03 * H)},${n(acornY + 0.01 * H)} Q ${n(hand.x)},${n(acornY + 0.02 * H)} ${n(hand.x - 0.03 * H)},${n(acornY + 0.01 * H)} Z`)
  const flameY = lantern.y + lantern.height * 0.75
  const flame = svg(`M ${n(hand.x)},${n(flameY)} C ${n(hand.x - 0.012 * H)},${n(flameY - 0.01 * H)} ${n(hand.x - 0.012 * H)},${n(flameY - 0.03 * H)} ${n(hand.x)},${n(flameY - 0.045 * H)} C ${n(hand.x + 0.012 * H)},${n(flameY - 0.03 * H)} ${n(hand.x + 0.012 * H)},${n(flameY - 0.01 * H)} ${n(hand.x)},${n(flameY)} Z`)
  return { handle, lantern, acornCap, flame }
}

export function HandItem({ id, g, motion }: HandItemProps) {
  const hand = g.hands[1]
  const shapes = useMemo(() => buildShapes(hand, g.handR, g.H), [hand, g.handR, g.H])
  const { breath } = motion
  const glowOpacity = useDerivedValue(() => 0.4 + 0.35 * breath.value)
  const { lantern } = shapes
  const glowCentre = vec(hand.x, lantern.y + lantern.height * 0.55)

  switch (id) {
    case 'lantern':
      return (
        <>
          <Circle cx={glowCentre.x} cy={glowCentre.y} r={0.13 * g.H} opacity={glowOpacity}>
            <RadialGradient c={glowCentre} r={0.13 * g.H} colors={[COLORS.candle + 'aa', COLORS.candle + '00']} />
          </Circle>
          <Path path={shapes.handle} color={COLORS.wire} style="stroke" strokeWidth={g.strokeThin * 0.7} strokeCap="round" />
          <Rect x={lantern.x + 0.008 * g.H} y={lantern.y} width={lantern.width - 0.016 * g.H} height={lantern.height} color={COLORS.candle} />
          <Path path={shapes.flame} color={COLORS.flame} />
          <RoundedRect x={lantern.x} y={lantern.y} width={lantern.width} height={lantern.height} r={0.008 * g.H} color={COLORS.wire} style="stroke" strokeWidth={g.strokeThin * 0.9} />
          <Line p1={vec(lantern.x - 0.006 * g.H, lantern.y)} p2={vec(lantern.x + lantern.width + 0.006 * g.H, lantern.y)} color={COLORS.wire} strokeWidth={g.strokeThin * 1.1} strokeCap="round" />
        </>
      )
    case 'acorn':
      return (
        <>
          <Oval rect={rect(hand.x - 0.026 * g.H, hand.y + g.handR * 0.8 - 0.005 * g.H, 0.052 * g.H, 0.055 * g.H)} color={COLORS.acorn} />
          <Path path={shapes.acornCap} color={COLORS.acornCap} />
          <Line p1={vec(hand.x, hand.y + g.handR * 0.8 - 0.02 * g.H)} p2={vec(hand.x + 0.006 * g.H, hand.y + g.handR * 0.8 - 0.038 * g.H)} color={COLORS.acornCap} strokeWidth={g.strokeThin * 0.8} strokeCap="round" />
        </>
      )
    case 'book':
      return (
        <Group transform={[{ rotate: 0.18 }]} origin={vec(hand.x, hand.y + g.handR)}>
          <RoundedRect x={hand.x - 0.035 * g.H} y={hand.y + g.handR * 0.4} width={0.07 * g.H} height={0.085 * g.H} r={0.006 * g.H} color={COLORS.bookCover} />
          <Rect x={hand.x - 0.028 * g.H} y={hand.y + g.handR * 0.4 + 0.006 * g.H} width={0.056 * g.H} height={0.073 * g.H} color={COLORS.page} />
          <Line p1={vec(hand.x - 0.035 * g.H, hand.y + g.handR * 0.4)} p2={vec(hand.x - 0.035 * g.H, hand.y + g.handR * 0.4 + 0.085 * g.H)} color={COLORS.accent} strokeWidth={g.strokeThin * 0.9} />
        </Group>
      )
    default:
      return null
  }
}
