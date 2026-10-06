import { useMemo } from 'react'
import { Circle, Group, Oval, Path, RadialGradient, vec } from '@shopify/react-native-skia'
import { useDerivedValue } from 'react-native-reanimated'
import type { Mood, StarterId } from '../rules'
import type { PuppetMotion } from './motion'
import { BREATH_SCALE, COLORS, FOOT_TUCK, LID_DROOP_COVER, LOOK_RANGE, PALETTES, SWING, buildGeometry, type PuppetGeometry, type PuppetStage } from './puppet/geometry'
import { renderWearable, type Outfit } from './wearables'

/* The elf as a painted puppet of pivoting parts, drawn with Skia nodes
   inside the cottage canvas: a chibi in the Pou spirit with a big round
   head, long ears, a small round tunic with a belt, two arms with mitten
   hands and little curled boots. The geometry comes from puppet/geometry
   (built once per form), the clothes from the wardrobe (renderWearable),
   the mood only swaps the static face parts (brows, mouth, tears, the sick
   tint, the sleeping eyes), and every movement is a shared value of
   PuppetMotion bound to a transform: the body squashes, bobs and tilts
   around the feet; the feet tuck on hops; the chest breathes; each arm
   rotates about its shoulder; the head pivots at the neck and leans with
   the gaze; the ears pivot at the skull edges; the hood tip swings from
   the hood top; the pupils wander both ways; the lids blink and droop; the
   brows lift; the mouth opens, and a grin can pick the happy mouth over
   the mood's. Nothing is rebuilt per frame. Everything is placed in room
   units from the feet origin upwards (negative y is up).

   Draw order inside the body group: the elder's aura, the cloak's cape,
   legs and boots, then the breathing chest (arms behind the torso, the
   hand item in the right arm's group, the torso as the outfit, the neck
   wear), then the head: ears, the hat's back (the hood circle), the face,
   the hat's front (rim shade, tip and pompom, or hair and a hat), the
   beard, cheeks and nose, eyes and lids, brows, mouth, tears, the face
   item. Roughly 70-90 nodes with everything on. */

export { PUPPET_HEIGHT, puppetHitBox } from './puppet/geometry'

export type ElfPuppetProps = {
  stage: PuppetStage
  starter: StarterId
  mood: Mood
  sleeping: boolean
  motion: PuppetMotion
  outfit: Outfit
  /* The feet, room units. */
  origin: { x: number; y: number }
}

export function ElfPuppet({ stage, starter, mood, sleeping, motion, outfit, origin }: ElfPuppetProps) {
  const g: PuppetGeometry = useMemo(() => buildGeometry(stage), [stage])
  const palette = PALETTES[starter]
  const { breath, bob, squash, tilt, blink, look, lookY, mouth, glow, headTilt, earWiggle, armL, armR, lidDroop, grin, browLift } = motion
  const wear = useMemo(() => ({ g, palette, motion }), [g, palette, motion])

  const eyesClosed = sleeping || mood === 'sleep'
  const sick = mood === 'sick' && !eyesClosed
  const sad = mood === 'sad' && !eyesClosed
  const faceMood: Mood = eyesClosed ? 'sleep' : mood
  const happyMood = faceMood === 'happy'

  /* The body around the feet: the hop, the lean and the squash. */
  const bodyTransform = useDerivedValue(() => [{ translateY: bob.value }, { rotate: tilt.value }, { scaleX: 1 / squash.value }, { scaleY: squash.value }])
  const breathTransform = useDerivedValue(() => [{ scale: 1 + breath.value * BREATH_SCALE }])
  /* The feet tuck up a little when the body is in the air, toes down. */
  const footTransformL = useDerivedValue(() => [{ translateY: bob.value * FOOT_TUCK }, { rotate: bob.value * 0.0012 }])
  const footTransformR = useDerivedValue(() => [{ translateY: bob.value * FOOT_TUCK }, { rotate: -bob.value * 0.0012 }])
  /* Positive raises an arm outwards: clockwise on the left, the other
     way on the right. */
  const armTransformL = useDerivedValue(() => [{ rotate: armL.value }])
  const armTransformR = useDerivedValue(() => [{ rotate: -armR.value }])
  const headTransform = useDerivedValue(() => [{ rotate: headTilt.value + look.value * SWING.headLean }])
  /* The same screen rotation on both ears: one goes up as the other goes down. */
  const earTransform = useDerivedValue(() => [{ rotate: earWiggle.value * SWING.ear }])
  const eyeTransform = useDerivedValue(() => [{ translateX: look.value * LOOK_RANGE.x }, { translateY: lookY.value * LOOK_RANGE.y }])
  const lidTransform = useDerivedValue(() => [{ scaleY: Math.max(blink.value, lidDroop.value * LID_DROOP_COVER) }])
  const browTransform = useDerivedValue(() => [{ translateY: -browLift.value * 0.02 * g.H }], [g])
  const mouthTransform = useDerivedValue(() => [{ scaleY: mouth.value }])
  /* The happy grin shows for the happy mood or while the grin value is up. */
  const grinOpacity = useDerivedValue(() => (happyMood ? 1 : grin.value), [happyMood])
  const lineOpacity = useDerivedValue(() => (happyMood ? 0 : 1 - grin.value), [happyMood])
  const tearTransform = useDerivedValue(() => [{ translateY: breath.value * 0.14 * g.H }], [g])
  const tearOpacity = useDerivedValue(() => 1 - breath.value * 0.9)
  const shadowOpacity = useDerivedValue(() => 0.28 * Math.max(0.3, 1 + bob.value / 200))
  const auraOpacity = useDerivedValue(() => 0.45 + 0.55 * glow.value)

  return (
    <Group transform={[{ translateX: origin.x }, { translateY: origin.y }]}>
      <Oval rect={{ x: -0.2 * g.H, y: -0.035 * g.H, width: 0.4 * g.H, height: 0.07 * g.H }} color={COLORS.shadow} opacity={shadowOpacity} />

      <Group transform={bodyTransform}>
        {stage === 'elder' && (
          <Circle cx={0} cy={-0.5 * g.H} r={0.62 * g.H} opacity={auraOpacity}>
            <RadialGradient c={vec(0, -0.5 * g.H)} r={0.62 * g.H} colors={[palette.glow + 'aa', palette.glow + '40', palette.glow + '00']} positions={[0, 0.55, 1]} />
          </Circle>
        )}

        {renderWearable('outfit', outfit.outfit, wear, 'back')}

        {/* Legs and boots: a sole, a curled toe and a highlight on each. */}
        <Oval rect={g.legs[0]} color={palette.shade} />
        <Oval rect={g.legs[1]} color={palette.shade} />
        <Group transform={footTransformL} origin={vec(-g.legX, -g.bootH)}>
          <Path path={g.boots[0]} color={COLORS.boot} />
          <Path path={g.soles[0]} color={COLORS.sole} />
          <Oval rect={g.bootHighlights[0]} color={COLORS.bootLight} opacity={0.7} />
        </Group>
        <Group transform={footTransformR} origin={vec(g.legX, -g.bootH)}>
          <Path path={g.boots[1]} color={COLORS.boot} />
          <Path path={g.soles[1]} color={COLORS.sole} />
          <Oval rect={g.bootHighlights[1]} color={COLORS.bootLight} opacity={0.7} />
        </Group>

        {/* The chest breathes; the arms hang from the shoulders behind it. */}
        <Group transform={breathTransform} origin={vec(0, g.bodyCenterY)}>
          <Group transform={armTransformL} origin={vec(g.shoulders[0].x, g.shoulders[0].y)}>
            <Path path={g.arms[0]} color={palette.shade} style="stroke" strokeWidth={g.armW} strokeCap="round" />
            <Circle cx={g.hands[0].x} cy={g.hands[0].y} r={g.handR} color={COLORS.skin} />
            <Oval rect={g.thumbs[0]} color={COLORS.skin} />
          </Group>
          <Group transform={armTransformR} origin={vec(g.shoulders[1].x, g.shoulders[1].y)}>
            <Path path={g.arms[1]} color={palette.shade} style="stroke" strokeWidth={g.armW} strokeCap="round" />
            <Circle cx={g.hands[1].x} cy={g.hands[1].y} r={g.handR} color={COLORS.skin} />
            <Oval rect={g.thumbs[1]} color={COLORS.skin} />
            {renderWearable('hand', outfit.hand, wear)}
          </Group>

          {renderWearable('outfit', outfit.outfit, wear)}
          {renderWearable('neck', outfit.neck, wear)}
        </Group>

        {/* The head pivots at the neck. */}
        <Group transform={headTransform} origin={vec(g.neck.x, g.neck.y)}>
          <Group transform={earTransform} origin={vec(g.earPivots[0].x, g.earPivots[0].y)}>
            <Path path={g.ears[0]} color={COLORS.skin} />
            <Path path={g.earInners[0]} color={COLORS.cheek} opacity={0.5} />
          </Group>
          <Group transform={earTransform} origin={vec(g.earPivots[1].x, g.earPivots[1].y)}>
            <Path path={g.ears[1]} color={COLORS.skin} />
            <Path path={g.earInners[1]} color={COLORS.cheek} opacity={0.5} />
          </Group>

          {renderWearable('hat', outfit.hat, wear, 'back')}

          {/* The face, lit softly from the upper left. */}
          <Oval rect={g.faceRect}>
            <RadialGradient c={vec(-g.faceRx * 0.3, g.faceY - g.faceRy * 0.35)} r={g.faceRx * 1.6} colors={[COLORS.skinLight, COLORS.skin, COLORS.skinShade]} positions={[0, 0.5, 1]} />
          </Oval>
          <Oval rect={g.faceRect} color={palette.trim} style="stroke" strokeWidth={g.strokeTrim} />
          {sick && <Oval rect={g.faceRect} color={COLORS.sick} opacity={0.3} />}

          {renderWearable('hat', outfit.hat, wear)}

          {stage === 'elder' && <Path path={g.beard} color={COLORS.beard} />}

          <Oval rect={g.cheeks[0]} color={COLORS.cheek} opacity={0.6} />
          <Oval rect={g.cheeks[1]} color={COLORS.cheek} opacity={0.6} />
          <Oval rect={g.noseRect} color={COLORS.skinShade} />

          {/* Eyes: open and following the gaze, crossed out when sick, or closed. */}
          {eyesClosed ? (
            <>
              <Path path={g.closedEyes[0]} color={COLORS.eye} style="stroke" strokeWidth={g.strokeThin} strokeCap="round" />
              <Path path={g.closedEyes[1]} color={COLORS.eye} style="stroke" strokeWidth={g.strokeThin} strokeCap="round" />
            </>
          ) : sick ? (
            <>
              <Path path={g.sickEyes[0]} color={COLORS.eye} style="stroke" strokeWidth={g.strokeThin} strokeCap="round" />
              <Path path={g.sickEyes[1]} color={COLORS.eye} style="stroke" strokeWidth={g.strokeThin} strokeCap="round" />
            </>
          ) : (
            <>
              <Group transform={eyeTransform}>
                <Oval rect={g.eyeRects[0]} color={COLORS.eye} />
                <Oval rect={g.eyeRects[1]} color={COLORS.eye} />
                <Circle cx={-g.eyeX - g.eyeRx * 0.3} cy={g.eyeY - g.eyeRy * 0.35} r={g.eyeRx * 0.33} color={COLORS.highlight} />
                <Circle cx={g.eyeX - g.eyeRx * 0.3} cy={g.eyeY - g.eyeRy * 0.35} r={g.eyeRx * 0.33} color={COLORS.highlight} />
                <Circle cx={-g.eyeX + g.eyeRx * 0.3} cy={g.eyeY + g.eyeRy * 0.3} r={g.eyeRx * 0.16} color={COLORS.highlight} opacity={0.9} />
                <Circle cx={g.eyeX + g.eyeRx * 0.3} cy={g.eyeY + g.eyeRy * 0.3} r={g.eyeRx * 0.16} color={COLORS.highlight} opacity={0.9} />
              </Group>
              <Group transform={lidTransform} origin={vec(g.lidPivots[0].x, g.lidPivots[0].y)}>
                <Oval rect={g.lidRects[0]} color={COLORS.skin} />
              </Group>
              <Group transform={lidTransform} origin={vec(g.lidPivots[1].x, g.lidPivots[1].y)}>
                <Oval rect={g.lidRects[1]} color={COLORS.skin} />
              </Group>
            </>
          )}

          <Group transform={browTransform}>
            <Path path={g.brows[faceMood][0]} color={COLORS.brow} style="stroke" strokeWidth={g.strokeThin} strokeCap="round" />
            <Path path={g.brows[faceMood][1]} color={COLORS.brow} style="stroke" strokeWidth={g.strokeThin} strokeCap="round" />
          </Group>

          {/* The mouth: the mood's line, the filled grin (happy mood or a
              proud grin) and the opening that chewing and singing drive. */}
          <Path path={g.mouths.happy} color={COLORS.mouthDark} opacity={grinOpacity} />
          <Path path={g.mouths[happyMood ? 'ok' : faceMood]} color={COLORS.mouthDark} style="stroke" strokeWidth={g.strokeThin} strokeCap="round" opacity={lineOpacity} />
          <Group transform={mouthTransform} origin={vec(0, g.mouthY)}>
            <Oval rect={g.mouthOpenRect} color={COLORS.mouthDark} />
          </Group>

          {sad && (
            <Group transform={tearTransform} opacity={tearOpacity}>
              <Path path={g.tears[0]} color={COLORS.tear} />
              <Path path={g.tears[1]} color={COLORS.tear} />
            </Group>
          )}

          {renderWearable('face', outfit.face, wear)}
        </Group>
      </Group>
    </Group>
  )
}
