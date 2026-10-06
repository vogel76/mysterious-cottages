import { useMemo } from 'react'
import { Circle, DashPathEffect, Group, Line, Path, vec } from '@shopify/react-native-skia'
import { withAlpha } from '../../../../../ui'
import type { Slot } from '../../room'
import { PALETTE, svgPath } from '../draw'
import type { FireMotion } from '../Fireplace'

/* A dreamcatcher on the hook: a willow hoop wrapped in a spiral of thread,
   a web of three rings on eight spokes with a red bead at its heart, and
   three feathers (cream, sage and lavender) hanging from the rim on
   threads with a bead each. The web is computed once from the hoop's
   radius. The anchor is where the lowest feather ends; the hook is 130
   units above it. */

const HOOP = { cx: 0, cy: 52, r: 36 }

/* Eight points around the hoop's centre at a given radius, inner rings turned half a step. */
function ring(radius: number, turn: number): string[] {
  return Array.from({ length: 8 }, (_, i) => {
    const angle = ((i + turn) / 8) * Math.PI * 2
    return `${(HOOP.cx + Math.cos(angle) * radius).toFixed(1)} ${(HOOP.cy + Math.sin(angle) * radius).toFixed(1)}`
  })
}
const WEB = [
  ...[33, 22, 11].map((radius, i) => {
    const points = ring(radius, i % 2 ? 0.5 : 0)
    return `M ${points[0]} L ${points.slice(1).join(' L ')} Z`
  }),
  ...ring(33, 0).map((point) => `M ${HOOP.cx} ${HOOP.cy} L ${point}`),
].join(' ')

const FEATHERS: ReadonlyArray<{ x: number; top: number; tilt: number; color: string }> = [
  { x: -27, top: 98, tilt: -0.14, color: '#e8dcc0' },
  { x: 0, top: 104, tilt: 0, color: '#9aa87a' },
  { x: 27, top: 98, tilt: 0.14, color: '#a88ac8' },
]
const THREADS = 'M -25 78 L -27 98 M 0 88 L 0 104 M 25 78 L 27 98'
const FEATHER = 'M 0 0 C -8 8 -8 20 0 28 C 8 20 8 8 0 0 Z'
const VANE = 'M 0 2 L 0 26 M -3 10 L 0 14 M 3 10 L 0 14 M -3 18 L 0 21 M 3 18 L 0 21'
const BEADS = FEATHERS.map((feather) => `M ${feather.x - 3} ${feather.top} a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0 Z`).join(' ')

/* From the hook's curl to the middle feather's tip, the hoop at the sides. */
export const HERBS_DREAMCATCHER_BOUNDS = { x: -44, y: -146, width: 88, height: 148 }

export function HerbsDreamcatcher({ slot }: { slot: Slot; fire: FireMotion }) {
  const hook = useMemo(() => svgPath('M -6 -2 Q 0 -14 6 -2 M 0 -2 L 0 6'), [])
  const web = useMemo(() => svgPath(WEB), [])
  const threads = useMemo(() => svgPath(THREADS), [])
  const feather = useMemo(() => svgPath(FEATHER), [])
  const vane = useMemo(() => svgPath(VANE), [])
  const beads = useMemo(() => svgPath(BEADS), [])

  return (
    <Group transform={[{ translateX: slot.x }, { translateY: slot.y - 130 }]}>
      <Path path={hook} style="stroke" strokeWidth={4} strokeCap="round" color="#2a2a2e" />
      <Line p1={vec(0, 4)} p2={vec(0, HOOP.cy - HOOP.r)} strokeWidth={2} color={withAlpha(PALETTE.cream, 0.6)} />

      {/* The hoop and its wrapping, then the web. */}
      <Circle cx={HOOP.cx} cy={HOOP.cy} r={HOOP.r} style="stroke" strokeWidth={6} color={PALETTE.beam} />
      <Circle cx={HOOP.cx} cy={HOOP.cy} r={HOOP.r} style="stroke" strokeWidth={6} color={withAlpha(PALETTE.accent, 0.8)}>
        <DashPathEffect intervals={[5, 11]} />
      </Circle>
      <Path path={web} style="stroke" strokeWidth={1.2} color={withAlpha(PALETTE.cream, 0.7)} />
      <Circle cx={HOOP.cx} cy={HOOP.cy} r={4} color="#a85050" />

      {/* The threads, their beads and the feathers. */}
      <Path path={threads} style="stroke" strokeWidth={1.5} color={withAlpha(PALETTE.cream, 0.6)} />
      <Path path={beads} color={PALETTE.accent} />
      {FEATHERS.map((item) => (
        <Group key={item.x} transform={[{ translateX: item.x }, { translateY: item.top + 3 }, { rotate: item.tilt }]}>
          <Path path={feather} color={item.color} />
          <Path path={vane} style="stroke" strokeWidth={1} color={withAlpha('#3a2616', 0.35)} />
        </Group>
      ))}
    </Group>
  )
}
