import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { ELF_MODEL_ASSET, fitElfModel, releaseModel, type FittedModel } from './model'

/* The hatched elf: the glTF model loaded once through react-three-fiber's
   cache (suspending the figure's boundary until it is parsed), cloned and fitted for
   this mount at the height of its form, with its own mixer playing the
   waving clip every frame. The clone shares geometry, materials and
   textures with the cached scene, so the primitive is told not to dispose
   them when it unmounts; only the mixer is released. A change of height (a
   new form) fits a fresh clone. */

type ElfModelProps = {
  /* The figure's height in scene units. */
  height: number
  /* The fitted clone is in the scene. */
  onReady?: () => void
  /* The measured size of the fitted figure, for the tears' placement. */
  onFitted?: (fitted: FittedModel) => void
}

/* The clip never jumps more than this per frame, however long the frame. */
const MAX_FRAME_DELTA = 0.05

/* Starts the download and parse ahead of the first mount, so the hatch does
   not wait on it; useLoader finds the result in its cache. */
export function preloadElfModel() {
  useLoader.preload(GLTFLoader, ELF_MODEL_ASSET as unknown as string)
}

export function ElfModel({ height, onReady, onFitted }: ElfModelProps) {
  /* The asset is a Metro module id; the native polyfills resolve it. */
  const gltf = useLoader(GLTFLoader, ELF_MODEL_ASSET as unknown as string)
  const fitted = useMemo(() => fitElfModel(gltf, height), [gltf, height])

  /* The callbacks are read through refs so a new closure does not count as a
     new model. */
  const onReadyRef = useRef(onReady)
  const onFittedRef = useRef(onFitted)
  onReadyRef.current = onReady
  onFittedRef.current = onFitted

  useEffect(() => {
    onFittedRef.current?.(fitted)
    onReadyRef.current?.()
    return () => releaseModel(fitted)
  }, [fitted])

  useFrame((_, delta) => {
    fitted.mixer.update(Math.min(delta, MAX_FRAME_DELTA))
  })

  return <primitive object={fitted.root} dispose={null} />
}
