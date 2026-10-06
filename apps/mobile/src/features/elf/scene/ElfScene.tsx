import { Component, Suspense, forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { Image } from 'expo-image'
import { useTranslation } from 'react-i18next'
import { Canvas } from '@react-three/fiber/native'
import type { RootState } from '@react-three/fiber'
import * as THREE from 'three'
import background from '../../../../assets/elf/background.webp'
import { Text, colors, radius, space, useReducedMotion } from '../../../ui'
import type { Mood, Stage, StarterId } from '../rules'
import { CameraRig, ORBIT, createOrbitState, dragOrbit, resetOrbit, type OrbitState } from './CameraRig'
import { ElfFigure, type ElfFigureHandle } from './ElfFigure'
import { FpsMeter } from './FpsMeter'

/* The elf's home as a React Native view: the Chatynkowo painting as the
   background and, over it, a transparent GL canvas in which the elf stands
   on an invisible ground that only catches its shadow. The light is tuned
   to the painting: a cool "moon" from the upper right casting a soft
   shadow, a warm fill from the campfire side, and a dim sky; while the elf
   sleeps everything dims. A drag orbits the camera, a tap pets the elf; the
   gestures are handled here on a wrapper view, so the canvas's own touch
   layer is switched off. The model loads behind its own suspense boundary
   inside the canvas, so the lights, the ground and the GL context stay up
   while it is parsed (the hatch would otherwise tear the canvas down); the
   outer boundary only covers the canvas's first frame. A load failure is
   reported once through onError and leaves the painting alone. With the
   system's reduce-motion setting on, the figure holds still and the camera
   stops drifting; a drag still moves the view. The component fills whatever
   size its style gives it. Development builds show the frame rate in the
   bottom corner: the prototype exists to measure it. */

export type ElfSceneHandle = {
  reactHappy: () => void
  resetView: () => void
}

export type ElfSceneProps = {
  stage: Stage
  starter: StarterId
  mood: Mood
  /* True stops rendering altogether, e.g. while the tab is not focused. */
  paused?: boolean
  /* A tap on the scene. */
  onPet?: () => void
  /* The model (or the egg) is in the scene. */
  onReady?: () => void
  onError?: (error: unknown) => void
  style?: StyleProp<ViewStyle>
}

const CAMERA = { fov: 42, near: 0.1, far: 60 } as const

/* The light rig: day while the elf is awake, night while it sleeps. The
   prototype's intensities were in three's legacy light units, which the
   renderer scaled by PI; three now uses physical units, hence the factor. */
const LIGHT = {
  sky: { color: 0x9fc4ff, ground: 0x1e2a22, day: 0.55 * Math.PI, night: 0.3 * Math.PI },
  moon: { color: 0xdce8ff, day: 1.25 * Math.PI, night: 0.6 * Math.PI, position: [5, 8, 3.5] as const },
  fill: { color: 0xffb066, day: 0.35 * Math.PI, night: 0.15 * Math.PI, position: [-2.5, 0.8, 3] as const },
} as const

const SHADOW = { mapSize: 1024, halfSize: 3, near: 0.5, far: 24, bias: -0.0012, groundSize: 14, opacity: 0.34 } as const

/* The camera starts where the rig rests, so the first frame is already the
   resting view. */
const INITIAL_CAMERA_POSITION: [number, number, number] = [
  ORBIT.radius * Math.sin(ORBIT.restPhi) * Math.sin(ORBIT.restTheta),
  ORBIT.lookAtY + ORBIT.radius * Math.cos(ORBIT.restPhi),
  ORBIT.radius * Math.sin(ORBIT.restPhi) * Math.cos(ORBIT.restTheta),
]

/* The prototype's soft PCF shadow is gone from three r186 (it falls back to
   plain PCF with a warning), so PCF is asked for outright. */
function onCanvasCreated(state: RootState) {
  state.gl.setClearColor(0x000000, 0)
  state.gl.shadowMap.enabled = true
  state.gl.shadowMap.type = THREE.PCFShadowMap
}

export const ElfScene = forwardRef<ElfSceneHandle, ElfSceneProps>(function ElfScene({ stage, starter, mood, paused = false, onPet, onReady, onError, style }, ref) {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
  const figure = useRef<ElfFigureHandle>(null)
  /* The frame rate of the last second; development builds only. */
  const [fps, setFps] = useState<number | null>(null)
  const orbit = useRef<OrbitState>(createOrbitState())
  /* Read through a ref so a new closure does not rebuild the gestures. */
  const onPetRef = useRef(onPet)
  onPetRef.current = onPet

  useImperativeHandle(
    ref,
    () => ({
      reactHappy: () => figure.current?.reactHappy(),
      resetView: () => resetOrbit(orbit.current),
    }),
    [],
  )

  /* Both gestures run on the JS thread and write the orbit state directly;
     the rig reads it on the next frame. They are built once: a rebuild on
     every render would be pushed to native each time the elf's state ticks. */
  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .runOnJS(true)
      .onBegin(() => {
        orbit.current.dragging = true
        orbit.current.idle = 0
      })
      .onChange((event) => {
        dragOrbit(orbit.current, event.changeX, event.changeY)
      })
      .onFinalize(() => {
        orbit.current.dragging = false
        orbit.current.idle = 0
      })
    const tap = Gesture.Tap()
      .runOnJS(true)
      .onEnd(() => {
        onPetRef.current?.()
      })
    return Gesture.Exclusive(pan, tap)
  }, [])

  const night = mood === 'sleep'

  return (
    <GestureDetector gesture={gesture}>
      <View accessible accessibilityRole="image" accessibilityLabel={t('mobile:elf.sceneAria')} accessibilityHint={t(stage === 'egg' ? 'mobile:elf.orbitHintEgg' : 'mobile:elf.orbitHint')} style={[styles.frame, style]}>
        <Image source={background} contentFit="cover" style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <SceneErrorBoundary onError={onError}>
            <Suspense fallback={null}>
              <Canvas
                pointerEvents="none"
                style={StyleSheet.absoluteFill}
                gl={{ alpha: true, antialias: true }}
                shadows
                flat
                camera={{ fov: CAMERA.fov, near: CAMERA.near, far: CAMERA.far, position: INITIAL_CAMERA_POSITION }}
                frameloop={paused ? 'never' : 'always'}
                onCreated={onCanvasCreated}
              >
                <CameraRig orbit={orbit} drift={!reduceMotion} />
                <Lights night={night} />
                <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                  <planeGeometry args={[SHADOW.groundSize, SHADOW.groundSize]} />
                  <shadowMaterial opacity={SHADOW.opacity} />
                </mesh>
                <Suspense fallback={null}>
                  <ElfFigure ref={figure} stage={stage} starter={starter} mood={mood} motion={!reduceMotion} onReady={onReady} />
                </Suspense>
                {__DEV__ ? <FpsMeter onSample={setFps} /> : null}
              </Canvas>
            </Suspense>
          </SceneErrorBoundary>
        </View>
        {__DEV__ && fps !== null && !paused ? (
          <View style={styles.fps} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Text variant="micro" weight="semibold" style={styles.fpsText}>
              {`${fps} fps`}
            </Text>
          </View>
        ) : null}
      </View>
    </GestureDetector>
  )
})

/* The sky, the moon with its shadow camera, and the campfire fill. */
function Lights({ night }: { night: boolean }) {
  const moon = useRef<THREE.DirectionalLight>(null)

  useLayoutEffect(() => {
    const light = moon.current
    if (!light) return
    light.shadow.mapSize.set(SHADOW.mapSize, SHADOW.mapSize)
    const shadowCamera = light.shadow.camera
    shadowCamera.left = -SHADOW.halfSize
    shadowCamera.right = SHADOW.halfSize
    shadowCamera.top = SHADOW.halfSize
    shadowCamera.bottom = -SHADOW.halfSize
    shadowCamera.near = SHADOW.near
    shadowCamera.far = SHADOW.far
    shadowCamera.updateProjectionMatrix()
    light.shadow.bias = SHADOW.bias
  }, [])

  return (
    <>
      <hemisphereLight args={[LIGHT.sky.color, LIGHT.sky.ground]} intensity={night ? LIGHT.sky.night : LIGHT.sky.day} />
      <directionalLight ref={moon} color={LIGHT.moon.color} intensity={night ? LIGHT.moon.night : LIGHT.moon.day} position={LIGHT.moon.position} castShadow />
      <directionalLight color={LIGHT.fill.color} intensity={night ? LIGHT.fill.night : LIGHT.fill.day} position={LIGHT.fill.position} />
    </>
  )
}

type BoundaryProps = { onError?: (error: unknown) => void; children: ReactNode }
type BoundaryState = { failed: boolean }

/* A failure inside the canvas (most likely the model not loading) is
   reported once; the painting stays, the canvas goes. */
class SceneErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false }

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    this.props.onError?.(error)
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  /* The development frame-rate readout, tucked into the bottom-left corner. */
  fps: {
    position: 'absolute',
    left: space.sm,
    bottom: space.sm,
    paddingVertical: 2,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.backdrop,
  },
  fpsText: {
    color: colors.inkSoft,
  },
})
