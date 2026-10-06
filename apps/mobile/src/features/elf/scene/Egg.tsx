import { useEffect, useRef } from 'react'
import { SCENE_COLORS, type Palette } from './model'

/* The egg before hatching, built from primitives as in the prototype: a
   stretched cream sphere, a band in the element's accent colour around its
   middle and six small dots in the element's tunic colour. It stands 0.9
   units tall with its base at y=0 of its parent, like every figure. Being
   procedural it is ready as soon as it mounts. */

type EggProps = {
  palette: Palette
  onReady?: () => void
}

const DOTS = 6
const DOT_ANGLES = Array.from({ length: DOTS }, (_, index) => (index / DOTS) * Math.PI * 2)

export function Egg({ palette, onReady }: EggProps) {
  /* The egg is ready once, on mount; a new onReady does not mean a new egg. */
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady
  useEffect(() => {
    onReadyRef.current?.()
  }, [])

  return (
    <group>
      <mesh position={[0, 0.45, 0]} scale={[1, 1.32, 1]} castShadow>
        <sphereGeometry args={[0.34, 32, 24]} />
        <meshStandardMaterial color={SCENE_COLORS.eggShell} roughness={0.75} />
      </mesh>
      <mesh position={[0, 0.42, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.3, 0.055, 12, 28]} />
        <meshStandardMaterial color={palette.accent} roughness={0.6} />
      </mesh>
      {DOT_ANGLES.map((angle, index) => (
        <mesh key={index} position={[Math.cos(angle) * 0.26, 0.34 + Math.sin(index * 2) * 0.18, Math.sin(angle) * 0.2]}>
          <sphereGeometry args={[0.035, 10, 8]} />
          <meshStandardMaterial color={palette.tunic} roughness={0.7} />
        </mesh>
      ))}
    </group>
  )
}
