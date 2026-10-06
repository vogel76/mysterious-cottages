import type { RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

/* The orbit camera of the elf scene, as in the prototype: the camera circles
   a point just below the elf's head on a fixed radius, within a limited arc
   behind the elf (it is shy and never shows its face from the front) and
   between two tilts. A drag moves the targets; each frame eases the camera
   towards them. Left alone for three seconds the view drifts slowly along
   the arc and turns back at its edges, unless the drift is switched off
   (the system's reduce-motion setting). The state lives in a plain mutable
   object owned by the scene (the gestures write it on the JS thread, the
   rig reads it per frame), so nothing re-renders while the finger moves. */

export const ORBIT = {
  /* The centre of the arc: directly behind the elf. */
  azimuth: Math.PI,
  /* Half the arc, in radians, either side of the azimuth. */
  span: 1.02,
  phiMin: 0.62,
  phiMax: 1.42,
  radius: 2.5,
  /* Where the camera looks; the higher, the lower the elf sits in frame. */
  lookAtY: 0.9,
  restTheta: Math.PI + 0.3,
  restPhi: 1.05,
  /* Radians per point of drag. */
  dragTheta: 0.007,
  dragPhi: 0.006,
  /* The idle drift: when it starts, how fast, and how far from the edges it
     turns back. */
  idleAfterSeconds: 3,
  driftSpeed: 0.12,
  driftMargin: 0.05,
  /* How quickly the camera settles on its targets. */
  ease: 6,
} as const

export type OrbitState = {
  theta: number
  phi: number
  targetTheta: number
  targetPhi: number
  dragging: boolean
  idle: number
  autoDir: 1 | -1
}

export function createOrbitState(): OrbitState {
  return { theta: ORBIT.restTheta, phi: ORBIT.restPhi, targetTheta: ORBIT.restTheta, targetPhi: ORBIT.restPhi, dragging: false, idle: 0, autoDir: 1 }
}

function clamp(value: number, low: number, high: number) {
  return Math.max(low, Math.min(high, value))
}

/* A finger moved by (dx, dy) points. */
export function dragOrbit(orbit: OrbitState, dx: number, dy: number) {
  orbit.targetTheta = clamp(orbit.targetTheta - dx * ORBIT.dragTheta, ORBIT.azimuth - ORBIT.span, ORBIT.azimuth + ORBIT.span)
  orbit.targetPhi = clamp(orbit.targetPhi - dy * ORBIT.dragPhi, ORBIT.phiMin, ORBIT.phiMax)
}

/* Back to the resting view (eased, like a drag). */
export function resetOrbit(orbit: OrbitState) {
  orbit.targetTheta = ORBIT.restTheta
  orbit.targetPhi = ORBIT.restPhi
  orbit.idle = 0
}

const LOOK_TARGET = new THREE.Vector3(0, ORBIT.lookAtY, 0)
const MAX_FRAME_DELTA = 0.05

type CameraRigProps = {
  orbit: RefObject<OrbitState>
  /* False holds the view where the finger left it; the drag still eases. */
  drift?: boolean
}

export function CameraRig({ orbit, drift = true }: CameraRigProps) {
  const camera = useThree((state) => state.camera)

  useFrame((_, frameDelta) => {
    const state = orbit.current
    if (!state) return
    const dt = Math.min(frameDelta, MAX_FRAME_DELTA)

    if (drift && !state.dragging) {
      state.idle += dt
      if (state.idle > ORBIT.idleAfterSeconds) {
        state.targetTheta += ORBIT.driftSpeed * dt * state.autoDir
        if (state.targetTheta > ORBIT.azimuth + ORBIT.span - ORBIT.driftMargin) state.autoDir = -1
        if (state.targetTheta < ORBIT.azimuth - ORBIT.span + ORBIT.driftMargin) state.autoDir = 1
      }
    }

    const ease = Math.min(1, dt * ORBIT.ease)
    state.theta += (state.targetTheta - state.theta) * ease
    state.phi += (state.targetPhi - state.phi) * ease

    const sinPhi = Math.sin(state.phi)
    camera.position.set(
      LOOK_TARGET.x + ORBIT.radius * sinPhi * Math.sin(state.theta),
      LOOK_TARGET.y + ORBIT.radius * Math.cos(state.phi),
      LOOK_TARGET.z + ORBIT.radius * sinPhi * Math.cos(state.theta),
    )
    camera.lookAt(LOOK_TARGET)
  })

  return null
}
