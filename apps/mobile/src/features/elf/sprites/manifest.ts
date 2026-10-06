/* The sprite atlases the art pipeline packs (apps/mobile/art, pack.py) and
   how the app finds them. A character is a manifest plus WebP sheets next
   to it under assets/elf/sprites/<character>/. Every frame of every clip
   is one cell of frameWidth by frameHeight pixels; the cells of a sheet
   run in reading order and the frame indices continue from one sheet to
   the next, so frame i is on the first sheet whose cumulative frame count
   exceeds i. The anchor is the character's feet inside a cell, which is
   the point the scene places the sprite by. A layered character (the
   body plus a face, a hat) keeps its overlays in `layers`, packed with the
   very same grid, so cell i of every layer is the same moment and the
   layers can be drawn from one frame clock.

   Metro only bundles files it sees in a static require, so the characters
   are registered here by hand: the manifest and each sheet file. The
   cottage scene draws the rendered room and the sprite elf whenever the
   elf is registered here, and the code-drawn vectors when it is not. */

export type SpriteSheet = {
  file: string
  columns: number
  rows: number
  /* Frames on this sheet; the last sheet is usually not full. */
  frames: number
}

export type SpriteClip = {
  /* Global frame indices, inclusive. */
  from: number
  to: number
  loop: boolean
}

export type SpriteManifest = {
  version: 1
  frameWidth: number
  frameHeight: number
  /* The feet inside a cell, pixels from its top left. */
  anchor: { x: number; y: number }
  fps: number
  /* The base layer's sheets (the body). */
  sheets: SpriteSheet[]
  clips: Record<string, SpriteClip>
  /* The overlays of a layered character, same grid as `sheets`. */
  layers?: Record<string, { sheets: SpriteSheet[] }>
}

/* A character as bundled: its manifest and the sheet files by name, as
   Metro's require gives them. */
export type SpriteSource = {
  manifest: SpriteManifest
  files: Record<string, number>
}

/* The characters as bundled; the paths are relative to this file. A new
   character or a new layer is added the same way: the manifest, then one
   line per sheet file it names. The elf is the body alone for now, the
   face (neutral, blinking in idle) and the hood baked in; the face and hat
   layers follow once art/blender renders them. */
export const SPRITE_CHARACTERS: Record<string, SpriteSource> = {
  elf: {
    manifest: require('../../../../assets/elf/sprites/elf/manifest.json'),
    files: {
      'body-1.webp': require('../../../../assets/elf/sprites/elf/body-1.webp'),
      'body-2.webp': require('../../../../assets/elf/sprites/elf/body-2.webp'),
      'body-3.webp': require('../../../../assets/elf/sprites/elf/body-3.webp'),
      'body-4.webp': require('../../../../assets/elf/sprites/elf/body-4.webp'),
      'body-5.webp': require('../../../../assets/elf/sprites/elf/body-5.webp'),
      'body-6.webp': require('../../../../assets/elf/sprites/elf/body-6.webp'),
      'body-7.webp': require('../../../../assets/elf/sprites/elf/body-7.webp'),
      'body-8.webp': require('../../../../assets/elf/sprites/elf/body-8.webp'),
      'body-9.webp': require('../../../../assets/elf/sprites/elf/body-9.webp'),
    },
  },
}

/* The sheets of a layer; the base when no layer is named. */
export function sheetsOf(manifest: SpriteManifest, layer?: string): SpriteSheet[] {
  if (layer === undefined) return manifest.sheets
  const overlay = manifest.layers?.[layer]
  if (!overlay) throw new Error(`sprite manifest has no layer "${layer}"`)
  return overlay.sheets
}

/* The bundled modules of a layer's sheets, in sheet order. */
export function sheetModules(source: SpriteSource, layer?: string): number[] {
  return sheetsOf(source.manifest, layer).map((sheet) => {
    const module = source.files[sheet.file]
    if (module === undefined) throw new Error(`sprite sheet "${sheet.file}" is not registered in SPRITE_CHARACTERS`)
    return module
  })
}

/* The clip, or a clear error for a typo. */
export function clipOf(manifest: SpriteManifest, name: string): SpriteClip {
  const clip = manifest.clips[name]
  if (!clip) throw new Error(`sprite manifest has no clip "${name}"`)
  return clip
}
