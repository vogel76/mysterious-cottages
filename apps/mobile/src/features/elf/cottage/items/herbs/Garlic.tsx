import { useMemo } from 'react'
import { Group, Path, Rect } from '@shopify/react-native-skia'
import { withAlpha } from '../../../../../ui'
import type { Slot } from '../../room'
import { PALETTE, svgPath } from '../draw'
import type { FireMotion } from '../Fireplace'

/* A braid of garlic hanging from the hook: a plait of dried stalks twisting
   down with five papery bulbs clustered left and right of it, each with a
   purple blush at its base and a few clove lines. The bulbs are one path
   each for body, blush, lines and sheen, so the braid is nine nodes. The
   anchor is where the lowest bulb ends; the hook is 130 units above it. */

const BULBS: ReadonlyArray<readonly [number, number, number, number]> = [
  [-14, 36, 15, 13],
  [16, 54, 15, 13],
  [-16, 74, 16, 14],
  [15, 92, 16, 14],
  [-3, 112, 17, 15],
]

function ellipse(cx: number, cy: number, rx: number, ry: number): string {
  return `M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${rx * 2} 0 a ${rx} ${ry} 0 1 0 ${-rx * 2} 0 Z`
}

const BRAID = 'M 0 4 C -9 22 9 38 0 56 C -9 74 9 90 0 108 M 0 4 C 9 22 -9 38 0 56 C 9 74 -9 90 0 108'
const BODIES = BULBS.map(([x, y, rx, ry]) => ellipse(x, y, rx, ry)).join(' ')
const BLUSH = BULBS.map(([x, y, rx, ry]) => ellipse(x, y + ry * 0.4, rx * 0.7, ry * 0.45)).join(' ')
const NECKS = BULBS.map(([x, y, , ry]) => `M ${x - 5} ${y - ry + 2} L ${x} ${y - ry - 9} L ${x + 5} ${y - ry + 2} Z`).join(' ')
const LINES = BULBS.map(([x, y, rx, ry]) => `M ${x - rx * 0.45} ${y - ry * 0.8} Q ${x - rx * 0.5} ${y} ${x - rx * 0.35} ${y + ry * 0.85} M ${x + rx * 0.4} ${y - ry * 0.8} Q ${x + rx * 0.45} ${y} ${x + rx * 0.3} ${y + ry * 0.85}`).join(' ')
const SHEEN = BULBS.map(([x, y, rx, ry]) => ellipse(x - rx * 0.35, y - ry * 0.35, rx * 0.22, ry * 0.3)).join(' ')

/* From the hook's curl to the lowest bulb; the braid is narrow. */
export const HERBS_GARLIC_BOUNDS = { x: -36, y: -146, width: 72, height: 146 }

export function HerbsGarlic({ slot }: { slot: Slot; fire: FireMotion }) {
  const hook = useMemo(() => svgPath('M -6 -2 Q 0 -14 6 -2 M 0 -2 L 0 6'), [])
  const braid = useMemo(() => svgPath(BRAID), [])
  const bodies = useMemo(() => svgPath(BODIES), [])
  const blush = useMemo(() => svgPath(BLUSH), [])
  const necks = useMemo(() => svgPath(NECKS), [])
  const lines = useMemo(() => svgPath(LINES), [])
  const sheen = useMemo(() => svgPath(SHEEN), [])

  return (
    <Group transform={[{ translateX: slot.x }, { translateY: slot.y - 130 }]}>
      <Path path={hook} style="stroke" strokeWidth={4} strokeCap="round" color="#2a2a2e" />
      <Path path={braid} style="stroke" strokeWidth={12} strokeCap="round" color="#8a7a50" />
      <Path path={braid} style="stroke" strokeWidth={7} strokeCap="round" color={PALETTE.plaster} />
      <Rect x={-8} y={4} width={16} height={8} color={PALETTE.accent} />
      <Path path={necks} color="#b8a878" />
      <Path path={bodies} color="#efe6d2" />
      <Path path={blush} color={withAlpha('#9a6a9a', 0.28)} />
      <Path path={lines} style="stroke" strokeWidth={1.5} color={withAlpha('#b9ad92', 0.8)} />
      <Path path={sheen} color={withAlpha('#ffffff', 0.5)} />
    </Group>
  )
}
