import { useEffect, useState } from 'react'
import { Image } from 'react-native'
import { Skia, type SkImage } from '@shopify/react-native-skia'
import { sheetModules, type SpriteSource } from './manifest'

/* Decodes a character's sheets into Skia images. useSpriteImages gives
   the base layer (the body) as an array in sheet order with the character
   it belongs to, null until the last sheet of the first character is in,
   so a player never draws a half-loaded character; when the character
   changes (the elf reaching a new form) the previous body stays until the
   new one is in, and the caller draws the body with its own character's
   manifest. Bodies are kept for the whole app, since every scene that
   mounts would otherwise decode the same sheets again, but only two of
   them: the one shown and the one preloadSprites named ahead of a change
   (the evolution's moment decodes the next form while it plays); any
   other is dropped. useSpriteLayer gives one overlay (the hat worn) with
   its character, decoded when it is asked for and not kept for the app:
   the wardrobe has several hats and only the one worn should hold memory,
   so a hat taken off is left to the collector. While a new overlay
   decodes the previous one stays, so a hat swap never shows the bare head
   for a moment; the caller drops an overlay of another character. A
   sheet that fails to decode leaves the character null, which the dev log
   reports. A caller without a character passes undefined and gets null,
   so its hooks stay the same. */

export type SpriteImages = {
  source: SpriteSource
  body: SkImage[]
}

const bodies = new Map<SpriteSource, Promise<SkImage[] | null>>()
let shown: SpriteSource | null = null
let upcoming: SpriteSource | null = null

function decodeModule(module: number): Promise<SkImage | null> {
  return Skia.Data.fromURI(Image.resolveAssetSource(module).uri)
    .then((data) => Skia.Image.MakeImageFromEncoded(data))
    .catch(() => null)
}

async function decodeAll(modules: number[]): Promise<SkImage[] | null> {
  const images = await Promise.all(modules.map(decodeModule))
  return images.every((image): image is SkImage => image !== null) ? images : null
}

function bodyOf(source: SpriteSource): Promise<SkImage[] | null> {
  let pending = bodies.get(source)
  if (!pending) {
    pending = decodeAll(sheetModules(source))
    bodies.set(source, pending)
  }
  return pending
}

/* Only the body shown and the one about to be are kept. */
function keepCurrent() {
  for (const source of [...bodies.keys()]) if (source !== shown && source !== upcoming) bodies.delete(source)
}

/* Decodes a character's body ahead of the moment it is shown. */
export function preloadSprites(source: SpriteSource) {
  upcoming = source
  void bodyOf(source)
}

export function useSpriteImages(source: SpriteSource | undefined): SpriteImages | null {
  const [images, setImages] = useState<SpriteImages | null>(null)
  useEffect(() => {
    let cancelled = false
    if (!source) {
      setImages(null)
      return
    }
    shown = source
    if (upcoming === source) upcoming = null
    keepCurrent()
    void bodyOf(source).then((body) => {
      if (cancelled) return
      if (!body) {
        if (__DEV__) console.warn('sprite sheets failed to decode; check the registered files')
        return
      }
      setImages({ source, body })
    })
    return () => {
      cancelled = true
    }
  }, [source])
  return images
}

/* One overlay of a character, as { source, layer, sheets }, or null for none. */
export function useSpriteLayer(source: SpriteSource | undefined, layer: string | null): { source: SpriteSource; layer: string; sheets: SkImage[] } | null {
  const [state, setState] = useState<{ source: SpriteSource; layer: string; sheets: SkImage[] } | null>(null)
  useEffect(() => {
    if (!source || !layer || !source.manifest.layers?.[layer]) {
      setState(null)
      return
    }
    let cancelled = false
    void Promise.all(sheetModules(source, layer).map(decodeModule)).then((images) => {
      if (cancelled) return
      if (!images.every((image): image is SkImage => image !== null)) {
        if (__DEV__) console.warn(`sprite layer "${layer}" failed to decode; check the registered files`)
        return
      }
      setState({ source, layer, sheets: images })
    })
    return () => {
      cancelled = true
    }
  }, [source, layer])
  return state
}
