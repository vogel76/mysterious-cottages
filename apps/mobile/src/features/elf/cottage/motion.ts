import { useCallback, useEffect, useMemo, useRef } from 'react'
import { ReduceMotion, cancelAnimation, useFrameCallback, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming, type SharedValue } from 'react-native-reanimated'
import { EASING, SPRINGS } from '../../../ui'
import type { Mood, Stage } from '../rules'
import { EGG_HIT_BOX } from './EggNest'
import { PUPPET_HEIGHT } from './puppet/geometry'
import { ROOM } from './room'

/* The life of the cottage puppet as shared values: a set of control
   numbers (breath, bob, squash, tilt, blink, look, lookY, mouth, glow,
   headTilt, earWiggle, hoodSwing, armL, armR, lidDroop, grin, browLift)
   that the puppet and the egg bind to their Skia transforms, and a small
   pool of particles (hearts, sparkles, bubbles, zzz, crumbs) that the
   reactions borrow. Everything moves on the UI thread through reanimated
   loops; the JS thread only starts and cancels them. The idle loops follow
   the mood (a happy elf bounces, a sad one slumps, a sick one wobbles, a
   sleeping one only breathes while zzz rise every two seconds), and
   react(kind) plays a short reaction on top: it cancels the previous one,
   drives the values it needs and, once it is over, hands them back to the
   idle loops; it says whether it took the reaction, since a paused or
   sleeping elf, or one in the middle of its level hop, refuses most, and
   the scene's frames must not react where the body does not. Hops and chews start with a short crouch (anticipation), and
   the hood tip and the ears trail the body through a spring follower that
   runs once per frame, so they lag and overshoot (follow-through) without
   any reaction knowing about them.

   The elf also notices the player: lookAt(x, y) turns the eyes and the
   head toward a room point for as long as it keeps being called, and
   lookRelease eases back to wandering; admireAt looks at a point and plays
   the admire reaction. While awake and left alone a scheduler picks a
   small fidget every 8-15 s (an ear twitch, a yawn, a scratch, a glance at
   the fire, a shift of weight, a hum) so the elf never freezes; yawns are
   favoured when the elf is tired, and tired lids droop to half.

   A level gained outranks the care reaction that caused it: the provider
   emits it synchronously from care(), so the care reaction arrives right
   after and would otherwise cut the hop short; while 'levelUp' plays, the
   other kinds are ignored. 'stroke' is special too: it is called again and
   again while the finger moves, and each call only extends it and lets a
   heart go at most every 180 ms. With reduce motion on there are no loops
   at all, the puppet holds a still pose and a reaction is only a brief
   blip of its particles. Paused (the tab out of focus) is the same still
   pose with no reactions, no fidgets and no zzz, so nothing runs on the UI
   thread for a scene nobody sees; the loops resume when the focus returns.
   Asleep, the elf answers nothing but the wake, a level and the egg, and
   neither its eyes nor its head follow a finger: the wardrobe and the
   decorating mode stay open over a sleeping elf, and a twirl or a clap
   with the eyes shut would read as a wake that never happened. */

export type ReactionKind = 'pet' | 'feed' | 'play' | 'bath' | 'wake' | 'egg' | 'levelUp' | 'stroke' | 'poke' | 'call' | 'greet' | 'twirl' | 'admire' | 'fidget'

export type PuppetMotion = {
  /* 0..1 slow loop. */
  breath: SharedValue<number>
  /* Vertical offset in room units (negative is up). */
  bob: SharedValue<number>
  /* 1 = none; <1 squashed, >1 stretched (the body's scaleY, scaleX = 1 / squash). */
  squash: SharedValue<number>
  /* Radians, small; the whole body around the feet. */
  tilt: SharedValue<number>
  /* 0 open .. 1 closed. */
  blink: SharedValue<number>
  /* -1..1, where the pupils look sideways. */
  look: SharedValue<number>
  /* -1..1, where the pupils look up (negative) or down. */
  lookY: SharedValue<number>
  /* 0 closed .. 1 open (chewing, singing, yawning). */
  mouth: SharedValue<number>
  /* 0..1, the egg's warmth pulse / the elder's aura breath. */
  glow: SharedValue<number>
  /* Radians, the head alone around the neck. */
  headTilt: SharedValue<number>
  /* -1..1, the ears around the skull edges (opposite phases). */
  earWiggle: SharedValue<number>
  /* -1..1, the hood tip and the pompom (and a scarf's tail, a nightcap). */
  hoodSwing: SharedValue<number>
  /* Radians, the arms around the shoulders; 0 is rest, positive raises the
     arm outwards and up. */
  armL: SharedValue<number>
  armR: SharedValue<number>
  /* 0..1, tired half lids. */
  lidDroop: SharedValue<number>
  /* 0..1, a proud grin that picks the happy mouth whatever the mood. */
  grin: SharedValue<number>
  /* 0..1, the brows lifted (surprise, admiration). */
  browLift: SharedValue<number>
}

export type ParticleKind = 'heart' | 'sparkle' | 'bubble' | 'zzz' | 'crumb'
export const PARTICLE_KINDS: readonly ParticleKind[] = ['heart', 'sparkle', 'bubble', 'zzz', 'crumb']
export const PARTICLE_POOL = 10

export type Particle = {
  x: SharedValue<number>
  y: SharedValue<number>
  scale: SharedValue<number>
  opacity: SharedValue<number>
  /* Index into PARTICLE_KINDS. */
  kind: SharedValue<number>
}

export type CottageMotion = {
  motion: PuppetMotion
  particles: readonly Particle[]
  /* True when the reaction plays; false when it was refused. */
  react: (kind: ReactionKind) => boolean
  /* Room units: the eyes and the head turn toward the point and stay
     there while this keeps being called. */
  lookAt: (x: number, y: number) => void
  /* Ease back and let the eyes wander again. */
  lookRelease: () => void
  /* Look at a room point and play 'admire'. */
  admireAt: (x: number, y: number) => void
}

type Options = { stage: Stage; mood: Mood; sleeping: boolean; reduceMotion: boolean; paused: boolean; tired?: boolean }

/* Tuning knobs of the idle loops, in milliseconds and room units. */
const IDLE = {
  breathMs: 3200,
  breathSadMs: 4400,
  breathSleepMs: 5200,
  /* Awake the breath only reaches this far; asleep it goes all the way. */
  breathAwakeDepth: 0.75,
  bobMs: 1600,
  bobUnits: 6,
  bobHappyMs: 900,
  bobHappyUnits: 14,
  blinkCloseMs: 70,
  blinkOpenMs: 110,
  /* A few different gaps in sequence so the blinking does not look mechanical. */
  blinkGapsMs: [2800, 4100, 3300, 5000, 3700],
  lookMs: 500,
  /* Where the eyes wander to, and how long they rest there before. */
  lookTargets: [
    { to: 0.6, up: -0.1, after: 4000 },
    { to: -0.4, up: 0.2, after: 5500 },
    { to: 0.2, up: -0.3, after: 4500 },
    { to: -0.6, up: 0.1, after: 7000 },
    { to: 0, up: 0, after: 5000 },
  ],
  sadTilt: -0.08,
  sadSquash: 0.94,
  sickWobble: 0.05,
  sickWobbleMs: 700,
  sleepTilt: -0.06,
  glowEggMs: 1400,
  glowElderMs: 2400,
  glowLow: 0.3,
  zzzEveryMs: 2000,
  /* Tired lids rest at this droop. */
  tiredDroop: 0.6,
} as const

/* The gaze: how far from the head (room units) a point is a full look,
   how much the head leans along, and how fast it turns. */
const GAZE = { reach: 0.9, headTilt: 0.14, strokeLean: 0.22, turnMs: 140, releaseMs: 450 } as const
/* The values a held or releasing gaze owns; applyIdle leaves them alone. */
const GAZE_VALUES: ReadonlySet<keyof PuppetMotion> = new Set(['look', 'lookY', 'headTilt'])

/* The spring follower of the hood tip and the ears: the body's tilt and
   bob are read as one swing signal, a spring chases it, and the lag
   between the two becomes the swing. Underdamped on purpose. */
const FOLLOW = {
  tiltGain: 6,
  bobGain: 1 / 40,
  hoodStiffness: 150,
  hoodDamping: 11,
  earStiffness: 240,
  earDamping: 15,
  earGain: 0.6,
  maxDtMs: 48,
} as const

/* Durations of the reactions, after which the idle loops take over again. */
const REACTION_MS: Record<Exclude<ReactionKind, 'fidget'>, number> = {
  pet: 1200,
  feed: 1700,
  play: 1100,
  bath: 1500,
  wake: 900,
  egg: 900,
  levelUp: 1300,
  stroke: 500,
  poke: 650,
  call: 1400,
  greet: 1800,
  twirl: 2000,
  admire: 1400,
}

/* The short crouch before a hop or a chew. */
const ANTICIPATION = { ms: 100, squash: 0.93 } as const

/* Strokes let a heart go at most this often. */
const STROKE_HEART_MS = 180

type Fidget = 'earTwitch' | 'yawn' | 'scratch' | 'lookFire' | 'shiftWeight' | 'hum'
const FIDGETS: readonly Fidget[] = ['earTwitch', 'yawn', 'scratch', 'lookFire', 'shiftWeight', 'hum']
const FIDGET_MS: Record<Fidget, number> = { earTwitch: 600, yawn: 1500, scratch: 1700, lookFire: 2400, shiftWeight: 1300, hum: 1600 }
/* How long the elf is left alone before the next fidget. */
const FIDGET_GAP_MS = { min: 8000, max: 15000, retry: 3000 } as const
/* Where the fire is, for the glance. */
const FIRE_POINT = { x: 740, y: 1000 } as const

/* With reduce motion a reaction is only this blip of its particles. */
const BLIP_MS = 300

/* The particles a reaction (or the sleep) throws; none for the quiet ones. */
const REACTION_PARTICLE: Partial<Record<ReactionKind, ParticleKind>> = {
  pet: 'heart',
  feed: 'crumb',
  play: 'sparkle',
  bath: 'bubble',
  wake: 'sparkle',
  egg: 'sparkle',
  levelUp: 'sparkle',
  stroke: 'heart',
  greet: 'sparkle',
  twirl: 'sparkle',
  admire: 'sparkle',
}

const NEVER_REDUCE = { reduceMotion: ReduceMotion.Never }

type Spawn = {
  kind: ParticleKind
  x: number
  y: number
  /* Where it travels to, in room units. */
  dx: number
  dy: number
  delay?: number
  duration: number
  scaleFrom?: number
  scaleTo?: number
  /* A sideways sway on the way (hearts, bubbles). */
  sway?: number
  /* Gravity-like fall instead of an eased drift. */
  fall?: boolean
}

function figureHeight(stage: Stage): number {
  return stage === 'egg' ? EGG_HIT_BOX.height : PUPPET_HEIGHT[stage]
}

function clamp(value: number, min: number, max: number): number {
  'worklet'
  return Math.min(max, Math.max(min, value))
}

function useParticlePool(): readonly Particle[] {
  /* The pool has a fixed size, so the hook count is constant. The array
     itself is memoised once: the shared values never change, and a fresh
     array per render would retrigger every effect and callback built on
     the pool. */
  const pool: Particle[] = []
  for (let index = 0; index < PARTICLE_POOL; index += 1) {
    pool.push({
      // eslint-disable-next-line react-hooks/rules-of-hooks
      x: useSharedValue(0),
      // eslint-disable-next-line react-hooks/rules-of-hooks
      y: useSharedValue(0),
      // eslint-disable-next-line react-hooks/rules-of-hooks
      scale: useSharedValue(1),
      // eslint-disable-next-line react-hooks/rules-of-hooks
      opacity: useSharedValue(0),
      // eslint-disable-next-line react-hooks/rules-of-hooks
      kind: useSharedValue(0),
    })
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => pool, [])
}

/* A wave of the arm: up, two swings, down. */
function wave(duration: number) {
  const up = 2.5
  return withSequence(
    withTiming(up, { duration: duration * 0.25, easing: EASING.out }),
    withTiming(up + 0.35, { duration: duration * 0.12, easing: EASING.inOut }),
    withTiming(up - 0.35, { duration: duration * 0.14, easing: EASING.inOut }),
    withTiming(up + 0.35, { duration: duration * 0.12, easing: EASING.inOut }),
    withTiming(up - 0.2, { duration: duration * 0.12, easing: EASING.inOut }),
    withTiming(0, { duration: duration * 0.25, easing: EASING.inOut }),
  )
}

export function useCottageMotion(options: Options): CottageMotion {
  const breath = useSharedValue(0)
  const bob = useSharedValue(0)
  const squash = useSharedValue(1)
  const tilt = useSharedValue(0)
  const blink = useSharedValue(0)
  const look = useSharedValue(0)
  const lookY = useSharedValue(0)
  const mouth = useSharedValue(0)
  const glow = useSharedValue(0)
  const headTilt = useSharedValue(0)
  const earWiggle = useSharedValue(0)
  const hoodSwing = useSharedValue(0)
  const armL = useSharedValue(0)
  const armR = useSharedValue(0)
  const lidDroop = useSharedValue(0)
  const grin = useSharedValue(0)
  const browLift = useSharedValue(0)
  const particles = useParticlePool()

  /* The follower's state: the hood's and the ears' chased positions and
     velocities, and the ear twitch a fidget adds on top. */
  const hoodPos = useSharedValue(0)
  const hoodVel = useSharedValue(0)
  const earPos = useSharedValue(0)
  const earVel = useSharedValue(0)
  const earTwitch = useSharedValue(0)

  const motionRef = useRef<PuppetMotion>({ breath, bob, squash, tilt, blink, look, lookY, mouth, glow, headTilt, earWiggle, hoodSwing, armL, armR, lidDroop, grin, browLift })
  const optionsRef = useRef(options)
  optionsRef.current = options
  /* Until when a reaction owns the values, which one it is, and the timer
     that gives them back. */
  const reactionUntil = useRef(0)
  const reactionKind = useRef<ReactionKind | null>(null)
  const restartTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /* The gaze: held by lookAt until lookRelease, or aimed by a fidget or
     admire for a while. */
  const gazeHeld = useRef(false)
  const gazeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /* Where the gaze was last aimed (room units), so a stroke can lean the
     head into the finger at once. */
  const gazePoint = useRef<{ x: number; y: number }>({ x: ROOM.elfAnchor.x, y: ROOM.elfAnchor.y })
  const fidgetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastHeart = useRef(0)
  const strokeCount = useRef(0)
  /* Until when each particle of the pool is taken. */
  const particleBusy = useRef<number[]>(new Array<number>(PARTICLE_POOL).fill(0))

  const cancelAll = useCallback(() => {
    const motion = motionRef.current
    for (const value of Object.values(motion)) cancelAnimation(value)
    cancelAnimation(earTwitch)
  }, [earTwitch])

  /* The hood tip and the ears trail the body, once per frame. */
  const follower = useFrameCallback((frame) => {
    const dt = Math.min(frame.timeSincePreviousFrame ?? 16, FOLLOW.maxDtMs) / 1000
    const signal = tilt.value * FOLLOW.tiltGain + bob.value * FOLLOW.bobGain
    const hoodAcc = (signal - hoodPos.value) * FOLLOW.hoodStiffness - hoodVel.value * FOLLOW.hoodDamping
    hoodVel.value += hoodAcc * dt
    hoodPos.value += hoodVel.value * dt
    hoodSwing.value = clamp(hoodPos.value - signal, -1, 1)
    const earAcc = (signal - earPos.value) * FOLLOW.earStiffness - earVel.value * FOLLOW.earDamping
    earVel.value += earAcc * dt
    earPos.value += earVel.value * dt
    earWiggle.value = clamp((earPos.value - signal) * FOLLOW.earGain + earTwitch.value, -1, 1)
  }, false)

  /* The wandering gaze. */
  const startWander = useCallback(() => {
    const motion = motionRef.current
    motion.look.value = withRepeat(withSequence(...IDLE.lookTargets.map(({ to, after }) => withDelay(after, withTiming(to, { duration: IDLE.lookMs, easing: EASING.inOut })))), -1)
    motion.lookY.value = withRepeat(withSequence(...IDLE.lookTargets.map(({ up, after }) => withDelay(after, withTiming(up, { duration: IDLE.lookMs, easing: EASING.inOut })))), -1)
  }, [])

  /* The idle loops (or the still pose) for the options as they are now. */
  const applyIdle = useCallback(() => {
    const { stage, mood, sleeping, reduceMotion, paused, tired = false } = optionsRef.current
    const motion = motionRef.current
    /* A gaze that is held, or easing back under unaim's own timer, keeps
       its three values: cancelling them here would freeze the eyes on
       their last target and leave the elf staring. */
    const keepGaze = gazeHeld.current || gazeTimer.current !== null
    for (const [key, value] of Object.entries(motion) as Array<[keyof PuppetMotion, SharedValue<number>]>) {
      if (keepGaze && GAZE_VALUES.has(key)) continue
      cancelAnimation(value)
    }
    cancelAnimation(earTwitch)
    const egg = stage === 'egg'
    const sad = mood === 'sad'
    const asleep = sleeping || mood === 'sleep'
    const glows = egg || stage === 'elder'
    const droop = tired && !asleep && !egg ? IDLE.tiredDroop : 0

    if (reduceMotion || paused) {
      motion.breath.value = 0.5
      motion.bob.value = 0
      motion.squash.value = sad ? IDLE.sadSquash : 1
      motion.tilt.value = sad ? IDLE.sadTilt : asleep ? IDLE.sleepTilt : 0
      motion.blink.value = asleep ? 1 : 0
      motion.look.value = 0
      motion.lookY.value = 0
      motion.mouth.value = 0
      motion.glow.value = glows ? 0.7 : 0
      motion.headTilt.value = 0
      motion.earWiggle.value = 0
      motion.hoodSwing.value = 0
      motion.armL.value = 0
      motion.armR.value = 0
      motion.lidDroop.value = droop
      motion.grin.value = 0
      motion.browLift.value = 0
      earTwitch.value = 0
      return
    }

    const breathHalf = (asleep ? IDLE.breathSleepMs : sad ? IDLE.breathSadMs : IDLE.breathMs) / 2
    const depth = asleep ? 1 : IDLE.breathAwakeDepth
    motion.breath.value = withRepeat(withSequence(withTiming(depth, { duration: breathHalf, easing: EASING.inOut }), withTiming(0, { duration: breathHalf, easing: EASING.inOut })), -1)

    motion.mouth.value = withTiming(0, { duration: 200 })
    motion.armL.value = withTiming(0, { duration: 350, easing: EASING.inOut })
    motion.armR.value = withTiming(0, { duration: 350, easing: EASING.inOut })
    motion.grin.value = withTiming(0, { duration: 300 })
    motion.browLift.value = withTiming(0, { duration: 300 })
    motion.lidDroop.value = withTiming(droop, { duration: 500, easing: EASING.inOut })
    if (!keepGaze) motion.headTilt.value = withTiming(0, { duration: 400, easing: EASING.inOut })

    if (glows) {
      const half = (egg ? IDLE.glowEggMs : IDLE.glowElderMs) / 2
      motion.glow.value = withRepeat(withSequence(withTiming(1, { duration: half, easing: EASING.inOut }), withTiming(IDLE.glowLow, { duration: half, easing: EASING.inOut })), -1)
    } else {
      motion.glow.value = withTiming(0, { duration: 300 })
    }

    if (egg) {
      motion.bob.value = withTiming(0, { duration: 200 })
      motion.squash.value = withTiming(1, { duration: 200 })
      motion.tilt.value = withTiming(0, { duration: 300 })
      motion.blink.value = 0
      motion.look.value = 0
      motion.lookY.value = 0
      return
    }

    if (asleep) {
      motion.bob.value = withTiming(0, { duration: 400 })
      motion.squash.value = withTiming(1, { duration: 400 })
      motion.tilt.value = withTiming(IDLE.sleepTilt, { duration: 600, easing: EASING.inOut })
      motion.blink.value = withTiming(1, { duration: 300 })
      motion.look.value = withTiming(0, { duration: 300 })
      motion.lookY.value = withTiming(0, { duration: 300 })
      return
    }

    if (mood === 'happy') {
      motion.bob.value = withRepeat(withSequence(withTiming(-IDLE.bobHappyUnits, { duration: IDLE.bobHappyMs / 2, easing: EASING.out }), withTiming(0, { duration: IDLE.bobHappyMs / 2, easing: EASING.inOut })), -1)
    } else if (sad) {
      motion.bob.value = withTiming(0, { duration: 400 })
    } else {
      motion.bob.value = withRepeat(withSequence(withTiming(-IDLE.bobUnits, { duration: IDLE.bobMs / 2, easing: EASING.inOut }), withTiming(0, { duration: IDLE.bobMs / 2, easing: EASING.inOut })), -1)
    }

    motion.squash.value = withTiming(sad ? IDLE.sadSquash : 1, { duration: 500, easing: EASING.inOut })

    if (sad) {
      motion.tilt.value = withTiming(IDLE.sadTilt, { duration: 600, easing: EASING.inOut })
    } else if (mood === 'sick') {
      motion.tilt.value = withRepeat(withSequence(withTiming(IDLE.sickWobble, { duration: IDLE.sickWobbleMs, easing: EASING.inOut }), withTiming(-IDLE.sickWobble, { duration: IDLE.sickWobbleMs, easing: EASING.inOut })), -1)
    } else {
      motion.tilt.value = withTiming(0, { duration: 400 })
    }

    /* The lids open first: a stroke leaves them shut, and the loop's first
       gap would otherwise hold them so for almost three seconds. */
    motion.blink.value = withSequence(
      withTiming(0, { duration: IDLE.blinkOpenMs }),
      withRepeat(
        withSequence(...IDLE.blinkGapsMs.flatMap((gap) => [withDelay(gap, withTiming(1, { duration: IDLE.blinkCloseMs })), withTiming(0, { duration: IDLE.blinkOpenMs })])),
        -1,
      ),
    )
    if (!keepGaze) startWander()
  }, [earTwitch, startWander])

  /* A free particle of the pool, or null when all ten are in the air. */
  const take = useCallback(
    (until: number): Particle | null => {
      const now = Date.now()
      const busy = particleBusy.current
      for (let index = 0; index < particles.length; index += 1) {
        if (busy[index] <= now) {
          busy[index] = until
          return particles[index]
        }
      }
      return null
    },
    [particles],
  )

  const spawn = useCallback(
    (spec: Spawn) => {
      const delay = spec.delay ?? 0
      const particle = take(Date.now() + delay + spec.duration + 50)
      if (!particle) return
      for (const value of [particle.x, particle.y, particle.scale, particle.opacity]) cancelAnimation(value)
      particle.kind.value = PARTICLE_KINDS.indexOf(spec.kind)
      particle.x.value = spec.x
      particle.y.value = spec.y
      particle.scale.value = spec.scaleFrom ?? 0.6
      particle.opacity.value = 0
      const easing = spec.fall ? EASING.linear : EASING.out
      const fallEasing = spec.fall ? { easing: EASING.linear } : { easing: EASING.inOut }
      if (spec.sway) {
        particle.x.value = withDelay(
          delay,
          withSequence(withTiming(spec.x + spec.sway, { duration: spec.duration / 2, easing: EASING.inOut }), withTiming(spec.x + spec.dx - spec.sway * 0.5, { duration: spec.duration / 2, easing: EASING.inOut })),
        )
      } else {
        particle.x.value = withDelay(delay, withTiming(spec.x + spec.dx, { duration: spec.duration, easing }))
      }
      particle.y.value = withDelay(delay, withTiming(spec.y + spec.dy, spec.fall ? { duration: spec.duration, easing: EASING.linear } : { duration: spec.duration, ...fallEasing }))
      particle.scale.value = withDelay(delay, withTiming(spec.scaleTo ?? 1, { duration: spec.duration * 0.6, easing: EASING.out }))
      const fadeIn = Math.min(120, spec.duration * 0.2)
      const fadeOut = Math.min(360, spec.duration * 0.4)
      particle.opacity.value = withDelay(
        delay,
        withSequence(withTiming(1, { duration: fadeIn }), withTiming(1, { duration: Math.max(0, spec.duration - fadeIn - fadeOut) }), withTiming(0, { duration: fadeOut })),
      )
    },
    [take],
  )

  /* With reduce motion: a few still particles that appear and go. */
  const blip = useCallback(
    (kind: ParticleKind, headX: number, headY: number) => {
      const offsets = [-70, 0, 70]
      for (const offset of offsets) {
        const particle = take(Date.now() + BLIP_MS + 50)
        if (!particle) return
        cancelAnimation(particle.opacity)
        particle.kind.value = PARTICLE_KINDS.indexOf(kind)
        particle.x.value = headX + offset
        particle.y.value = headY - 90 + Math.abs(offset) * 0.3
        particle.scale.value = 1
        particle.opacity.value = withSequence(withTiming(1, { duration: BLIP_MS / 2, ...NEVER_REDUCE }), withTiming(0, { duration: BLIP_MS / 2, ...NEVER_REDUCE }))
      }
    },
    [take],
  )

  /* A few sparkles around the head. */
  const sparkleBurst = useCallback(
    (ox: number, headY: number, count: number, spread: number) => {
      for (let index = 0; index < count; index += 1) {
        const angle = (index / count) * Math.PI * 2 - Math.PI / 2
        spawn({ kind: 'sparkle', x: ox + Math.cos(angle) * spread * 0.4, y: headY + Math.sin(angle) * spread * 0.3, dx: Math.cos(angle) * spread, dy: Math.sin(angle) * spread * 0.7 - 50, delay: (index % 3) * 70, duration: 800, scaleFrom: 0.4, scaleTo: 1.1 })
      }
    },
    [spawn],
  )

  /* Turn the eyes and the head toward a room point. */
  const aim = useCallback((x: number, y: number) => {
    const { stage } = optionsRef.current
    const motion = motionRef.current
    const height = figureHeight(stage)
    const headX = ROOM.elfAnchor.x
    const headY = ROOM.elfAnchor.y - 0.8 * height
    const lx = clamp((x - headX) / (GAZE.reach * height), -1, 1)
    const ly = clamp((y - headY) / (GAZE.reach * height), -1, 1)
    gazePoint.current = { x, y }
    /* While stroked the head leans into the finger, not just along the eyes. */
    const lean = reactionKind.current === 'stroke' ? GAZE.strokeLean : GAZE.headTilt
    cancelAnimation(motion.look)
    cancelAnimation(motion.lookY)
    cancelAnimation(motion.headTilt)
    motion.look.value = withTiming(lx, { duration: GAZE.turnMs, easing: EASING.out })
    motion.lookY.value = withTiming(ly, { duration: GAZE.turnMs, easing: EASING.out })
    motion.headTilt.value = withTiming(lx * lean, { duration: GAZE.turnMs * 2, easing: EASING.out })
  }, [])

  /* Ease the gaze back and let the eyes wander again. */
  const unaim = useCallback(() => {
    const motion = motionRef.current
    const { stage, sleeping, mood } = optionsRef.current
    cancelAnimation(motion.look)
    cancelAnimation(motion.lookY)
    cancelAnimation(motion.headTilt)
    motion.look.value = withTiming(0, { duration: GAZE.releaseMs, easing: EASING.inOut })
    motion.lookY.value = withTiming(0, { duration: GAZE.releaseMs, easing: EASING.inOut })
    motion.headTilt.value = withTiming(0, { duration: GAZE.releaseMs, easing: EASING.inOut })
    const awake = stage !== 'egg' && !sleeping && mood !== 'sleep'
    if (!awake) return
    if (gazeTimer.current) clearTimeout(gazeTimer.current)
    gazeTimer.current = setTimeout(() => {
      gazeTimer.current = null
      if (!gazeHeld.current && !optionsRef.current.paused && !optionsRef.current.reduceMotion) startWander()
    }, GAZE.releaseMs)
  }, [startWander])

  const lookAt = useCallback(
    (x: number, y: number) => {
      const { stage, reduceMotion, paused, sleeping, mood } = optionsRef.current
      if (stage === 'egg' || reduceMotion || paused || sleeping || mood === 'sleep') return
      if (gazeTimer.current) clearTimeout(gazeTimer.current)
      gazeTimer.current = null
      gazeHeld.current = true
      aim(x, y)
    },
    [aim],
  )

  const lookRelease = useCallback(() => {
    if (!gazeHeld.current) return
    gazeHeld.current = false
    const { stage, reduceMotion, paused } = optionsRef.current
    if (stage === 'egg' || reduceMotion || paused) return
    unaim()
  }, [unaim])

  /* A glance that lets go by itself (fidgets, admire). */
  const glance = useCallback(
    (x: number, y: number, holdMs: number) => {
      const { sleeping, mood } = optionsRef.current
      if (gazeHeld.current || sleeping || mood === 'sleep') return
      aim(x, y)
      if (gazeTimer.current) clearTimeout(gazeTimer.current)
      gazeTimer.current = setTimeout(() => {
        gazeTimer.current = null
        if (!gazeHeld.current) unaim()
      }, holdMs)
    },
    [aim, unaim],
  )

  const pickFidget = useCallback((): Fidget => {
    const { tired = false, mood } = optionsRef.current
    const weights = FIDGETS.map((fidget) => (fidget === 'yawn' ? (tired ? 4 : 1) : fidget === 'hum' && mood !== 'happy' && mood !== 'ok' ? 0.3 : 1))
    const total = weights.reduce((sum, weight) => sum + weight, 0)
    let roll = Math.random() * total
    for (let index = 0; index < FIDGETS.length; index += 1) {
      roll -= weights[index]
      if (roll <= 0) return FIDGETS[index]
    }
    return FIDGETS[0]
  }, [])

  const react = useCallback(
    (kind: ReactionKind): boolean => {
      const { stage, reduceMotion, paused, sleeping, mood, tired = false } = optionsRef.current
      if (paused) return false
      /* A sleeping elf only wakes, grows or is rocked in its egg. */
      if ((sleeping || mood === 'sleep') && kind !== 'wake' && kind !== 'levelUp' && kind !== 'egg') return false
      const now = Date.now()
      const active = now < reactionUntil.current
      /* The hop of a level is not cut short by the care reaction behind it. */
      if (kind !== 'levelUp' && reactionKind.current === 'levelUp' && active) return false
      /* A fidget never interrupts anything. */
      if (kind === 'fidget' && active) return false
      const motion = motionRef.current
      const height = figureHeight(stage)
      const { x: ox, y: oy } = ROOM.elfAnchor
      const headY = oy - 0.8 * height
      const bodyY = oy - 0.4 * height
      const halfWidth = 0.22 * height

      if (reduceMotion) {
        /* The stroke's heart is throttled here too: the pan calls on every
           move event, and a blip per frame would drain the pool at once. */
        if (kind === 'stroke') {
          if (now - lastHeart.current < STROKE_HEART_MS) return true
          lastHeart.current = now
        }
        const particle = REACTION_PARTICLE[kind]
        if (particle) blip(particle, ox, headY)
        return true
      }

      /* A stroke in progress only goes on, with a heart now and then. */
      if (kind === 'stroke' && reactionKind.current === 'stroke' && active) {
        reactionUntil.current = now + REACTION_MS.stroke
        if (restartTimer.current) clearTimeout(restartTimer.current)
        restartTimer.current = setTimeout(() => {
          restartTimer.current = null
          reactionUntil.current = 0
          reactionKind.current = null
          applyIdle()
        }, REACTION_MS.stroke)
        if (now - lastHeart.current >= STROKE_HEART_MS) {
          lastHeart.current = now
          strokeCount.current += 1
          const dx = ((strokeCount.current % 5) - 2) * 32
          spawn({ kind: 'heart', x: ox + dx, y: headY - 0.3 * height, dx: dx * 0.4, dy: -130, duration: 900, sway: 14, scaleFrom: 0.4, scaleTo: 0.9 })
        }
        return true
      }

      const fidget: Fidget = kind === 'fidget' ? pickFidget() : 'earTwitch'
      const duration = kind === 'fidget' ? FIDGET_MS[fidget] : REACTION_MS[kind]

      if (restartTimer.current) clearTimeout(restartTimer.current)
      reactionUntil.current = now + duration
      reactionKind.current = kind
      restartTimer.current = setTimeout(() => {
        restartTimer.current = null
        reactionUntil.current = 0
        reactionKind.current = null
        applyIdle()
      }, duration)

      switch (kind) {
        case 'pet': {
          cancelAnimation(motion.squash)
          motion.squash.value = withSequence(withTiming(0.85, { duration: 120, easing: EASING.out }), withSpring(1.12, SPRINGS.snappy), withSpring(1, SPRINGS.gentle))
          const spots = [-60, 10, 70]
          spots.forEach((dx, index) => spawn({ kind: 'heart', x: ox + dx, y: headY - 0.25 * height, dx: dx * 0.3, dy: -150, delay: index * 140, duration: 1000, sway: 18, scaleFrom: 0.5, scaleTo: 1.1 }))
          break
        }
        case 'feed': {
          cancelAnimation(motion.mouth)
          cancelAnimation(motion.squash)
          /* A crouch, then four chews, then a contented settle. */
          motion.squash.value = withSequence(
            withTiming(ANTICIPATION.squash, { duration: ANTICIPATION.ms, easing: EASING.out }),
            withTiming(1, { duration: 120, easing: EASING.out }),
            withDelay(1000, withSequence(withTiming(0.93, { duration: 150, easing: EASING.out }), withSpring(1, SPRINGS.gentle))),
          )
          motion.mouth.value = withDelay(ANTICIPATION.ms, withSequence(withRepeat(withSequence(withTiming(1, { duration: 140 }), withTiming(0, { duration: 140 })), 4), withTiming(0, { duration: 80 })))
          const crumbs = [-26, 14, 32]
          crumbs.forEach((dx, index) => spawn({ kind: 'crumb', x: ox + dx, y: headY + 0.1 * height, dx: dx * 0.8, dy: 0.72 * height, delay: 260 + index * 250, duration: 620, fall: true, scaleFrom: 0.9, scaleTo: 0.7 }))
          break
        }
        case 'play': {
          cancelAnimation(motion.bob)
          cancelAnimation(motion.tilt)
          cancelAnimation(motion.squash)
          motion.squash.value = withSequence(withTiming(ANTICIPATION.squash, { duration: ANTICIPATION.ms, easing: EASING.out }), withTiming(1.06, { duration: 200, easing: EASING.out }), withSpring(1, SPRINGS.gentle))
          motion.bob.value = withDelay(
            ANTICIPATION.ms,
            withSequence(withTiming(-70, { duration: 260, easing: EASING.out }), withTiming(0, { duration: 240, easing: EASING.inOut }), withTiming(-55, { duration: 240, easing: EASING.out }), withTiming(0, { duration: 220, easing: EASING.inOut })),
          )
          motion.tilt.value = withDelay(ANTICIPATION.ms, withSequence(withTiming(0.12, { duration: 260, easing: EASING.inOut }), withTiming(-0.12, { duration: 480, easing: EASING.inOut }), withTiming(0, { duration: 220, easing: EASING.inOut })))
          const angles = [-1.1, -0.4, 0.3, 1.0, 1.9]
          angles.forEach((angle, index) => spawn({ kind: 'sparkle', x: ox + Math.cos(angle) * halfWidth * 0.6, y: bodyY + Math.sin(angle) * 0.2 * height, dx: Math.cos(angle) * 110, dy: Math.sin(angle) * 90 - 60, delay: ANTICIPATION.ms + index * 90, duration: 800, scaleFrom: 0.4, scaleTo: 1.2 }))
          break
        }
        case 'bath': {
          cancelAnimation(motion.tilt)
          motion.tilt.value = withSequence(withRepeat(withSequence(withTiming(0.04, { duration: 60 }), withTiming(-0.04, { duration: 60 })), 5), withTiming(0, { duration: 80 }))
          for (let index = 0; index < 8; index += 1) {
            const side = index % 2 === 0 ? -1 : 1
            const dx = side * (halfWidth * 0.8 + (index % 3) * 22)
            spawn({ kind: 'bubble', x: ox + dx, y: oy - 0.15 * height - (index % 4) * 30, dx: side * 30, dy: -0.7 * height, delay: index * 80, duration: 1500 - index * 60, sway: 14 * side, scaleFrom: 0.4, scaleTo: 0.8 + (index % 3) * 0.2 })
          }
          break
        }
        case 'wake': {
          cancelAnimation(motion.squash)
          cancelAnimation(motion.blink)
          motion.squash.value = withSequence(withTiming(1.1, { duration: 400, easing: EASING.inOut }), withTiming(1, { duration: 300, easing: EASING.inOut }))
          motion.blink.value = withSequence(withTiming(0, { duration: 200 }), withTiming(1, { duration: 80 }), withTiming(0, { duration: 160 }))
          spawn({ kind: 'sparkle', x: ox + 60, y: headY - 0.25 * height, dx: 30, dy: -70, duration: 700, scaleFrom: 0.4, scaleTo: 0.9 })
          break
        }
        case 'egg': {
          cancelAnimation(motion.tilt)
          cancelAnimation(motion.bob)
          cancelAnimation(motion.glow)
          motion.tilt.value = withSequence(withTiming(0.14, { duration: 110, easing: EASING.out }), withTiming(-0.12, { duration: 200, easing: EASING.inOut }), withTiming(0.08, { duration: 180, easing: EASING.inOut }), withTiming(-0.04, { duration: 160, easing: EASING.inOut }), withTiming(0, { duration: 150, easing: EASING.inOut }))
          motion.bob.value = withSequence(withTiming(-18, { duration: 160, easing: EASING.out }), withTiming(0, { duration: 180, easing: EASING.inOut }))
          motion.glow.value = withSequence(withTiming(1, { duration: 200 }), withTiming(0.4, { duration: 500, easing: EASING.inOut }))
          const tips = [-40, 45]
          tips.forEach((dx, index) => spawn({ kind: 'sparkle', x: ox + dx, y: headY - 0.2 * height, dx: dx * 0.6, dy: -60, delay: index * 120, duration: 650, scaleFrom: 0.4, scaleTo: 0.9 }))
          break
        }
        case 'levelUp': {
          cancelAnimation(motion.bob)
          cancelAnimation(motion.squash)
          cancelAnimation(motion.armL)
          cancelAnimation(motion.armR)
          motion.squash.value = withSequence(withTiming(0.88, { duration: 120, easing: EASING.out }), withTiming(1.1, { duration: 200, easing: EASING.out }), withSpring(1, SPRINGS.settle))
          motion.bob.value = withSequence(withTiming(0, { duration: 120 }), withTiming(-120, { duration: 320, easing: EASING.out }), withTiming(0, { duration: 300, easing: EASING.inOut }))
          motion.armL.value = withSequence(withTiming(0, { duration: 120 }), withTiming(2.6, { duration: 280, easing: EASING.out }), withTiming(0, { duration: 500, easing: EASING.inOut }))
          motion.armR.value = withSequence(withTiming(0, { duration: 120 }), withTiming(2.6, { duration: 280, easing: EASING.out }), withTiming(0, { duration: 500, easing: EASING.inOut }))
          for (let index = 0; index < 8; index += 1) {
            const angle = (index / 8) * Math.PI * 2 - Math.PI / 2
            spawn({ kind: 'sparkle', x: ox + Math.cos(angle) * 30, y: bodyY + Math.sin(angle) * 30, dx: Math.cos(angle) * 180, dy: Math.sin(angle) * 160 - 40, delay: 120 + (index % 2) * 60, duration: 900, scaleFrom: 0.5, scaleTo: 1.3 })
          }
          break
        }
        case 'stroke': {
          /* The eyes close and the head leans into the finger: the gaze is
             re-aimed at the point lookAt just set, now that the stroke
             owns the lean (aim reads the reaction kind). */
          cancelAnimation(motion.blink)
          cancelAnimation(motion.squash)
          motion.blink.value = withTiming(1, { duration: 160, easing: EASING.out })
          motion.squash.value = withSpring(1.03, SPRINGS.gentle)
          aim(gazePoint.current.x, gazePoint.current.y)
          lastHeart.current = now
          strokeCount.current = 0
          spawn({ kind: 'heart', x: ox, y: headY - 0.3 * height, dx: 10, dy: -130, duration: 900, sway: 14, scaleFrom: 0.4, scaleTo: 0.9 })
          break
        }
        case 'poke': {
          /* A belly jiggle and raised brows, no particles. */
          cancelAnimation(motion.squash)
          cancelAnimation(motion.browLift)
          motion.squash.value = withSequence(withTiming(0.9, { duration: 90, easing: EASING.out }), withSpring(1.06, SPRINGS.snappy), withSpring(1, SPRINGS.gentle))
          motion.browLift.value = withSequence(withTiming(1, { duration: 80 }), withDelay(320, withTiming(0, { duration: 200 })))
          break
        }
        case 'call': {
          /* Turn to the player and wave. */
          cancelAnimation(motion.headTilt)
          cancelAnimation(motion.armR)
          cancelAnimation(motion.armL)
          cancelAnimation(motion.mouth)
          motion.headTilt.value = withTiming(0, { duration: 200, easing: EASING.inOut })
          motion.armR.value = wave(duration)
          motion.armL.value = withSequence(withTiming(0.5, { duration: 300, easing: EASING.out }), withDelay(600, withTiming(0, { duration: 400, easing: EASING.inOut })))
          motion.mouth.value = withSequence(withTiming(0.8, { duration: 200 }), withTiming(0.8, { duration: 300 }), withTiming(0, { duration: 200 }))
          break
        }
        case 'greet': {
          /* A stretch, then a wave with sparkles. */
          cancelAnimation(motion.squash)
          cancelAnimation(motion.armR)
          cancelAnimation(motion.armL)
          motion.squash.value = withSequence(withTiming(1.1, { duration: 400, easing: EASING.inOut }), withSpring(1, SPRINGS.gentle))
          motion.armL.value = withSequence(withTiming(2.9, { duration: 350, easing: EASING.out }), withTiming(2.9, { duration: 150 }), withTiming(0, { duration: 400, easing: EASING.inOut }))
          motion.armR.value = withSequence(withTiming(2.9, { duration: 350, easing: EASING.out }), withTiming(2.9, { duration: 150 }), wave(1250))
          sparkleBurst(ox, headY - 0.3 * height, 6, 140)
          break
        }
        case 'twirl': {
          /* A tilt both ways with a hop, then a proud grin. */
          cancelAnimation(motion.tilt)
          cancelAnimation(motion.bob)
          cancelAnimation(motion.squash)
          cancelAnimation(motion.grin)
          motion.squash.value = withSequence(withTiming(ANTICIPATION.squash, { duration: ANTICIPATION.ms, easing: EASING.out }), withSpring(1, SPRINGS.gentle))
          motion.tilt.value = withDelay(ANTICIPATION.ms, withSequence(withTiming(0.2, { duration: 200, easing: EASING.inOut }), withTiming(-0.2, { duration: 200, easing: EASING.inOut }), withSpring(0, SPRINGS.settle)))
          motion.bob.value = withDelay(ANTICIPATION.ms, withSequence(withTiming(-80, { duration: 220, easing: EASING.out }), withTiming(0, { duration: 220, easing: EASING.inOut })))
          motion.grin.value = withDelay(400, withSequence(withTiming(1, { duration: 150 }), withTiming(1, { duration: 1250 }), withTiming(0, { duration: 200 })))
          sparkleBurst(ox, bodyY, 8, 170)
          break
        }
        case 'admire': {
          /* Brows up and a small clap: both arms up, twice. */
          cancelAnimation(motion.browLift)
          cancelAnimation(motion.armL)
          cancelAnimation(motion.armR)
          motion.browLift.value = withSequence(withTiming(1, { duration: 150 }), withTiming(1, { duration: 900 }), withTiming(0, { duration: 300 }))
          const clap = withSequence(
            withTiming(1.7, { duration: 250, easing: EASING.out }),
            withTiming(1.3, { duration: 120, easing: EASING.inOut }),
            withTiming(1.8, { duration: 120, easing: EASING.inOut }),
            withTiming(1.3, { duration: 120, easing: EASING.inOut }),
            withTiming(1.8, { duration: 120, easing: EASING.inOut }),
            withTiming(0, { duration: 400, easing: EASING.inOut }),
          )
          motion.armL.value = clap
          motion.armR.value = withSequence(
            withTiming(1.7, { duration: 250, easing: EASING.out }),
            withTiming(1.3, { duration: 120, easing: EASING.inOut }),
            withTiming(1.8, { duration: 120, easing: EASING.inOut }),
            withTiming(1.3, { duration: 120, easing: EASING.inOut }),
            withTiming(1.8, { duration: 120, easing: EASING.inOut }),
            withTiming(0, { duration: 400, easing: EASING.inOut }),
          )
          sparkleBurst(ox, headY - 0.2 * height, 5, 120)
          break
        }
        case 'fidget': {
          switch (fidget) {
            case 'earTwitch': {
              cancelAnimation(earTwitch)
              earTwitch.value = withSequence(withTiming(1, { duration: 80, easing: EASING.out }), withTiming(-0.6, { duration: 110, easing: EASING.inOut }), withTiming(0.3, { duration: 110, easing: EASING.inOut }), withTiming(0, { duration: 200, easing: EASING.inOut }))
              break
            }
            case 'yawn': {
              cancelAnimation(motion.mouth)
              cancelAnimation(motion.squash)
              cancelAnimation(motion.lidDroop)
              cancelAnimation(motion.headTilt)
              motion.mouth.value = withSequence(withTiming(1, { duration: 350, easing: EASING.out }), withTiming(1, { duration: 600 }), withTiming(0, { duration: 300, easing: EASING.inOut }))
              motion.squash.value = withSequence(withTiming(0.96, { duration: 350, easing: EASING.inOut }), withTiming(0.96, { duration: 600 }), withSpring(1, SPRINGS.gentle))
              motion.lidDroop.value = withSequence(withTiming(0.5, { duration: 300 }), withTiming(0.5, { duration: 700 }), withTiming(tired ? IDLE.tiredDroop : 0, { duration: 400 }))
              motion.headTilt.value = withSequence(withTiming(-0.06, { duration: 350, easing: EASING.inOut }), withTiming(-0.06, { duration: 600 }), withTiming(0, { duration: 400, easing: EASING.inOut }))
              break
            }
            case 'scratch': {
              cancelAnimation(motion.armR)
              cancelAnimation(motion.headTilt)
              motion.armR.value = withSequence(
                withTiming(2.7, { duration: 350, easing: EASING.out }),
                withRepeat(withSequence(withTiming(2.85, { duration: 110, easing: EASING.inOut }), withTiming(2.55, { duration: 110, easing: EASING.inOut })), 3),
                withTiming(0, { duration: 450, easing: EASING.inOut }),
              )
              motion.headTilt.value = withSequence(withTiming(-0.1, { duration: 350, easing: EASING.inOut }), withTiming(-0.1, { duration: 700 }), withTiming(0, { duration: 450, easing: EASING.inOut }))
              break
            }
            case 'lookFire': {
              glance(FIRE_POINT.x, FIRE_POINT.y, 2000)
              break
            }
            case 'shiftWeight': {
              cancelAnimation(motion.tilt)
              const side = Math.random() < 0.5 ? -1 : 1
              motion.tilt.value = withSequence(withTiming(side * 0.04, { duration: 400, easing: EASING.inOut }), withTiming(side * 0.04, { duration: 450 }), withTiming(0, { duration: 400, easing: EASING.inOut }))
              break
            }
            case 'hum': {
              cancelAnimation(motion.mouth)
              cancelAnimation(motion.headTilt)
              motion.mouth.value = withSequence(withRepeat(withSequence(withTiming(0.2, { duration: 240, easing: EASING.inOut }), withTiming(0.05, { duration: 240, easing: EASING.inOut })), 3), withTiming(0, { duration: 120 }))
              motion.headTilt.value = withSequence(withTiming(0.05, { duration: 480, easing: EASING.inOut }), withTiming(-0.05, { duration: 480, easing: EASING.inOut }), withTiming(0, { duration: 480, easing: EASING.inOut }))
              break
            }
          }
          break
        }
      }
      return true
    },
    [applyIdle, blip, spawn, sparkleBurst, glance, aim, pickFidget, earTwitch],
  )

  const admireAt = useCallback(
    (x: number, y: number) => {
      const { stage, reduceMotion, paused } = optionsRef.current
      if (stage === 'egg' || paused) return
      if (!reduceMotion) glance(x, y, REACTION_MS.admire)
      react('admire')
    },
    [glance, react],
  )

  /* The idle loops follow the options, unless a reaction has the values at
     the moment: its timer applies the latest options when it ends. Pausing
     drops a running reaction and a held gaze outright. */
  useEffect(() => {
    if (options.paused) {
      if (restartTimer.current) clearTimeout(restartTimer.current)
      restartTimer.current = null
      reactionUntil.current = 0
      reactionKind.current = null
      if (gazeTimer.current) clearTimeout(gazeTimer.current)
      gazeTimer.current = null
      gazeHeld.current = false
    } else if (Date.now() < reactionUntil.current) {
      return
    }
    applyIdle()
  }, [applyIdle, options.stage, options.mood, options.sleeping, options.reduceMotion, options.paused, options.tired])

  /* The follower runs only while the scene moves; a still pose resets it. */
  useEffect(() => {
    const running = !options.paused && !options.reduceMotion && options.stage !== 'egg'
    if (!running) {
      hoodPos.value = 0
      hoodVel.value = 0
      earPos.value = 0
      earVel.value = 0
    }
    follower.setActive(running)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.paused, options.reduceMotion, options.stage])

  /* The fidget scheduler: while awake and left alone, one small fidget
     every 8-15 s; busy moments are retried a little later. */
  useEffect(() => {
    const awake = options.stage !== 'egg' && !options.sleeping && options.mood !== 'sleep'
    if (!awake || options.reduceMotion || options.paused) return
    const schedule = (ms: number) => {
      fidgetTimer.current = setTimeout(() => {
        fidgetTimer.current = null
        const busy = Date.now() < reactionUntil.current || gazeHeld.current
        if (!busy) react('fidget')
        schedule(busy ? FIDGET_GAP_MS.retry : FIDGET_GAP_MS.min + Math.random() * (FIDGET_GAP_MS.max - FIDGET_GAP_MS.min))
      }, ms)
    }
    schedule(FIDGET_GAP_MS.min + Math.random() * (FIDGET_GAP_MS.max - FIDGET_GAP_MS.min))
    return () => {
      if (fidgetTimer.current) clearTimeout(fidgetTimer.current)
      fidgetTimer.current = null
    }
  }, [options.stage, options.sleeping, options.mood, options.reduceMotion, options.paused, react])

  /* Zzz while the elf sleeps. */
  useEffect(() => {
    const asleep = options.stage !== 'egg' && (options.sleeping || options.mood === 'sleep')
    if (!asleep || options.reduceMotion || options.paused) return
    const height = figureHeight(options.stage)
    const { x: ox, y: oy } = ROOM.elfAnchor
    let index = 0
    const tick = () => {
      index += 1
      spawn({ kind: 'zzz', x: ox + 0.2 * height, y: oy - 0.9 * height, dx: 60 + (index % 2) * 20, dy: -150, duration: 1900, sway: 12, scaleFrom: 0.5, scaleTo: 1.2 })
    }
    tick()
    const interval = setInterval(tick, IDLE.zzzEveryMs)
    return () => clearInterval(interval)
  }, [options.stage, options.sleeping, options.mood, options.reduceMotion, options.paused, spawn])

  /* Only on unmount: the pool and cancelAll are stable, so this cleanup
     never runs for a mere re-render of the scene. */
  useEffect(
    () => () => {
      if (restartTimer.current) clearTimeout(restartTimer.current)
      if (gazeTimer.current) clearTimeout(gazeTimer.current)
      if (fidgetTimer.current) clearTimeout(fidgetTimer.current)
      cancelAll()
      for (const particle of particles) for (const value of [particle.x, particle.y, particle.scale, particle.opacity]) cancelAnimation(value)
    },
    [cancelAll, particles],
  )

  return useMemo(() => ({ motion: motionRef.current, particles, react, lookAt, lookRelease, admireAt }), [particles, react, lookAt, lookRelease, admireAt])
}
