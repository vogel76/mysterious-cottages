import * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import elfModel from '../../../../assets/elf/elf.glb'
import type { Stage, StarterId } from '../rules'

/* The elf's glTF model and everything about fitting it into the scene,
   ported from the Elfostudio prototype: the palettes of the three elements,
   the tuning knobs (which way the model faces, whether its textures need
   flipping on this GL stack), and the fit itself. react-three-fiber's
   useLoader caches one parsed scene per asset, so every mount takes a
   skinned clone and starts the clip on it. The clone is measured in the
   poses the clip actually shows (a skinned mesh's rest geometry is
   collapsed; only the bones give it a shape, and this clip lifts the figure
   by a good part of its height), then centred, its feet put on the ground
   and scaled to the height of its form. The posed bounds do not depend on
   the height, and skinning every vertex of the mesh at several moments is
   by far the dearest step of the whole feature on a phone, so they are
   measured once per parsed scene on a subsample of the vertices (as the
   prototype did) and reused by every later fit. Nothing here runs per
   frame. */

/* The Metro asset id of the model; useLoader's native polyfills resolve it
   through expo-asset. */
export const ELF_MODEL_ASSET: number = elfModel

export const MODEL = {
  /* Turns the model so it faces +Z (towards the castle, away from the
     default camera behind its back). Tune after a look on a device. */
  yawOffset: 0,
} as const

/* expo-gl and GLTFLoader disagree about the vertical origin of a texture on
   some stacks. Flip this once if the device shows the elf's textures upside
   down; it is applied to every texture of the clone. */
export const FLIP_TEXTURES = false

export type Palette = { glow: string; accent: string; tunic: string }

/* The three elements' colours inside the 3D scene (not interface colours:
   they paint the egg's band and dots, the elder's aura and, later, the
   accents of each form). */
export const PALETTES: Record<StarterId, Palette> = {
  forest: { glow: '#9af08f', accent: '#c79a4b', tunic: '#4e8a54' },
  ember: { glow: '#ffb46b', accent: '#f4c76b', tunic: '#e08a3d' },
  mystic: { glow: '#c39bff', accent: '#c79a4b', tunic: '#6b3fa0' },
}

/* Scene colours that do not depend on the element. */
export const SCENE_COLORS = {
  eggShell: '#f5ead1',
  tear: '#8fd0ff',
} as const

/* Only the last form glows. */
export const STAGE_HAS_AURA: Record<Stage, boolean> = { egg: false, baby: false, young: false, adult: false, elder: true }

/* How many moments of the clip the posed bounds are measured at. */
const POSE_SAMPLES = 6
/* About how many vertices of a skinned mesh are skinned per sample; the
   rest are skipped. The bounds of a figure this dense hardly move for it. */
const MEASURE_VERTICES = 6000

/* The raw posed bounds of each parsed scene, measured on its first clone. */
const POSED_BOUNDS = new WeakMap<GLTF, THREE.Box3>()

export type FittedModel = {
  /* The scaled, aligned holder to add to the scene. */
  root: THREE.Group
  /* The clone's own mixer; update it every frame and stop it on unmount. */
  mixer: THREE.AnimationMixer
  clip: THREE.AnimationClip | null
  /* The figure's size in scene units after scaling. */
  size: THREE.Vector3
  height: number
}

function pickClip(animations: THREE.AnimationClip[]): THREE.AnimationClip | null {
  if (animations.length === 0) return null
  return animations.find((clip) => /idle|stand|breath|wav/i.test(clip.name)) ?? animations[0]
}

const measuredVertex = new THREE.Vector3()

/* Grows the box by the object's current pose. A skinned mesh is skinned on
   every n-th vertex only (three's precise Box3 has no stride and would
   transform all of them); anything else takes three's own bounds. */
function expandByPose(box: THREE.Box3, object: THREE.Object3D) {
  object.traverseVisible((child) => {
    if (child instanceof THREE.SkinnedMesh) {
      const position = child.geometry.getAttribute('position')
      if (!position) return
      const stride = Math.max(1, Math.floor(position.count / MEASURE_VERTICES))
      for (let index = 0; index < position.count; index += stride) {
        child.getVertexPosition(index, measuredVertex).applyMatrix4(child.matrixWorld)
        box.expandByPoint(measuredVertex)
      }
    } else if (child instanceof THREE.Mesh) {
      box.expandByObject(child)
    }
  })
}

/* The union of the bounds at evenly spaced moments of the clip. The mixer
   is left at the start of the clip. */
function measurePosed(object: THREE.Object3D, mixer: THREE.AnimationMixer | null, duration: number): THREE.Box3 {
  const box = new THREE.Box3()
  if (!mixer) {
    object.updateMatrixWorld(true)
    expandByPose(box, object)
    return box
  }
  for (let index = 0; index < POSE_SAMPLES; index += 1) {
    mixer.setTime((duration * index) / POSE_SAMPLES)
    object.updateMatrixWorld(true)
    expandByPose(box, object)
  }
  mixer.setTime(0)
  object.updateMatrixWorld(true)
  return box
}

/* The raw posed bounds of the scene, measured on the first clone and reused
   by every later fit of the same parsed scene. */
function posedBounds(gltf: GLTF, clone: THREE.Object3D, mixer: THREE.AnimationMixer, clip: THREE.AnimationClip | null): THREE.Box3 {
  const cached = POSED_BOUNDS.get(gltf)
  if (cached) return cached
  const box = measurePosed(clone, clip ? mixer : null, clip?.duration ?? 1)
  if (box.isEmpty()) box.setFromObject(clone)
  POSED_BOUNDS.set(gltf, box)
  return box
}

const TEXTURE_SLOTS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'alphaMap'] as const

function orientTextures(material: THREE.Material) {
  const slots = material as unknown as Record<string, unknown>
  for (const slot of TEXTURE_SLOTS) {
    const texture = slots[slot]
    if (texture instanceof THREE.Texture && texture.flipY !== FLIP_TEXTURES) {
      texture.flipY = FLIP_TEXTURES
      texture.needsUpdate = true
    }
  }
}

/* A fresh, fitted instance of the elf at the given height. */
export function fitElfModel(gltf: GLTF, height: number): FittedModel {
  const clone = cloneSkinned(gltf.scene)
  const clip = pickClip(gltf.animations)
  const mixer = new THREE.AnimationMixer(clone)
  if (clip) mixer.clipAction(clip).play()

  const box = posedBounds(gltf, clone, mixer, clip)
  const rawSize = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const scale = height / (rawSize.y || 1)

  clone.position.set(-center.x, -box.min.y, -center.z)
  const root = new THREE.Group()
  root.add(clone)
  root.scale.setScalar(scale)
  root.rotation.y = MODEL.yawOffset

  clone.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    child.castShadow = true
    child.frustumCulled = false
    const materials: THREE.Material[] = Array.isArray(child.material) ? child.material : [child.material]
    materials.forEach(orientTextures)
  })

  return { root, mixer, clip, size: rawSize.multiplyScalar(scale), height }
}

/* Releases what the clone owns (its actions); geometries, materials and
   textures belong to the cached scene and stay. */
export function releaseModel(fitted: FittedModel) {
  fitted.mixer.stopAllAction()
  fitted.mixer.uncacheRoot(fitted.mixer.getRoot())
}
