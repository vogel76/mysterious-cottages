import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { View, type AccessibilityActionEvent } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { Canvas, Circle, Group, Line, vec } from '@shopify/react-native-skia'
import { cancelAnimation, useDerivedValue, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { DURATIONS, EASING, ReduceMotion, useReducedMotion, withAlpha } from '../../../ui'
import { PET_COOLDOWN_MS, type ElfMood, type ElfStage, type ElfStarter } from '@chatynkowo/core'
import { SPRITE_CHARACTERS, useSpriteImages, type SpriteSource } from '../sprites'
import { elfKey } from '../labels'
import { PHOTO_ID, type Decor, type SlotId } from './catalogue'
import { useDayClock } from './clock'
import { EGG_HIT_BOX, EggNest } from './EggNest'
import { useFireMotion } from './fire'
import { PlateLighting } from './Lighting'
import { useCottageMotion, type ReactionKind } from './motion'
import { Particles } from './Particles'
import { ROOM, fitRoom, inBounds, slotAtIn, slotById, toRoom, type Slot } from './room'
import { spriteSlotsFor } from './roomAssets'
import { RoomSprites } from './RoomSprites'
import { SlotMarkers } from './SlotMarkers'
import { SPRITE_ELF_HEAD_LINE, SPRITE_ELF_HIT_BOX, SPRITE_ELF_ORIGIN, SpriteElf } from './SpriteElf'

/* The elf's cottage as one full-screen Skia canvas: the rendered room
   (the Blender plate and the furniture crops of the slots in three depth
   layers, whichever variant the decor map names for each slot), the elf
   on the rug as its sprite (or the egg in its nest before the hatch), the
   particles of its reactions and the light over everything, which follows
   the device clock. The room is designed in room units and scaled here to cover the
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

   Every animation lives on the UI thread: the figure's motion comes from
   useCottageMotion, the fire's (with the daylight) from its own hook, and both are handed down as shared values; nothing
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
   the egg, or touches the room: the hearth flares, a shooting star
   crosses the window, and the elf glances (or leans) at whatever was
   touched; a tap on the picture frame is also reported to the tab, which
   opens the cottage whose photo it shows. In edit mode the taps select
   slots instead and the elf is not petted; the editable slots wear
   dashed frames, the selected one in the accent colour. A screen reader reaches the pet through the activate
   action of the view around the canvas. The reactions the tab wants to
   show (a care action, a cheer, a greeting), the elf's gaze while food is
   dragged over the room, and the look at a freshly placed piece all go
   through the handle. While the tab is out of focus the scene is paused:
   every loop stops at a still pose, so the UI thread owes nothing to a
   room nobody sees. The component is memoised: the provider commits a new
   state every few seconds while the elf is awake and none of these props
   change with it; the outfit and the decor arrive as stable references.

   The room is the rendered one (RoomSprites: the plate and the furniture
   crops, as art/blender rendered and packed them) and the elf a sprite
   (SpriteElf) playing the clip of its mood (sleep, sad, idle), or for a
   moment the clip of a reaction (a pat, a meal, a happy hop, a wave)
   before falling back to the mood's. The reaction clips are one shots
   keyed by a counter, so repeating one restarts it; the motion hook is
   told about every reaction first, so the particles, the hop and the
   squash still play over the baked frames, and a reaction the motion
   refuses (asleep, paused, in the middle of the cheer) leaves the
   frames alone too, so body and frames never disagree. The egg is still
   the vector nest, drawn over the rendered rug, until the pipeline renders
   it. The slot table (the tap targets, the glance centres and the frames
   of edit mode) comes from the rendered pieces (roomAssets.spriteSlotsFor),
   and the elf's tap target is the drawn figure, not its atlas cell. Only
   the slots with a choice of renders are offered, framed and tappable in
   edit mode. Over the plate, which is lit in Blender, only the fire's
   pulse and the night tint are painted (PlateLighting). The sheets decode
   once (useSpriteImages caches them for the app) from the moment the
   scene mounts, egg stage included, so they are in before the hatch; the
   room draws without the elf until they are. */

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
  stage: ElfStage
  /* Null until the hatch names the elf: the egg is then plain. */
  starter: ElfStarter | null
  mood: ElfMood
  sleeping: boolean
  /* Bedtime, before the elf is tucked in: heavy lids and yawns. */
  sleepy: boolean
  /* The egg's warmth, 0..100; ignored after the hatch. */
  warmth: number
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
  /* The slots edit mode frames and picks: what the panel offers right now. */
  editable: readonly SlotId[]
  selectedSlot?: SlotId | null
  onSelectSlot?: (slot: SlotId) => void
  onPetElf?: () => void
  /* A tap on the head; without it the head is petted like the body. */
  onPokeElf?: () => void
  /* The finger moving over the body, once per pet cooldown; returns
     whether the rules counted it, so a refused call is tried again. */
  onStrokeElf?: () => boolean
  onPetEgg?: () => void
  /* Where the figure's top (the elf's or the egg's) is in view
     coordinates, told on mount and whenever the layout or the figure
     changes: the speech bubble sits there. */
  onFigureTop?: (point: { x: number; y: number }) => void
  /* The latest cottage found, as a picture URI: what the frame on the
     wall shows when the decor asks for the photo. */
  photo?: string | null
  /* A tap on the picture frame; the tab opens the cottage it shows. */
  onPictureTap?: () => void
}

/* How long the elf's glance at a touched item lasts. */
const GLANCE_MS = 900
/* The lift behind a panel: at least this share of the panel's height,
   and enough to keep this much view (points) under the elf's feet. */
const LIFT = { share: 0.6, margin: 32 } as const
/* The shooting star's flight across the window. */
const STAR_MS = 750
const STAR = { fromX: -72, fromY: -236, dx: 124, dy: 56 } as const

/* The rendered elf, as art/blender packed it. The scene has no other way
   to draw the figure, so a missing registration is an error at load, not
   a blank room. */
const ELF_SPRITES: SpriteSource = elfSprites()
function elfSprites(): SpriteSource {
  const source = SPRITE_CHARACTERS.elf
  if (!source) throw new Error('the elf character is not registered in SPRITE_CHARACTERS: render and pack it first (art/README.md)')
  return source
}

/* The one-shot clip a reaction plays over the mood's loop; a kind missing
   here (a poke, a fidget, the egg's rock) leaves the baked animation
   alone while the motion still bobs and squashes. */
const REACTION_CLIP: Partial<Record<ReactionKind, string>> = {
  pet: 'pet',
  feed: 'feed',
  play: 'happy',
  cheer: 'happy',
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
function moodClip(mood: ElfMood, sleeping: boolean): string {
  if (sleeping || mood === 'asleep') return 'sleep'
  if (mood === 'misses') return 'sad'
  return 'idle'
}

let decodeLogged = false

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
    { stage, starter, mood, sleeping, sleepy, warmth, decor, width, height, paused = false, editing = false, bottomInset = 0, selectedSlot = null, onSelectSlot, onPetElf, onPokeElf, onStrokeElf, onPetEgg, onFigureTop, photo = null, onPictureTap, editable },
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
      const feetY = stage === 'egg' ? ROOM.elfAnchor.y : SPRITE_ELF_ORIGIN.y
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

    const { motion, particles, react, lookAt, lookRelease, admireAt } = useCottageMotion({ stage, mood, sleeping, sleepy, reduceMotion, paused })
    /* The elf's sheets, decoded from the first mount, so they are in
       before the hatch. */
    const images = useSpriteImages(ELF_SPRITES)
    useEffect(() => {
      if (!__DEV__ || !images || decodeLogged) return
      decodeLogged = true
      const sizes = images.body.map((sheet) => `${sheet.width()}x${sheet.height()}`).join(', ')
      console.log(`[elf sprites] ${images.body.length} sheets decoded: ${sizes} px`)
    }, [images])
    /* The slot table the taps, the glances and the frames use: the
       rendered pieces' boxes (they follow the decor, which arrives as a
       stable reference). */
    const sceneSlots = useMemo(() => spriteSlotsFor(decor), [decor])
    /* The fire holds still both for reduce motion and while paused. */
    const fire = useFireMotion({ reduceMotion, paused })
    useDayClock(fire.day, { night: sleeping, reduceMotion })

    /* The shooting star's progress; 0 when there is none. */
    const star = useSharedValue(0)
    const windowSlot = useMemo(() => slotById('window'), [])
    /* The tap on the frame, read through a ref so the gesture is not
       rebuilt when the tab's handler changes. */
    const onPictureTapRef = useRef(onPictureTap)
    onPictureTapRef.current = onPictureTap
    /* Edit mode frames and picks only what the panel offers. */
    const acceptsEdit = useCallback((id: SlotId) => editable.includes(id), [editable])

    /* The elf stands on the rendered rug; the egg keeps the room's anchor
       in its nest. */
    const hatched = stage !== 'egg'
    const figureOrigin = hatched ? SPRITE_ELF_ORIGIN : ROOM.elfAnchor
    /* Whether a room point lands on the figure (the elf or the egg). */
    const figureBox = hatched ? SPRITE_ELF_HIT_BOX : EGG_HIT_BOX
    const hitsFigure = useCallback((point: { x: number; y: number }) => inBounds(point, figureOrigin, figureBox), [figureOrigin, figureBox])
    /* Above this line a tap on the figure lands on the head. */
    const headLine = hatched ? SPRITE_ELF_ORIGIN.y - SPRITE_ELF_HEAD_LINE : Number.NEGATIVE_INFINITY
    /* The figure's top in the view, for the bubble over its head. */
    useEffect(() => {
      onFigureTop?.({ x: layout.offsetX + figureOrigin.x * layout.scale, y: layout.offsetY + (figureOrigin.y + figureBox.y) * layout.scale })
    }, [onFigureTop, layout, figureOrigin, figureBox])

    /* The clip: the mood's loop, or a reaction's one shot over
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
       squash); the ones with a clip also swap the frames, but only when
       the motion took the reaction: what it refuses (a pat
       during the cheer, anything while asleep or paused) must not
       restart the frames under a body that goes on with its hop. With
       reduce motion the frames hold still and a one shot would never
       end, so the loop stays. */
    const reactScene = useCallback(
      (kind: ReactionKind) => {
        if (!react(kind)) return
        if (!hatched || paused || reduceMotion) return
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
      [react, hatched, paused, reduceMotion],
    )
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
        const { actionName } = event.nativeEvent
        if (actionName.startsWith('slot:')) {
          onSelectSlot?.(actionName.slice('slot:'.length) as SlotId)
          return
        }
        if (editing) return
        if (actionName === 'openStory') {
          onPictureTapRef.current?.()
          return
        }
        if (actionName !== 'activate') return
        if (stage === 'egg') onPetEgg?.()
        else onPetElf?.()
      },
      [stage, editing, onPetElf, onPetEgg, onSelectSlot],
    )
    /* In edit mode a screen reader picks a slot from the actions, one per
       piece on offer, since it cannot tap a spot of the canvas. */
    const slotActions = useMemo(() => editable.map((id) => ({ name: `slot:${id}`, label: t(elfKey('slot', id)) })), [editable, t])
    /* The frame's photo opens its cottage: a second action for a screen
       reader, which cannot tap a spot of the canvas. */
    const framePhoto = Boolean(photo) && decor.picture === PHOTO_ID

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
          else if (slot.id === 'window') shootStar()
          else if (slot.id === 'picture') onPictureTapRef.current?.()
        })

      return Gesture.Exclusive(pan, tap)
    }, [layout, stage, editing, sleeping, headLine, hitsFigure, sceneSlots, lookAt, lookRelease, reactScene, glanceAt, shootStar, fire, acceptsEdit, onSelectSlot, onPetElf, onPokeElf, onStrokeElf, onPetEgg])

    const roomTransform = useDerivedValue(() => [{ translateX: layout.offsetX }, { translateY: drawnOffsetY.value }, { scale: layout.scale }])

    return (
      <GestureDetector gesture={gesture}>
        <View
          style={{ width, height }}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('mobile:elf.cottageAria')}
          accessibilityHint={t(editing ? 'mobile:elf.decorateHint' : stage === 'egg' ? 'mobile:elf.tapHintEgg' : 'mobile:elf.tapHint')}
          accessibilityActions={editing ? slotActions : framePhoto ? [{ name: 'activate' }, { name: 'openStory', label: t('mobile:elf.frameAction') }] : [{ name: 'activate' }]}
          onAccessibilityAction={onAccessibilityAction}
        >
          {/* The room covers the whole canvas, so it can be opaque: Android
              then backs it with a SurfaceView, the cheapest path, and the
              one that also draws on the emulator (its TextureView consumer
              never attaches there). */}
          <Canvas style={{ width, height }} opaque>
            <Group transform={roomTransform}>
              <RoomSprites decor={decor} layer="back" day={fire.day} photo={photo} />
              <RoomSprites decor={decor} layer="mid" day={fire.day} />
              {hatched ? (
                images ? (
                  <SpriteElf clip={clip} clipKey={clipKey} onClipEnd={onClipEnd} playing={!paused && !reduceMotion} motion={motion} origin={SPRITE_ELF_ORIGIN} day={fire.day} images={images} manifest={ELF_SPRITES.manifest} />
                ) : null
              ) : (
                <EggNest starter={starter} warmth={warmth} motion={motion} origin={ROOM.elfAnchor} />
              )}
              <RoomSprites decor={decor} layer="front" day={fire.day} />
              <ShootingStar progress={star} origin={windowSlot} />
              <Particles particles={particles} />
              <PlateLighting sleeping={sleeping} fire={fire} reduceMotion={reduceMotion} />
              {editing ? <SlotMarkers slots={sceneSlots} accept={acceptsEdit} selected={selectedSlot} reduceMotion={reduceMotion} /> : null}
            </Group>
          </Canvas>
        </View>
      </GestureDetector>
    )
  }),
)
