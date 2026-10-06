import { Skia, rect, type SkPath, type SkPathBuilder, type SkRect } from '@shopify/react-native-skia'
import type { Mood, Stage, StarterId } from '../../rules'

/* The measurements of the elf puppet: everything the puppet and its
   wearables draw is derived here, once per form (baby, young, adult,
   elder), from the form's height and a few proportions, so the drawing
   files only place nodes. The figure stands in room units with the feet at
   the origin and negative y upwards. Besides the raw numbers (the head's
   radius and centre, the body oval, the eyes) the geometry holds every
   static path (ears, boots, arms, belt, brows, mouths, tears, beard, hood
   tip, hair) and the pivots the motion rotates the parts around: the neck
   for the head, the skull edges for the ears, the shoulders for the arms,
   the hood top for its tip. The starter palettes and the shared colours
   live here too, so a wearable looks native on a forest, ember or mystic
   elf. Nothing in this file is rebuilt per frame. */

export type PuppetStage = Exclude<Stage, 'egg'>

/* The elf is the centre of the screen, so even the smallest form is big:
   the forms differ by a step, not by scale. */
export const PUPPET_HEIGHT: Record<PuppetStage, number> = { baby: 430, young: 480, adult: 530, elder: 570 }

/* The tap target around the figure, relative to the feet. It takes in the
   ears and the hood's tip with a little slack. */
export function puppetHitBox(stage: PuppetStage): { x: number; y: number; width: number; height: number } {
  const height = PUPPET_HEIGHT[stage]
  return { x: -0.34 * height, y: -1.14 * height, width: 0.68 * height, height: 1.18 * height }
}

export type StarterPalette = { tunic: string; shade: string; trim: string; glow: string }

export const PALETTES: Record<StarterId, StarterPalette> = {
  forest: { tunic: '#4e8a54', shade: '#3b6e41', trim: '#c79a4b', glow: '#9af08f' },
  ember: { tunic: '#e08a3d', shade: '#b86a2a', trim: '#f4c76b', glow: '#ffb46b' },
  mystic: { tunic: '#6b3fa0', shade: '#4f2d7a', trim: '#c79a4b', glow: '#c39bff' },
}

/* Colours shared by the puppet and the wearables, named by material. */
export const COLORS = {
  skin: '#f1d2b0',
  skinLight: '#f8e1c6',
  skinShade: '#dcb08c',
  cheek: '#e8a090',
  eye: '#2b2118',
  highlight: '#ffffff',
  brow: '#5a3b22',
  mouthDark: '#6e2b2b',
  boot: '#3a2616',
  bootLight: '#5a3b22',
  sole: '#241709',
  accent: '#d2a64d',
  tear: '#8fd0ff',
  sick: '#9fd49a',
  beard: '#efe6d8',
  shadow: '#000000',
  rimLight: '#ffcf7a',
  hair: '#7a4a2a',
  hairLight: '#9a6238',
  leather: '#6b4a2b',
  leatherLight: '#8a6238',
  cream: '#f1e8d3',
  creamShade: '#d8ccb0',
  mushroom: '#c8452f',
  petalPink: '#f2a7b8',
  petalWhite: '#fff4e0',
  leaf: '#5f9a52',
  wire: '#3a3a40',
  glass: '#dff3ff',
  candle: '#ffd98a',
  flame: '#ffb347',
  bookCover: '#7a3b3b',
  page: '#f6efe0',
  acorn: '#a86a34',
  acornCap: '#5a3b22',
  freckle: '#c98a62',
} as const

/* Proportions that make the forms differ: the baby is rounder with bigger
   eyes, the adult a little slimmer. All as fractions of the height. */
export const PROPORTIONS: Record<PuppetStage, { headR: number; bodyW: number; eyeRx: number; eyeRy: number }> = {
  baby: { headR: 0.23, bodyW: 0.46, eyeRx: 0.052, eyeRy: 0.066 },
  young: { headR: 0.215, bodyW: 0.42, eyeRx: 0.046, eyeRy: 0.058 },
  adult: { headR: 0.205, bodyW: 0.37, eyeRx: 0.042, eyeRy: 0.054 },
  elder: { headR: 0.205, bodyW: 0.38, eyeRx: 0.04, eyeRy: 0.05 },
}

/* How far the pupils travel at look = 1, in room units. */
export const LOOK_RANGE = { x: 12, y: 8 } as const
/* The chest grows by this much at full breath. */
export const BREATH_SCALE = 0.025
/* Radians at a motion value of 1: the hood tip and the pompom, the ears,
   and how much the head leans with the eyes. */
export const SWING = { hood: 0.26, ear: 0.2, headLean: 0.06 } as const
/* The lids at full droop cover this much of the eye. */
export const LID_DROOP_COVER = 0.55
/* The feet tuck up by this fraction of the hop. */
export const FOOT_TUCK = 0.18

export type Point = { x: number; y: number }

export function svg(d: string): SkPath {
  return Skia.Path.MakeFromSVGString(d) ?? Skia.Path.Make()
}

export const n = (value: number) => value.toFixed(1)

/* A path assembled from primitives: the builder is handed to the callback
   and the finished, immutable path comes back. */
export function buildPath(draw: (path: SkPathBuilder) => void): SkPath {
  const builder = Skia.PathBuilder.Make()
  draw(builder)
  return builder.build()
}

export type PuppetGeometry = ReturnType<typeof buildGeometry>

export function buildGeometry(stage: PuppetStage) {
  const H = PUPPET_HEIGHT[stage]
  const { headR: headRatio, bodyW: bodyRatio, eyeRx: eyeRxRatio, eyeRy: eyeRyRatio } = PROPORTIONS[stage]
  const headR = headRatio * H
  const bodyW = bodyRatio * H
  const eyeRx = eyeRxRatio * H
  const eyeRy = eyeRyRatio * H

  /* The head sinks a little into the body. */
  const headY = -H + headR + 0.02 * H
  const bodyTop = -0.58 * H
  const bodyH = 0.44 * H
  const bodyCenterY = bodyTop + bodyH / 2
  const faceY = headY + 0.02 * H
  const faceRx = headR * 0.82
  const faceRy = headR * 0.8
  const eyeX = headR * 0.36
  const eyeY = headY - headR * 0.02
  const browY = eyeY - eyeRy - 0.035 * H
  const mouthY = headY + headR * 0.5
  const mouthW = headR * 0.3
  const bootW = 0.17 * H
  const bootH = 0.075 * H
  const legX = 0.09 * H
  const legW = 0.1 * H
  const legTop = -0.2 * H
  const legH = 0.17 * H
  const armW = 0.085 * H
  const armLen = 0.21 * H
  const shoulderX = bodyW / 2 - 0.03 * H
  const shoulderY = -0.5 * H
  const handR = 0.038 * H
  const beltY = -0.3 * H

  /* The head pivots at the neck, where the hood meets the collar. */
  const neck: Point = { x: 0, y: headY + headR * 1.0 }
  const shoulders: readonly [Point, Point] = [
    { x: -shoulderX, y: shoulderY },
    { x: shoulderX, y: shoulderY },
  ]
  /* The arms hang down and a touch outwards; the hands are their ends. */
  const hands: readonly [Point, Point] = [
    { x: -shoulderX - 0.07 * H, y: shoulderY + armLen },
    { x: shoulderX + 0.07 * H, y: shoulderY + armLen },
  ]
  const arm = (side: 0 | 1) => {
    const s = shoulders[side]
    const h = hands[side]
    const sign = side === 0 ? -1 : 1
    return svg(`M ${n(s.x)},${n(s.y)} Q ${n(s.x + sign * 0.1 * H)},${n(s.y + 0.09 * H)} ${n(h.x)},${n(h.y)}`)
  }
  /* The mitten's thumb, a small oval on the inner side of the hand. */
  const thumb = (side: 0 | 1): SkRect => {
    const h = hands[side]
    const sign = side === 0 ? 1 : -1
    return rect(h.x + sign * handR * 0.55 - handR * 0.45, h.y - handR * 0.95, handR * 0.9, handR * 0.7)
  }

  /* Boots with a sole, a toe curling outwards and a highlight on the shaft;
     each sits under its leg with the sole on the ground. */
  const boot = (side: -1 | 1) => {
    const cx = side * legX
    const w = bootW
    const h = bootH
    const p = (x: number, y: number) => `${n(cx + side * x)},${n(y)}`
    return svg(
      `M ${p(-0.5 * w, -1.5 * h)} L ${p(0.3 * w, -1.5 * h)} L ${p(0.36 * w, -0.55 * h)} Q ${p(0.9 * w, -1.0 * h)} ${p(1.05 * w, -0.35 * h)} Q ${p(0.95 * w, 0)} ${p(0.6 * w, 0)} L ${p(-0.42 * w, 0)} Q ${p(-0.52 * w, 0)} ${p(-0.5 * w, -0.15 * h)} Z`,
    )
  }
  const sole = (side: -1 | 1) => {
    const cx = side * legX
    const w = bootW
    const h = bootH
    const p = (x: number, y: number) => `${n(cx + side * x)},${n(y)}`
    return svg(`M ${p(-0.5 * w, -0.2 * h)} L ${p(0.75 * w, -0.2 * h)} Q ${p(0.95 * w, -0.15 * h)} ${p(0.6 * w, 0)} L ${p(-0.42 * w, 0)} Q ${p(-0.52 * w, 0)} ${p(-0.5 * w, -0.15 * h)} Z`)
  }
  const bootHighlight = (side: -1 | 1): SkRect => rect(side * legX - side * 0.3 * bootW - 0.08 * bootW, -1.3 * bootH, 0.16 * bootW, 0.6 * bootH)
  const legRect = (side: -1 | 1): SkRect => rect(side * legX - legW / 2, legTop, legW, legH)

  const earPivots: readonly [Point, Point] = [
    { x: -headR * 0.8, y: headY - 0.01 * H },
    { x: headR * 0.8, y: headY - 0.01 * H },
  ]
  const ear = (side: 1 | -1) =>
    svg(
      `M ${n(side * headR * 0.8)},${n(headY - 0.1 * H)} Q ${n(side * headR * 1.6)},${n(headY - 0.35 * H)} ${n(side * headR * 2.05)},${n(headY - 0.42 * H)} Q ${n(side * headR * 1.5)},${n(headY - 0.05 * H)} ${n(side * headR * 0.8)},${n(headY + 0.08 * H)} Z`,
    )
  const earInner = (side: 1 | -1) =>
    svg(
      `M ${n(side * headR * 1.0)},${n(headY - 0.1 * H)} Q ${n(side * headR * 1.55)},${n(headY - 0.3 * H)} ${n(side * headR * 1.8)},${n(headY - 0.36 * H)} Q ${n(side * headR * 1.45)},${n(headY - 0.08 * H)} ${n(side * headR * 1.0)},${n(headY + 0.02 * H)} Z`,
    )

  /* The hood: a circle around the head, its tip swinging from a pivot
     near the top, a crescent of shade under the rim and a warm rim light
     on the fire's side (the right). */
  const hood = { cx: 0, cy: headY - 0.01 * H, r: headR * 1.1 }
  const hoodTop = headY - headR * 1.1
  const hoodPivot: Point = { x: headR * 0.1, y: hoodTop + headR * 0.4 }
  const hoodTip = svg(
    `M ${n(-headR * 0.35)},${n(hoodTop + headR * 0.18)} Q ${n(headR * 0.15)},${n(hoodTop - headR * 0.75)} ${n(headR * 0.95)},${n(hoodTop - headR * 0.62)} Q ${n(headR * 0.55)},${n(hoodTop - headR * 0.3)} ${n(headR * 0.7)},${n(hoodTop + headR * 0.35)} Z`,
  )
  const pompom = { x: headR * 0.97, y: hoodTop - headR * 0.62, r: 0.03 * H }
  const hoodRimShade = svg(
    `M ${n(-faceRx * 0.98)},${n(faceY - faceRy * 0.25)} Q 0,${n(faceY - faceRy * 1.12)} ${n(faceRx * 0.98)},${n(faceY - faceRy * 0.25)} Q 0,${n(faceY - faceRy * 0.62)} ${n(-faceRx * 0.98)},${n(faceY - faceRy * 0.25)} Z`,
  )
  const hoodRimLight = buildPath((path) => path.addArc(rect(hood.cx - hood.r * 0.94, hood.cy - hood.r * 0.94, hood.r * 1.88, hood.r * 1.88), -70, 95))

  /* Short hair under the other hats: a cap over the skull with a fringe
     of three locks over the brow. */
  const hairCap = svg(
    `M ${n(-faceRx * 1.04)},${n(faceY - faceRy * 0.22)} A ${n(faceRx * 1.04)},${n(faceRy * 1.1)} 0 0,1 ${n(faceRx * 1.04)},${n(faceY - faceRy * 0.22)} Q ${n(faceRx * 0.72)},${n(faceY - faceRy * 0.5)} ${n(faceRx * 0.4)},${n(faceY - faceRy * 0.42)} Q ${n(faceRx * 0.12)},${n(faceY - faceRy * 0.74)} ${n(-faceRx * 0.25)},${n(faceY - faceRy * 0.44)} Q ${n(-faceRx * 0.62)},${n(faceY - faceRy * 0.56)} ${n(-faceRx * 1.04)},${n(faceY - faceRy * 0.22)} Z`,
  )
  /* The top of the skull, where the hats sit. */
  const crown: Point = { x: 0, y: faceY - faceRy * 1.05 }

  const collar = svg(`M ${n(-0.09 * H)},${n(-0.55 * H)} L 0,${n(-0.47 * H)} L ${n(0.09 * H)},${n(-0.55 * H)}`)
  /* The belt follows the belly's curve. */
  const belt = svg(`M ${n(-bodyW * 0.45)},${n(beltY - 0.012 * H)} Q 0,${n(beltY + 0.035 * H)} ${n(bodyW * 0.45)},${n(beltY - 0.012 * H)}`)
  const buckle: Point = { x: 0, y: beltY + 0.012 * H }
  const bodyRect = rect(-bodyW / 2, bodyTop, bodyW, bodyH)
  const bellyRect = rect(-bodyW * 0.22, bodyCenterY - bodyH * 0.2, bodyW * 0.44, bodyH * 0.5)
  const neckShadeRect = rect(-bodyW * 0.32, bodyTop - 0.012 * H, bodyW * 0.64, 0.075 * H)

  const brow = (side: 1 | -1, innerLift: number, outerLift: number, arch: number) => {
    const inner = side * (eyeX - eyeRx)
    const outer = side * (eyeX + eyeRx)
    return svg(`M ${n(inner)},${n(browY - innerLift)} Q ${n(side * eyeX)},${n(browY - arch)} ${n(outer)},${n(browY - outerLift)}`)
  }

  const brows: Record<Mood, [SkPath, SkPath]> = {
    ok: [brow(-1, 0, 0, 0.015 * H), brow(1, 0, 0, 0.015 * H)],
    happy: [brow(-1, 0.012 * H, 0.012 * H, 0.032 * H), brow(1, 0.012 * H, 0.012 * H, 0.032 * H)],
    sad: [brow(-1, 0.018 * H, -0.01 * H, 0.012 * H), brow(1, 0.018 * H, -0.01 * H, 0.012 * H)],
    sick: [brow(-1, -0.004 * H, 0.006 * H, 0.004 * H), brow(1, -0.004 * H, 0.006 * H, 0.004 * H)],
    sleep: [brow(-1, 0.004 * H, 0.004 * H, 0.012 * H), brow(1, 0.004 * H, 0.004 * H, 0.012 * H)],
  }

  const mouths: Record<Mood, SkPath> = {
    ok: svg(`M ${n(-mouthW)},${n(mouthY)} Q 0,${n(mouthY + 0.03 * H)} ${n(mouthW)},${n(mouthY)}`),
    happy: svg(`M ${n(-mouthW * 1.3)},${n(mouthY - 0.005 * H)} Q 0,${n(mouthY + 0.075 * H)} ${n(mouthW * 1.3)},${n(mouthY - 0.005 * H)} Z`),
    sad: svg(`M ${n(-mouthW * 0.9)},${n(mouthY + 0.02 * H)} Q 0,${n(mouthY - 0.02 * H)} ${n(mouthW * 0.9)},${n(mouthY + 0.02 * H)}`),
    sick: svg(`M ${n(-mouthW * 1.1)},${n(mouthY)} q ${n(mouthW * 0.55)},${n(-0.03 * H)} ${n(mouthW * 1.1)},0 t ${n(mouthW * 1.1)},0`),
    sleep: svg(`M ${n(-mouthW * 0.8)},${n(mouthY)} Q 0,${n(mouthY + 0.022 * H)} ${n(mouthW * 0.8)},${n(mouthY)}`),
  }
  const mouthOpenRect = rect(-headR * 0.14, mouthY - 0.002 * H, headR * 0.28, headR * 0.3)

  const closedEye = (side: 1 | -1) => svg(`M ${n(side * eyeX - eyeRx)},${n(eyeY)} Q ${n(side * eyeX)},${n(eyeY + eyeRy * 0.6)} ${n(side * eyeX + eyeRx)},${n(eyeY)}`)
  const sickEye = (side: 1 | -1) => {
    const a = eyeRx * 0.75
    const cx = side * eyeX
    return svg(`M ${n(cx - a)},${n(eyeY - a)} L ${n(cx + a)},${n(eyeY + a)} M ${n(cx + a)},${n(eyeY - a)} L ${n(cx - a)},${n(eyeY + a)}`)
  }
  const eyeRect = (side: 1 | -1): SkRect => rect(side * eyeX - eyeRx, eyeY - eyeRy, 2 * eyeRx, 2 * eyeRy)
  /* The lid is a skin-coloured oval over the eye, wide enough to cover it
     wherever the pupil looks, scaled down from its top edge. */
  const lidRect = (side: 1 | -1): SkRect => rect(side * eyeX - eyeRx - LOOK_RANGE.x - 2, eyeY - eyeRy - LOOK_RANGE.y - 4, 2 * (eyeRx + LOOK_RANGE.x + 2), 2 * (eyeRy + LOOK_RANGE.y + 4))
  const lidPivot = (side: 1 | -1): Point => ({ x: side * eyeX, y: eyeY - eyeRy - LOOK_RANGE.y - 4 })

  const tearDrop = (side: 1 | -1) => {
    const cx = side * headR * 0.5
    const cy = eyeY + eyeRy + 0.015 * H
    return svg(`M ${n(cx)},${n(cy - 9)} C ${n(cx + 4)},${n(cy - 3)} ${n(cx + 7)},${n(cy + 2)} ${n(cx + 7)},${n(cy + 6)} A 7,7 0 1,1 ${n(cx - 7)},${n(cy + 6)} C ${n(cx - 7)},${n(cy + 2)} ${n(cx - 4)},${n(cy - 3)} ${n(cx)},${n(cy - 9)} Z`)
  }

  const beard = svg(
    `M ${n(-headR * 0.55)},${n(headY + headR * 0.45)} Q ${n(-headR * 0.62)},${n(headY + headR * 1.3)} 0,${n(headY + headR * 1.5)} Q ${n(headR * 0.62)},${n(headY + headR * 1.3)} ${n(headR * 0.55)},${n(headY + headR * 0.45)} Q 0,${n(headY + headR * 0.78)} ${n(-headR * 0.55)},${n(headY + headR * 0.45)} Z`,
  )

  const faceRect = rect(-faceRx, faceY - faceRy, 2 * faceRx, 2 * faceRy)
  const cheekRect = (side: 1 | -1): SkRect => rect(side * headR * 0.55 - headR * 0.2, headY + headR * 0.3 - headR * 0.13, headR * 0.4, headR * 0.26)
  const noseRect = rect(-0.018 * H, headY + headR * 0.22 - 0.013 * H, 0.036 * H, 0.026 * H)

  return {
    H,
    headR,
    headY,
    bodyW,
    bodyTop,
    bodyH,
    bodyCenterY,
    beltY,
    faceY,
    faceRx,
    faceRy,
    eyeX,
    eyeY,
    eyeRx,
    eyeRy,
    browY,
    mouthY,
    mouthW,
    bootW,
    bootH,
    legX,
    legW,
    armW,
    handR,
    strokeThin: 0.012 * H,
    strokeTrim: 0.022 * H,
    neck,
    shoulders,
    hands,
    arms: [arm(0), arm(1)] as const,
    thumbs: [thumb(0), thumb(1)] as const,
    legs: [legRect(-1), legRect(1)] as const,
    boots: [boot(-1), boot(1)] as const,
    soles: [sole(-1), sole(1)] as const,
    bootHighlights: [bootHighlight(-1), bootHighlight(1)] as const,
    earPivots,
    ears: [ear(-1), ear(1)] as const,
    earInners: [earInner(-1), earInner(1)] as const,
    hood,
    hoodTop,
    hoodPivot,
    hoodTip,
    pompom,
    hoodRimShade,
    hoodRimLight,
    hairCap,
    crown,
    collar,
    belt,
    buckle,
    bodyRect,
    bellyRect,
    neckShadeRect,
    brows,
    mouths,
    mouthOpenRect,
    closedEyes: [closedEye(-1), closedEye(1)] as const,
    sickEyes: [sickEye(-1), sickEye(1)] as const,
    eyeRects: [eyeRect(-1), eyeRect(1)] as const,
    lidRects: [lidRect(-1), lidRect(1)] as const,
    lidPivots: [lidPivot(-1), lidPivot(1)] as const,
    tears: [tearDrop(-1), tearDrop(1)] as const,
    beard,
    faceRect,
    cheeks: [cheekRect(-1), cheekRect(1)] as const,
    noseRect,
  }
}
