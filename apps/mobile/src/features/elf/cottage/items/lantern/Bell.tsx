import { useMemo } from 'react'
import { Circle, Group, Line, LinearGradient, Path, RoundedRect, vec } from '@shopify/react-native-skia'
import { useDerivedValue } from 'react-native-reanimated'
import { withAlpha } from '../../../../../ui'
import type { Slot } from '../../room'
import { PALETTE, svgPath } from '../draw'
import type { FireMotion } from '../Fireplace'

/* A brass bell on an iron bracket: a plate screwed to the beam, a shaft
   with a curl ending in a ring, a leather strap and the bell itself with
   a bright shoulder, a dark clapper and a little pull cord with a knot at
   its end. It gives no light, so of the fire motion only the swing is
   read: the bell hangs on it by its strap and rocks around the bracket's
   ring when a tap on the slot kicks it, while the bracket stays screwed to
   the beam. The anchor is the knot of the cord; the bracket starts 280
   units above it. */

/* The swing value is -1..1; this is the full lean in radians. */
const SWING_RAD = 0.12
/* Where the strap hangs from: the bracket's ring. */
const PIVOT = vec(0, -138)

const ARM = 'M 0 -276 L 0 -164 Q -12 -154 0 -144'
const BELL = 'M -8 -120 Q -14 -108 -24 -84 Q -34 -62 -46 -44 L -46 -36 L 46 -36 L 46 -44 Q 34 -62 24 -84 Q 14 -108 8 -120 Z'
const SHOULDER = 'M -22 -84 Q 0 -78 22 -84'
const HIGHLIGHT = 'M -17 -108 Q -27 -80 -36 -50'

/* The bracket's plate to the cord's knot, the rim at the sides. */
export const LANTERN_BELL_BOUNDS = { x: -50, y: -280, width: 100, height: 281 }

export function LanternBell({ slot, fire }: { slot: Slot; fire: FireMotion }) {
  const arm = useMemo(() => svgPath(ARM), [])
  const bell = useMemo(() => svgPath(BELL), [])
  const shoulder = useMemo(() => svgPath(SHOULDER), [])
  const highlight = useMemo(() => svgPath(HIGHLIGHT), [])

  const { swing } = fire
  const swingTransform = useDerivedValue(() => [{ rotate: swing.value * SWING_RAD }])

  return (
    <Group transform={[{ translateX: slot.x }, { translateY: slot.y }]}>
      {/* The iron bracket. */}
      <RoundedRect x={-10} y={-280} width={20} height={44} r={3} color="#26262a" />
      <Path path={arm} style="stroke" strokeWidth={6} strokeCap="round" color="#2a2a2e" />
      <Circle cx={0} cy={-138} r={7} style="stroke" strokeWidth={4} color="#2a2a2e" />

      {/* The strap and everything under it rock around the ring. */}
      <Group transform={swingTransform} origin={PIVOT}>
        <RoundedRect x={-4} y={-136} width={8} height={18} r={2} color={PALETTE.beam} />

        {/* The bell, its rim, shoulder band and shine. */}
        <Path path={bell}>
          <LinearGradient start={vec(-46, 0)} end={vec(46, 0)} colors={['#8a6a2a', '#e2c070', '#b08a3a', '#6a4a1a']} positions={[0, 0.3, 0.7, 1]} />
        </Path>
        <RoundedRect x={-50} y={-40} width={100} height={12} r={4}>
          <LinearGradient start={vec(0, -40)} end={vec(0, -28)} colors={['#d8b45a', '#7a5a22']} />
        </RoundedRect>
        <Path path={shoulder} style="stroke" strokeWidth={3} strokeCap="round" color={withAlpha('#6a4a1a', 0.5)} />
        <Path path={highlight} style="stroke" strokeWidth={4} strokeCap="round" color={withAlpha('#ffffff', 0.3)} />

        {/* The clapper and the pull cord. */}
        <Circle cx={0} cy={-22} r={7} color="#3a3a40" />
        <Line p1={vec(0, -22)} p2={vec(0, -4)} strokeWidth={2.5} color={PALETTE.plaster} />
        <Circle cx={0} cy={-3} r={3.5} color={PALETTE.accent} />
      </Group>
    </Group>
  )
}
