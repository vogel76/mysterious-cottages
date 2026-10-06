import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

/* Counts the frames the canvas renders and reports the rate once a second,
   for the performance readout of development builds: the point of the
   prototype is to learn how the skinned model fares on real phones, and
   the canvas runs at the device's native resolution, which no desktop
   number predicts. Nothing is allocated per frame and nothing re-renders
   until the second is up. Rendered inside a Canvas only. */

const SAMPLE_SECONDS = 1

export function FpsMeter({ onSample }: { onSample: (fps: number) => void }) {
  const frames = useRef(0)
  const elapsed = useRef(0)

  useFrame((_, delta) => {
    frames.current += 1
    elapsed.current += delta
    if (elapsed.current < SAMPLE_SECONDS) return
    onSample(Math.round(frames.current / elapsed.current))
    frames.current = 0
    elapsed.current = 0
  })

  return null
}
