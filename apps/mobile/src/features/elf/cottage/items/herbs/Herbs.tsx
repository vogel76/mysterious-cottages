import { useMemo } from 'react'
import { Group, Line, Path, Rect, vec } from '@shopify/react-native-skia'
import { withAlpha } from '../../../../../ui'
import type { Slot } from '../../room'
import { PALETTE, svgPath } from '../draw'
import type { FireMotion } from '../Fireplace'

/* The default of the herbs slot: bundles of dried herbs hanging head-down
   from a hook on the wall, sage, lavender and a rusty sprig of something
   gathered in summer, each tied with a twist of twine and swinging a
   little off the vertical. The anchor is where the lowest leaves end;
   the hook is 130 units above it. */

const BUNDLES: ReadonlyArray<{ x: number; tilt: number; stem: string; leaf: string; tip: string }> = [
  { x: -42, tilt: -0.12, stem: '#5a6a3a', leaf: '#7a8a5a', tip: '#9aa87a' },
  { x: 0, tilt: 0.04, stem: '#5a4a6a', leaf: '#7a6a9a', tip: '#a88ac8' },
  { x: 40, tilt: 0.14, stem: '#6a4a2a', leaf: '#8a6a3a', tip: '#b8904a' },
]

/* Sprigs from the tie downwards, each a stem with leaves on both sides. */
const SPRIG = 'M 0 0 L -4 110 M 0 0 L 6 112 M 0 0 L 0 118'
const LEAVES =
  'M -3 30 q -12 6 -14 20 q 10 -4 14 -16 Z M 3 36 q 12 6 14 20 q -10 -4 -14 -16 Z M -4 56 q -14 6 -16 22 q 12 -4 16 -18 Z M 5 62 q 14 6 16 22 q -12 -4 -16 -18 Z M -4 82 q -12 6 -12 20 q 10 -6 12 -16 Z M 5 86 q 12 6 12 20 q -10 -6 -12 -16 Z'
const TIPS = 'M -4 104 q -6 6 -4 14 q 6 -4 4 -14 Z M 6 106 q 6 6 4 14 q -6 -4 -4 -14 Z M 0 110 q -4 8 0 16 q 4 -8 0 -16 Z'

/* From the hook's curl down to the lowest tips, the outer bundles' leaves at the sides. */
export const HERBS_HERBS_BOUNDS = { x: -64, y: -146, width: 128, height: 148 }

export function HerbsHerbs({ slot }: { slot: Slot; fire: FireMotion }) {
  const sprig = useMemo(() => svgPath(SPRIG), [])
  const leaves = useMemo(() => svgPath(LEAVES), [])
  const tips = useMemo(() => svgPath(TIPS), [])
  const hook = useMemo(() => svgPath('M -6 -2 Q 0 -14 6 -2 M 0 -2 L 0 6'), [])

  return (
    <Group transform={[{ translateX: slot.x }, { translateY: slot.y - 130 }]}>
      <Path path={hook} style="stroke" strokeWidth={4} strokeCap="round" color="#2a2a2e" />
      {BUNDLES.map((bundle) => (
        <Group key={bundle.x}>
          <Line p1={vec(0, 4)} p2={vec(bundle.x, 18)} strokeWidth={2} color={withAlpha(PALETTE.cream, 0.55)} />
          <Group transform={[{ translateX: bundle.x }, { translateY: 18 }, { rotate: bundle.tilt }]}>
            <Path path={sprig} style="stroke" strokeWidth={3} strokeCap="round" color={bundle.stem} />
            <Path path={leaves} color={bundle.leaf} />
            <Path path={tips} color={bundle.tip} />
            <Rect x={-7} y={6} width={14} height={8} color={PALETTE.accent} />
          </Group>
        </Group>
      ))}
    </Group>
  )
}
