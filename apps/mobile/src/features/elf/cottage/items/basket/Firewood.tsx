import { useMemo } from 'react'
import { BlurMask, Group, LinearGradient, Oval, Path, vec } from '@shopify/react-native-skia'
import { withAlpha } from '../../../../../ui'
import type { Slot } from '../../room'
import { PALETTE, buildPath } from '../draw'
import type { FireMotion } from '../Fireplace'

/* A stack of split logs in an iron ring beside the hearth, in place of
   the acorn basket: the logs are seen end on, so each is a pale disc of
   sawn wood with a bark edge, a few growth rings and a split, heaped
   three on two on one and held by a flat iron band on two little feet.
   All discs share a path per colour, so the stack is a dozen nodes. The
   anchor is the floor under the middle of the ring. */

export const BASKET_FIREWOOD_BOUNDS = { x: -64, y: -124, width: 128, height: 142 } as const

const LOGS: ReadonlyArray<{ x: number; y: number; r: number }> = [
  { x: -34, y: -24, r: 19 },
  { x: 0, y: -24, r: 20 },
  { x: 34, y: -24, r: 19 },
  { x: -17, y: -58, r: 19 },
  { x: 17, y: -58, r: 19 },
  { x: 0, y: -92, r: 18 },
]

export function BasketFirewood({ slot }: { slot: Slot; fire: FireMotion }) {
  const bark = useMemo(
    () =>
      buildPath((path) => {
        for (const log of LOGS) path.addCircle(log.x, log.y, log.r + 4)
      }),
    [],
  )
  const wood = useMemo(
    () =>
      buildPath((path) => {
        for (const log of LOGS) path.addCircle(log.x, log.y, log.r)
      }),
    [],
  )
  const rings = useMemo(
    () =>
      buildPath((path) => {
        for (const log of LOGS) {
          path.addCircle(log.x + 2, log.y - 1, log.r * 0.62)
          path.addCircle(log.x + 3, log.y - 2, log.r * 0.3)
        }
      }),
    [],
  )
  const splits = useMemo(
    () =>
      buildPath((path) => {
        for (const log of LOGS) {
          path.moveTo(log.x + 3, log.y - 2)
          path.lineTo(log.x + log.r * 0.7, log.y - log.r * 0.7)
        }
      }),
    [],
  )
  const band = useMemo(() => buildPath((path) => path.addOval({ x: -58, y: -46, width: 116, height: 32 })), [])
  const feet = useMemo(
    () =>
      buildPath((path) => {
        path.addRRect({ rect: { x: -54, y: -16, width: 14, height: 16 }, rx: 3, ry: 3 })
        path.addRRect({ rect: { x: 40, y: -16, width: 14, height: 16 }, rx: 3, ry: 3 })
      }),
    [],
  )

  return (
    <Group transform={[{ translateX: slot.x }, { translateY: slot.y }]}>
      <Oval x={-66} y={-14} width={132} height={32} color={withAlpha('#000000', 0.4)}>
        <BlurMask blur={10} style="normal" />
      </Oval>

      {/* The logs: bark, sawn face, rings and the split. */}
      <Path path={bark}>
        <LinearGradient start={vec(0, -110)} end={vec(0, -4)} colors={['#5a3620', '#3a2616']} />
      </Path>
      <Path path={wood}>
        <LinearGradient start={vec(-40, -100)} end={vec(40, -10)} colors={['#e2c89a', '#c9a86e']} />
      </Path>
      <Path path={rings} style="stroke" strokeWidth={2} color={withAlpha('#8a6238', 0.55)} />
      <Path path={splits} style="stroke" strokeWidth={3} strokeCap="round" color={withAlpha('#4a3019', 0.6)} />

      {/* The iron ring in front of the lower row, and its feet. */}
      <Path path={feet} color={PALETTE.soot} />
      <Path path={band} style="stroke" strokeWidth={9} color="#3b3b3f" />
      <Path path={band} style="stroke" strokeWidth={3} color={withAlpha('#9a9aa0', 0.45)} />
    </Group>
  )
}
