import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import type { Mood, Stage, StarterId } from '../rules'
import { ElfFigure } from '../scene/ElfFigure'
import type { CatchWorld } from './world'

/* The elf loose in the camera view: a group around the still figure that
   drifts towards the world's target, bobs as it goes and turns its head
   from side to side (both dropped under the system's reduce-motion setting;
   it then glides), with the phone's tilt added as parallax. Once the orb
   has it the group shrinks away to nothing. Everything happens in the
   frame loop on the group's transform; React is not involved and nothing
   is allocated per frame. Rendered inside the canvas only. */

export type WandererProps = {
  world: CatchWorld
  stage: Stage
  starter: StarterId
  mood: Mood
  /* False drops the bob and the head sway; the glide stays. */
  motion?: boolean
  onReady?: () => void
}

/* The share of the remaining distance covered each frame. */
const EASE = 0.05
/* Scene units per pixel-like unit, across and up. */
const UNITS_X = 120
const UNITS_Y = 160
const BOB_HEIGHT = 0.12
const BOB_RATE = 4
const SWAY_ANGLE = 0.28
const SWAY_RATE = 1.5
/* How fast a caught elf vanishes, per second. */
const SHRINK_RATE = 3.4
/* A hitch or a tab switch must not land as one giant step. */
const MAX_DELTA = 0.05

export function Wanderer({ world, stage, starter, mood, motion = true, onReady }: WandererProps) {
  const group = useRef<Group>(null)

  useFrame((state, delta) => {
    const node = group.current
    if (!node) return
    const dt = Math.min(delta, MAX_DELTA)
    const t = state.clock.elapsedTime
    if (world.caught) {
      node.scale.multiplyScalar(Math.max(0, 1 - dt * SHRINK_RATE))
      return
    }
    /* A retry brought the elf back: it stands full size again. */
    if (node.scale.x !== 1) node.scale.setScalar(1)
    world.currentX += (world.targetX - world.currentX) * EASE
    world.currentY += (world.targetY - world.currentY) * EASE
    node.position.x = (world.currentX + world.parallaxX) / UNITS_X
    const lift = -(world.currentY + world.parallaxY) / UNITS_Y
    node.position.y = motion ? lift + Math.abs(Math.sin(t * BOB_RATE)) * BOB_HEIGHT : lift
    node.rotation.y = motion ? Math.sin(t * SWAY_RATE) * SWAY_ANGLE : 0
  })

  return (
    <group ref={group}>
      <ElfFigure stage={stage} starter={starter} mood={mood} motion={false} onReady={onReady} />
    </group>
  )
}
