import { useEffect, useState } from 'react'
import { Image } from 'react-native'
import { Skia, type SkImage } from '@shopify/react-native-skia'
import background from '../../../../../../assets/elf/background.webp'

/* The Chatynkowo painting seen through every window variant, decoded once
   for the whole app. Skia's useImage decodes per hook instance, and the
   1536 by 1024 painting is about six megabytes once decoded: the room's
   window plus the three thumbnails of the Decorate panel would hold four
   copies and decode three more on every return to the window tab. Here
   the first subscriber starts the one load and every later one gets the
   same image, at once when it is already there; a failed load leaves null
   and the windows keep their plain night. The image is kept for the life
   of the app, which is what a shared background costs. */

let painting: SkImage | null = null
let loading: Promise<SkImage | null> | null = null

function load(): Promise<SkImage | null> {
  if (!loading) {
    loading = Skia.Data.fromURI(Image.resolveAssetSource(background).uri)
      .then((data) => {
        painting = Skia.Image.MakeImageFromEncoded(data)
        return painting
      })
      .catch(() => null)
  }
  return loading
}

/* The decoded painting, or null until it is there (or if it never is). */
export function usePainting(): SkImage | null {
  const [image, setImage] = useState(painting)
  useEffect(() => {
    if (image) return
    let mounted = true
    void load().then((result) => {
      if (mounted && result) setImage(result)
    })
    return () => {
      mounted = false
    }
  }, [image])
  return image
}
