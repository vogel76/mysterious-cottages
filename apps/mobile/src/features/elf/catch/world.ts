/* The catch view's world: where the elf wanders and how the phone is held,
   as one mutable record shared by the sensor hook (which writes the
   parallax), the Wanderer inside the canvas (which eases the position
   every frame) and the throw (which reads where the elf is at that
   moment). It lives in a ref and never passes through React state, so a
   frame costs no render and no allocation. The units are the prototype's
   pixel-like ones: the figure's offset divided by 120 (x) and 160 (y) is
   its position in scene units. */

export type CatchWorld = {
  /* Where the elf is heading and where it is now. */
  targetX: number
  targetY: number
  currentX: number
  currentY: number
  /* The offset the phone's tilt adds, from the sensor. */
  parallaxX: number
  parallaxY: number
  /* The orb has it: the figure shrinks away and stops wandering. */
  caught: boolean
}

/* How far the elf strays, in the pixel-like units. */
const WANDER_X = 130
const WANDER_Y_MIN = -30
const WANDER_Y_MAX = 40
/* The far side the elf jumps to after a miss. */
const DODGE_X = 120

/* An orb landing within this of the elf's centre catches it. */
export const CATCH_RADIUS = 64

export function newWorld(): CatchWorld {
  return { targetX: 0, targetY: 0, currentX: 0, currentY: 0, parallaxX: 0, parallaxY: 0, caught: false }
}

/* A fresh place to head for; a caught elf stays where it is. */
export function pickTarget(world: CatchWorld): void {
  if (world.caught) return
  world.targetX = Math.random() * (WANDER_X * 2) - WANDER_X
  world.targetY = Math.random() * (WANDER_Y_MAX - WANDER_Y_MIN) + WANDER_Y_MIN
}

/* Back to the centre, free again. */
export function resetWorld(world: CatchWorld): void {
  world.targetX = 0
  world.targetY = 0
  world.currentX = 0
  world.currentY = 0
  world.caught = false
}

/* The elf's horizontal offset on the screen, wander and tilt together. */
export function elfOffsetX(world: CatchWorld): number {
  return world.currentX + world.parallaxX
}

/* The elf dodges to the side opposite the orb. */
export function dodge(world: CatchWorld, thrownX: number): void {
  world.targetX = thrownX > 0 ? -DODGE_X : DODGE_X
}
