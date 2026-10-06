import { useEffect } from 'react'
import { DeviceMotion, type DeviceMotionMeasurement } from 'expo-sensors'
import type { CatchWorld } from './world'

/* The phone's tilt as a parallax on the elf, so looking around moves it
   across the camera image the way the prototype anchored it with
   DeviceOrientation. The motion sensor reports the orientation in radians
   (beta about x, gamma about y); turning left and right slides the elf the
   other way, tipping the phone forward and back from how it was held at
   the start lifts and lowers it. The values are written straight into the
   world record for the frame loop; without a sensor (an emulator) they
   stay at zero and the elf merely wanders. */

const UPDATE_MS = 50
const DEGREES = 180 / Math.PI
/* The prototype's gains and clamps, in its pixel-like units. */
const TILT_X_GAIN = 3
const TILT_X_MAX = 170
const TILT_Y_GAIN = 2
const TILT_Y_MAX = 80

function clamp(value: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, value))
}

export function useDeviceParallax(world: CatchWorld): void {
  useEffect(() => {
    let subscription: { remove: () => void } | null = null
    let cancelled = false
    let baseBeta: number | null = null

    const onMotion = (measurement: DeviceMotionMeasurement) => {
      const rotation = measurement.rotation
      if (!rotation) return
      const beta = rotation.beta * DEGREES
      const gamma = rotation.gamma * DEGREES
      if (!Number.isFinite(beta) || !Number.isFinite(gamma)) return
      if (baseBeta === null) baseBeta = beta
      world.parallaxX = clamp(-gamma * TILT_X_GAIN, TILT_X_MAX)
      world.parallaxY = clamp((beta - baseBeta) * TILT_Y_GAIN, TILT_Y_MAX)
    }

    void DeviceMotion.isAvailableAsync()
      .then((available) => {
        if (!available || cancelled) return
        DeviceMotion.setUpdateInterval(UPDATE_MS)
        subscription = DeviceMotion.addListener(onMotion)
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
      subscription?.remove()
      subscription = null
      world.parallaxX = 0
      world.parallaxY = 0
    }
  }, [world])
}
