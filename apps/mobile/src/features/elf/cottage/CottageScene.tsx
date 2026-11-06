import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { View, type AccessibilityActionEvent } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { Canvas, Circle, Group, Line, vec } from '@shopify/react-native-skia'
import { Easing, cancelAnimation, useDerivedValue, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { DURATIONS, EASING, ReduceMotion, useReducedMotion, withAlpha } from '../../../ui'
import { PET_COOLDOWN_MS, type ElfForm, type ElfMood, type ElfStage } from '@chatynkowo/core'
import { SPRITE_CHARACTERS, useSpriteImages, useSpriteLayer, useUpcomingSprites } from '../sprites'
import { elfKey } from '../labels'
import { PHOTO_ID, isSurface, type Decor, type SlotId } from './catalogue'
import { useDayClock } from './clock'
import { useFireMotion } from './fire'
import { PlateLighting } from './Lighting'
import type { ElfSound } from '../useElfSounds'
import { useCottageMotion, type Fidget, type ReactionKind } from './motion'
import { Particles } from './Particles'
import { EGG_HIT_BOX, HATCH_BEATS, RenderedEgg } from './RenderedEgg'
import { ROOM, fitRoom, inBounds, slotAtIn, slotById, toRoom, type Slot } from './room'
import { extraPictures, placedBounds, renderedVariantFor, spriteSlotsFor, type RoomExtras } from './roomAssets'
import { RoomSprites } from './RoomSprites'
import { SleepingElf } from './SleepingElf'
import { SlotHighlight } from './SlotHighlight'
import { SPRITE_ELF_ORIGIN, SpriteElf, figureUnits, spriteElfHeadLine, spriteElfHitBox } from './SpriteElf'

/* The elf's cottage as one full-screen Skia canvas: the rendered room
   (the Blender plate and the furniture crops of the slots in three depth
   layers, whichever variant the decor map names for each slot), the elf
   on the rug as its sprite (or the egg in its nest before the hatch), the
   particles of its reactions and the light over everything, which follows
   the device clock. The room is designed in room units and scaled here to cover the
   band of the view the tab leaves free (the tab passes what its strip
   takes at the top as topInset and what the care band or an open panel
   covers at the bottom as bottomInset), so the component measures
   nothing: the tab passes the size. One transform group carries the whole
   room, so every child draws in room units. When a panel opens at the
   bottom the band shortens and the room follows: the move is eased in
   the transform while the layout the gestures convert through changes at
   once, and the floor runs on below the room's edge (ROOM.overrun) so
   nothing bare comes up from under it on a wide view.

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
   opens the cottage whose photo it shows; the wall and the floor are not
   things to touch. In the decorating mode the taps pick the catalogue's
   category instead and the elf is not petted; the room moves to bring
   the place being chosen for to the middle of its band, and a piece is
   lit there (SlotHighlight). A screen reader reaches the pet through the activate
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
   frames alone too, so body and frames never disagree. Before the hatch
   the egg stands at the figure's place in its nest, from the room's
   renders too (RenderedEgg); the hatch is the scene's: the tab asks for it
   (hatch) and is called back at the moment the elf takes the egg's place,
   while the broken shell, the flash and the nest play out over the elf
   that has just appeared. The slot table (the tap targets, the glance centres and the light
   of the decorating mode) comes from the rendered pieces
   (roomAssets.spriteSlotsFor), and the elf's tap target is the drawn
   figure, not its atlas cell. Only the places the catalogue offers are
   tappable in the decorating mode. Over the plate, which is lit in Blender, only the fire's
   pulse and the night tint are painted (PlateLighting). Each form of the
   elf is an atlas of its own, the form the tab names (the one before an
   evolution until its moment), at its own height; its sheets decode once
   (useSpriteImages keeps them for the app) from the moment the scene
   mounts, the hatchling's while the egg waits, so they are in before the
   hatch; the room draws without the elf until they are, and a new form
   replaces the old one only once it is in. The form coming next (the
   tab names it as soon as it is reached) is decoded ahead of its moment,
   so the swap waits for nothing but Skia's first draw of its sheets (the
   GPU cannot hold two forms' sheets at once, so they are not drawn
   before). */

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
  /* The egg breaks: onOpen is called when the elf is to take its place
     (the tab hatches it then), the rest of the break plays on after. */
  hatch: (onOpen: () => void) => void
}

export type CottageSceneProps = {
  stage: ElfStage
  mood: ElfMood
  sleeping: boolean
  /* Bedtime, before the elf is tucked in: heavy lids and yawns. */
  sleepy: boolean
  /* The egg's warmth, 0..100; ignored after the hatch. */
  warmth: number
  /* The ready egg's cracks: 0 whole, 1 after the first tap, 2 breaking. */
  eggCracks?: number
  decor: Decor
  /* The hat the elf wears, a wardrobe id ('none' for the bare hair). */
  hat?: string
  /* The form drawn, when it is not the stage's: the tab keeps the form
     before an evolution until the evolution's moment shows the new one. */
  form?: ElfForm
  /* The form about to replace the drawn one, decoded ahead; told once its
     sheets are in. */
  nextForm?: ElfForm
  onNextReady?: (form: ElfForm) => void
  /* While decorating: the room brings the elf to its band's middle (the
     wardrobe's tab is open) instead of a place. */
  focusElf?: boolean
  width: number
  height: number
  /* True while the tab is out of focus: no loops, no reactions. */
  paused?: boolean
  /* How much of the view's top the HUD's strip takes and how much of its
     bottom the care band or an open panel covers (0 for none): the room
     fills the band between them. */
  topInset?: number
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
  /* Whether the elf stands drawn in the room: its form's sheets are
     decoded (false for the egg and while a form's atlas decodes); told
     whenever it changes, so the tab holds the evolution's moment for it. */
  onFigureReady?: (ready: boolean) => void
  /* The latest cottage found, as a picture URI: what the frame on the
     wall shows when the decor asks for the photo. */
  photo?: string | null
  /* A tap on the picture frame; the tab opens the cottage it shows. */
  onPictureTap?: () => void
  /* What the days have brought: the plant, the sill's finds, a letter. */
  extras?: RoomExtras
  /* A tap on the waiting letter, and on the shelf or the sill's finds
     (the keepsake shelf). */
  onLetterTap?: () => void
  /* A sound for what just happened to the elf (the tab plays it). */
  onSound?: (sound: ElfSound) => void
  onShelfTap?: () => void
}

/* The days' pieces have room-absolute boxes: inBounds measures them from here. */
const ORIGIN = { x: 0, y: 0 } as const
/* How long the elf's glance at a touched item lasts. */
const GLANCE_MS = 900
/* The shooting star's flight across the window, as shares of the
   window's box (the curtains included: the glass is its middle). */
const STAR_MS = 750
const STAR = { fromX: 0.32, fromY: 0.22, dx: 0.32, dy: 0.14 } as const
/* How long the egg's break takes, with reduce motion a short fade. */
const HATCH_MS = { full: 1800, reduced: 700 } as const

/* The one-shot clip a reaction plays over the mood's loop; a kind missing
   here (a poke, a fidget, the egg's rock) leaves the baked animation
   alone while the motion still bobs and squashes. */
const REACTION_CLIP: Partial<Record<ReactionKind, string>> = {
  pet: 'pet',
  feed: 'feed',
  play: 'play',
  cheer: 'happy',
  twirl: 'happy',
  bath: 'bath',
  wake: 'wave',
  call: 'wave',
  greet: 'greet',
  admire: 'wave',
  stroke: 'pet',
  refuse: 'refuse',
  sip: 'sip',
  beckon: 'beckon',
}
/* The sound of a reaction the motion took (a pat and a stroke are silent). */
const REACTION_SOUND: Partial<Record<ReactionKind, ElfSound>> = {
  /* The egg's three touches; its rocking on its own when ready stays silent. */
  egg: 'eggTap',
  warm: 'warm',
  rock: 'lullaby',
  poke: 'poke',
  feed: 'feed',
  bath: 'bath',
  play: 'play',
  twirl: 'play',
  wake: 'wake',
  greet: 'wake',
  cheer: 'cheer',
  evolve: 'evolve',
  refuse: 'refuse',
  sip: 'sip',
  beckon: 'beckon',
}
/* A snore with every breath of sleep (motion's breathSleepMs). */
const SNORE_EVERY_MS = 5200
/* A stroke restarts the pat clip at most this often; the pan reports it
   on every move. */
const STROKE_CLIP_MS = 1500

/* The loop the elf plays when nothing happens to it (asleep it is in
   its bed, and the figure on the rug only fades). */
function moodClip(mood: ElfMood): string {
  return mood === 'misses' ? 'sad' : 'idle'
}
/* How long the elf takes to go to bed or get up. */
const BED_FADE_MS = 600

let decodeLogged = false

/* A short streak with a bright head, flying across the window's opening
   while progress runs 0..1; invisible at rest. */
function ShootingStar({ progress, window }: { progress: SharedValue<number>; window: Slot }) {
  const left = window.x + window.hit.x
  const top = window.y + window.hit.y
  const { width, height } = window.hit
  const transform = useDerivedValue(() => [
    { translateX: left + width * (STAR.fromX + STAR.dx * progress.value) },
    { translateY: top + height * (STAR.fromY + STAR.dy * progress.value) },
  ])
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
    { stage, form, nextForm, onNextReady, mood, sleeping, sleepy, warmth, eggCracks = 0, decor, hat = 'none', focusElf = false, width, height, paused = false, editing = false, topInset = 0, bottomInset = 0, selectedSlot = null, onSelectSlot, onPetElf, onPokeElf, onStrokeElf, onPetEgg, onFigureTop, onFigureReady, photo = null, onPictureTap, extras, onLetterTap, onShelfTap, onSound, editable },
    ref,
  ) {
    const { t } = useTranslation()
    const reduceMotion = useReducedMotion()
    /* The slot table the taps, the glances and the light use: the
       rendered pieces' boxes (they follow the decor, which arrives as a
       stable reference). */
    const sceneSlots = useMemo(() => spriteSlotsFor(decor), [decor])
    /* While decorating, the place being chosen for: in focus, and lit
       unless it is the wall or the floor, which are the whole room. */
    const focusSlot = useMemo(() => (editing && selectedSlot ? (sceneSlots.find((slot) => slot.id === selectedSlot) ?? null) : null), [editing, selectedSlot, sceneSlots])
    /* The elf's sheets: the form's atlas, decoded from the first mount (the
       hatchling's while the egg waits, so it is in before the hatch); the
       body decoded is drawn with its own atlas's manifest, and a hat of
       another form's atlas is not drawn. */
    const formSource = SPRITE_CHARACTERS[form ?? (stage === 'egg' ? 'baby' : stage)]
    const images = useSpriteImages(formSource)
    const next = useUpcomingSprites(nextForm ? SPRITE_CHARACTERS[nextForm] : undefined)
    useEffect(() => {
      if (nextForm && next?.source === SPRITE_CHARACTERS[nextForm]) onNextReady?.(nextForm)
    }, [next, nextForm, onNextReady])
    /* The hat's layer, decoded only while it is worn. */
    const hatDecoded = useSpriteLayer(images?.source, hat !== 'none' ? `hat_${hat}` : null)
    const hatLayer = hatDecoded && hatDecoded.source === images?.source ? hatDecoded : null
    /* The drawn figure's height, for its tap target, and its neck's, for
       the head's line and the room's focus on the head. */
    const drawnManifest = (images?.source ?? formSource).manifest
    const units = figureUnits(drawnManifest)
    const neck = spriteElfHeadLine(drawnManifest)
    /* The cover fit into the band between the strip above and whatever
       covers the bottom, moved towards the place being chosen for; an open
       panel shortens the band and the room follows, eased. */
    const focus = useMemo(
      () => (editing && focusElf ? { x: SPRITE_ELF_ORIGIN.x, y: SPRITE_ELF_ORIGIN.y - neck } : focusSlot ? slotCentre(focusSlot) : null),
      [editing, focusElf, focusSlot, neck],
    )
    const layout = useMemo(() => fitRoom(width, height, topInset, bottomInset, focus), [width, height, topInset, bottomInset, focus])
    /* The drawn offset eases to the layout's; the gestures use the target at once. */
    const drawnOffsetX = useSharedValue(layout.offsetX)
    const drawnOffsetY = useSharedValue(layout.offsetY)
    useEffect(() => {
      drawnOffsetX.value = withTiming(layout.offsetX, { duration: DURATIONS.slow, easing: EASING.inOut, reduceMotion: ReduceMotion.System })
      drawnOffsetY.value = withTiming(layout.offsetY, { duration: DURATIONS.slow, easing: EASING.inOut, reduceMotion: ReduceMotion.System })
    }, [layout.offsetX, layout.offsetY, drawnOffsetX, drawnOffsetY])

    /* Asleep, the elf lies in the bed the decor names, the form's picture
       of it there in place of the figure on the rug. */
    const sleeper = stage !== 'egg' ? drawnManifest.sleepers?.[renderedVariantFor('bed', decor.bed)] : undefined
    const inBed = sleeping && sleeper !== undefined
    const bedShown = useSharedValue(inBed ? 1 : 0)
    useEffect(() => {
      bedShown.value = withTiming(inBed ? 1 : 0, { duration: reduceMotion ? 0 : BED_FADE_MS, easing: EASING.inOut })
    }, [inBed, reduceMotion, bedShown])
    const standing = useDerivedValue(() => 1 - bedShown.value)
    /* The egg's cracks crack, and the elf in bed snores with its breath. */
    const cracksHeard = useRef(eggCracks)
    useEffect(() => {
      if (eggCracks > cracksHeard.current) onSoundRef.current?.('crack')
      cracksHeard.current = eggCracks
    }, [eggCracks])
    useEffect(() => {
      if (!inBed || paused) return
      const timer = setInterval(() => onSoundRef.current?.('snore'), SNORE_EVERY_MS)
      return () => clearInterval(timer)
    }, [inBed, paused])
    /* A yawn among the fidgets plays its clip (set once the overrides exist). */
    const fidgetRef = useRef<(fidget: Fidget) => void>(() => undefined)
    const onFidget = useCallback((fidget: Fidget) => fidgetRef.current(fidget), [])
    const { motion, particles, react, lookAt, lookRelease, admireAt } = useCottageMotion({
      stage,
      mood,
      sleeping,
      sleepy,
      reduceMotion,
      paused,
      sleepPoint: inBed ? sleeper.puff : undefined,
      onFidget,
    })
    useEffect(() => {
      if (!__DEV__ || !images || decodeLogged) return
      decodeLogged = true
      const sizes = images.body.map((sheet) => `${sheet.width()}x${sheet.height()}`).join(', ')
      console.log(`[elf sprites] ${images.body.length} sheets decoded: ${sizes} px`)
    }, [images])
    /* The fire holds still both for reduce motion and while paused. */
    const fire = useFireMotion({ reduceMotion, paused })
    useDayClock(fire.day, { night: sleeping, reduceMotion })

    /* The shooting star's progress; 0 when there is none. */
    const star = useSharedValue(0)
    const windowSlot = useMemo(() => sceneSlots.find((slot) => slot.id === 'window') ?? slotById('window'), [sceneSlots])
    /* The tap on the frame, read through a ref so the gesture is not
       rebuilt when the tab's handler changes. */
    const onPictureTapRef = useRef(onPictureTap)
    onPictureTapRef.current = onPictureTap
    const onLetterTapRef = useRef(onLetterTap)
    onLetterTapRef.current = onLetterTap
    const onSoundRef = useRef(onSound)
    onSoundRef.current = onSound
    const onShelfTapRef = useRef(onShelfTap)
    onShelfTapRef.current = onShelfTap
    /* Where the letter and the sill's finds take a tap, room units. */
    const extraHits = useMemo(() => {
      if (!extras) return { letter: null, sill: null }
      const { sill, letter } = extraPictures(extras)
      return { letter: letter ? placedBounds([{ picture: letter, dx: 0 }]) : null, sill: placedBounds(sill) }
    }, [extras])
    /* Edit mode frames and picks only what the panel offers. */
    const acceptsEdit = useCallback((id: SlotId) => editable.includes(id), [editable])

    /* The elf stands on the rendered rug; the egg keeps the room's anchor
       in its nest. */
    const hatched = stage !== 'egg'
    const figureOrigin = !hatched ? ROOM.elfAnchor : inBed ? ORIGIN : SPRITE_ELF_ORIGIN
    /* Whether a room point lands on the figure (the elf, in its bed while
       it sleeps, or the egg). */
    const sleeperX = sleeper?.x
    const sleeperY = sleeper?.y
    const sleeperWidth = sleeper?.width
    const sleeperHeight = sleeper?.height
    const figureBox = useMemo(
      () =>
        !hatched
          ? EGG_HIT_BOX
          : inBed && sleeperX !== undefined && sleeperY !== undefined && sleeperWidth !== undefined && sleeperHeight !== undefined
            ? { x: sleeperX, y: sleeperY, width: sleeperWidth, height: sleeperHeight }
            : spriteElfHitBox(units),
      [hatched, inBed, sleeperX, sleeperY, sleeperWidth, sleeperHeight, units],
    )
    const hitsFigure = useCallback((point: { x: number; y: number }) => inBounds(point, figureOrigin, figureBox), [figureOrigin, figureBox])
    /* Above this line a tap on the standing figure lands on the head. */
    const headLine = hatched && !inBed ? SPRITE_ELF_ORIGIN.y - neck : Number.NEGATIVE_INFINITY
    const figureReady = hatched && images?.source === formSource
    useEffect(() => {
      onFigureReady?.(figureReady)
    }, [onFigureReady, figureReady])
    /* The figure's top in the view, for the bubble over its head: the
       middle of the figure's box (the standing elf's is centred on its
       anchor, the sleeper's lies where the bed is, the egg's around the
       nest), at its top edge. */
    useEffect(() => {
      onFigureTop?.({ x: layout.offsetX + (figureOrigin.x + figureBox.x + figureBox.width / 2) * layout.scale, y: layout.offsetY + (figureOrigin.y + figureBox.y) * layout.scale })
    }, [onFigureTop, layout, figureOrigin, figureBox])

    /* The clip: the mood's loop, or a reaction's one shot over
       it, keyed so the same reaction twice restarts the clip. The end of
       the one shot hands back to the mood's loop; a stale end (a clock
       replaced before it finished) is told apart by its key. */
    const [override, setOverride] = useState<{ clip: string; key: number } | null>(null)
    const overrideCount = useRef(0)
    const strokeClipAt = useRef(0)
    const clip = override?.clip ?? moodClip(mood)
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
        const sound = REACTION_SOUND[kind]
        if (sound) onSoundRef.current?.(sound)
        if (!hatched || paused || reduceMotion) return
        const next = REACTION_CLIP[kind]
        /* A form whose atlas lacks the clip (packed before the clip
           existed) keeps its idle rather than throwing in the clock. */
        if (!next || !(next in drawnManifest.clips)) return
        if (kind === 'stroke') {
          const now = Date.now()
          if (now - strokeClipAt.current < STROKE_CLIP_MS) return
          strokeClipAt.current = now
        }
        overrideCount.current += 1
        setOverride({ clip: next, key: overrideCount.current })
      },
      [react, hatched, paused, reduceMotion, drawnManifest],
    )
    fidgetRef.current = (fidget: Fidget) => {
      if (fidget !== 'yawn' || !hatched || paused) return
      onSoundRef.current?.('yawn')
      if (reduceMotion) return
      overrideCount.current += 1
      setOverride({ clip: 'yawn', key: overrideCount.current })
    }
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

    /* The egg's break: its progress for the egg, the timers of its beats,
       and whether the broken egg is still on screen (it outlives the
       hatch, which turns the figure into the elf at the open beat). */
    const hatchProgress = useSharedValue(0)
    const [hatching, setHatching] = useState(false)
    const hatchTimers = useRef<ReturnType<typeof setTimeout>[]>([])
    useEffect(() => () => hatchTimers.current.forEach(clearTimeout), [])
    const hatch = useCallback(
      (onOpen: () => void) => {
        const duration = reduceMotion ? HATCH_MS.reduced : HATCH_MS.full
        hatchTimers.current.forEach(clearTimeout)
        setHatching(true)
        cancelAnimation(hatchProgress)
        hatchProgress.value = 0
        hatchProgress.value = withTiming(1, { duration, easing: Easing.linear, reduceMotion: ReduceMotion.Never })
        hatchTimers.current = [
          setTimeout(() => {
            react('hatch')
            onSoundRef.current?.('hatch')
          }, duration * HATCH_BEATS.split),
          setTimeout(onOpen, duration * HATCH_BEATS.open),
          setTimeout(() => {
            hatchProgress.value = 0
            setHatching(false)
          }, duration + 100),
        ]
      },
      [reduceMotion, hatchProgress, react],
    )

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
        hatch,
      }),
      [reactScene, lookAt, lookRelease, admireAt, layout, hitsFigure, sceneSlots, hatch],
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
        if (actionName === 'openLetter') {
          onLetterTapRef.current?.()
          return
        }
        if (actionName === 'openShelf') {
          onShelfTapRef.current?.()
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
    /* The actions outside edit mode: the touch, the frame's cottage, the
       letter while one waits, the keepsake shelf. */
    const sceneActions = useMemo(
      () => [
        { name: 'activate' },
        ...(framePhoto ? [{ name: 'openStory', label: t('mobile:elf.frameAction') }] : []),
        ...(extras?.letter ? [{ name: 'openLetter', label: t('mobile:elf.awayLetterRead') }] : []),
        { name: 'openShelf', label: t('mobile:elf.shelfOpen') },
      ],
      [framePhoto, extras?.letter, t],
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
          /* The letter lies in front of everything, the finds on the
             window's sill. */
          if (extraHits.letter && inBounds(point, ORIGIN, extraHits.letter)) {
            onLetterTapRef.current?.()
            return
          }
          if (hitsFigure(point)) {
            if (stage === 'egg') onPetEgg?.()
            else if (point.y < headLine && onPokeElf) onPokeElf()
            else onPetElf?.()
            return
          }
          /* The wall and the floor are not things to poke. */
          const slot = slotAtIn(sceneSlots, point, (candidate) => !isSurface(candidate.id))
          if (!slot) return
          glanceAt(slot)
          if (slot.id === 'shelf' || (slot.id === 'window' && extraHits.sill && inBounds(point, ORIGIN, extraHits.sill))) onShelfTapRef.current?.()
          else if (slot.id === 'fireplace') fire.flare()
          else if (slot.id === 'window') shootStar()
          else if (slot.id === 'picture') onPictureTapRef.current?.()
        })

      return Gesture.Exclusive(pan, tap)
    }, [layout, stage, editing, sleeping, headLine, hitsFigure, extraHits, sceneSlots, lookAt, lookRelease, reactScene, glanceAt, shootStar, fire, acceptsEdit, onSelectSlot, onPetElf, onPokeElf, onStrokeElf, onPetEgg])

    const roomTransform = useDerivedValue(() => [{ translateX: drawnOffsetX.value }, { translateY: drawnOffsetY.value }, { scale: layout.scale }])

    return (
      <GestureDetector gesture={gesture}>
        <View
          style={{ width, height }}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('mobile:elf.cottageAria')}
          accessibilityHint={t(editing ? 'mobile:elf.decorateHint' : stage === 'egg' ? 'mobile:elf.tapHintEgg' : 'mobile:elf.tapHint')}
          accessibilityActions={editing ? slotActions : sceneActions}
          onAccessibilityAction={onAccessibilityAction}
        >
          {/* The room covers the whole canvas, so it can be opaque: Android
              then backs it with a SurfaceView, the cheapest path, and the
              one that also draws on the emulator (its TextureView consumer
              never attaches there). */}
          <Canvas style={{ width, height }} opaque>
            <Group transform={roomTransform}>
              <RoomSprites decor={decor} layer="back" day={fire.day} photo={photo} extras={extras} />
              <RoomSprites decor={decor} layer="mid" day={fire.day} />
              {hatched && images ? (
                <Group opacity={standing}>
                  <SpriteElf clip={clip} clipKey={clipKey} onClipEnd={onClipEnd} playing={!paused && !reduceMotion} motion={motion} origin={SPRITE_ELF_ORIGIN} day={fire.day} images={images} hat={hatLayer} manifest={images.source.manifest} />
                </Group>
              ) : null}
              {hatched && sleeper ? <SleepingElf source={images?.source ?? formSource} sleeper={sleeper} hat={hat} day={fire.day} breath={motion.breath} shown={bedShown} /> : null}
              {!hatched || hatching ? <RenderedEgg warmth={warmth} cracks={eggCracks} motion={motion} origin={ROOM.elfAnchor} day={fire.day} hatch={hatchProgress} still={reduceMotion} /> : null}
              <RoomSprites decor={decor} layer="front" day={fire.day} extras={extras} />
              <ShootingStar progress={star} window={windowSlot} />
              <Particles particles={particles} />
              <PlateLighting sleeping={sleeping} fire={fire} reduceMotion={reduceMotion} />
              {focusSlot && !focusElf && !isSurface(focusSlot.id) ? <SlotHighlight slot={focusSlot} reduceMotion={reduceMotion} /> : null}
            </Group>
          </Canvas>
        </View>
      </GestureDetector>
    )
  }),
)
