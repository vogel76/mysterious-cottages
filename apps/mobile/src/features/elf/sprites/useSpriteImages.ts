import { useEffect, useState } from 'react'
import { Image } from 'react-native'
import { Skia, type SkImage } from '@shopify/react-native-skia'
import { sheetModules, type SpriteSource } from './manifest'

/* Decodes a character's sheets into Skia images. useSpriteImages gives
   the base layer (the body) as an array in sheet order, null until the
   last sheet is in, so a player never draws a half-loaded character; the
   body's sheets are decoded once for the whole app and kept, since every
   scene that mounts would otherwise decode the same sheets again.
   useSpriteLayer gives one overlay (the hat worn), decoded when it is
   asked for and not kept for the app: the wardrobe has several hats and
   only the one worn should hold memory, so a hat taken off is left to the
   collector. While a new overlay decodes the previous one stays, so a hat
   swap never shows the bare head for a moment. A sheet that fails to
   decode leaves the character null, which the dev log reports. A caller
   without a character passes undefined and gets null, so its hooks stay
   the same. */

export type SpriteImages = {
  body: SkImage[]
}

const decoded = new Map<number, Promise<SkImage | null>>()

function decodeModule(module: number): Promise<SkImage | null> {
  return Skia.Data.fromURI(Image.resolveAssetSource(module).uri)
    .then((data) => Skia.Image.MakeImageFromEncoded(data))
    .catch(() => null)
}

function decodeKept(module: number): Promise<SkImage | null> {
  let pending = decoded.get(module)
  if (!pending) {
    pending = decodeModule(module)
    decoded.set(module, pending)
  }
  return pending
}

async function decodeAll(modules: number[], decode: (module: number) => Promise<SkImage | null>): Promise<SkImage[] | null> {
  const images = await Promise.all(modules.map(decode))
  return images.every((image): image is SkImage => image !== null) ? images : null
}

export function useSpriteImages(source: SpriteSource | undefined): SpriteImages | null {
  const [images, setImages] = useState<SpriteImages | null>(null)
  useEffect(() => {
    let cancelled = false
    setImages(null)
    if (!source) return
    void decodeAll(sheetModules(source), decodeKept).then((body) => {
      if (cancelled) return
      if (!body) {
        if (__DEV__) console.warn('sprite sheets failed to decode; check the registered files')
        return
      }
      setImages({ body })
    })
    return () => {
      cancelled = true
    }
  }, [source])
  return images
}

/* One overlay of a character, as { layer, sheets }, or null for none. */
export function useSpriteLayer(source: SpriteSource | undefined, layer: string | null): { layer: string; sheets: SkImage[] } | null {
  const [state, setState] = useState<{ layer: string; sheets: SkImage[] } | null>(null)
  useEffect(() => {
    if (!source || !layer || !source.manifest.layers?.[layer]) {
      setState(null)
      return
    }
    let cancelled = false
    void decodeAll(sheetModules(source, layer), decodeModule).then((sheets) => {
      if (cancelled) return
      if (!sheets) {
        if (__DEV__) console.warn(`sprite layer "${layer}" failed to decode; check the registered files`)
        return
      }
      setState({ layer, sheets })
    })
    return () => {
      cancelled = true
    }
  }, [source, layer])
  return state
}
