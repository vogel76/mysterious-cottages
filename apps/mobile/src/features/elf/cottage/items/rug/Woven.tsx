import { useMemo } from 'react'
import { BlurMask, Group, LinearGradient, Oval, Path, RadialGradient, vec } from '@shopify/react-native-skia'
import { withAlpha } from '../../../../../ui'
import type { Slot } from '../../room'
import { PALETTE, buildPath, svgPath } from '../draw'
import type { FireMotion } from '../Fireplace'

/* A rectangular woven kilim in place of the round rug, seen in the same
   perspective (from the front and a little above), so it is a wide, low
   parallelogram that leans a touch to the right. Rust and moss bands run
   its length with a cream pinstripe between them, a row of small diamonds
   sits in the middle band, and knotted fringes hang off both short ends.
   The same far-edge shading and hearth glow as the braided rug lie over
   it, so it reads as the same floor. The anchor is its centre, which is
   also the elf's feet. */

export const RUG_WOVEN_BOUNDS = { x: -330, y: -112, width: 660, height: 236 } as const

/* The four corners: top edge from -280 to 300, bottom edge from -300 to
   280, so the near edge sits a little left of the far one. */
const OUTLINE = 'M -280 -108 L 300 -108 L 280 108 L -300 108 Z'
const BANDS = [-108, -72, -36, 0, 36, 72, 108]
const RUST = '#8a3f2c'
const MOSS = '#4f6b45'

/* The x of the left and right edges at a given y, for bands and fringes
   that follow the lean. */
function edgeX(y: number, side: -1 | 1): number {
  const t = (y + 108) / 216
  return side < 0 ? -280 - 20 * t : 300 - 20 * t
}

export function RugWoven({ slot }: { slot: Slot; fire: FireMotion }) {
  const outline = useMemo(() => svgPath(OUTLINE), [])
  const rustBands = useMemo(
    () =>
      buildPath((path) => {
        for (let i = 0; i < BANDS.length - 1; i += 2) {
          const top = BANDS[i]!
          const bottom = BANDS[i + 1]!
          path.addPoly([vec(edgeX(top, -1), top), vec(edgeX(top, 1), top), vec(edgeX(bottom, 1), bottom), vec(edgeX(bottom, -1), bottom)], true)
        }
      }),
    [],
  )
  const pinstripes = useMemo(
    () =>
      buildPath((path) => {
        for (const y of BANDS.slice(1, -1)) {
          path.moveTo(edgeX(y, -1), y)
          path.lineTo(edgeX(y, 1), y)
        }
      }),
    [],
  )
  const diamonds = useMemo(
    () =>
      buildPath((path) => {
        for (let x = -200; x <= 200; x += 100) {
          path.addPoly([vec(x, -30), vec(x + 34, 0), vec(x, 30), vec(x - 34, 0)], true)
        }
      }),
    [],
  )
  const diamondEyes = useMemo(
    () =>
      buildPath((path) => {
        for (let x = -200; x <= 200; x += 100) {
          path.addPoly([vec(x, -12), vec(x + 14, 0), vec(x, 12), vec(x - 14, 0)], true)
        }
      }),
    [],
  )
  const fringes = useMemo(
    () =>
      buildPath((path) => {
        for (let y = -100; y <= 100; y += 16) {
          const left = edgeX(y, -1)
          const right = edgeX(y, 1)
          path.moveTo(left, y)
          path.lineTo(left - 22, y + 3)
          path.moveTo(right, y)
          path.lineTo(right + 22, y + 3)
        }
      }),
    [],
  )

  return (
    <Group transform={[{ translateX: slot.x }, { translateY: slot.y }]}>
      <Oval x={-316} y={-100} width={632} height={228} color={withAlpha('#000000', 0.32)}>
        <BlurMask blur={14} style="normal" />
      </Oval>
      <Path path={fringes} style="stroke" strokeWidth={4} strokeCap="round" color="#d8c49a" />

      {/* The cloth: moss ground, rust bands, the stitch between them. */}
      <Path path={outline}>
        <LinearGradient start={vec(-300, 0)} end={vec(300, 0)} colors={[MOSS, '#5c7a50', MOSS]} />
      </Path>
      <Path path={rustBands}>
        <LinearGradient start={vec(-300, 0)} end={vec(300, 0)} colors={[RUST, '#a04e36', RUST]} />
      </Path>
      <Path path={pinstripes} style="stroke" strokeWidth={3} color={withAlpha(PALETTE.cream, 0.55)} />
      <Path path={diamonds} color={PALETTE.accent} />
      <Path path={diamondEyes} color="#3a2616" />
      <Path path={outline} style="stroke" strokeWidth={4} color={withAlpha('#2a1a0c', 0.4)} />

      {/* The far-edge shading and the hearth glow, as on the braided rug. */}
      <Path path={outline}>
        <RadialGradient c={vec(0, 40)} r={330} colors={['transparent', withAlpha('#1a0e06', 0.38)]} positions={[0.5, 1]} />
      </Path>
      <Path path={outline} opacity={0.5} blendMode="overlay">
        <RadialGradient c={vec(150, 0)} r={340} colors={[withAlpha(PALETTE.fire, 0.4), 'transparent']} />
      </Path>
    </Group>
  )
}
