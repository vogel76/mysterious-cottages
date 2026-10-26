import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useIsFocused, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { careLeft, hatchAt, isBedtimeAt, wantedNeed, type ElfCareAction, type ElfEggAction, type ElfNeedId } from '@chatynkowo/core'
import { useElf, useForeground } from '../../providers'
import { DURATIONS, FeedIcon, ReduceMotion, SPRINGS, Screen, SkeletonCard, TAB_BAR_OVERHANG, Text, colors, fade, iconSize, leave, mapPalette, radius, space, useTabBarHeight } from '../../ui'
import { CottageScene, type CottageSceneHandle } from './cottage/CottageScene'
import type { SlotId } from './cottage/catalogue'
import { ElfActionBar, type FeedDragHandler } from './ElfActionBar'
import { ElfAdoption } from './ElfAdoption'
import { ElfHud, ElfMoodPill, type ElfPanel } from './ElfHud'
import { DECOR_SLOTS, ElfPicker } from './ElfPicker'
import { ElfSpeech } from './ElfSpeech'
import { elfKey } from './labels'
import { useEvolutionPresenter } from './useEvolutionPresenter'
import { useReturnGreeting } from './useReturnGreeting'

/* The Elf tab's screen: the adoption form on the first visit, afterwards
   the cottage. The elf (or its egg in the nest) lives in a full-screen
   painted room (src/features/elf/cottage) that fills the whole tab, under
   the status bar and the floating tab bar as the Atlas does, and a light
   HUD floats over it: the name, the form, the decorating
   buttons, the needs and the ledger at the top with the mood pill under
   them, the round care buttons at the bottom. A tap on the elf pets it
   (and when the rules are still in their cooldown the elf is poked
   instead, so it always answers), a tap on the egg rocks it. The acorn of
   the feed button can also be dragged to the elf: it floats under the
   finger, the elf follows it with its eyes (the sprite elf, with no
   separate head, leans towards it), and dropping it on the elf feeds it;
   dropped elsewhere it flies back. Every action is answered in the scene
   (the care, the tap, the wake, a cheer for the day's quests) and, when
   the rules refuse or the elf sleeps, by the elf itself in a speech
   bubble over its head (ElfSpeech); the care buttons show the day's caps
   as dots, so a refusal is rarely a surprise. The evolution card is
   presented by the hook while the tab is focused. The elf also speaks
   first: a need it wants seen to makes it wave for attention once per
   episode, and a return after half an hour away is greeted.

   Coming into view is a visit for the rules (packages/core, elf.ts): the
   day is settled, the streak counted, the quests dealt. What a visit or an
   action earned (a quest done and its acorns, the full set, a streak
   milestone) and what was lost (a streak that ended with a missed day)
   comes back as news and is said in the bubble line by line, the set and
   the milestone with a cheer in the scene. The purse and the streak stand in
   the HUD's ledger, and a tap on it opens the sheet that says what they
   are (/elf-ledger); a sheet to read the day's quests and pick its reward
   comes in a later step.

   The room is the rendered art (the Blender plate, the furniture sprites
   and the elf's atlases, see apps/mobile/art/README.md). There is no
   wardrobe yet: the elf's face and hood are baked into the body frames and
   no hat layer has been rendered, so there is nothing a wearable could
   change; the outfit the rules store waits for the art pipeline's layers.
   The decorating panel lists only the slots whose variants are rendered,
   and its thumbnails are the sprites themselves.

   The decorating mode is a panel inside the tab, not a route: a route
   would unfocus the tab and pause the scene, and the point of the panel
   is the live preview in the room. It rises in place of the action bar
   and hides the mood pill, and the room is lifted behind it (the panel's
   measured height goes to the scene as its bottom inset) so the elf and
   the low furniture slots stay in view and in reach; the mode puts the
   scene in edit mode (its slots become tap targets that pick the panel's
   tab) and the elf admires each piece placed. A stroke over the
   elf's body counts as a pet for the rules without a reaction of its own:
   the scene plays the stroke. The scene is paused while another tab is on
   top: the tabs keep this screen mounted, and its loops would otherwise
   run under the Atlas for nobody. A new egg gets a fresh scene. */

/* How long a line stays in the elf's speech bubble. */
const SPEECH_MS = 4000
/* The acorn under the finger. */
const ACORN = 44

export function ElfTab() {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  /* The HUD sits above the floating bar's full height: an absolute layout
     gets no automatic content inset. */
  const tabBarHeight = useTabBarHeight()
  const elf = useElf()
  const { state, loaded, stage, mood, decor, lastInteraction, news, visit } = elf
  useEvolutionPresenter()
  const router = useRouter()
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

  /* The tab in view, or the app back in front with the tab on top, is a
     visit: the day is settled and counted. */
  useEffect(() => {
    if (focused && loaded) visit()
  }, [focused, loaded, visit])
  useForeground(() => {
    if (focused && loaded) visit()
  })

  /* What the elf says: one line at a time in the bubble over its head
     for its while, the news waiting in a queue behind it. An answer to a
     touch (a refusal, the greeting, the call) is said at once; a news line
     it cuts short goes back to the front of the queue, so what was earned
     or lost is never missed. The bubble sits where the scene says the
     figure's top is at the moment the line starts. */
  const [speech, setSpeech] = useState<{ text: string; anchor: { x: number; y: number } | null } | null>(null)
  const speechTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const speechQueue = useRef<string[]>([])
  /* The line on screen, and whether it came from the queue. */
  const saying = useRef<{ text: string; queued: boolean } | null>(null)
  const show = useCallback((text: string | null) => {
    setSpeech(text ? { text, anchor: sceneRef.current?.figureTop() ?? null } : null)
  }, [])
  const advanceSpeech = useCallback(() => {
    speechTimer.current = null
    const next = speechQueue.current.shift() ?? null
    saying.current = next ? { text: next, queued: true } : null
    show(next)
    if (next) speechTimer.current = setTimeout(advanceSpeech, SPEECH_MS)
  }, [show])
  const say = useCallback(
    (text: string) => {
      if (speechTimer.current) clearTimeout(speechTimer.current)
      if (saying.current?.queued) speechQueue.current.unshift(saying.current.text)
      saying.current = { text, queued: false }
      show(text)
      speechTimer.current = setTimeout(advanceSpeech, SPEECH_MS)
    },
    [advanceSpeech, show],
  )
  const queueSpeech = useCallback(
    (lines: string[]) => {
      speechQueue.current.push(...lines)
      if (!speechTimer.current) advanceSpeech()
    },
    [advanceSpeech],
  )
  useEffect(
    () => () => {
      if (speechTimer.current) clearTimeout(speechTimer.current)
    },
    [],
  )

  const name = state?.name ?? ''
  const hatched = Boolean(state?.hatched)
  const awake = hatched && !state?.sleeping

  /* The news of the last action or visit, said line by line: a streak
     lost first (it is the one that stings), then what was earned. The
     full set of quests and a streak milestone get a cheer in the scene. */
  useEffect(() => {
    if (!news) return
    const lines: string[] = []
    if (news.streakLost !== null) lines.push(t('mobile:elf.streakLost', { count: news.streakLost }))
    if (news.milestoneDust) lines.push(t('mobile:elf.streakMilestone', { days: news.streak, dust: news.milestoneDust }))
    if (news.completed.length) lines.push(t('mobile:elf.questDone', { count: news.acorns }))
    if (news.setBonus) lines.push(t('mobile:elf.questSet'))
    queueSpeech(lines)
    if (news.setBonus || news.milestoneDust) sceneRef.current?.react('cheer')
  }, [news, queueSpeech, t])

  /* The elf waking, by the button or by the morning: the scene plays the
     wake when the tab can see it (a wake while away is played on the
     return, so the elf is seen to be up). */
  const wasSleeping = useRef(Boolean(state?.sleeping))
  useEffect(() => {
    const sleeping = Boolean(state?.sleeping)
    if (wasSleeping.current && !sleeping && hatched && focused) sceneRef.current?.react('wake')
    wasSleeping.current = sleeping
  }, [state?.sleeping, hatched, focused])

  /* ---------- The panels ---------- */

  const [panel, setPanel] = useState<ElfPanel>('none')
  /* The open panel's height, measured, so the scene can lift the room. */
  const [panelHeight, setPanelHeight] = useState(0)
  const onPanelLayout = useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout
    setPanelHeight((current) => (current === height ? current : height))
  }, [])
  const [decorSlot, setDecorSlot] = useState<SlotId>(DECOR_SLOTS[0] ?? 'rug')
  /* No elf, no panel. */
  useEffect(() => {
    if (!state) setPanel('none')
  }, [state])

  const togglePanel = useCallback((which: Exclude<ElfPanel, 'none'>) => setPanel((current) => (current === which ? 'none' : which)), [])
  const onDecorate = useCallback(() => togglePanel('decor'), [togglePanel])
  /* What the ledger's figures mean: a sheet over the tab. */
  const onLedger = useCallback(() => router.push('/elf-ledger'), [router])
  const closePanel = useCallback(() => setPanel('none'), [])

  /* A slot tapped in the room while decorating picks the panel's tab; a
     slot the panel does not offer (the fireplace, or a slot with a single
     rendered variant) is left alone. */
  const onSelectSlot = useCallback((slot: SlotId) => {
    if (DECOR_SLOTS.includes(slot)) setDecorSlot(slot)
  }, [])

  const { placeDecor } = elf
  const onPick = useCallback(
    (slot: SlotId, id: string) => {
      placeDecor(slot, id)
      sceneRef.current?.admireSlot(slot)
    },
    [placeDecor],
  )

  /* ---------- The elf's own voice ---------- */

  const greeting = useReturnGreeting({
    focused,
    awake,
    lastInteraction,
    onGreet: () => {
      sceneRef.current?.react('greet')
      say(t('mobile:elf.greetHint'))
    },
  })

  /* A need the elf wants seen to: it turns to the player and waves, once
     per episode (the ref remembers which need was called; it clears when
     no need is wanted). Asleep, out of focus, behind a panel, while a
     greeting plays or before the scene is mounted it waits: the episode is
     only marked called once the scene has the wave. */
  const wanted = state && hatched ? wantedNeed(state) : null
  const calledNeed = useRef<ElfNeedId | null>(null)
  useEffect(() => {
    if (!wanted) {
      calledNeed.current = null
      return
    }
    if (!awake || !focused || panel !== 'none' || greeting || calledNeed.current === wanted) return
    if (!sceneRef.current) return
    calledNeed.current = wanted
    sceneRef.current.react('call')
    say(t('mobile:elf.callHint'))
  }, [wanted, awake, focused, panel, greeting, size, say, t])

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
    (id: ElfCareAction) => {
      const outcome = elf.care(id)
      if (outcome.kind === 'refused') say(t(elfKey('guard', outcome.reason)))
      else if (outcome.kind === 'asleep') say(t('mobile:elf.asleepHint'))
      else if (outcome.kind === 'done') sceneRef.current?.react(id === 'feed' ? 'feed' : id === 'play' ? 'play' : 'bath')
      return outcome.kind
    },
    [elf, say, t],
  )

  const onTendEgg = useCallback(
    (id: ElfEggAction) => {
      tendEgg(id)
      sceneRef.current?.react('egg')
    },
    [tendEgg],
  )

  /* The wake itself is played by the sleeping edge above. */
  const onToggleSleep = useCallback(() => {
    const outcome = elf.toggleSleep()
    if (outcome === 'slept') say(t('mobile:elf.fallsAsleep'))
    else if (outcome === 'tooEarly') say(t('mobile:elf.tooEarlyHint'))
  }, [elf, say, t])

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
        /* Dropped elsewhere, or refused (asleep, a full belly, the day's
           feeds used up): back to the button, then gone. */
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
  const hatchTime = hatchAt(state)
  /* What the day still allows of each care, for the buttons' dots. */
  const now = Date.now()
  const left = { feed: careLeft(state, 'feed', now), play: careLeft(state, 'play', now), bath: careLeft(state, 'bath', now) }
  const editing = panel === 'decor'
  /* Bedtime, before the elf is tucked in: heavy lids and yawns say it is
     time. Read at render: the drift re-renders the tab every few seconds. */
  const sleepy = awake && isBedtimeAt(now)
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
            sleepy={sleepy}
            warmth={state.warmth}
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
        <ElfHud name={state.name} stage={stage} needs={state.needs} hatchAt={hatchTime} wallet={state.wallet} streak={state.streak} panel={panel} onDecorate={onDecorate} onLedger={onLedger} onReset={confirmReset} />
        {panel === 'none' ? (
          <Animated.View entering={fade()} exiting={leave()} pointerEvents="none">
            <ElfMoodPill name={state.name} stage={stage} mood={mood} hatchAt={hatchTime} wantedNeed={wanted} />
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

      {/* The elf's line, over its head where the scene put it when the
          line started. */}
      {size ? <ElfSpeech text={speech?.text ?? null} anchor={speech?.anchor ?? null} width={size.width} height={size.height} /> : null}

      <View style={[styles.bottom, { bottom: bottomOffset }]} pointerEvents="box-none">
        {panel === 'none' ? (
          <Animated.View entering={fade()} exiting={leave()} pointerEvents="box-none">
            <ElfActionBar stage={stage} sleeping={state.sleeping} careLeft={left} onCare={onCare} onTendEgg={onTendEgg} onToggleSleep={onToggleSleep} onFeedDrag={onFeedDrag} />
          </Animated.View>
        ) : (
          <View onLayout={onPanelLayout}>
            <ElfPicker decor={decor} activeSlot={decorSlot} onSelectSlot={setDecorSlot} onPick={onPick} onDone={closePanel} />
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
