/* What every piece of furniture shares: the painted palette of the cottage
   (dark beams, dimmed plaster, hearth stone, floor planks, fire, candle and
   moon), the helper that turns an SVG path string into a Skia path, the
   builder for a path assembled from primitives, and the matrix that places
   one shape many times inside a single path (leaves, fronds), so a motif
   repeated a dozen times costs one node. The items build their paths once,
   in useMemo, and only ever animate transforms and opacities, so the
   helpers are called a handful of times per mount and never per frame. The
   colours are named by material rather than by item, so a new piece of
   furniture reads as part of the same room. Soft shading over the shapes
   uses the theme's withAlpha. */

import { Skia, type SkPath, type SkPathBuilder } from '@shopify/react-native-skia'

export const PALETTE = {
  beamDark: '#3a2616',
  beam: '#5a3b22',
  beamLight: '#7a5230',
  plaster: '#c9b48c',
  plasterShade: '#7a6a50',
  stone: '#6e6a63',
  stoneDark: '#4a4642',
  stoneLight: '#8a857c',
  plank: '#6b4a2b',
  plankLight: '#8a6238',
  fireLight: '#ffe08a',
  fire: '#ffb347',
  fireDeep: '#ff7a1a',
  candle: '#ffd98a',
  moon: '#9fc4ff',
  accent: '#d2a64d',
  soot: '#1a120c',
  cream: '#f1e8d3',
} as const

/* An SVG path as a Skia path; a malformed string gives an empty path rather
   than a crash, so a typo shows as a missing shape in the room. */
export function svgPath(d: string): SkPath {
  return Skia.Path.MakeFromSVGString(d) ?? Skia.Path.Make()
}

/* A path assembled from primitives (circles, rectangles, segments): the
   builder is handed to the callback and the finished, immutable path comes
   back. */
export function buildPath(draw: (path: SkPathBuilder) => void): SkPath {
  const builder = Skia.PathBuilder.Make()
  draw(builder)
  return builder.build()
}

/* The 3x3 matrix (row-major, for Skia.Matrix) that moves a shape drawn at
   the origin to (x, y), turned by rotate radians and scaled uniformly, for
   adding one shape into a path many times. */
export function placeMatrix(x: number, y: number, rotate: number, scale: number): number[] {
  const c = Math.cos(rotate) * scale
  const s = Math.sin(rotate) * scale
  return [c, -s, x, s, c, y, 0, 0, 1]
}
