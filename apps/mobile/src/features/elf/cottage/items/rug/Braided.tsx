import { BlurMask, DashPathEffect, Group, Oval, RadialGradient, vec } from '@shopify/react-native-skia'
import { withAlpha } from '../../../../../ui'
import type { Slot } from '../../room'
import { PALETTE } from '../draw'
import type { FireMotion } from '../Fireplace'

/* The round braided rug the elf stands on, the default of the rug slot,
   seen from the front and a little above, so it is a wide ellipse. Its
   rings alternate rust, straw, moss and a dark brown, with a dashed stroke
   along each seam for the braid, a soft shadow underneath and a shading
   that darkens its far edge so it lies on the floor instead of floating.
   The anchor is its centre, which is also the elf's feet. */

export const RUG_BRAIDED_BOUNDS = { x: -306, y: -112, width: 612, height: 236 } as const

const RINGS: ReadonlyArray<{ rx: number; ry: number; color: string }> = [
  { rx: 300, ry: 112, color: '#7e3b2e' },
  { rx: 252, ry: 94, color: '#b98f4e' },
  { rx: 204, ry: 76, color: '#4d6b4a' },
  { rx: 156, ry: 58, color: '#a85a40' },
  { rx: 108, ry: 40, color: PALETTE.accent },
  { rx: 60, ry: 22, color: '#5e4027' },
]

export function RugBraided({ slot }: { slot: Slot; fire: FireMotion }) {
  return (
    <Group transform={[{ translateX: slot.x }, { translateY: slot.y }]}>
      <Oval x={-306} y={-104} width={612} height={236} color={withAlpha('#000000', 0.32)}>
        <BlurMask blur={14} style="normal" />
      </Oval>
      {RINGS.map((ring) => (
        <Oval key={ring.rx} x={-ring.rx} y={-ring.ry} width={ring.rx * 2} height={ring.ry * 2} color={ring.color} />
      ))}
      <Group style="stroke" strokeWidth={5} color={withAlpha('#2a1a0c', 0.3)}>
        <Oval x={-300} y={-112} width={600} height={224}>
          <DashPathEffect intervals={[14, 10]} />
        </Oval>
      </Group>
      {RINGS.slice(1).map((ring) => (
        <Oval key={ring.rx} x={-ring.rx} y={-ring.ry} width={ring.rx * 2} height={ring.ry * 2} style="stroke" strokeWidth={4} color={withAlpha('#2a1a0c', 0.28)}>
          <DashPathEffect intervals={[12, 9]} phase={ring.rx % 7} />
        </Oval>
      ))}
      <Oval x={-300} y={-112} width={600} height={224}>
        <RadialGradient c={vec(0, 30)} r={300} colors={['transparent', withAlpha('#1a0e06', 0.35)]} positions={[0.55, 1]} />
      </Oval>
      <Oval x={-300} y={-112} width={600} height={224} opacity={0.5} blendMode="overlay">
        <RadialGradient c={vec(140, 0)} r={320} colors={[withAlpha(PALETTE.fire, 0.4), 'transparent']} />
      </Oval>
    </Group>
  )
}
