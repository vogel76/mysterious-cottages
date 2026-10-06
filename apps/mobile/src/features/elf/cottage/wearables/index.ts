import { createElement, type ReactElement } from 'react'
import type { PuppetMotion } from '../motion'
import type { PuppetGeometry, StarterPalette } from '../puppet/geometry'
import { FaceItem } from './Face'
import { HandItem } from './Hand'
import { Hat } from './Hat'
import { Neckwear } from './Neck'
import { Garment } from './Outfit'

/* The elf's wardrobe: five fixed slots (hat, outfit, neck, hand, face),
   each with a small catalogue of ids, and the one function the puppet
   renders them through. A wearable is a handful of Skia nodes drawn in
   the puppet's body coordinates from the puppet's geometry, tinted with
   the starter's palette so the same scarf looks native on a forest, ember
   or mystic elf, and bound to the puppet's motion where it should move
   (a scarf tail or a nightcap swings with the hood). The ids here are the
   contract with the rules and the wardrobe sheet: the first id of hat and
   outfit is the classic look the puppet has always had, 'none' leaves a
   slot empty, and an unknown id falls back to the slot's default so a
   stale save never draws nothing. Some garments have a part behind the
   body (a cloak's cape, the hood's own circle behind the face): the puppet
   asks for the 'back' layer at the right point of its draw order and the
   'front' layer later. */

export type WearableSlot = 'hat' | 'outfit' | 'neck' | 'hand' | 'face'
export const WEARABLE_SLOTS: readonly WearableSlot[] = ['hat', 'outfit', 'neck', 'hand', 'face']

export const WEARABLE_IDS: Record<WearableSlot, readonly string[]> = {
  hat: ['hood', 'acornCap', 'mushroomCap', 'flowerCrown', 'nightcap'],
  outfit: ['tunic', 'vest', 'apron', 'cloak'],
  neck: ['none', 'scarf', 'amulet'],
  hand: ['none', 'lantern', 'acorn', 'book'],
  face: ['none', 'glasses', 'freckles'],
}

/* The same shape is declared in rules.ts; the two unions stay identical. */
export type Outfit = Record<WearableSlot, string>

export const DEFAULT_OUTFIT: Outfit = { hat: 'hood', outfit: 'tunic', neck: 'none', hand: 'none', face: 'none' }

export type WearableProps = { g: PuppetGeometry; palette: StarterPalette; motion: PuppetMotion }

/* 'back' is drawn behind the body or the face, 'front' over it. */
export type WearableLayer = 'back' | 'front'

/* The id of a slot as it is drawn: unknown ids fall back to the default. */
export function wearableId(slot: WearableSlot, id: string | undefined): string {
  return id !== undefined && WEARABLE_IDS[slot].includes(id) ? id : DEFAULT_OUTFIT[slot]
}

export function renderWearable(slot: WearableSlot, id: string, props: WearableProps, layer: WearableLayer = 'front'): ReactElement | null {
  const known = wearableId(slot, id)
  switch (slot) {
    case 'hat':
      return createElement(Hat, { id: known, layer, ...props })
    case 'outfit':
      return createElement(Garment, { id: known, layer, ...props })
    case 'neck':
      return layer === 'front' ? createElement(Neckwear, { id: known, ...props }) : null
    case 'hand':
      return layer === 'front' ? createElement(HandItem, { id: known, ...props }) : null
    case 'face':
      return layer === 'front' ? createElement(FaceItem, { id: known, ...props }) : null
  }
}
