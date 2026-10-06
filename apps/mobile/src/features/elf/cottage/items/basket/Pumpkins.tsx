import { useMemo } from 'react'
import { BlurMask, Group, LinearGradient, Oval, Path, RadialGradient, vec } from '@shopify/react-native-skia'
import { withAlpha } from '../../../../../ui'
import type { Slot } from '../../room'
import { buildPath, svgPath } from '../draw'
import type { FireMotion } from '../Fireplace'

/* Three small pumpkins and a striped gourd heaped beside the hearth, in
   place of the acorn basket: round orange bodies with curved ribs and a
   stubby stem each, the biggest in front, and a bottle-shaped gourd in
   pale green with darker stripes leaning on them, one curled leaf on top.
   The ribs and stems of all three share one path each. The anchor is the
   floor under the middle of the heap. */

export const BASKET_PUMPKINS_BOUNDS = { x: -78, y: -132, width: 156, height: 150 } as const

const PUMPKINS: ReadonlyArray<{ x: number; y: number; rx: number; ry: number }> = [
  { x: -38, y: -58, rx: 30, ry: 24 },
  { x: 10, y: -72, rx: 26, ry: 21 },
  { x: -4, y: -30, rx: 36, ry: 30 },
]

const GOURD = 'M 40 -2 C 14 -2 10 -40 26 -60 C 32 -70 30 -90 38 -104 C 46 -90 44 -70 50 -60 C 66 -40 66 -2 40 -2 Z'

export function BasketPumpkins({ slot }: { slot: Slot; fire: FireMotion }) {
  const ribs = useMemo(
    () =>
      buildPath((path) => {
        for (const p of PUMPKINS) {
          for (const k of [-0.5, 0, 0.5]) {
            const x = p.x + k * p.rx
            const bulge = (k === 0 ? 0 : -k) * p.rx * 0.22
            path.moveTo(x, p.y - p.ry + 1)
            path.quadTo(x + bulge, p.y, x, p.y + p.ry - 1)
          }
        }
      }),
    [],
  )
  const stems = useMemo(
    () =>
      buildPath((path) => {
        for (const p of PUMPKINS) {
          path.addRRect({ rect: { x: p.x - 5, y: p.y - p.ry - 12, width: 10, height: 16 }, rx: 3, ry: 3 })
        }
      }),
    [],
  )
  const gourd = useMemo(() => svgPath(GOURD), [])
  const gourdStripes = useMemo(
    () => svgPath('M 30 -14 C 24 -40 30 -56 36 -66 M 42 -8 C 42 -40 40 -70 40 -96 M 54 -16 C 58 -40 52 -56 46 -66'),
    [],
  )
  const leaf = useMemo(() => svgPath('M 10 -92 C 0 -110 -20 -112 -26 -98 C -14 -94 -4 -96 10 -92 Z'), [])

  return (
    <Group transform={[{ translateX: slot.x }, { translateY: slot.y }]}>
      <Oval x={-76} y={-14} width={152} height={34} color={withAlpha('#000000', 0.4)}>
        <BlurMask blur={10} style="normal" />
      </Oval>

      {/* The gourd behind the heap. */}
      <Path path={gourd}>
        <LinearGradient start={vec(20, 0)} end={vec(62, 0)} colors={['#8aa064', '#d2d69a', '#9aa86a']} />
      </Path>
      <Path path={gourdStripes} style="stroke" strokeWidth={3} strokeCap="round" color={withAlpha('#5a7a3c', 0.6)} />

      {/* The pumpkins, back to front, with their ribs and stems. */}
      {PUMPKINS.map((p) => (
        <Oval key={p.x} x={p.x - p.rx} y={p.y - p.ry} width={p.rx * 2} height={p.ry * 2}>
          <RadialGradient c={vec(p.x - p.rx * 0.3, p.y - p.ry * 0.4)} r={p.rx * 1.3} colors={['#f0a040', '#d8742a', '#9a4a18']} positions={[0, 0.6, 1]} />
        </Oval>
      ))}
      <Path path={ribs} style="stroke" strokeWidth={3} strokeCap="round" color={withAlpha('#7a3a12', 0.5)} />
      <Path path={stems}>
        <LinearGradient start={vec(0, -110)} end={vec(0, -40)} colors={['#6a7a3c', '#4a5a2a']} />
      </Path>
      <Path path={leaf} color="#4e8a54" />
    </Group>
  )
}
