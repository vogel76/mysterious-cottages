import { useMemo } from 'react'
import { Group, LinearGradient, Path, Rect, vec } from '@shopify/react-native-skia'
import { withAlpha } from '../../../../ui'
import { ROOM } from '../room'
import { PALETTE, buildPath } from './draw'

/* The floor of the cottage: wide oak planks running away from the viewer
   towards a vanishing point behind the wall, so their seams fan out at the
   bottom of the screen, with every other plank a shade darker and a few
   short end joints to break the rhythm. A dark skirting board hides the
   joint with the wall and throws a soft shadow onto the boards. The floor
   is warmer towards the fire and darkest near the viewer, where the room
   falls out of the light. The boards run on below the room's bottom edge
   by the room's overrun, so the floor is still there when the scene lifts
   the room behind an open panel. All paths are built once; nothing here
   moves. */

/* The seams meet, if extended, at this point behind the wall. */
const VANISH = { x: 500, y: 700 }
/* Half the plank width at the wall; it doubles by the bottom edge. */
const PLANK = 95
const SEAMS = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5]
const SKIRTING = { height: 26 }
const BOTTOM = ROOM.height + ROOM.overrun

/* The x of seam n at height y, following the perspective. */
function seamX(n: number, y: number): number {
  return VANISH.x + n * PLANK * ((y - VANISH.y) / (ROOM.floorY - VANISH.y))
}

export function Floor() {
  const seams = useMemo(
    () =>
      buildPath((path) => {
        for (const n of SEAMS) {
          path.moveTo(seamX(n, ROOM.floorY), ROOM.floorY)
          path.lineTo(seamX(n, BOTTOM), BOTTOM)
        }
      }),
    [],
  )

  const darkPlanks = useMemo(
    () =>
      buildPath((path) => {
        for (const n of SEAMS) {
          if (n % 2 !== 0) continue
          path.moveTo(seamX(n, ROOM.floorY), ROOM.floorY)
          path.lineTo(seamX(n + 1, ROOM.floorY), ROOM.floorY)
          path.lineTo(seamX(n + 1, BOTTOM), BOTTOM)
          path.lineTo(seamX(n, BOTTOM), BOTTOM)
          path.close()
        }
      }),
    [],
  )

  const joints = useMemo(
    () =>
      buildPath((path) => {
        const ends: Array<[number, number]> = [
          [-4, 1260],
          [-2, 1420],
          [1, 1330],
          [3, 1500],
          [-1, 1560],
          [4, 1240],
        ]
        for (const [n, y] of ends) {
          path.moveTo(seamX(n, y), y)
          path.lineTo(seamX(n + 1, y), y)
        }
      }),
    [],
  )

  const floorHeight = ROOM.height + ROOM.overrun - ROOM.floorY

  return (
    <Group>
      <Rect x={0} y={ROOM.floorY} width={ROOM.width} height={floorHeight}>
        <LinearGradient start={vec(0, ROOM.floorY)} end={vec(0, ROOM.height)} colors={[PALETTE.plankLight, PALETTE.plank, '#4a3119']} positions={[0, 0.55, 1]} />
      </Rect>
      <Rect x={0} y={ROOM.floorY} width={ROOM.width} height={floorHeight}>
        <LinearGradient start={vec(0, 0)} end={vec(ROOM.width, 0)} colors={[withAlpha('#2a3450', 0.22), 'transparent', withAlpha('#d07a30', 0.14)]} positions={[0, 0.5, 1]} />
      </Rect>
      <Path path={darkPlanks} color={withAlpha('#2a1a0c', 0.14)} />
      <Path path={seams} style="stroke" strokeWidth={3} color={withAlpha(PALETTE.beamDark, 0.7)} />
      <Path path={joints} style="stroke" strokeWidth={3} strokeCap="round" color={withAlpha(PALETTE.beamDark, 0.55)} />

      {/* The skirting board and the shadow under it. */}
      <Rect x={0} y={ROOM.floorY} width={ROOM.width} height={SKIRTING.height}>
        <LinearGradient start={vec(0, ROOM.floorY)} end={vec(0, ROOM.floorY + SKIRTING.height)} colors={[PALETTE.beamLight, PALETTE.beam, PALETTE.beamDark]} positions={[0, 0.25, 1]} />
      </Rect>
      <Rect x={0} y={ROOM.floorY + SKIRTING.height} width={ROOM.width} height={70}>
        <LinearGradient start={vec(0, ROOM.floorY + SKIRTING.height)} end={vec(0, ROOM.floorY + SKIRTING.height + 70)} colors={[withAlpha('#000000', 0.42), 'transparent']} />
      </Rect>
    </Group>
  )
}
