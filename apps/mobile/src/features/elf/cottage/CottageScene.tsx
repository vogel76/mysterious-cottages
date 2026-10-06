import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { View, type AccessibilityActionEvent } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { Canvas, Circle, Group, Line, vec } from '@shopify/react-native-skia'
import { cancelAnimation, useDerivedValue, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { DURATIONS, EASING, ReduceMotion, useReducedMotion, withAlpha } from '../../../ui'
import { PET_COOLDOWN_MS, type Mood, type Stage, type StarterId } from '../rules'
import { SPRITE_CHARACTERS, useSpriteImages, type SpriteSource } from '../sprites'
import { useDayClock } from './clock'
import { EGG_HIT_BOX, EggNest } from './EggNest'
import { ElfPuppet, PUPPET_HEIGHT, puppetHitBox } from './ElfPuppet'
import { Lighting, PlateLighting } from './Lighting'
import { useCottageMotion, type ReactionKind } from './motion'
import { Particles } from './Particles'
import { ROOM, SLOTS, fitRoom, inBounds, slotAtIn, slotById, slotsIn, toRoom, type Slot, type SlotZ } from './room'
import { isRenderedEditableSlot, spriteSlotsFor } from './roomAssets'
import { RoomSprites } from './RoomSprites'
import { SlotMarkers } from './SlotMarkers'
import { ELF_HEIGHT_UNITS, SPRITE_ELF_HEAD_LINE, SPRITE_ELF_HIT_BOX, SPRITE_ELF_ORIGIN, SpriteElf } from './SpriteElf'
import { decorItem, isEditableSlot, type Decor, type SlotId } from './items'
import { useFireMotion, type FireMotion } from './items/Fireplace'
import { Floor } from './items/Floor'
import { Wall } from './items/Wall'
import type { Outfit } from './wearables'

/* The elf's cottage as one full-screen Skia canvas: the room shell (wall
   and floor), the furniture of the slots in three depth layers (whichever
   variant the decor map names for each slot), the elf on the rug in its
   outfit (or the egg in its nest before the hatch), the particles of its
   reactions and the light over everything, which follows the device
   clock. The room is designed in room units and scaled here to cover the
   view it is given, so the component measures nothing: the tab passes the
   size. One transform group carries the whole room, so every child draws
   in room units. While a panel stands at the bottom of the tab (the tab
   passes how much of the view it takes as bottomInset) the room is lifted
   so the elf's feet and the furniture around it clear the panel: the live
   preview of a wearable or a swapped piece is the whole point of the
   panel, and the slots a finger has to reach in edit mode sit low in the
   room. The lift is eased in the transform while the layout the gestures
   convert through moves at once, and the floor runs on below the room's
   edge (ROOM.overrun) so nothing bare comes up from under it.

   Every animation lives on the UI thread: the puppet's motion comes from
   useCottageMotion, the fire's (with the lantern's swing and the daylight)
   from its own hook, and both are handed down as shared values; nothing
   here re-renders per frame. The touch is two gestures, a pan and a tap,
   exclusive of each other. The pan is the most alive input: the elf's eyes
   and head follow the finger wherever it goes (the sprite elf, with no
   separate head, leans towards it), and while the finger moves
   over the body the elf is stroked (it leans in, hearts trickle) and the
   stroke is reported through onStrokeElf once per pet cooldown, so the
   rules can count it as a pet while the stroke itself plays on undisturbed
   (a 'pet' reaction in the middle of it would jerk the body and double the
   hearts). A sleeping elf is left to sleep. The tap pets the elf (a
   tap on the head pokes it instead, when the tab listens for that), rocks
   the egg, or touches the room: the hearth flares, the lantern swings, a
   shooting star crosses the window, and the elf glances (or leans) at
   whatever was touched. In edit mode the taps select slots instead and the elf is not
   petted; the editable slots wear dashed frames, the selected one in the
   accent colour. A screen reader reaches the pet through the activate
   action of the view around the canvas. The reactions the tab wants to
   show (a care action, a level, a greeting), the elf's gaze while food is
   dragged over the room, and the look at a freshly placed piece all go
   through the handle. While the tab is out of focus the scene is paused:
   every loop stops at a still pose, so the UI thread owes nothing to a
   room nobody sees. The component is memoised: the provider commits a new
   state every second while the elf is awake and none of these props
   change with it; the outfit and the decor arrive as stable references.

   The scene has two looks. With the elf registered in SPRITE_CHARACTERS
   (art/blender has rendered and packed it) it draws the rendered room
   (RoomSprites: the plate and the furniture crops) and the elf as a
   sprite (SpriteElf) playing the clip of its mood (sleep, sad, idle), or
   for a moment the clip of a reaction (a pat, a meal, a happy hop, a
   wave) before falling back to the mood's. The reaction clips are one
   shots keyed by a counter, so repeating one restarts it; the motion
   hook is told about every reaction first, so the particles, the hop and
   the squash still play over the baked frames, and a reaction the motion
   refuses (asleep, paused, in the middle of the level hop) leaves the
   frames alone too, so body and frames never disagree. The egg stays the
   vector nest, drawn over the rendered rug. In this mode the slot table
   (the tap targets, the glance centres and the frames of edit mode) comes
   from the rendered pieces (roomAssets.spriteSlotsFor), since the Blender
   room hangs its furniture elsewhere than the vector one, and the elf's
   tap target is the drawn figure, not its atlas cell. Only the slots with
   a choice of renders are offered, framed and tappable in edit mode. Over
   the plate, which is lit in Blender, only the fire's pulse and the night
   tint are painted (PlateLighting). With no sprite elf registered the
   scene draws the code-drawn room and puppet it started with, so the two
   can be compared. The sheets decode once (useSpriteImages caches them
   for the app) from the moment the scene mounts, egg stage included, so
   they are in before the hatch; the room draws without the elf until
   they are. */

export type CottageSceneHandle = {
  react: (kind: ReactionKind) => void
  /* The elf looks at a view point (e.g. the food being dragged); held
     while called repeatedly. */
  lookAt: (viewX: number, viewY: number) => void
  /* The gaze eases back to wandering. */
  lookRelease: () => void
  /* Whether a view point lands on the elf (or the egg). */
  hitsPuppet: (viewX: number, viewY: number) => boolean
  /* The elf turns to a slot and admires what stands there. */
  admireSlot: (slot: SlotId) => void
}

export type CottageSceneProps = {
  stage: Stage
  starter: StarterId
  mood: Mood
  sleeping: boolean
  /* Energy under the low mark: heavy lids and yawns. */
  tired: boolean
  /* The egg's warmth, 0..100; ignored after the hatch. */
  warmth: number
  outfit: Outfit
  decor: Decor
  width: number
  height: number
  /* True while the tab is out of focus: no loops, no reactions. */
  paused?: boolean
  /* How much of the view's bottom a panel covers (0 for none): the room is
     lifted so the elf and the low slots stay in view above it. */
  bottomInset?: number
  /* Edit mode: taps pick slots, the frames show, the elf is left alone. */
  editing?: boolean
  selectedSlot?: SlotId | null
  onSelectSlot?: (slot: SlotId) => void
  onPetElf?: () => void
  /* A tap on the head; without it the head is petted like the body. */
  onPokeElf?: () => void
  /* The finger moving over the body, once per pet cooldown; returns
     whether the rules counted it, so a refused call is tried again. */
  onStrokeElf?: () => boolean
  onPetEgg?: () => void
}

/* How long the elf's glance at a touched item lasts. */
const GLANCE_MS = 900
/* The lift behind a panel: at least this share of the panel's height,
   and enough to keep this much view (points) under the elf's feet. */
const LIFT = { share: 0.6, margin: 32 } as const
/* The shooting star's flight across the window. */
const STAR_MS = 750
const STAR = { fromX: -72, fromY: -236, dx: 124, dy: 56 } as const

/* The rendered elf, once art/blender has packed it; without it the scene
   stays with the vectors. Decided once for the app. */
const ELF_SPRITES: SpriteSource | undefined = SPRITE_CHARACTERS.elf
const SPRITE_MODE = ELF_SPRITES !== undefined
/* The slots edit mode frames, picks and the panel offers: in sprite mode
   only those with a choice of renders. */
const acceptsEdit: (slot: SlotId) => boolean = SPRITE_MODE ? isRenderedEditableSlot : isEditableSlot

/* The one-shot clip a reaction plays over the mood's loop; a kind missing
   here (a poke, a fidget, the egg's rock) leaves the baked animation
   alone while the motion still bobs and squashes. */
const REACTION_CLIP: Partial<Record<ReactionKind, string>> = {
  pet: 'pet',
  feed: 'feed',
  play: 'happy',
  levelUp: 'happy',
  twirl: 'happy',
  bath: 'pet',
  wake: 'wave',
  call: 'wave',
  greet: 'wave',
  admire: 'wave',
  stroke: 'pet',
}
/* A stroke restarts the pat clip at most this often; the pan reports it
   on every move. */
const STROKE_CLIP_MS = 1500

/* The loop the elf plays when nothing happens to it. */
function moodClip(mood: Mood, sleeping: boolean): string {
  if (sleeping || mood === 'sleep') return 'sleep'
  if (mood === 'sad' || mood === 'sick') return 'sad'
  return 'idle'
}

let decodeLogged = false

function Layer({ z, decor, fire }: { z: SlotZ; decor: Decor; fire: FireMotion }) {
  return (
    <>
      {slotsIn(z).map((slot) => {
        const item = decorItem(slot.id, decor[slot.id])
        return <item.Component key={`${slot.id}:${item.id}`} slot={slot} fire={fire} />
      })}
    </>
  )
}

/* A short streak with a bright head, flying across the window's opening
   while progress runs 0..1; invisible at rest. */
function ShootingStar({ progress, origin }: { progress: SharedValue<number>; origin: Slot }) {
  const transform = useDerivedValue(() => [{ translateX: origin.x + STAR.fromX + STAR.dx * progress.value }, { translateY: origin.y + STAR.fromY + STAR.dy * progress.value }])
  const opacity = useDerivedValue(() => {
    const p = progress.value
    return p <= 0 || p >= 1 ? 0 : Math.sin(Math.PI * p)
  })
  return (
    <Group transform={transform} opacity={opacity}>
      <Line p1={vec(0, 0)} p2={vec(-48, -22)} strokeWidth={5} strokeCap="round" color={withAlpha('#ffffff', 0.55)} />
      <Circle cx={0} cy={0} r={5} color="#fff8e0" />
    </Group>
  )
}

/* The centre of a slot's hit box, where the elf looks when it is touched. */
function slotCentre(slot: Slot): { x: number; y: number } {
  return { x: slot.x + slot.hit.x + slot.hit.width / 2, y: slot.y + slot.hit.y + slot.hit.height / 2 }
}

export const CottageScene = memo(
  forwardRef<CottageSceneHandle, CottageSceneProps>(function CottageScene(
    { stage, starter, mood, sleeping, tired, warmth, outfit, decor, width, height, paused = false, editing = false, bottomInset = 0, selectedSlot = null, onSelectSlot, onPetElf, onPokeElf, onStrokeElf, onPetEgg },
    ref,
  ) {
    const { t } = useTranslation()
    const reduceMotion = useReducedMotion()
    /* The cover fit, raised by the lift while a panel is open; the lift
       never exceeds the panel or the floor's overrun, so the room's edge
       stays under the panel and on floor. */
    const layout = useMemo(() => {
      const fit = fitRoom(width, height)
      if (bottomInset <= 0) return fit
      const feetY = SPRITE_MODE && stage !== 'egg' ? SPRITE_ELF_ORIGIN.y : ROOM.elfAnchor.y
      const feet = fit.offsetY + feetY * fit.scale
      const wanted = Math.max(bottomInset * LIFT.share, feet + LIFT.margin - (height - bottomInset))
      const lift = Math.max(0, Math.min(wanted, bottomInset, ROOM.overrun * fit.scale))
      return { ...fit, offsetY: fit.offsetY - lift }
    }, [width, height, bottomInset, stage])
    /* The drawn offset eases to the layout's; the gestures use the target at once. */
    const drawnOffsetY = useSharedValue(layout.offsetY)
    useEffect(() => {
      drawnOffsetY.value = withTiming(layout.offsetY, { duration: DURATIONS.slow, easing: EASING.inOut, reduceMotion: ReduceMotion.System })
    }, [layout.offsetY, drawnOffsetY])

    const { motion, particles, react, lookAt, lookRelease, admireAt } = useCottageMotion({ stage, mood, sleeping, tired, reduceMotion, paused })
    /* The elf's sheets, decoded from the first mount (null in vector mode,
       where there is no character), so they are in before the hatch. */
    const images = useSpriteImages(ELF_SPRITES)
    useEffect(() => {
      if (!__DEV__ || !images || decodeLogged) return
      decodeLogged = true
      const sizes = images.body.map((sheet) => `${sheet.width()}x${sheet.height()}`).join(', ')
      console.log(`[elf sprites] ${images.body.length} sheets decoded: ${sizes} px`)
    }, [images])
    /* The slot table the taps, the glances and the frames use: the
       rendered pieces' boxes in sprite mode (they follow the decor, which
       arrives as a stable reference), the vector boxes otherwise. */
    const sceneSlots = useMemo(() => (SPRITE_MODE ? spriteSlotsFor(decor) : SLOTS), [decor])
    /* The fire holds still both for reduce motion and while paused. */
    const fire = useFireMotion({ reduceMotion, paused })
    useDayClock(fire.day, { night: sleeping, reduceMotion })

    /* The shooting star's progress; 0 when there is none. */
    const star = useSharedValue(0)
    const windowSlot = useMemo(() => slotById('window'), [])

    /* The sprite elf stands on the rendered rug; the egg and the puppet
       keep the room's anchor. */
    const spriteFigure = SPRITE_MODE && stage !== 'egg'
    const figureOrigin = spriteFigure ? SPRITE_ELF_ORIGIN : ROOM.elfAnchor
    /* Whether a room point lands on the figure (the elf or the egg). */
    const figureBox = useMemo(() => (stage === 'egg' ? EGG_HIT_BOX : spriteFigure ? SPRITE_ELF_HIT_BOX : puppetHitBox(stage)), [stage, spriteFigure])
    const hitsFigure = useCallback((point: { x: number; y: number }) => inBounds(point, figureOrigin, figureBox), [figureOrigin, figureBox])
    /* Above this line a tap on the figure lands on the head. */
    const headLine = stage === 'egg' ? Number.NEGATIVE_INFINITY : spriteFigure ? SPRITE_ELF_ORIGIN.y - SPRITE_ELF_HEAD_LINE : ROOM.elfAnchor.y - 0.58 * PUPPET_HEIGHT[stage]

    /* Sprite mode's clip: the mood's loop, or a reaction's one shot over
       it, keyed so the same reaction twice restarts the clip. The end of
       the one shot hands back to the mood's loop; a stale end (a clock
       replaced before it finished) is told apart by its key. */
    const [override, setOverride] = useState<{ clip: string; key: number } | null>(null)
    const overrideCount = useRef(0)
    const strokeClipAt = useRef(0)
    const clip = override?.clip ?? moodClip(mood, sleeping)
    const clipKey = override?.key ?? 0
    const onClipEnd = useCallback(() => {
      const key = clipKey
      setOverride((current) => (current && current.key === key ? null : current))
    }, [clipKey])
    /* While the frames hold still (paused, reduce motion) a one shot would
       never reach its end, so a reaction caught by the stop hands back to
       the mood's loop at once rather than freezing on a frame of the pat. */
    useEffect(() => {
      if (paused || reduceMotion) setOverride(null)
    }, [paused, reduceMotion])
    /* Every reaction goes to the motion (the particles, the hop, the
       squash); in sprite mode the ones with a clip also swap the frames,
       but only when the motion took the reaction: what it refuses (a pat
       during the level hop, anything while asleep or paused) must not
       restart the frames under a body that goes on with its hop. With
       reduce motion the frames hold still and a one shot would never
       end, so the loop stays. */
    const reactScene = useCallback(
      (kind: ReactionKind) => {
        if (!react(kind)) return
        if (!spriteFigure || paused || reduceMotion) return
        const next = REACTION_CLIP[kind]
        if (!next) return
        if (kind === 'stroke') {
          const now = Date.now()
          if (now - strokeClipAt.current < STROKE_CLIP_MS) return
          strokeClipAt.current = now
        }
        overrideCount.current += 1
        setOverride({ clip: next, key: overrideCount.current })
      },
      [react, spriteFigure, paused, reduceMotion],
    )
    /* The motion aims its particles at the puppet (the room's anchor and
       the stage's puppet height); in sprite mode they are mapped onto the
       taller sprite around its feet, so the hearts still rise from the head. */
    const particleTransform = useMemo(() => {
      if (!spriteFigure) return undefined
      const grow = ELF_HEIGHT_UNITS / PUPPET_HEIGHT[stage]
      return [{ translateX: SPRITE_ELF_ORIGIN.x }, { translateY: SPRITE_ELF_ORIGIN.y }, { scale: grow }, { translateX: -ROOM.elfAnchor.x }, { translateY: -ROOM.elfAnchor.y }]
    }, [spriteFigure, stage])

    /* The glance at a touched item, and when the last stroke counted as a pet. */
    const glanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const strokePetAt = useRef(0)
    const glanceAt = useCallback(
      (slot: Slot) => {
        const centre = slotCentre(slot)
        lookAt(centre.x, centre.y)
        if (glanceTimer.current) clearTimeout(glanceTimer.current)
        glanceTimer.current = setTimeout(() => {
          glanceTimer.current = null
          lookRelease()
        }, GLANCE_MS)
      },
      [lookAt, lookRelease],
    )
    useEffect(
      () => () => {
        if (glanceTimer.current) clearTimeout(glanceTimer.current)
        cancelAnimation(star)
      },
      [star],
    )

    const shootStar = useCallback(() => {
      if (paused || reduceMotion) return
      cancelAnimation(star)
      star.value = 0
      star.value = withTiming(1, { duration: STAR_MS, easing: EASING.out })
    }, [star, paused, reduceMotion])

    useImperativeHandle(
      ref,
      () => ({
        react: reactScene,
        lookAt: (viewX, viewY) => {
          const point = toRoom(layout, viewX, viewY)
          lookAt(point.x, point.y)
        },
        lookRelease,
        hitsPuppet: (viewX, viewY) => hitsFigure(toRoom(layout, viewX, viewY)),
        admireSlot: (id) => {
          const centre = slotCentre(sceneSlots.find((slot) => slot.id === id) ?? slotById(id))
          admireAt(centre.x, centre.y)
        },
      }),
      [reactScene, lookAt, lookRelease, admireAt, layout, hitsFigure, sceneSlots],
    )

    /* The same pet for a screen reader's double tap: it has no point to
       convert, so it always lands on the elf (or the egg). */
    const onAccessibilityAction = useCallback(
      (event: AccessibilityActionEvent) => {
        if (event.nativeEvent.actionName !== 'activate' || editing) return
        if (stage === 'egg') onPetEgg?.()
        else onPetElf?.()
      },
      [stage, editing, onPetElf, onPetEgg],
    )

    const gesture = useMemo(() => {
      const pan = Gesture.Pan()
        .runOnJS(true)
        .minDistance(8)
        .onBegin((event) => {
          const point = toRoom(layout, event.x, event.y)
          lookAt(point.x, point.y)
        })
        .onUpdate((event) => {
          const point = toRoom(layout, event.x, event.y)
          lookAt(point.x, point.y)
          if (editing || stage === 'egg' || sleeping || !hitsFigure(point)) return
          reactScene('stroke')
          const now = Date.now()
          if (now - strokePetAt.current < PET_COOLDOWN_MS) return
          if (onStrokeElf?.()) strokePetAt.current = now
        })
        .onFinalize(() => {
          /* A glance started by the tap under this touch keeps its own timer. */
          if (!glanceTimer.current) lookRelease()
        })

      const tap = Gesture.Tap()
        .runOnJS(true)
        .maxDuration(400)
        .maxDistance(24)
        .onEnd((event, success) => {
          if (!success) return
          const point = toRoom(layout, event.x, event.y)
          if (editing) {
            const slot = slotAtIn(sceneSlots, point, (candidate) => acceptsEdit(candidate.id))
            if (slot) onSelectSlot?.(slot.id)
            return
          }
          if (hitsFigure(point)) {
            if (stage === 'egg') onPetEgg?.()
            else if (point.y < headLine && onPokeElf) onPokeElf()
            else onPetElf?.()
            return
          }
          const slot = slotAtIn(sceneSlots, point)
          if (!slot) return
          glanceAt(slot)
          if (slot.id === 'fireplace') fire.flare()
          else if (slot.id === 'lantern') fire.swingLantern()
          else if (slot.id === 'window') shootStar()
        })

      return Gesture.Exclusive(pan, tap)
    }, [layout, stage, editing, sleeping, headLine, hitsFigure, sceneSlots, lookAt, lookRelease, reactScene, glanceAt, shootStar, fire, onSelectSlot, onPetElf, onPokeElf, onStrokeElf, onPetEgg])

    const roomTransform = useDerivedValue(() => [{ translateX: layout.offsetX }, { translateY: drawnOffsetY.value }, { scale: layout.scale }])

    return (
      <GestureDetector gesture={gesture}>
        <View
          style={{ width, height }}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('mobile:elf.cottageAria')}
          accessibilityHint={t(editing ? 'mobile:elf.decorateHint' : stage === 'egg' ? 'mobile:elf.tapHintEgg' : 'mobile:elf.tapHint')}
          accessibilityActions={[{ name: 'activate' }]}
          onAccessibilityAction={onAccessibilityAction}
        >
          {/* The room covers the whole canvas, so it can be opaque: Android
              then backs it with a SurfaceView, the cheapest path, and the
              one that also draws on the emulator (its TextureView consumer
              never attaches there). */}
          <Canvas style={{ width, height }} opaque>
            <Group transform={roomTransform}>
              {ELF_SPRITES ? (
                <>
                  <RoomSprites decor={decor} layer="back" />
                  <RoomSprites decor={decor} layer="mid" />
                  {stage === 'egg' ? (
                    <EggNest starter={starter} warmth={warmth} motion={motion} origin={ROOM.elfAnchor} />
                  ) : images ? (
                    <SpriteElf clip={clip} clipKey={clipKey} onClipEnd={onClipEnd} playing={!paused && !reduceMotion} motion={motion} origin={SPRITE_ELF_ORIGIN} images={images} manifest={ELF_SPRITES.manifest} />
                  ) : null}
                  <RoomSprites decor={decor} layer="front" />
                </>
              ) : (
                <>
                  <Wall />
                  <Floor />
                  <Layer z="back" decor={decor} fire={fire} />
                  <Layer z="mid" decor={decor} fire={fire} />
                  {stage === 'egg' ? (
                    <EggNest starter={starter} warmth={warmth} motion={motion} origin={ROOM.elfAnchor} />
                  ) : (
                    <ElfPuppet stage={stage} starter={starter} mood={mood} sleeping={sleeping} outfit={outfit} motion={motion} origin={ROOM.elfAnchor} />
                  )}
                  <Layer z="front" decor={decor} fire={fire} />
                </>
              )}
              <ShootingStar progress={star} origin={windowSlot} />
              <Group transform={particleTransform}>
                <Particles particles={particles} />
              </Group>
              {ELF_SPRITES ? <PlateLighting sleeping={sleeping} fire={fire} reduceMotion={reduceMotion} /> : <Lighting sleeping={sleeping} fire={fire} reduceMotion={reduceMotion} />}
              {editing ? <SlotMarkers slots={sceneSlots} accept={acceptsEdit} selected={selectedSlot} reduceMotion={reduceMotion} /> : null}
            </Group>
          </Canvas>
        </View>
      </GestureDetector>
    )
  }),
)
