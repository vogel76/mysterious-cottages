import { useCallback, useEffect, useMemo } from 'react'
import { BlurMask, Circle, Group, LinearGradient, Oval, Path, RadialGradient, Rect, RoundedRect, vec } from '@shopify/react-native-skia'
import { ReduceMotion, cancelAnimation, useDerivedValue, useSharedValue, withRepeat, withSequence, withSpring, withTiming, type SharedValue } from 'react-native-reanimated'
import { EASING, withAlpha } from '../../../../ui'
import type { Slot } from '../room'
import { PALETTE, buildPath, svgPath } from './draw'

/* The hearth, the warm heart of the room on the right wall: a stone
   surround laid as rounded fieldstones with mortar between, an oak mantel
   with a clay jug on it, an arched opening that glows from within, two
   crossed logs on a bed of ash, and the fire itself as three flame shapes
   one inside the other (deep orange, amber, pale gold) that sway and
   stretch on the UI thread, with embers that pulse at the base and a few
   sparks that keep rising. A hearth stone lies on the floor in front.

   The fire's motion is its own small hook, shared with the lighting layer
   so the glow on the walls breathes with the flames and the candle on the
   stool flickers at its own tempo: three looping values in 0..1, none of
   which rebuilds a path. With reduce motion on they hold at the middle
   and the fire simply stands; paused (the tab out of focus) is the same
   stillness. The anchor is the floor line under the middle of the opening.

   The same object is the room's small weather report, handed to every
   item: besides the flames it carries the lantern's swing (0 at rest; a
   tap on the lantern slot kicks it and it rings down like a pendulum, so
   the lantern variants hang their body on it) and the time of day (0 at
   night, 1 in full daylight), which the scene feeds from the device clock
   and the lighting layer and the window variants read to tint the sky and
   the light in the room; sleep forces it to night. The hook also returns
   the two controls the scene's taps use: flare() throws the flames up for
   a moment before the loop takes over again, swingLantern() kicks the
   swing. Both are a single eased movement, not a loop, so a reduce motion
   reader still gets the flare; the swing is a decaying oscillation and
   stays still for them. */

export type FireMotion = {
  /* The height and brightness of the flames, in an uneven loop; a flare
     briefly takes it above 1. */
  flicker: SharedValue<number>
  /* A slow side-to-side lean, also the sparks' rise. */
  sway: SharedValue<number>
  /* The candle's and the lantern's own flicker. */
  candle: SharedValue<number>
  /* The lantern's swing, -1..1 around 0 at rest; a kick rings it down. */
  swing: SharedValue<number>
  /* Daylight, 0 night .. 1 full day, from the clock (0 while asleep). */
  day: SharedValue<number>
}

export type FireControls = FireMotion & {
  /* The flames leap for a moment (a tap on the hearth). */
  flare: () => void
  /* The lantern starts swinging (a tap on the lantern). */
  swingLantern: () => void
}

/* The idle flicker, restarted after a flare. */
function flickerLoop() {
  return withRepeat(
    withSequence(
      withTiming(1, { duration: 380, easing: EASING.inOut }),
      withTiming(0.25, { duration: 440, easing: EASING.inOut }),
      withTiming(0.8, { duration: 260, easing: EASING.inOut }),
      withTiming(0, { duration: 540, easing: EASING.inOut }),
    ),
    -1,
    false,
  )
}

/* How high the flare reaches and how long it lasts. */
const FLARE = { peak: 1.7, upMs: 180, downMs: 520 } as const
/* A loose spring, so the kicked lantern swings a few times before it rests. */
const SWING_SPRING = { damping: 5, stiffness: 50, mass: 1, reduceMotion: ReduceMotion.Never } as const
const NEVER_REDUCE = { reduceMotion: ReduceMotion.Never } as const

export function useFireMotion({ reduceMotion, paused }: { reduceMotion: boolean; paused: boolean }): FireControls {
  const flicker = useSharedValue(0.5)
  const sway = useSharedValue(0.5)
  const candle = useSharedValue(0.5)
  const swing = useSharedValue(0)
  const day = useSharedValue(0)
  const still = reduceMotion || paused

  useEffect(() => {
    if (still) {
      cancelAnimation(flicker)
      cancelAnimation(sway)
      cancelAnimation(candle)
      cancelAnimation(swing)
      flicker.value = 0.5
      sway.value = 0.5
      candle.value = 0.5
      swing.value = 0
      return
    }
    flicker.value = flickerLoop()
    sway.value = withRepeat(withTiming(1, { duration: 1300, easing: EASING.inOut }), -1, true)
    candle.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 240, easing: EASING.inOut }),
        withTiming(0.35, { duration: 360, easing: EASING.inOut }),
        withTiming(0.75, { duration: 160, easing: EASING.inOut }),
        withTiming(0, { duration: 460, easing: EASING.inOut }),
      ),
      -1,
      false,
    )
    return () => {
      cancelAnimation(flicker)
      cancelAnimation(sway)
      cancelAnimation(candle)
      cancelAnimation(swing)
    }
  }, [still, flicker, sway, candle, swing])

  const flare = useCallback(() => {
    if (paused) return
    cancelAnimation(flicker)
    /* A single eased leap, never a loop: it keeps its duration under the
       system's reduce motion setting, which would otherwise finish both
       steps at once and show nothing. */
    const settle = reduceMotion ? withTiming(0.5, { duration: FLARE.downMs, easing: EASING.inOut, ...NEVER_REDUCE }) : withSequence(withTiming(0.4, { duration: FLARE.downMs, easing: EASING.inOut }), flickerLoop())
    flicker.value = withSequence(withTiming(FLARE.peak, { duration: FLARE.upMs, easing: EASING.out, ...NEVER_REDUCE }), settle)
  }, [flicker, paused, reduceMotion])

  const swingLantern = useCallback(() => {
    if (paused || reduceMotion) return
    cancelAnimation(swing)
    swing.value = withSequence(withTiming(1, { duration: 140, easing: EASING.out }), withSpring(0, SWING_SPRING))
  }, [swing, paused, reduceMotion])

  return useMemo(() => ({ flicker, sway, candle, swing, day, flare, swingLantern }), [flicker, sway, candle, swing, day, flare, swingLantern])
}

/* The hearth's extent around its anchor: the mantel's width, from the jug
   on top down to the hearth stone's shadow on the floor. */
export const FIREPLACE_BOUNDS = { x: -176, y: -590, width: 352, height: 666 } as const

/* One flame, base at the origin, 236 tall; the inner tongues are the same
   shape scaled down. */
const FLAME = 'M 0 0 C -62 -18 -78 -92 -40 -140 C -22 -162 -22 -196 0 -236 C 22 -196 22 -162 40 -140 C 78 -92 62 -18 0 0 Z'
const FLAME_BASE_Y = -44

type Stone = { x: number; y: number; w: number; h: number; shade: 0 | 1 | 2 }

/* The fieldstones of the surround: two pillars and a lintel, sizes nudged
   so no two rows line up. */
function layStones(): Stone[] {
  const stones: Stone[] = []
  let shade = 0
  for (const side of [-1, 1]) {
    let y = -360
    let row = 0
    while (y < -10) {
      const h = row % 2 === 0 ? 74 : 58
      const w = row % 3 === 0 ? 54 : 46
      const x = side < 0 ? -150 + (row % 2) * 4 : 150 - w - (row % 2) * 4
      stones.push({ x, y, w, h: Math.min(h, -10 - y), shade: (shade++ % 3) as 0 | 1 | 2 })
      y += h + 8
      row++
    }
  }
  const lintel = [-150, -84, -18, 46, 104]
  lintel.forEach((x, i) => {
    const w = i === lintel.length - 1 ? 46 : lintel[i + 1]! - x - 8
    stones.push({ x, y: -462, w, h: i % 2 === 0 ? 94 : 82, shade: (shade++ % 3) as 0 | 1 | 2 })
  })
  return stones
}

const STONE_SHADES = [PALETTE.stoneLight, PALETTE.stone, '#5f5b54'] as const

/* A path of small discs: embers and sparks. */
function circles(spots: ReadonlyArray<readonly [number, number, number]>) {
  return buildPath((path) => {
    for (const [x, y, r] of spots) path.addCircle(x, y, r)
  })
}

export function Fireplace({ slot, fire }: { slot: Slot; fire: FireMotion }) {
  const opening = useMemo(() => svgPath('M -90 0 L -90 -300 Q -90 -370 0 -370 Q 90 -370 90 -300 L 90 0 Z'), [])
  const flame = useMemo(() => svgPath(FLAME), [])
  const jugHandle = useMemo(() => svgPath('M 20 -50 Q 40 -44 24 -20'), [])
  const soot = useMemo(() => svgPath('M -70 -372 Q -40 -430 0 -420 Q 50 -440 76 -374 Z'), [])
  const stonePaths = useMemo(() => {
    const stones = layStones()
    return STONE_SHADES.map((_, shade) =>
      buildPath((path) => {
        for (const stone of stones) {
          if (stone.shade !== shade) continue
          path.addRRect({ rect: { x: stone.x, y: stone.y, width: stone.w, height: stone.h }, rx: 14, ry: 14 })
        }
      }),
    )
  }, [])
  const emberSpots = useMemo(
    () => ({
      warm: circles([
        [-52, -34, 4],
        [-20, -28, 3],
        [36, -30, 4.5],
        [58, -38, 3],
      ]),
      cool: circles([
        [-38, -26, 3],
        [8, -24, 3.5],
        [50, -26, 3],
      ]),
    }),
    [],
  )
  const sparks = useMemo(
    () =>
      circles([
        [-18, -250, 2.4],
        [12, -282, 2],
        [30, -230, 1.8],
      ]),
    [],
  )

  const { flicker, sway } = fire
  const outerTransform = useDerivedValue(() => [
    { translateY: FLAME_BASE_Y },
    { skewX: (sway.value - 0.5) * 0.22 },
    { scaleY: 0.9 + 0.18 * flicker.value },
    { scaleX: 1.04 - 0.08 * flicker.value },
  ])
  const midTransform = useDerivedValue(() => [{ scale: 0.68 }, { skewX: (0.5 - sway.value) * 0.18 }, { scaleY: 0.96 + 0.1 * flicker.value }])
  const innerTransform = useDerivedValue(() => [{ scale: 0.42 }, { skewX: (sway.value - 0.5) * 0.12 }, { scaleY: 0.92 + 0.16 * flicker.value }])
  const haloOpacity = useDerivedValue(() => 0.55 + 0.45 * flicker.value)
  const emberWarm = useDerivedValue(() => 0.45 + 0.55 * flicker.value)
  const emberCool = useDerivedValue(() => 1 - 0.6 * flicker.value)
  const sparkTransform = useDerivedValue(() => [{ translateY: -70 * sway.value }, { translateX: 10 * (sway.value - 0.5) }])
  const sparkOpacity = useDerivedValue(() => 0.9 - 0.9 * sway.value)

  return (
    <Group transform={[{ translateX: slot.x }, { translateY: slot.y }]}>
      {/* The surround: mortar, then the stones in three shades. */}
      <RoundedRect x={-154} y={-466} width={308} height={466} r={6}>
        <LinearGradient start={vec(0, -466)} end={vec(0, 0)} colors={[PALETTE.stoneDark, '#3f3b36']} />
      </RoundedRect>
      {stonePaths.map((path, i) => (
        <Path key={i} path={path} color={STONE_SHADES[i]!} />
      ))}
      <Rect x={-154} y={-466} width={308} height={466} blendMode="multiply">
        <LinearGradient start={vec(-154, 0)} end={vec(154, 0)} colors={[withAlpha('#5a5a70', 0.6), 'transparent', withAlpha('#ffb060', 0.5)]} positions={[0, 0.5, 1]} />
      </Rect>

      {/* The opening and the fire's light on its back wall. */}
      <Path path={opening}>
        <LinearGradient start={vec(0, -370)} end={vec(0, 0)} colors={['#0b0604', '#1e0f07', '#3a1a0a']} positions={[0, 0.55, 1]} />
      </Path>
      <Group clip={opening}>
        <Rect x={-90} y={-370} width={180} height={370} opacity={haloOpacity}>
          <RadialGradient c={vec(0, -110)} r={190} colors={[withAlpha(PALETTE.fireDeep, 0.75), withAlpha(PALETTE.fireDeep, 0.2), 'transparent']} positions={[0, 0.5, 1]} />
        </Rect>
      </Group>
      <Path path={opening} style="stroke" strokeWidth={6} color={withAlpha('#2a2622', 0.8)} />
      <Path path={soot} color={withAlpha('#000000', 0.35)}>
        <BlurMask blur={10} style="normal" />
      </Path>

      {/* The ash bed and the logs. */}
      <Oval x={-78} y={-30} width={156} height={34} color="#2a2420" />
      <Oval x={-60} y={-26} width={120} height={22} color="#5a4e46" />
      <Group transform={[{ translateX: -8 }, { translateY: -40 }, { rotate: -0.22 }]}>
        <RoundedRect x={-62} y={-13} width={124} height={26} r={13} color="#4a2e18" />
        <Rect x={-50} y={-6} width={100} height={3} color={withAlpha('#7a5230', 0.5)} />
        <Circle cx={62} cy={0} r={13} color="#7a5230" />
        <Circle cx={62} cy={0} r={7} color="#a87a4a" />
      </Group>
      <Group transform={[{ translateX: 10 }, { translateY: -46 }, { rotate: 0.28 }]}>
        <RoundedRect x={-60} y={-12} width={120} height={24} r={12} color="#3f2714" />
        <Rect x={-48} y={-5} width={96} height={3} color={withAlpha('#7a5230', 0.45)} />
        <Circle cx={-60} cy={0} r={12} color="#6b4626" />
        <Circle cx={-60} cy={0} r={6} color="#9a7044" />
      </Group>

      {/* The fire. */}
      <Group clip={opening}>
        <Group transform={outerTransform}>
          <Path path={flame} color={withAlpha(PALETTE.fireDeep, 0.55)}>
            <BlurMask blur={14} style="normal" />
          </Path>
          <Path path={flame}>
            <LinearGradient start={vec(0, 0)} end={vec(0, -236)} colors={[PALETTE.fireDeep, '#ff9a2a', withAlpha(PALETTE.fireDeep, 0.6)]} positions={[0, 0.5, 1]} />
          </Path>
          <Group transform={midTransform}>
            <Path path={flame}>
              <LinearGradient start={vec(0, 0)} end={vec(0, -236)} colors={[PALETTE.fire, PALETTE.fireLight]} />
            </Path>
          </Group>
          <Group transform={innerTransform}>
            <Path path={flame} color="#fff4c8" />
          </Group>
        </Group>
        <Path path={emberSpots.warm} color={PALETTE.fireLight} opacity={emberWarm} />
        <Path path={emberSpots.cool} color={PALETTE.fire} opacity={emberCool} />
        <Group transform={sparkTransform} opacity={sparkOpacity}>
          <Path path={sparks} color={PALETTE.fireLight} />
        </Group>
      </Group>

      {/* The mantel, its shadow and the jug on it. */}
      <Rect x={-176} y={-460} width={352} height={30}>
        <LinearGradient start={vec(0, -460)} end={vec(0, -430)} colors={[withAlpha('#000000', 0.4), 'transparent']} />
      </Rect>
      <RoundedRect x={-176} y={-512} width={352} height={52} r={6}>
        <LinearGradient start={vec(0, -512)} end={vec(0, -460)} colors={[PALETTE.beamLight, PALETTE.beam, PALETTE.beamDark]} positions={[0, 0.5, 1]} />
      </RoundedRect>
      <Rect x={-176} y={-512} width={352} height={5} color={withAlpha('#a87a4a', 0.7)} />
      <Group transform={[{ translateX: -110 }, { translateY: -512 }]}>
        <Oval x={-22} y={-54} width={44} height={54} color="#8a5a3a" />
        <Rect x={-10} y={-70} width={20} height={20} color="#7a4e30" />
        <Oval x={-10} y={-74} width={20} height={8} color="#5a3620" />
        <Path path={jugHandle} style="stroke" strokeWidth={6} strokeCap="round" color="#7a4e30" />
        <Oval x={-14} y={-48} width={14} height={34} color={withAlpha('#ffd9a0', 0.22)} />
      </Group>
      <Group transform={[{ translateX: 100 }, { translateY: -512 }]}>
        <RoundedRect x={-30} y={-16} width={60} height={16} r={3} color="#4a6a4a" />
        <RoundedRect x={-26} y={-30} width={52} height={14} r={3} color="#7a3a3a" />
        <Rect x={-30} y={-16} width={60} height={3} color={withAlpha('#ffffff', 0.15)} />
      </Group>

      {/* The hearth stone on the floor. */}
      <Rect x={-136} y={0} width={272} height={46}>
        <LinearGradient start={vec(0, 0)} end={vec(0, 46)} colors={[PALETTE.stone, PALETTE.stoneDark]} />
      </Rect>
      <Rect x={-136} y={0} width={272} height={8} color={PALETTE.stoneLight} />
      <Rect x={-136} y={46} width={272} height={30}>
        <LinearGradient start={vec(0, 46)} end={vec(0, 76)} colors={[withAlpha('#000000', 0.4), 'transparent']} />
      </Rect>
    </Group>
  )
}
