import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useIsFocused } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useElf } from '../../providers'
import { DURATIONS, FeedIcon, ReduceMotion, SPRINGS, Screen, SkeletonCard, TAB_BAR_OVERHANG, Text, colors, fade, iconSize, leave, mapPalette, radius, space, useTabBarHeight } from '../../ui'
import { CottageScene, type CottageSceneHandle } from './cottage/CottageScene'
import type { SlotId } from './cottage/items'
import { ElfActionBar, type FeedDragHandler } from './ElfActionBar'
import { ElfAdoption } from './ElfAdoption'
import { ElfHud, ElfMoodPill, type ElfHint, type ElfPanel } from './ElfHud'
import { ElfPicker, decorSlotsFor, type PickerSlot } from './ElfPicker'
import { elfKey } from './labels'
import { lowestNeed, type CareActionId, type EggActionId, type NeedId, type WearableSlot } from './rules'
import { SPRITE_CHARACTERS } from './sprites'
import { useEvolutionPresenter } from './useEvolutionPresenter'
import { useReturnGreeting } from './useReturnGreeting'

/* The Elf tab's screen: the adoption form on the first visit, afterwards
   the cottage. The elf (or its egg in the nest) lives in a full-screen
   painted room (src/features/elf/cottage) that fills the whole tab, under
   the status bar and the floating tab bar as the Atlas does, and a light
   HUD floats over it: the name, the form, the wardrobe and decorating
   buttons and the needs at the top with the mood pill under them, the
   round care buttons at the bottom. A tap on the elf pets it (and when the
   rules are still in their cooldown the elf is poked instead, so it always
   answers), a tap on the egg rocks it. The acorn of the feed button can
   also be dragged to the elf: it floats under the finger, the elf follows
   it with its eyes (the sprite elf, with no separate head, leans towards
   it), and dropping it on the elf feeds it; dropped elsewhere it flies
   back. Every action is answered in the scene (the care, the tap,
   the wake, a level gained) and, when the rules refuse or the elf sleeps,
   in the hint under the mood line; the evolution card is presented by the
   hook while the tab is focused. The elf also speaks first: a need under
   the low mark makes it wave for attention once per episode, and a return
   after half an hour away is greeted.

   The room is drawn in one of two ways, and the scene picks: the rendered
   art (the Blender plate, the furniture sprites and the elf's atlases, see
   apps/mobile/art/README.md) once the elf character is registered in
   SPRITE_CHARACTERS, otherwise the code-drawn vectors it started with.
   The tab follows that choice where it shows: in sprite mode the wardrobe
   is hidden (the elf's face and hood are baked into the body frames and no
   hat layer has been rendered yet, so there is nothing a wearable could
   change), the decorating panel lists only the slots whose variants are
   rendered, and the picker's thumbnails are the sprites themselves.

   The wardrobe and the decorating mode are panels inside the tab, not
   routes: a route would unfocus the tab and pause the scene, and the point
   of both is the live preview in the room. A panel rises in place of the
   action bar and hides the mood pill, and the room is lifted behind it
   (the panel's measured height goes to the scene as its bottom inset) so
   the elf and the low furniture slots stay in view and in reach; the
   wardrobe equips at once and the elf twirls, the decorating mode puts
   the scene in edit mode (its slots become tap targets that pick the
   panel's tab) and the elf admires each piece placed. A stroke over the
   elf's body counts as a pet for the rules without a reaction of its own:
   the scene plays the stroke. The scene is paused while another tab is on top: the tabs
   keep this screen mounted, and its loops would otherwise run under the
   Atlas for nobody. A new egg gets a fresh scene. The game mechanics
   around the care loop (levels, skills, a shop) are out of scope for this
   prototype; the rules keep working underneath. */

/* How long a passing hint stays under the mood line. */
const HINT_MS = 3500
/* Energy under this makes the elf droop and yawn. */
const TIRED_ENERGY = 30
/* The acorn under the finger. */
const ACORN = 44
/* Whether the scene draws the rendered art: the elf's atlases are
   registered. The vector cottage stays as the fallback until the sprites
   cover everything. */
const SPRITE_MODE = 'elf' in SPRITE_CHARACTERS
/* The furniture the decorating panel offers in this mode. */
const DECOR_SLOTS = decorSlotsFor(SPRITE_MODE)

export function ElfTab() {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  /* The HUD sits above the floating bar's full height: an absolute layout
     gets no automatic content inset. */
  const tabBarHeight = useTabBarHeight()
  const elf = useElf()
  const { state, loaded, stage, mood, outfit, decor, lastInteraction, onReaction } = elf
  useEvolutionPresenter()
  const focused = useIsFocused()

  const sceneRef = useRef<CottageSceneHandle>(null)
  const rootRef = useRef<View>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const [hintSeen, setHintSeen] = useState(false)
  /* Where the tab sits in the window: the drag reports window coordinates. */
  const windowOffset = useRef({ x: 0, y: 0 })

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setSize((current) => (current && current.width === width && current.height === height ? current : { width, height }))
    rootRef.current?.measureInWindow((x, y) => {
      windowOffset.current = { x, y }
    })
  }

  /* A new egg starts with the tap hint again, and so does the hatched elf:
     the egg's hint is usually dismissed by the tap that hatched it. */
  useEffect(() => {
    if (!state) setHintSeen(false)
  }, [state])
  const prevStage = useRef(stage)
  useEffect(() => {
    if (prevStage.current === 'egg' && stage !== 'egg') setHintSeen(false)
    prevStage.current = stage
  }, [stage])

  /* The passing hint and the timer that clears it. */
  const [flash, setFlash] = useState<ElfHint | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showHint = useCallback((text: string, tone: ElfHint['tone'] = 'soft') => {
    if (flashTimer.current) clearTimeout(flashTimer.current)
    setFlash({ text, tone })
    flashTimer.current = setTimeout(() => {
      flashTimer.current = null
      setFlash(null)
    }, HINT_MS)
  }, [])
  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current)
    },
    [],
  )

  /* A level gained is called out in the hint and in the scene. The other
     reactions are answered where they happen (the handlers below), so they
     are not doubled here. */
  useEffect(
    () =>
      onReaction((reaction) => {
        if (reaction === 'levelUp') {
          showHint(t('mobile:elf.levelUp'), 'accent')
          sceneRef.current?.react('levelUp')
        }
      }),
    [onReaction, showHint, t],
  )

  const name = state?.name ?? ''
  const hatched = Boolean(state?.hatched)
  const awake = hatched && !state?.sleeping

  /* ---------- The panels ---------- */

  const [panel, setPanel] = useState<ElfPanel>('none')
  /* The open panel's height, measured, so the scene can lift the room. */
  const [panelHeight, setPanelHeight] = useState(0)
  const onPanelLayout = useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout
    setPanelHeight((current) => (current === height ? current : height))
  }, [])
  const [wardrobeSlot, setWardrobeSlot] = useState<WearableSlot>('hat')
  const [decorSlot, setDecorSlot] = useState<SlotId>(DECOR_SLOTS[0] ?? 'rug')
  /* The wardrobe is offered to a hatched elf, and only while the vector
     puppet is drawn: the rendered elf has no hat layers yet (its face and
     hood are baked into the body), so a wearable would change nothing. */
  const wardrobe = hatched && !SPRITE_MODE
  /* No elf, no panel; no wardrobe, no wardrobe panel. */
  useEffect(() => {
    if (!state) setPanel('none')
    else if (!wardrobe && panel === 'wardrobe') setPanel('none')
  }, [state, wardrobe, panel])

  const togglePanel = useCallback((which: Exclude<ElfPanel, 'none'>) => setPanel((current) => (current === which ? 'none' : which)), [])
  const onWardrobe = useCallback(() => togglePanel('wardrobe'), [togglePanel])
  const onDecorate = useCallback(() => togglePanel('decor'), [togglePanel])
  const closePanel = useCallback(() => setPanel('none'), [])

  const onPickerSlot = useCallback(
    (slot: PickerSlot) => {
      if (panel === 'wardrobe') setWardrobeSlot(slot as WearableSlot)
      else setDecorSlot(slot as SlotId)
    },
    [panel],
  )

  /* A slot tapped in the room while decorating picks the panel's tab; a
     slot the panel does not offer (the fireplace, and in sprite mode a slot
     with a single rendered variant) is left alone. */
  const onSelectSlot = useCallback((slot: SlotId) => {
    if (DECOR_SLOTS.includes(slot)) setDecorSlot(slot)
  }, [])

  const { equip, placeDecor } = elf
  const onPick = useCallback(
    (slot: PickerSlot, id: string) => {
      if (panel === 'wardrobe') {
        equip(slot as WearableSlot, id)
        sceneRef.current?.react('twirl')
      } else {
        placeDecor(slot as SlotId, id)
        sceneRef.current?.admireSlot(slot as SlotId)
      }
    },
    [panel, equip, placeDecor],
  )

  /* ---------- The elf's own voice ---------- */

  const greeting = useReturnGreeting({
    focused,
    awake,
    lastInteraction,
    onGreet: () => {
      sceneRef.current?.react('greet')
      showHint(t('mobile:elf.greetHint', { name }), 'accent')
    },
  })

  /* A need under the low mark: the elf turns to the player and waves, once
     per episode (the ref remembers which need was called; it clears when
     no need is low). Asleep, out of focus, behind a panel, while a
     greeting plays or before the scene is mounted it waits: the episode is
     only marked called once the scene has the wave. */
  const lowNeed = state ? lowestNeed(state) : null
  const calledNeed = useRef<NeedId | null>(null)
  useEffect(() => {
    if (!lowNeed) {
      calledNeed.current = null
      return
    }
    if (!awake || !focused || panel !== 'none' || greeting || calledNeed.current === lowNeed) return
    if (!sceneRef.current) return
    calledNeed.current = lowNeed
    sceneRef.current.react('call')
    showHint(t('mobile:elf.callHint', { name }), 'accent')
  }, [lowNeed, awake, focused, panel, greeting, size, showHint, t, name])

  /* ---------- The actions ---------- */

  const { pet, tendEgg } = elf
  const onPetElf = useCallback(() => {
    setHintSeen(true)
    /* Within the cooldown the rules give nothing, but the elf still answers. */
    sceneRef.current?.react(pet() ? 'pet' : 'poke')
  }, [pet])

  const onPokeElf = useCallback(() => {
    setHintSeen(true)
    sceneRef.current?.react('poke')
  }, [])

  /* The finger moving over the body: the rules count a pet, the scene
     already plays the stroke and its hearts. */
  const onStrokeElf = useCallback(() => {
    const counted = pet()
    if (counted) setHintSeen(true)
    return counted
  }, [pet])

  const onPetEgg = useCallback(() => {
    setHintSeen(true)
    tendEgg('rock')
    sceneRef.current?.react('egg')
  }, [tendEgg])

  /* Returns how the rules took it, so the drag-to-feed can tell an eaten
     acorn from a refused one. */
  const onCare = useCallback(
    (id: CareActionId) => {
      const outcome = elf.care(id)
      if (outcome.kind === 'refused') showHint(t(elfKey('guard', outcome.reason), { name }), 'soft')
      else if (outcome.kind === 'asleep') showHint(t('mobile:elf.asleepHint', { name }), 'soft')
      else if (outcome.kind === 'done') sceneRef.current?.react(id === 'feed' ? 'feed' : id === 'play' ? 'play' : 'bath')
      return outcome.kind
    },
    [elf, showHint, t, name],
  )

  const onTendEgg = useCallback(
    (id: EggActionId) => {
      tendEgg(id)
      sceneRef.current?.react('egg')
    },
    [tendEgg],
  )

  const onToggleSleep = useCallback(() => {
    const waking = Boolean(state?.sleeping)
    elf.toggleSleep()
    if (waking) sceneRef.current?.react('wake')
    else showHint(t('mobile:elf.fallsAsleep', { name }), 'soft')
  }, [elf, state, showHint, t, name])

  /* ---------- Drag-to-feed ---------- */

  /* The acorn under the finger, in the tab's coordinates (the scene fills
     the tab, so they are the scene's view coordinates too). */
  const acornX = useSharedValue(0)
  const acornY = useSharedValue(0)
  const acornScale = useSharedValue(0.6)
  const acornOpacity = useSharedValue(0)
  const dragStart = useRef({ x: 0, y: 0 })
  const acornStyle = useAnimatedStyle(() => ({
    opacity: acornOpacity.value,
    transform: [{ translateX: acornX.value - ACORN / 2 }, { translateY: acornY.value - ACORN / 2 }, { scale: acornScale.value }],
  }))

  const onFeedDrag = useCallback<FeedDragHandler>(
    (phase, windowX, windowY) => {
      const x = windowX - windowOffset.current.x
      const y = windowY - windowOffset.current.y
      const scene = sceneRef.current
      if (phase === 'begin') {
        setHintSeen(true)
        dragStart.current = { x, y }
        for (const value of [acornX, acornY, acornScale, acornOpacity]) cancelAnimation(value)
        acornX.value = x
        acornY.value = y
        acornScale.value = withSpring(1, SPRINGS.snappy)
        acornOpacity.value = withTiming(1, { duration: DURATIONS.fast, reduceMotion: ReduceMotion.System })
        scene?.lookAt(x, y)
        return
      }
      if (phase === 'move') {
        acornX.value = x
        acornY.value = y
        scene?.lookAt(x, y)
        return
      }
      scene?.lookRelease()
      if (scene?.hitsPuppet(x, y) && onCare('feed') === 'done') {
        /* Eaten: the acorn shrinks into the elf. */
        acornScale.value = withTiming(0.3, { duration: DURATIONS.fast, reduceMotion: ReduceMotion.System })
        acornOpacity.value = withTiming(0, { duration: DURATIONS.fast, reduceMotion: ReduceMotion.System })
      } else {
        /* Dropped elsewhere, or refused (asleep, a full belly): back to the
           button, then gone. */
        acornX.value = withSpring(dragStart.current.x, SPRINGS.settle)
        acornY.value = withSpring(dragStart.current.y, SPRINGS.settle)
        acornScale.value = withSpring(0.6, SPRINGS.settle)
        acornOpacity.value = withDelay(DURATIONS.base, withTiming(0, { duration: DURATIONS.fast, reduceMotion: ReduceMotion.System }))
      }
    },
    [acornX, acornY, acornScale, acornOpacity, onCare],
  )

  const confirmReset = () =>
    Alert.alert(t('mobile:elf.resetTitle'), t('mobile:elf.resetBody'), [
      { text: t('mobile:common.cancel'), style: 'cancel' },
      { text: t('mobile:elf.resetConfirm'), style: 'destructive', onPress: elf.reset },
    ])

  /* The form and the skeleton scroll under no header, so they take the top
     inset themselves and end above the bar. */
  const bottom = { paddingBottom: tabBarHeight + space.xxl }

  if (!loaded) {
    return (
      <Screen topInset contentStyle={bottom}>
        <SkeletonCard />
        <SkeletonCard />
      </Screen>
    )
  }

  if (!state) {
    return (
      <Screen topInset keyboard="interactive" contentStyle={bottom}>
        <ElfAdoption />
      </Screen>
    )
  }

  const isEgg = stage === 'egg'
  const editing = panel === 'decor'
  /* Where the action bar and the panels stand above the floating tab bar. */
  const bottomOffset = tabBarHeight + TAB_BAR_OVERHANG + space.md
  const bottomInset = panel === 'none' ? 0 : bottomOffset + panelHeight

  return (
    <View ref={rootRef} style={styles.screen} onLayout={onLayout}>
      {size ? (
        <View key={state.born} style={StyleSheet.absoluteFill}>
          <CottageScene
            ref={sceneRef}
            stage={stage}
            starter={state.starter}
            mood={mood}
            sleeping={state.sleeping}
            tired={hatched && state.needs.energy < TIRED_ENERGY}
            warmth={state.warmth}
            outfit={outfit}
            decor={decor}
            width={size.width}
            height={size.height}
            paused={!focused}
            editing={editing}
            bottomInset={bottomInset}
            selectedSlot={editing ? decorSlot : null}
            onSelectSlot={onSelectSlot}
            onPetElf={onPetElf}
            onPokeElf={onPokeElf}
            onStrokeElf={onStrokeElf}
            onPetEgg={onPetEgg}
          />
        </View>
      ) : null}

      {/* The words stay at the top with the needs, so the elf in the middle
          of the room is never covered; the bottom holds the action bar or
          the open panel alone. */}
      <View style={[styles.top, { top: insets.top + space.md }]} pointerEvents="box-none">
        <ElfHud name={state.name} stage={stage} needs={state.needs} warmth={state.warmth} panel={panel} wardrobe={wardrobe} onWardrobe={onWardrobe} onDecorate={onDecorate} onReset={confirmReset} />
        {panel === 'none' ? (
          <Animated.View entering={fade()} exiting={leave()} pointerEvents="none">
            <ElfMoodPill name={state.name} stage={stage} mood={mood} lowNeed={lowNeed} flash={flash} />
          </Animated.View>
        ) : null}
        {panel === 'decor' ? (
          <Animated.View entering={fade()} exiting={leave()} pointerEvents="none" style={styles.editHint} accessibilityLiveRegion="polite">
            <Text variant="small" align="center" style={styles.editHintInk}>
              {t('mobile:elf.decorateHint')}
            </Text>
          </Animated.View>
        ) : null}
        {hintSeen || panel !== 'none' ? null : (
          <Animated.View entering={fade()} exiting={leave()} pointerEvents="none">
            <Text variant="small" tone="faint" align="center" style={styles.tapHint}>
              {t(isEgg ? 'mobile:elf.tapHintEgg' : 'mobile:elf.tapHint')}
            </Text>
            {isEgg ? null : (
              <Text variant="small" tone="faint" align="center" style={styles.tapHint}>
                {t('mobile:elf.dragFeedHint')}
              </Text>
            )}
          </Animated.View>
        )}
      </View>

      <View style={[styles.bottom, { bottom: bottomOffset }]} pointerEvents="box-none">
        {panel === 'none' ? (
          <Animated.View entering={fade()} exiting={leave()} pointerEvents="box-none">
            <ElfActionBar stage={stage} sleeping={state.sleeping} onCare={onCare} onTendEgg={onTendEgg} onToggleSleep={onToggleSleep} onFeedDrag={onFeedDrag} />
          </Animated.View>
        ) : (
          <View onLayout={onPanelLayout}>
            <ElfPicker
              mode={panel}
              sprites={SPRITE_MODE}
              starter={state.starter}
              outfit={outfit}
              decor={decor}
              activeSlot={panel === 'wardrobe' ? wardrobeSlot : decorSlot}
              onSelectSlot={onPickerSlot}
              onPick={onPick}
              onDone={closePanel}
            />
          </View>
        )}
      </View>

      {/* The acorn in flight, over everything; it never takes a touch. */}
      <Animated.View style={[styles.acorn, acornStyle]} pointerEvents="none">
        <FeedIcon size={iconSize.md} weight="fill" color={colors.accentInk} />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.page,
  },
  top: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    gap: space.sm,
  },
  bottom: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
  },
  /* Over the painted floor, not on a surface: a shadow keeps it legible. */
  tapHint: {
    textShadowColor: colors.page,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  /* The decorating hint takes the mood pill's place and chrome. */
  editHint: {
    alignSelf: 'center',
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    borderWidth: 1,
    borderColor: mapPalette.chromeBorder,
    borderRadius: radius.card,
    backgroundColor: mapPalette.chrome,
  },
  editHintInk: {
    color: mapPalette.chromeInk,
  },
  acorn: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: ACORN,
    height: ACORN,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    backgroundColor: colors.accent,
  },
})
