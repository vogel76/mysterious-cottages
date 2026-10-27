import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useIsFocused, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { careLeft, decorFindsNeeded, ELF_CARE_NEEDS, hatchAt, isBedtimeAt, wantedNeed, type ElfCareAction, type ElfEggAction, type ElfNeedId } from '@chatynkowo/core'
import { announce } from '../../lib/announce'
import { content } from '../../lib/content'
import { useContent, useElf, useForeground, useProgress } from '../../providers'
import { DURATIONS, FeedIcon, ReduceMotion, SPRINGS, Screen, SkeletonCard, TAB_BAR_OVERHANG, Text, cachedContentFile, colors, fade, iconSize, leave, mapPalette, radius, space, useTabBarHeight } from '../../ui'
import { CottageScene, type CottageSceneHandle } from './cottage/CottageScene'
import { PHOTO_ID, type SlotId } from './cottage/catalogue'
import { ElfActionBar, type FeedDragHandler } from './ElfActionBar'
import { ElfHud, type ElfPanel } from './ElfHud'
import { DECOR_SLOTS, ElfPicker } from './ElfPicker'
import { ElfSpeech } from './ElfSpeech'
import { elfKey } from './labels'
import { useEvolutionPresenter } from './useEvolutionPresenter'
import { useReturnGreeting } from './useReturnGreeting'

/* The Elf tab's screen: the cottage, from the first visit, with the egg
   in its nest (nothing to fill in: the elf is named and given its element
   when it hatches, in the hatch sheet). The elf (or its egg) lives in a
   full-screen
   painted room (src/features/elf/cottage) that fills the whole tab, under
   the status bar and the floating tab bar as the Atlas does, and a light
   HUD floats over it: the name, the form and the elf's mood, the
   decorating button, the needs and the ledger at the top, the round care
   buttons on a band over the tab bar, split around its discover key; the
   room in between stays clear, lifted so the rug stays above the band. A tap on the elf pets it
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
   first: its first words to a new player say how to pet it (once for the
   egg, once for the hatched elf), a need it wants seen to makes it wave
   for attention once per episode, and a return after half an hour away
   is greeted.

   Coming into view is a visit for the rules (packages/core, elf.ts): the
   day is settled, the streak counted, the quests dealt. What a visit or an
   action earned (a quest done and its acorns, the full set, a streak
   milestone) and what was lost (a streak that ended with a missed day)
   comes back as news and is said in the bubble line by line, the set and
   the milestone with a cheer in the scene; a new day is announced too.
   The purse, the streak and the day's quests stand in the HUD's ledger,
   and a tap on it opens the day's sheet (/elf-today): the quests with
   their progress, the reward to pick, the streak and what the figures
   mean.

   The room is the rendered art (the Blender plate, the furniture sprites
   and the elf's atlases, see apps/mobile/art/README.md). There is no
   wardrobe yet: the elf's face and hood are baked into the body frames and
   no hat layer has been rendered, so there is nothing a wearable could
   change; the outfit the rules store waits for the art pipeline's layers.
   The decorating panel lists only the slots whose variants are rendered,
   and its thumbnails are the sprites themselves. The frame on the wall
   shows the latest cottage found (its photo, from the expedition's cache,
   drawn into the frame's render) once there is one, unless the player
   picks another picture, and a tap on it opens that cottage's story.

   The decorating mode is a panel inside the tab, not a route: a route
   would unfocus the tab and pause the scene, and the point of the panel
   is the live preview in the room. It rises in place of the action band
   while the HUD steps aside, so every slot's frame is in view, and the
   room is lifted behind it (the panel's
   measured height goes to the scene as its bottom inset) so the elf and
   the low furniture slots stay in view and in reach; the mode puts the
   scene in edit mode (its slots become tap targets that pick the panel's
   tab) and the elf admires each piece placed. A stroke over the
   elf's body counts as a pet for the rules without a reaction of its own:
   the scene plays the stroke. The scene is paused while another tab is on
   top: the tabs keep this screen mounted, and its loops would otherwise
   run under the Atlas for nobody. A new egg gets a fresh scene (keyed by
   the egg's own moment, so the hatch keeps the room on screen). */

/* How long a line stays in the elf's speech bubble. */
const SPEECH_MS = 4000
/* The hatch: how often the ready egg rocks on its own, how many taps crack
   it, and the moment the hatched elf hops after the swap of the figure. */
const HATCH_ROCK_MS = 4000
const HATCH_TAPS = 2
const HATCH_CHEER_DELAY_MS = 400
/* The acorn under the finger. */
const ACORN = 44

export function ElfTab() {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  /* The HUD sits above the floating bar's full height: an absolute layout
     gets no automatic content inset. */
  const tabBarHeight = useTabBarHeight()
  const elf = useElf()
  const { state, loaded, stage, mood, decor, lastInteraction, news, visit, hatchReady, hatchNow } = elf
  /* The cottages, to name the one the elf cheers about and to find the
     latest one's photo; the finds themselves and their count. */
  const { cottages } = useContent()
  const { foundCount, state: progress } = useProgress()
  useEvolutionPresenter()
  const router = useRouter()
  const focused = useIsFocused()

  const sceneRef = useRef<CottageSceneHandle>(null)
  const rootRef = useRef<View>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  /* Where the tab sits in the window: the drag reports window coordinates. */
  const windowOffset = useRef({ x: 0, y: 0 })

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setSize((current) => (current && current.width === width && current.height === height ? current : { width, height }))
    rootRef.current?.measureInWindow((x, y) => {
      windowOffset.current = { x, y }
    })
  }

  /* Whom the elf has introduced itself to: the egg's word and the hatched
     elf's are each said once; a new egg starts over. */
  const introduced = useRef<'egg' | 'elf' | null>(null)
  useEffect(() => {
    if (!state) introduced.current = null
  }, [state])

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
     or lost is never missed. The bubble sits over the figure's top, which
     the scene reports as it lays the room out (so a line said before the
     scene has mounted, the new day's on the first open, still shows once
     it has). */
  const [speech, setSpeech] = useState<{ text: string; seq: number } | null>(null)
  const [figureTop, setFigureTop] = useState<{ x: number; y: number } | null>(null)
  const speechTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const speechQueue = useRef<string[]>([])
  const speechSeq = useRef(0)
  /* The line on screen, and whether it came from the queue. */
  const saying = useRef<{ text: string; queued: boolean } | null>(null)
  /* A line starts: a new bubble (the same words twice included) and the
     line spoken to a screen reader, which the bubble alone would not
     reach on iOS. */
  const start = useCallback((text: string | null) => {
    if (text === null) {
      setSpeech(null)
      return
    }
    speechSeq.current += 1
    setSpeech({ text, seq: speechSeq.current })
    announce(text)
  }, [])
  const advanceSpeech = useCallback(() => {
    speechTimer.current = null
    const next = speechQueue.current.shift() ?? null
    saying.current = next ? { text: next, queued: true } : null
    start(next)
    if (next) speechTimer.current = setTimeout(advanceSpeech, SPEECH_MS)
  }, [start])
  const say = useCallback(
    (text: string) => {
      if (speechTimer.current) clearTimeout(speechTimer.current)
      if (saying.current?.queued) speechQueue.current.unshift(saying.current.text)
      saying.current = { text, queued: false }
      start(text)
      speechTimer.current = setTimeout(advanceSpeech, SPEECH_MS)
    },
    [advanceSpeech, start],
  )
  const queueSpeech = useCallback(
    (lines: string[]) => {
      speechQueue.current.push(...lines)
      if (!speechTimer.current) advanceSpeech()
    },
    [advanceSpeech],
  )
  /* A line said right after the one on screen, not over it: the greeting
     arrives half a second into a visit's news and must not cut it. */
  const sayNext = useCallback(
    (text: string) => {
      if (speechTimer.current) speechQueue.current.unshift(text)
      else say(text)
    },
    [say],
  )
  /* Out of focus (a sheet or a story over the tab) the lines wait: the
     bubble is hidden, a line cut short returns to the front of the queue,
     and the focus resumes them, so nothing is read out over another
     screen. */
  useEffect(() => {
    if (focused) {
      if (!speechTimer.current && speechQueue.current.length) advanceSpeech()
      return
    }
    if (speechTimer.current) clearTimeout(speechTimer.current)
    speechTimer.current = null
    if (saying.current?.queued) speechQueue.current.unshift(saying.current.text)
    saying.current = null
    setSpeech(null)
  }, [focused, advanceSpeech])
  useEffect(
    () => () => {
      if (speechTimer.current) clearTimeout(speechTimer.current)
    },
    [],
  )

  const hatched = Boolean(state?.hatched)
  const awake = hatched && !state?.sleeping
  /* The latest state for the handlers, without re-making them on the drift. */
  const stateRef = useRef(state)
  stateRef.current = state

  /* The news of the last action or visit, said line by line: a cottage
     found since the last visit first (the elf's own joy), a streak lost
     (the one that stings), the new day with its quests and reward, then
     each quest earned. A find, the full set of quests and a streak
     milestone get a cheer in the scene. Each record is said once, when
     the tab is in view: news that arrived while another tab was on top
     (the tick turning the day) waits for the focus, and a language change
     does not repeat the last lines. */
  const consumedNews = useRef(0)
  useEffect(() => {
    if (!news || !focused || news.seq === consumedNews.current) return
    consumedNews.current = news.seq
    const lines: string[] = []
    if (news.celebrate.length === 1) {
      const title = cottages.find((cottage) => cottage.slug === news.celebrate[0])?.title
      lines.push(title ? t('mobile:elf.findLine', { name: title }) : t('mobile:elf.findManyLine', { count: foundCount }))
    } else if (news.celebrate.length > 1) lines.push(t('mobile:elf.findManyLine', { count: foundCount }))
    if (news.streakLost !== null) lines.push(t('mobile:elf.streakLost', { count: news.streakLost }))
    if (news.milestoneDust) lines.push(t('mobile:elf.streakMilestone', { days: news.streak, dust: news.milestoneDust }))
    if (news.newDay) lines.push(t('mobile:elf.newDayLine'))
    for (const quest of news.completed) lines.push(quest.dust > 0 ? t('mobile:elf.questDoneDust', { count: quest.acorns, dust: quest.dust }) : t('mobile:elf.questDone', { count: quest.acorns }))
    if (news.setBonus) lines.push(t('mobile:elf.questSet'))
    queueSpeech(lines)
    if (news.setBonus || news.milestoneDust || news.celebrate.length) sceneRef.current?.react('cheer')
  }, [news, focused, queueSpeech, t, cottages, foundCount])

  /* The elf's first words to a new player, a short guide said once for the
     egg (how to rock it, where the day's quests and reward are) and once
     for the hatched elf (how to pet it, the care and its caps, what a
     cottage found brings), after whatever news the visit brings. */
  useEffect(() => {
    if (!state || !focused) return
    const form = stage === 'egg' ? 'egg' : 'elf'
    if (introduced.current === form) return
    introduced.current = form
    queueSpeech(form === 'egg' ? [t('mobile:elf.firstLineEgg'), t('mobile:elf.guideLedger')] : [t('mobile:elf.firstLine'), t('mobile:elf.guideCare'), t('mobile:elf.guideFind')])
  }, [state, focused, stage, queueSpeech, t])

  /* The elf waking, by the button or by the morning: the scene plays the
     wake when the tab can see it (a wake while away is played on the
     return, so the elf is seen to be up). */
  const wasSleeping = useRef(Boolean(state?.sleeping))
  useEffect(() => {
    const sleeping = Boolean(state?.sleeping)
    if (wasSleeping.current && !sleeping && hatched && focused) sceneRef.current?.react('wake')
    wasSleeping.current = sleeping
  }, [state?.sleeping, hatched, focused])

  /* The latest cottage found: the frame on the wall shows its photo (from
     the expedition's picture cache when it has it, so the frame fills
     offline too) and a tap on the frame opens its story. */
  const latestSlug = useMemo(() => {
    let latest: { slug: string; at: string } | null = null
    for (const [slug, find] of Object.entries(progress.found)) if (!latest || find.foundAt > latest.at) latest = { slug, at: find.foundAt }
    return latest?.slug ?? null
  }, [progress.found])
  const [photo, setPhoto] = useState<string | null>(null)
  useEffect(() => {
    const cottage = latestSlug ? cottages.find((candidate) => candidate.slug === latestSlug) : undefined
    const uri = cottage ? (content.storyPhotos(cottage)[0] ?? null) : null
    if (!uri) {
      setPhoto(null)
      return
    }
    let current = true
    void cachedContentFile(uri).then((resolved) => {
      if (current) setPhoto(resolved)
    })
    return () => {
      current = false
    }
  }, [latestSlug, cottages])
  const onPictureTap = useCallback(() => {
    if (decor.picture !== PHOTO_ID || !latestSlug) return
    router.push({ pathname: '/story/[slug]', params: { slug: latestSlug } })
  }, [decor.picture, latestSlug, router])

  /* ---------- The panels ---------- */

  const [panel, setPanel] = useState<ElfPanel>('none')
  /* How far the HUD reaches down, measured, so the bubble stays under it. */
  const [hudHeight, setHudHeight] = useState(0)
  const onTopLayout = useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout
    setHudHeight((current) => (current === height ? current : height))
  }, [])
  /* The care band's height, measured, so the room is lifted above it. */
  const [bandHeight, setBandHeight] = useState(0)
  const onBandLayout = useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout
    setBandHeight((current) => (current === height ? current : height))
  }, [])
  /* The open panel's height, measured, so the scene can lift the room. */
  const [panelHeight, setPanelHeight] = useState(0)
  const onPanelLayout = useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout
    setPanelHeight((current) => (current === height ? current : height))
  }, [])
  const [decorSlot, setDecorSlot] = useState<SlotId>(DECOR_SLOTS[0] ?? 'rug')
  /* The slots the panel offers right now: the frame only once there is a
     photo to put in it. The scene's edit mode and the panel go by the
     same list, and the active slot never points outside it. */
  const editableSlots = useMemo(() => DECOR_SLOTS.filter((slot) => slot !== 'picture' || photo), [photo])
  useEffect(() => {
    if (!editableSlots.includes(decorSlot)) setDecorSlot(editableSlots[0] ?? 'rug')
  }, [editableSlots, decorSlot])
  /* No elf: no panel, and nothing left to say (a new egg would otherwise
     be told the old elf's lines). */
  useEffect(() => {
    if (state) return
    setPanel('none')
    if (speechTimer.current) clearTimeout(speechTimer.current)
    speechTimer.current = null
    speechQueue.current = []
    saying.current = null
    setSpeech(null)
    setFigureTop(null)
  }, [state])

  const togglePanel = useCallback((which: Exclude<ElfPanel, 'none'>) => setPanel((current) => (current === which ? 'none' : which)), [])
  const onDecorate = useCallback(() => togglePanel('decor'), [togglePanel])
  /* The day's quests, the reward to pick and what the ledger's figures
     mean: a sheet over the tab. */
  const onLedger = useCallback(() => router.push('/elf-today'), [router])
  const closePanel = useCallback(() => setPanel('none'), [])

  /* A slot tapped in the room while decorating picks the panel's tab; a
     slot the panel does not offer (the fireplace, or a slot with a single
     rendered variant) is left alone. */
  const onSelectSlot = useCallback(
    (slot: SlotId) => {
      if (editableSlots.includes(slot)) setDecorSlot(slot)
    },
    [editableSlots],
  )

  /* A piece the finds have not unlocked yet is not placed: the elf says
     how many cottages it still takes. */
  const { placeDecor } = elf
  const onPick = useCallback(
    (slot: SlotId, id: string) => {
      const needed = decorFindsNeeded(slot, id, foundCount)
      if (needed > 0) {
        say(t('mobile:elf.lockedLine', { count: needed }))
        return
      }
      placeDecor(slot, id)
      sceneRef.current?.admireSlot(slot)
    },
    [placeDecor, foundCount, say, t],
  )

  /* ---------- The elf's own voice ---------- */

  const greeting = useReturnGreeting({
    focused,
    awake,
    lastInteraction,
    onGreet: () => {
      sceneRef.current?.react('greet')
      sayNext(t('mobile:elf.greetHint'))
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
    /* Within the cooldown the rules give nothing, but the elf still answers. */
    sceneRef.current?.react(pet() ? 'pet' : 'poke')
  }, [pet])

  const onPokeElf = useCallback(() => {
    sceneRef.current?.react('poke')
  }, [])

  /* The finger moving over the body: the rules count a pet, the scene
     already plays the stroke and its hearts. */
  const onStrokeElf = useCallback(() => pet(), [pet])

  /* The hatch is the player's: once the egg is ready it rocks on its own
     every few seconds and the name block says to tap it; the first tap
     cracks it (a word from inside), the second lets the elf out, who hops
     with a cheer and says hello before the sheet asks for its name. */
  const cracks = useRef(0)
  useEffect(() => {
    if (!hatchReady || stage !== 'egg' || !focused || panel !== 'none') return
    cracks.current = 0
    const timer = setInterval(() => sceneRef.current?.react('egg'), HATCH_ROCK_MS)
    return () => clearInterval(timer)
  }, [hatchReady, stage, focused, panel])
  const onPetEgg = useCallback(() => {
    if (hatchReady) {
      cracks.current += 1
      sceneRef.current?.react('egg')
      if (cracks.current < HATCH_TAPS) {
        say(t('mobile:elf.crackLine'))
        return
      }
      hatchNow()
      setTimeout(() => sceneRef.current?.react('cheer'), HATCH_CHEER_DELAY_MS)
      say(t('mobile:elf.hatchHello'))
      return
    }
    tendEgg('rock')
    sceneRef.current?.react('egg')
  }, [hatchReady, hatchNow, tendEgg, say, t])

  /* Returns how the rules took it, so the drag-to-feed can tell an eaten
     acorn from a refused one. */
  const onCare = useCallback(
    (id: ElfCareAction) => {
      const outcome = elf.care(id)
      if (outcome.kind === 'refused') say(t(elfKey('guard', outcome.reason)))
      else if (outcome.kind === 'asleep') say(t('mobile:elf.asleepHint'))
      else if (outcome.kind === 'done') {
        sceneRef.current?.react(id === 'feed' ? 'feed' : id === 'play' ? 'play' : 'bath')
        /* The scene and the "+N" over the chip show it; a screen reader
           is told the need and its gain. */
        const need = ELF_CARE_NEEDS[id]
        const gain = Math.round(outcome.state.needs[need] - (stateRef.current?.needs[need] ?? outcome.state.needs[need]))
        if (gain > 0) announce(t('mobile:elf.needGainAria', { need: t(elfKey('need', need)), value: gain }))
      }
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

  /* The form and the skeleton scroll under no header, so they take the top
     inset themselves and end above the bar. */
  const bottom = { paddingBottom: tabBarHeight + space.xxl }

  if (!loaded || !state) {
    return (
      <Screen topInset contentStyle={bottom}>
        <SkeletonCard />
        <SkeletonCard />
      </Screen>
    )
  }

  const hatchTime = hatchAt(state)
  /* What the day still allows of each care, for the buttons' dots. */
  const now = Date.now()
  const left = { feed: careLeft(state, 'feed', now), play: careLeft(state, 'play', now), bath: careLeft(state, 'bath', now) }
  const editing = panel === 'decor'
  /* Bedtime, before the elf is tucked in: heavy lids and yawns say it is
     time. Read at render: the drift re-renders the tab every few seconds. */
  const sleepy = awake && isBedtimeAt(now)
  /* Where the panels stand above the floating tab bar; the care band sits
     on the bar itself. What covers the view's bottom, for the room's lift. */
  const bottomOffset = tabBarHeight + TAB_BAR_OVERHANG + space.md
  const bottomInset = panel === 'none' ? tabBarHeight + bandHeight : bottomOffset + panelHeight

  return (
    <View ref={rootRef} style={styles.screen} onLayout={onLayout}>
      {size ? (
        <View key={state.eggAppearedAt} style={StyleSheet.absoluteFill}>
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
            editable={editableSlots}
            bottomInset={bottomInset}
            selectedSlot={editing ? decorSlot : null}
            onSelectSlot={onSelectSlot}
            onPetElf={onPetElf}
            onPokeElf={onPokeElf}
            onStrokeElf={onStrokeElf}
            onPetEgg={onPetEgg}
            onFigureTop={setFigureTop}
            photo={photo}
            onPictureTap={onPictureTap}
          />
        </View>
      ) : null}

      {/* The words stay at the top with the needs, so the room and the elf
          in the middle of it are never covered; the bottom holds the action
          bar or the open panel alone. */}
      <View style={[styles.top, { top: insets.top + space.md }]} pointerEvents="box-none" onLayout={onTopLayout}>
        {/* While decorating the HUD steps aside: the whole room is there to
            pick from, and no slot's frame hides under the name block. The
            panel has the way out. */}
        {panel === 'none' ? (
          <Animated.View entering={fade()} exiting={leave()} pointerEvents="box-none">
            <ElfHud name={state.name} stage={stage} mood={mood} wantedNeed={wanted} needs={state.needs} hatchAt={hatchTime} wallet={state.wallet} streak={state.streak} questsDone={state.daily.quests.filter((quest) => quest.done).length} rewardWaiting={state.daily.rewardPicked === null} onDecorate={onDecorate} onLedger={onLedger} />
          </Animated.View>
        ) : null}
        {panel === 'decor' ? (
          <Animated.View entering={fade()} exiting={leave()} pointerEvents="none" style={styles.editHint} accessibilityLiveRegion="polite">
            <Text variant="small" align="center" style={styles.editHintInk}>
              {t('mobile:elf.decorateHint')}
            </Text>
          </Animated.View>
        ) : null}
      </View>

      {/* The elf's line, over its head where the scene says it is. */}
      {size ? <ElfSpeech line={speech} anchor={figureTop} width={size.width} height={size.height} topLimit={insets.top + space.md + hudHeight + space.sm} /> : null}

      {panel === 'none' ? (
        <Animated.View entering={fade()} exiting={leave()} style={[styles.band, { bottom: tabBarHeight }]} onLayout={onBandLayout} pointerEvents="box-none">
          <ElfActionBar stage={stage} sleeping={state.sleeping} careLeft={left} onCare={onCare} onTendEgg={onTendEgg} onToggleSleep={onToggleSleep} onFeedDrag={onFeedDrag} />
        </Animated.View>
      ) : (
        <View style={[styles.bottom, { bottom: bottomOffset }]} onLayout={onPanelLayout} pointerEvents="box-none">
          <ElfPicker decor={decor} photo={photo} slots={editableSlots} foundCount={foundCount} activeSlot={decorSlot} onSelectSlot={setDecorSlot} onPick={onPick} onDone={closePanel} />
        </View>
      )}

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
  /* The care band runs edge to edge on the tab bar. */
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  /* The decorating hint, in the HUD's chrome, under the ledger. */
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
