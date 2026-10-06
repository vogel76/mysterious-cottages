import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Mood, Stage, StarterId } from '../rules'
import { Egg } from './Egg'
import { ElfModel } from './ElfModel'
import { PALETTES, SCENE_COLORS, STAGE_HAS_AURA, type FittedModel } from './model'

/* The elf as one figure in the scene: the egg or the fitted model inside a
   group that carries the prototype's procedural mood motion (an idle bob
   and sway, happy hops, the sad crouch, the sleeping tilt) and the two
   reactions (a full spin and a pulse jump when something good happens),
   plus the tears that fall beside the head while the elf is sad or sick and
   the additive aura of the last form. The figure's feet stand at y=0 of its
   parent. Everything per frame works on refs and reused vectors: no state,
   no allocation. Rendered inside a react-three-fiber Canvas only. */

/* Heights of the forms in scene units. */
export const FIGURE_HEIGHTS: Record<Stage, number> = { egg: 0.9, baby: 0.95, young: 1.3, adult: 1.7, elder: 1.95 }

export type ElfFigureHandle = { reactHappy: () => void }

export type ElfFigureProps = {
  stage: Stage
  starter: StarterId
  mood: Mood
  /* False holds the figure still at rest (the mixer still plays). */
  motion?: boolean
  /* The model (or the egg) is in the scene. */
  onReady?: () => void
}

const SPIN_SECONDS = 0.95
const PULSE_SECONDS = 0.6
const MAX_FRAME_DELTA = 0.05

/* The sad pose. */
const SAD_ROT_X = 0.22
const SAD_SCALE_Y = 0.88
/* The sleeping lean. */
const SLEEP_ROT_Z = -0.28
const SLEEP_ROT_X = 0.04

/* Tears: three per side, falling in a loop of this many seconds. */
const TEARS_PER_SIDE = 3
const TEAR_LOOP_SECONDS = 1.6
const TEAR_SIDES = [-1, 1] as const

type TearSpec = { side: 1 | -1; phase: number }
const TEAR_SPECS: TearSpec[] = TEAR_SIDES.flatMap((side) => Array.from({ length: TEARS_PER_SIDE }, (_, index) => ({ side, phase: index / TEARS_PER_SIDE })))

export const ElfFigure = forwardRef<ElfFigureHandle, ElfFigureProps>(function ElfFigure({ stage, starter, mood, motion = true, onReady }, ref) {
  const group = useRef<THREE.Group>(null)
  const timers = useRef({ spin: 0, pulse: 0 })
  /* The fitted model's width, for the tears' placement; zero until fitted. */
  const [figureWidth, setFigureWidth] = useState(0)

  const height = FIGURE_HEIGHTS[stage]
  const palette = PALETTES[starter]
  const sad = mood === 'sad' || mood === 'sick'
  const isEgg = stage === 'egg'

  useImperativeHandle(
    ref,
    () => ({
      reactHappy: () => {
        timers.current.spin = SPIN_SECONDS
        timers.current.pulse = PULSE_SECONDS
      },
    }),
    [],
  )

  const onFitted = useCallback((fitted: FittedModel) => setFigureWidth(fitted.size.x), [])

  /* Held still: back to rest at once. */
  useEffect(() => {
    if (motion || !group.current) return
    group.current.position.set(0, 0, 0)
    group.current.rotation.set(0, 0, 0)
    group.current.scale.set(1, 1, 1)
  }, [motion])

  useFrame((state, frameDelta) => {
    const target = group.current
    if (!target || !motion) return
    const dt = Math.min(frameDelta, MAX_FRAME_DELTA)
    const t = state.clock.elapsedTime
    const h = height

    let baseY = 0
    let rotX = 0
    let scaleY = 1
    let sway = 0
    if (sad) {
      rotX = SAD_ROT_X
      baseY = -h * 0.02
      scaleY = SAD_SCALE_Y
      sway = Math.sin(t * 3) * 0.045
    } else if (mood === 'sleep') {
      rotX = SLEEP_ROT_X
      baseY = Math.sin(t * 1.2) * h * 0.012
    } else if (mood === 'happy') {
      baseY = Math.abs(Math.sin(t * 5)) * h * 0.09
      sway = Math.sin(t * 10) * 0.04
    } else {
      baseY = Math.sin(t * 2) * h * 0.014
      sway = Math.sin(t * 1.3) * 0.02
    }

    const timer = timers.current
    if (timer.pulse > 0) {
      timer.pulse -= dt
      baseY += Math.sin(((PULSE_SECONDS - timer.pulse) / PULSE_SECONDS) * Math.PI) * h * 0.15
    }
    if (timer.spin > 0) {
      timer.spin -= dt
      target.rotation.y += dt * ((Math.PI * 2) / SPIN_SECONDS)
    } else {
      target.rotation.y += (0 - target.rotation.y) * Math.min(1, dt * 8)
      if (Math.abs(target.rotation.y) < 0.01) target.rotation.y = 0
    }

    target.position.y += (baseY - target.position.y) * Math.min(1, dt * 10)
    target.rotation.x += (rotX - target.rotation.x) * Math.min(1, dt * 6)
    const rotZ = mood === 'sleep' ? SLEEP_ROT_Z : sway
    target.rotation.z += (rotZ - target.rotation.z) * Math.min(1, dt * 6)
    target.scale.set(1, scaleY, 1)
  })

  return (
    <group ref={group}>
      {isEgg ? <Egg palette={palette} onReady={onReady} /> : <ElfModel height={height} onReady={onReady} onFitted={onFitted} />}
      {!isEgg ? <Tears height={height} width={figureWidth} active={sad && motion} /> : null}
      {STAGE_HAS_AURA[stage] ? <Aura height={height} color={palette.glow} /> : null}
    </group>
  )
})

type TearsProps = { height: number; width: number; active: boolean }

/* Six light-blue drops beside the head, three per side, each on its own
   phase of a loop that fades in, falls outwards and down, and fades out.
   Hidden while the elf is not sad. */
function Tears({ height, width, active }: TearsProps) {
  const meshes = useRef<(THREE.Mesh | null)[]>([])
  const phases = useRef(TEAR_SPECS.map((spec) => spec.phase))
  const h = height
  const w = Math.max(width, h * 0.28)
  const y0 = h * 0.86
  const z0 = -h * 0.02

  useFrame((_, frameDelta) => {
    const dt = Math.min(frameDelta, MAX_FRAME_DELTA)
    for (let index = 0; index < TEAR_SPECS.length; index += 1) {
      const mesh = meshes.current[index]
      if (!mesh) continue
      if (!active) {
        mesh.visible = false
        continue
      }
      mesh.visible = true
      let phase = phases.current[index] + dt / TEAR_LOOP_SECONDS
      if (phase > 1) phase -= 1
      phases.current[index] = phase
      const side = TEAR_SPECS[index].side
      mesh.position.set(side * w * 0.42 + side * phase * h * 0.09, y0 - phase * h * 0.36, z0)
      const material = mesh.material as THREE.MeshBasicMaterial
      material.opacity = phase < 0.15 ? phase / 0.15 : phase > 0.85 ? (1 - phase) / 0.15 : 1
    }
  })

  return (
    <>
      {TEAR_SPECS.map((spec, index) => (
        <mesh
          key={index}
          ref={(mesh) => {
            meshes.current[index] = mesh
          }}
          position={[spec.side * w * 0.42, y0, z0]}
          scale={[1, 1.4, 1]}
          visible={false}
        >
          <sphereGeometry args={[h * 0.028, 12, 10]} />
          <meshBasicMaterial color={SCENE_COLORS.tear} transparent opacity={0} />
        </mesh>
      ))}
    </>
  )
}

/* The elder's glow: a faint additive sphere around the whole figure. */
function Aura({ height, color }: { height: number; color: string }) {
  return (
    <mesh position={[0, height * 0.55, 0]}>
      <sphereGeometry args={[height * 0.55, 20, 16]} />
      <meshBasicMaterial color={color} transparent opacity={0.13} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  )
}
