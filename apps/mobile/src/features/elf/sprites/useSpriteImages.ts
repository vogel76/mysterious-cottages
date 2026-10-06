import { useEffect, useState } from 'react'
import { Image } from 'react-native'
import { Skia, type SkImage } from '@shopify/react-native-skia'
import { sheetModules, type SpriteSource } from './manifest'

/* Decodes a character's sheets into Skia images: the base layer and every
   overlay of the manifest, each as an array in sheet order. Null until the
   last sheet is in, so a player never draws a half-loaded character. A
   sheet is decoded once for the whole app and kept (as the painting behind
   the window is): a 2048 by 2048 sheet is sixteen megabytes once decoded,
   and the pickers that preview an outfit would otherwise decode the same
   sheet again for every thumbnail. A sheet that fails to decode leaves
   the character null, which the dev log reports. A caller without a
   character (the scene in vector mode) passes undefined and gets null, so
   its hooks stay the same in both modes. */

export type SpriteImages = {
  body: SkImage[]
  layers: Record<string, SkImage[]>
}

const decoded = new Map<number, Promise<SkImage | null>>()

function decode(module: number): Promise<SkImage | null> {
  let pending = decoded.get(module)
  if (!pending) {
    pending = Skia.Data.fromURI(Image.resolveAssetSource(module).uri)
      .then((data) => Skia.Image.MakeImageFromEncoded(data))
      .catch(() => null)
    decoded.set(module, pending)
  }
  return pending
}

async function decodeAll(modules: number[]): Promise<SkImage[] | null> {
  const images = await Promise.all(modules.map(decode))
  return images.every((image): image is SkImage => image !== null) ? images : null
}

export function useSpriteImages(source: SpriteSource | undefined): SpriteImages | null {
  const [images, setImages] = useState<SpriteImages | null>(null)
  useEffect(() => {
    let cancelled = false
    setImages(null)
    if (!source) return
    const layerNames = Object.keys(source.manifest.layers ?? {})
    Promise.all([decodeAll(sheetModules(source)), ...layerNames.map((layer) => decodeAll(sheetModules(source, layer)))])
      .then(([body, ...overlays]) => {
        if (cancelled) return
        if (!body || overlays.some((images) => images === null)) {
          if (__DEV__) console.warn('sprite sheets failed to decode; check the registered files')
          return
        }
        const layers: Record<string, SkImage[]> = {}
        layerNames.forEach((layer, index) => {
          layers[layer] = overlays[index] as SkImage[]
        })
        setImages({ body, layers })
      })
    return () => {
      cancelled = true
    }
  }, [source])
  return images
}
