import { useMemo } from 'react'
import { Path, type SkPath } from '@shopify/react-native-skia'
import { COLORS, buildPath } from '../puppet/geometry'
import type { WearableProps } from './index'

/* What sits on the face, drawn after the mouth: round wire glasses (one
   stroked path for both rims, the bridge and the temples, plus a faint
   shine) or freckles across the cheeks (one path of small dots). 'none'
   draws nothing. The glasses stay put while the pupils move behind them. */

export type FaceItemProps = WearableProps & { id: string }

type FaceShapes = { frames: SkPath; lenses: SkPath; freckles: SkPath }

function buildShapes(eyeX: number, eyeY: number, eyeRx: number, eyeRy: number, faceRx: number, headR: number, headY: number): FaceShapes {
  const r = Math.max(eyeRx, eyeRy) * 1.35
  const frames = buildPath((path) => {
    path.addCircle(-eyeX, eyeY, r)
    path.addCircle(eyeX, eyeY, r)
    path.moveTo(-eyeX + r, eyeY - r * 0.15)
    path.quadTo(0, eyeY - r * 0.45, eyeX - r, eyeY - r * 0.15)
    path.moveTo(-eyeX - r, eyeY)
    path.lineTo(-faceRx * 0.98, eyeY - r * 0.2)
    path.moveTo(eyeX + r, eyeY)
    path.lineTo(faceRx * 0.98, eyeY - r * 0.2)
  })
  const lenses = buildPath((path) => {
    path.addCircle(-eyeX, eyeY, r)
    path.addCircle(eyeX, eyeY, r)
  })
  const cheekY = headY + headR * 0.3
  const freckles = buildPath((path) => {
    for (const [dx, dy, scale] of [
      [-0.72, -0.1, 1],
      [-0.58, 0.08, 0.8],
      [-0.44, -0.08, 0.9],
      [0.72, -0.1, 1],
      [0.58, 0.08, 0.8],
      [0.44, -0.08, 0.9],
    ]) {
      path.addCircle(dx * headR, cheekY + dy * headR, headR * 0.035 * scale)
    }
  })
  return { frames, lenses, freckles }
}

export function FaceItem({ id, g }: FaceItemProps) {
  const shapes = useMemo(() => buildShapes(g.eyeX, g.eyeY, g.eyeRx, g.eyeRy, g.faceRx, g.headR, g.headY), [g])
  switch (id) {
    case 'glasses':
      return (
        <>
          <Path path={shapes.lenses} color={COLORS.glass} opacity={0.18} />
          <Path path={shapes.frames} color={COLORS.wire} style="stroke" strokeWidth={g.strokeThin * 0.8} strokeCap="round" strokeJoin="round" />
        </>
      )
    case 'freckles':
      return <Path path={shapes.freckles} color={COLORS.freckle} opacity={0.75} />
    default:
      return null
  }
}
