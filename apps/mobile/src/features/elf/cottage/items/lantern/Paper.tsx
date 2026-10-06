import { useMemo } from 'react'
import { Circle, Group, Line, LinearGradient, Oval, Path, RadialGradient, RoundedRect, vec } from '@shopify/react-native-skia'
import { useDerivedValue } from 'react-native-reanimated'
import { withAlpha } from '../../../../../ui'
import type { Slot } from '../../room'
import { PALETTE, svgPath } from '../draw'
import type { FireMotion } from '../Fireplace'

/* A round paper lantern in warm red hanging from the beam on a cord, with
   bamboo ribs showing through the paper, brass caps and a golden tassel.
   The flame inside is never seen; it shows as the paper glowing from
   within and the halo on the wall, both breathing with the candle value
   of the fire motion; the cord and the body hang on its swing value and
   pivot at the cord's top when a tap on the slot kicks it. The anchor is
   the end of the tassel; the cord starts 280 units above it. */

/* The swing value is -1..1; this is the full lean in radians. */
const SWING_RAD = 0.12

const BODY = { x: -50, y: -130, width: 100, height: 100 }
const RIBS = 'M -34 -124 Q -46 -80 -34 -36 M -14 -129 Q -20 -80 -14 -31 M 14 -129 Q 20 -80 14 -31 M 34 -124 Q 46 -80 34 -36'
const THREADS = 'M -5 -8 L -7 1 M 0 -8 L 0 2 M 5 -8 L 7 1'

/* The cord's top to the tassel's end, the paper body at the sides; the halo is light, not body. */
export const LANTERN_PAPER_BOUNDS = { x: -50, y: -280, width: 100, height: 282 }

export function LanternPaper({ slot, fire }: { slot: Slot; fire: FireMotion }) {
  const ribs = useMemo(() => svgPath(RIBS), [])
  const threads = useMemo(() => svgPath(THREADS), [])

  const { candle, swing } = fire
  const glowOpacity = useDerivedValue(() => 0.55 + 0.45 * candle.value)
  const paperLight = useDerivedValue(() => 0.12 + 0.26 * candle.value)
  const swingTransform = useDerivedValue(() => [{ rotate: swing.value * SWING_RAD }])

  return (
    <Group transform={[{ translateX: slot.x }, { translateY: slot.y }]}>
      <Circle cx={0} cy={-80} r={130} opacity={glowOpacity}>
        <RadialGradient c={vec(0, -80)} r={130} colors={[withAlpha(PALETTE.fire, 0.38), 'transparent']} />
      </Circle>

      {/* Everything that hangs swings around the cord's top. */}
      <Group transform={swingTransform} origin={vec(0, -280)}>
        {/* The cord and the top cap. */}
        <Line p1={vec(0, -280)} p2={vec(0, -134)} strokeWidth={3} color="#5a2626" />
        <RoundedRect x={-16} y={-142} width={32} height={14} r={3} color={PALETTE.accent} />

        {/* The paper body, lit from inside, with its ribs. */}
        <Oval x={BODY.x} y={BODY.y} width={BODY.width} height={BODY.height}>
          <RadialGradient c={vec(-4, -92)} r={76} colors={['#ff9a5a', '#d8402a', '#8a1f1a']} positions={[0, 0.55, 1]} />
        </Oval>
        <Oval x={BODY.x} y={BODY.y} width={BODY.width} height={BODY.height} color={PALETTE.fireLight} opacity={paperLight} />
        <Path path={ribs} style="stroke" strokeWidth={2.5} color={withAlpha('#5a1210', 0.55)} />
        <Oval x={-30} y={-122} width={18} height={30} color={withAlpha('#ffffff', 0.16)} />

        {/* The bottom cap and the tassel. */}
        <RoundedRect x={-14} y={-34} width={28} height={12} r={3} color={PALETTE.accent} />
        <Line p1={vec(0, -22)} p2={vec(0, -10)} strokeWidth={3} color={PALETTE.accent} />
        <Circle cx={0} cy={-9} r={4} color="#b98f4e" />
        <Path path={threads} style="stroke" strokeWidth={2} strokeCap="round" color={PALETTE.accent} />
      </Group>
    </Group>
  )
}
