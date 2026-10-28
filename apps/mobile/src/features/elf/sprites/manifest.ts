/* The sprite atlases the art pipeline packs (apps/mobile/art, pack.py) and
   how the app finds them. A character is a manifest plus WebP sheets next
   to it under assets/elf/sprites/<character>/. Every frame of every clip
   is one cell of frameWidth by frameHeight pixels; the cells of a sheet
   run in reading order and the frame indices continue from one sheet to
   the next, so frame i is on the first sheet whose cumulative frame count
   exceeds i. The anchor is the character's feet inside a cell, which is
   the point the scene places the sprite by. A layered character (the
   body plus a hat) keeps its overlays in `layers`: each in a grid of its
   own, cells of its own size (a hat is a small part of the frame) placed
   at an offset from the base cell, so cell i of every layer is the same
   moment and the layers can be drawn from one frame clock. The wardrobe's
   pictures are in `thumbs`.

   Metro only bundles files it sees in a static require; the packer
   generates the registry of an atlas's files (pack.py --registry), and
   the characters are registered here with it. The cottage scene draws
   the elf registered here and has no other way to draw it, so a missing
   registration is an error at load. */

import { ATLAS_FILES as ELF_FILES } from './elfFiles'

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
  version: 2
  frameWidth: number
  frameHeight: number
  /* The feet inside a cell, pixels from its top left. */
  anchor: { x: number; y: number }
  fps: number
  /* The render's pixels to the metre after the pack's scale, and the
     model's height in metres: together the figure's height in cell pixels,
     which the scene scales to its room units. */
  pixelsPerMetre: number
  modelHeight: number
  /* The render and the pack that made the atlas (art/README.md, "Packing"). */
  source?: { render: Record<string, unknown> | null; pack: string }
  /* The base layer's sheets (the body). */
  sheets: SpriteSheet[]
  clips: Record<string, SpriteClip>
  /* The overlays of a layered character, each in its own grid. */
  layers?: Record<string, SpriteOverlay>
  /* The catalogue pictures packed with the atlas, by name. */
  thumbs?: Record<string, string>
}

/* One overlay: its cells' size and their offset from the base cell's top
   left, in cell pixels (before the scene's scale), and its sheets. */
export type SpriteOverlay = {
  frameWidth: number
  frameHeight: number
  offset: { x: number; y: number }
  sheets: SpriteSheet[]
}

/* A character as bundled: its manifest and the sheet files by name, as
   Metro's require gives them. */
export type SpriteSource = {
  manifest: SpriteManifest
  files: Record<string, number>
}

/* The characters as bundled: the manifest and the generated registry of
   its files. The elf is the body (its face, neutral and blinking in idle,
   and its hair baked in) and a layer per hat of the wardrobe. */
export const SPRITE_CHARACTERS: Record<string, SpriteSource> = {
  elf: {
    manifest: require('../../../../assets/elf/sprites/elf/manifest.json'),
    files: ELF_FILES,
  },
}

/* The cell of a layer: its size and its offset from the base cell. */
export function cellOf(manifest: SpriteManifest, layer?: string): { width: number; height: number; x: number; y: number } {
  if (layer === undefined) return { width: manifest.frameWidth, height: manifest.frameHeight, x: 0, y: 0 }
  const overlay = manifest.layers?.[layer]
  if (!overlay) throw new Error(`sprite manifest has no layer "${layer}"`)
  return { width: overlay.frameWidth, height: overlay.frameHeight, x: overlay.offset.x, y: overlay.offset.y }
}

/* The bundled module of a catalogue picture packed with the atlas. */
export function thumbModule(source: SpriteSource, name: string): number | null {
  const file = source.manifest.thumbs?.[name]
  return file ? (source.files[file] ?? null) : null
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
