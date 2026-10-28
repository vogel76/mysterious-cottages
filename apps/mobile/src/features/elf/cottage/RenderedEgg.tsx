import { Group, vec } from '@shopify/react-native-skia'
import { useDerivedValue, type SharedValue } from 'react-native-reanimated'
import type { PuppetMotion } from './motion'
import type { Bounds } from './room'
import { EGG_BASE, extraSpriteFor, type RoomPicture } from './roomAssets'
import { PictureSprite } from './RoomSprites'

/* The egg before the hatch, in its nest on the rug, from the room's
   renders (art/blender/room.py renders its pieces like the furniture, by
   night and by day, in the room's light and ink): the back half of the
   nest, the egg, the front half of the nest over the egg's foot. The egg
   rocks (tilt) about the point it rests on and hops (bob) with the same
   shared values the elf uses later, so the scene does not care which of
   the two stands at the anchor; its glow, the shell lit from within, is
   drawn in screen blending at the egg's warmth and the glow pulse. The
   ready egg shows its cracks (after the first tap, and as it breaks).

   The hatch is a progress from 0 to 1 the scene runs: the egg shakes, the
   shell splits along its zigzag (the cracked shell gives way to its base
   and its cap), the cap flies off in an arc and fades, a flash of the glow
   covers the moment the elf takes the egg's place, then the base and the
   nest fade; with reduce motion the egg neither shakes nor throws its cap,
   the pieces only fade under the flash. The pieces are drawn at their plate boxes, the whole moved so
   the egg's rest point lands on the figure's anchor. */

export type RenderedEggProps = {
  /* 0..100 */
  warmth: number
  /* The ready egg's cracks: 0 whole, 1 after the first tap, 2 breaking. */
  cracks: number
  motion: PuppetMotion
  /* Where the egg rests, room units (the figure's anchor). */
  origin: { x: number; y: number }
  /* Daylight, 0 night .. 1 full day. */
  day: SharedValue<number>
  /* The hatch, 0 before it .. 1 once the shell and the nest have gone. */
  hatch: SharedValue<number>
  /* Reduce motion: the break without its shake. */
  still?: boolean
}

type EggPiece = 'nestBack' | 'nestFront' | 'shell' | 'crack1' | 'crack2' | 'cap' | 'base' | 'glow'
const PIECES: Record<EggPiece, RoomPicture | null> = {
  nestBack: extraSpriteFor('egg', 'nestBack'),
  nestFront: extraSpriteFor('egg', 'nestFront'),
  shell: extraSpriteFor('egg', 'shell'),
  crack1: extraSpriteFor('egg', 'crack1'),
  crack2: extraSpriteFor('egg', 'crack2'),
  cap: extraSpriteFor('egg', 'cap'),
  base: extraSpriteFor('egg', 'base'),
  glow: extraSpriteFor('egg', 'glow'),
}

/* The hatch's beats, as shares of its progress. */
export const HATCH_BEATS = {
  /* The shake ends and the shell splits. */
  split: 0.3,
  /* The elf takes the egg's place, under the flash. */
  open: 0.42,
} as const

/* The tap target, room units around the anchor: the nest and the egg. */
export const EGG_HIT_BOX: Bounds = (() => {
  const boxes = [PIECES.nestBack, PIECES.nestFront, PIECES.shell].filter((piece): piece is RoomPicture => piece !== null)
  if (boxes.length === 0) return { x: -140, y: -300, width: 280, height: 320 }
  const left = Math.min(...boxes.map((box) => box.x))
  const top = Math.min(...boxes.map((box) => box.y))
  const right = Math.max(...boxes.map((box) => box.x + box.width))
  const bottom = Math.max(...boxes.map((box) => box.y + box.height))
  return { x: left - EGG_BASE.x, y: top - EGG_BASE.y, width: right - left, height: bottom - top }
})()

function clamp01(value: number): number {
  'worklet'
  return Math.min(1, Math.max(0, value))
}

/* Where a piece is drawn when there is one. */
function Piece({ piece, day }: { piece: EggPiece; day: SharedValue<number> }) {
  const picture = PIECES[piece]
  return picture ? <PictureSprite sprite={picture} day={day} /> : null
}

export function RenderedEgg({ warmth, cracks, motion, origin, day, hatch, still = false }: RenderedEggProps) {
  const { bob, tilt, glow } = motion
  const shift = [{ translateX: origin.x - EGG_BASE.x }, { translateY: origin.y - EGG_BASE.y }]
  const shell: EggPiece = cracks >= 2 ? 'crack2' : cracks === 1 ? 'crack1' : 'shell'
  const cap = PIECES.cap

  /* The rock and the hop, and the shake before the split. */
  const eggTransform = useDerivedValue(() => {
    const p = hatch.value
    const shake = !still && p > 0 && p < HATCH_BEATS.split ? 0.1 * Math.sin(p * 90) * (p / HATCH_BEATS.split) : 0
    return [{ translateY: bob.value }, { rotate: tilt.value + shake }]
  }, [still])
  const wholeOpacity = useDerivedValue(() => (hatch.value < HATCH_BEATS.split ? 1 : 0))
  const baseOpacity = useDerivedValue(() => (hatch.value < HATCH_BEATS.split ? 0 : 1 - clamp01((hatch.value - 0.55) / 0.3)))
  const nestOpacity = useDerivedValue(() => 1 - clamp01((hatch.value - 0.6) / 0.35))
  /* The cap's flight: up and to the right in an arc, turning, fading. */
  const capOpacity = useDerivedValue(() => (hatch.value < HATCH_BEATS.split ? 0 : 1 - clamp01((hatch.value - 0.6) / 0.25)))
  const capTransform = useDerivedValue(() => {
    const q = still ? 0 : clamp01((hatch.value - HATCH_BEATS.split) / 0.5)
    return [{ translateX: 110 * q }, { translateY: -280 * q + 230 * q * q }, { rotate: 1.4 * q }]
  }, [still])
  /* The warmth's glow, and the flash of the split over it. */
  const glowOpacity = useDerivedValue(() => {
    const p = hatch.value
    const flash = p <= 0 ? 0 : p < 0.36 ? clamp01((p - 0.2) / 0.16) : 1 - clamp01((p - 0.48) / 0.3)
    const warm = (warmth / 100) * (0.18 + 0.3 * glow.value)
    return Math.max(warm * (1 - clamp01((p - HATCH_BEATS.split) / 0.2)), flash)
  }, [warmth])

  return (
    <Group transform={shift}>
      <Group opacity={nestOpacity}>
        <Piece piece="nestBack" day={day} />
      </Group>
      <Group transform={eggTransform} origin={vec(EGG_BASE.x, EGG_BASE.y)}>
        <Group opacity={wholeOpacity}>
          <Piece piece={shell} day={day} />
        </Group>
        <Group opacity={baseOpacity}>
          <Piece piece="base" day={day} />
        </Group>
        <Group blendMode="screen" opacity={glowOpacity}>
          <Piece piece="glow" day={day} />
        </Group>
      </Group>
      <Group opacity={nestOpacity}>
        <Piece piece="nestFront" day={day} />
      </Group>
      {cap ? (
        <Group opacity={capOpacity} transform={capTransform} origin={vec(cap.x + cap.width / 2, cap.y + cap.height / 2)}>
          <Piece piece="cap" day={day} />
        </Group>
      ) : null}
    </Group>
  )
}
