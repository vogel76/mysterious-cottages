import { Group } from '@shopify/react-native-skia'
import { useDerivedValue, type SharedValue } from 'react-native-reanimated'
import type { SpriteSleeper, SpriteSource } from '../sprites'
import { PictureSprite, type PlacedPicture } from './RoomSprites'

/* The elf asleep in its bed, in place of the figure on the rug: the
   form's render of its head on the bed's pillow with the bed's cover
   raised over its body (art/blender/elf.py, the sleepers stage), and the
   hat worn as a picture of its own over it, each by night with its day
   twin over it at the daylight's opacity like the room's pieces. The
   whole picture breathes, rising a little from the cover's foot with the
   slow breath of sleep, and fades with `shown` so the elf can go to bed
   and get up. */

export type SleepingElfProps = {
  source: SpriteSource
  sleeper: SpriteSleeper
  hat: string
  day: SharedValue<number>
  /* 0..1, the sleep's breath. */
  breath: SharedValue<number>
  /* 0..1, how far the elf is in bed. */
  shown: SharedValue<number>
}

/* How much the picture rises at the top of a breath. */
const BREATH_LIFT = 0.012

function placed(source: SpriteSource, sleeper: SpriteSleeper, file: string, fileDay: string): PlacedPicture | null {
  const module = source.files[file]
  if (module === undefined) return null
  return { x: sleeper.x, y: sleeper.y, width: sleeper.width, height: sleeper.height, module, moduleDay: source.files[fileDay] ?? null }
}

export function SleepingElf({ source, sleeper, hat, day, breath, shown }: SleepingElfProps) {
  const foot = sleeper.y + sleeper.height
  const transform = useDerivedValue(() => [{ translateY: foot }, { scaleY: 1 + BREATH_LIFT * breath.value }, { translateY: -foot }])
  const body = placed(source, sleeper, sleeper.file, sleeper.fileDay)
  const worn = sleeper.hats[hat]
  const hatPicture = worn ? placed(source, sleeper, worn.file, worn.fileDay) : null
  if (!body) return null
  return (
    <Group opacity={shown} transform={transform}>
      <PictureSprite sprite={body} day={day} />
      {hatPicture ? <PictureSprite sprite={hatPicture} day={day} /> : null}
    </Group>
  )
}
