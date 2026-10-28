import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useIsFocused, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { careLeft, decorFindsNeeded, ELF_CARE_NEEDS, hatchAt, isBedtimeAt, plantStageAt, wantedNeed, type ElfCareAction, type ElfEggAction, type ElfForm, type ElfNeedId } from '@chatynkowo/core'
import { announce } from '../../lib/announce'
import { requestNotificationPermission } from '../../lib/notifications'
import { setReminders } from '../../lib/reminders-store'
import { content } from '../../lib/content'
import { useContent, useElf, useForeground, useProgress } from '../../providers'
import { Button, DURATIONS, FeedIcon, ReduceMotion, SPRINGS, Screen, SkeletonCard, Text, cachedContentFile, colors, fade, iconSize, leave, mapPalette, radius, space, useTabBarHeight } from '../../ui'
import { CottageScene, type CottageSceneHandle } from './cottage/CottageScene'
import { SPRITE_CHARACTERS, preloadSprites } from './sprites'
import { PHOTO_ID, type SlotId } from './cottage/catalogue'
import type { RoomExtras } from './cottage/roomAssets'
import { ElfActionBar, type FeedDragHandler } from './ElfActionBar'
import { ElfHud, type ElfPanel } from './ElfHud'
import { DECOR_SLOTS, ElfDecorPanel, type CatalogueTab } from './ElfDecorPanel'
import { ElfSpeech } from './ElfSpeech'
import { ElfCard } from './ElfCard'
import { ElfTutorial } from './ElfTutorial'
import { useElfTutorial } from './useElfTutorial'
import { elfKey } from './labels'
import { useElfCardPresenter } from './useElfCardPresenter'
import { useReminderPrefs } from './useElfReminders'
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
   first: a need it wants seen to makes it wave for attention once per
   episode, and a return after half an hour away is greeted. A new player
   is shown the way by the tutorial (useElfTutorial, ElfTutorial): a few
   cards above the care band, once for the egg and once for the named
   elf, some waiting for the move they ask for. In the same place, once
   no step shows, the elf asks once whether it may let the player know
   when something happens (the reminders, useElfReminders).

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
   and the elf's atlases, see apps/mobile/art/README.md). The wardrobe is
   the hats, each a layer of the elf's atlas over the body, chosen in the
   decorating catalogue's first tab; the other wearables the rules store
   wait for their layers. The catalogue lists only the places whose
   variants are rendered, with their close-up pictures. The frame on the wall
   shows the latest cottage found (its photo, from the expedition's cache,
   drawn into the frame's render) once there is one, unless the player
   picks another picture, and a tap on it opens that cottage's story.
   What the days bring is in the room too: the plant on the windowsill
   grows with the elf's age, the finds of the days away lie beside it, and
   a letter that came waits on the floor. A tap on the letter opens it, one
   on the shelf or the finds the keepsake shelf, and the first visit after
   an absence of two days or more opens the 'while you were away' card (the
   card presenter); a single night's find the elf says itself.

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

/* A name in the middle of a line: its first letter lowered ("Szyszka" to
   "szyszka"), the rest kept ("Amonit z Jury"). */
function lowerFirst(text: string, language: string): string {
  return text.charAt(0).toLocaleLowerCase(language) + text.slice(1)
}

/* How long a line stays in the elf's speech bubble. */
const SPEECH_MS = 4000
/* The hatch: how often the ready egg rocks on its own, how many taps crack
   it, and the moment the hatched elf hops after the swap of the figure. */
const HATCH_ROCK_MS = 4000
const HATCH_TAPS = 2
const HATCH_CHEER_DELAY_MS = 400
/* The evolution's moment waits this long after the form is reached, and
   the new form appears at the height of its flash. */
const EVOLVE_DELAY_MS = 400
const EVOLVE_FLASH_MS = 900
/* The acorn under the finger. */
const ACORN = 44

export function ElfTab() {
  const { t, i18n } = useTranslation()
  const insets = useSafeAreaInsets()
  /* The HUD sits above the floating bar's full height: an absolute layout
     gets no automatic content inset. */
  const tabBarHeight = useTabBarHeight()
  const elf = useElf()
  const { state, loaded, stage, mood, decor, lastInteraction, news, away, visit, hatchReady, hatchNow, pendingEvolution } = elf
  /* The cottages, to name the one the elf cheers about and to find the
     latest one's photo; the finds themselves and their count. */
  const { cottages } = useContent()
  const { foundCount, state: progress } = useProgress()
  useElfCardPresenter()
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
  /* Whether the 'while you were away' card waits: it tells of the letter itself. */
  const awayRef = useRef(away)
  awayRef.current = away

  /* The news of the last action or visit, said line by line: a cottage
     found since the last visit first (the elf's own joy), a streak lost
     (the one that stings), the new day with its quests and reward, the
     night's find on the sill (a longer absence has the card instead), then
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
    const find = news.away && !news.away.card ? news.away.found[0] : undefined
    if (find) lines.push(t('mobile:elf.sillFoundLine', { item: lowerFirst(t(elfKey('sill', find)), i18n.language) }))
    for (const quest of news.completed) lines.push(quest.dust > 0 ? t('mobile:elf.questDoneDust', { count: quest.acorns, dust: quest.dust }) : t('mobile:elf.questDone', { count: quest.acorns }))
    if (news.setBonus) lines.push(t('mobile:elf.questSet'))
    queueSpeech(lines)
    if (news.setBonus || news.milestoneDust || news.celebrate.length) sceneRef.current?.react('cheer')
  }, [news, focused, queueSpeech, t, i18n.language, cottages, foundCount])


  /* The elf waking, by the button or by the morning: the scene plays the
     wake when the tab can see it (a wake while away is played on the
     return, so the elf is seen to be up). */
  const wasSleeping = useRef(Boolean(state?.sleeping))
  useEffect(() => {
    const sleeping = Boolean(state?.sleeping)
    if (wasSleeping.current && !sleeping && hatched && focused) sceneRef.current?.react('wake')
    wasSleeping.current = sleeping
  }, [state?.sleeping, hatched, focused])

  /* A form reached: the elf's moment in the room (it lights up in a
     spiral of sparkles), a beat after the care that earned it, before the
     card presenter brings the evolution card. Played once per form, when
     the tab is in view. Until the moment the room keeps drawing the form
     the player saw last; the new form's atlas is decoded as soon as the
     form is reached, and it takes the old one's place at the height of
     the flash. */
  const evolvedTo = useRef<string | null>(null)
  const [revealed, setRevealed] = useState<ElfForm | null>(null)
  useEffect(() => {
    if (pendingEvolution) preloadSprites(SPRITE_CHARACTERS[pendingEvolution])
  }, [pendingEvolution])
  useEffect(() => {
    if (!pendingEvolution || !focused || !state?.starter || evolvedTo.current === pendingEvolution) return
    let swap: ReturnType<typeof setTimeout> | null = null
    const timer = setTimeout(() => {
      evolvedTo.current = pendingEvolution
      sceneRef.current?.react('evolve')
      swap = setTimeout(() => setRevealed(pendingEvolution), EVOLVE_FLASH_MS)
    }, EVOLVE_DELAY_MS)
    /* A flash cut short (the tab left mid-moment) still reveals the new form. */
    return () => {
      clearTimeout(timer)
      if (swap) {
        clearTimeout(swap)
        setRevealed(pendingEvolution)
      }
    }
  }, [pendingEvolution, focused, state?.starter])
  const seenForm = state?.stageShown ?? null
  const drawnForm: ElfForm | undefined =
    stage === 'egg' ? undefined : pendingEvolution && seenForm && seenForm !== stage && revealed !== pendingEvolution ? seenForm : stage

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

  /* What the days have brought into the room: the plant at its stage, the
     finds on the sill, and the newest unread letter on the floor, which a
     tap opens; the shelf and the sill's finds open the keepsake shelf.
     Built from plain values, so the room is not redrawn on every drift of
     the needs. */
  const plantStage = state ? plantStageAt(state, Date.now()) : 0
  const sillLine = state?.sill.join(',') ?? ''
  const unreadLetter = state ? ([...state.letters].reverse().find((letter) => !letter.read)?.n ?? null) : null
  const extras = useMemo<RoomExtras>(() => ({ plantStage, sill: sillLine ? sillLine.split(',') : [], letter: unreadLetter !== null }), [plantStage, sillLine, unreadLetter])
  const onLetterTap = useCallback(() => {
    if (unreadLetter !== null) router.push({ pathname: '/elf-letter', params: { n: String(unreadLetter) } })
  }, [unreadLetter, router])
  const onShelfTap = useCallback(() => router.push('/elf-shelf'), [router])

  /* ---------- The panels ---------- */

  const [panel, setPanel] = useState<ElfPanel>('none')
  /* How far the strip at the top reaches down, measured: the room starts
     there and the bubble stays under it. */
  const [hudHeight, setHudHeight] = useState(0)
  const onTopLayout = useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout
    setHudHeight((current) => (current === height ? current : height))
  }, [])
  /* The tutorial: the egg's flow while the egg waits (not once it is ready
     to hatch, which has its own ritual), the elf's once it has its name. */
  const tutorial = useElfTutorial({
    flow: !state ? null : stage === 'egg' ? (hatchReady ? null : 'egg') : state.starter !== null ? 'elf' : null,
    ready: loaded && focused && panel === 'none',
  })
  /* The elf asks once whether it may let the player know when something
     happens (the reminders, useElfReminders): at the egg, whose readiness
     is the first thing worth telling, or, for an elf hatched before the
     question existed, once it has its name; never over a tutorial step or
     a panel. A yes asks the system too; the elf says how it went. */
  const reminderPrefs = useReminderPrefs()
  const askReminders = Boolean(
    reminderPrefs.loaded && !reminderPrefs.asked && state && loaded && focused && panel === 'none' && !tutorial.step && (stage === 'egg' ? !hatchReady : state.starter !== null),
  )
  const answering = useRef(false)
  const answerReminders = useCallback(
    async (yes: boolean) => {
      if (answering.current) return
      answering.current = true
      try {
        const granted = yes ? await requestNotificationPermission(t('mobile:reminders.channel')) : false
        await setReminders(granted)
        say(t(!yes ? 'mobile:reminders.saidNo' : granted ? 'mobile:reminders.saidYes' : 'mobile:reminders.saidDenied'))
      } finally {
        answering.current = false
      }
    },
    [say, t],
  )

  /* The card over the care band (the tutorial's step, or the elf's
     question about the reminders), measured so the room is lifted. */
  const [cardHeight, setCardHeight] = useState(0)
  const onCardLayout = useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout
    setCardHeight((current) => (current === height ? current : height))
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
  /* The places the catalogue offers right now: the frame only once there
     is a photo to put in it. The scene's decorating mode and the catalogue
     go by the same list; the catalogue's tabs add the hat once the elf has
     hatched, first, and the active tab never points outside them. */
  const editableSlots = useMemo(() => DECOR_SLOTS.filter((slot) => slot !== 'picture' || photo), [photo])
  const catalogueTabs = useMemo<readonly CatalogueTab[]>(() => (stage === 'egg' ? editableSlots : ['hat', ...editableSlots]), [stage, editableSlots])
  const [decorTab, setDecorTab] = useState<CatalogueTab>(catalogueTabs[0] ?? 'rug')
  useEffect(() => {
    if (!catalogueTabs.includes(decorTab)) setDecorTab(catalogueTabs[0] ?? 'rug')
  }, [catalogueTabs, decorTab])
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
  const onLedger = useCallback(() => {
    tutorial.note('ledger')
    router.push('/elf-today')
  }, [router, tutorial])
  const closePanel = useCallback(() => setPanel('none'), [])

  /* A slot tapped in the room while decorating picks the panel's tab; a
     slot the panel does not offer (the fireplace, or a slot with a single
     rendered variant) is left alone. */
  const onSelectSlot = useCallback(
    (slot: SlotId) => {
      if (editableSlots.includes(slot)) setDecorTab(slot)
    },
    [editableSlots],
  )

  /* A piece or a hat the finds have not unlocked yet is not placed: the
     elf says how many cottages it still takes. A hat put on, the elf
     twirls in it; a piece placed, it turns to admire it. */
  const { placeDecor, equip, outfit } = elf
  const onPick = useCallback(
    (tab: CatalogueTab, id: string) => {
      const needed = decorFindsNeeded(tab, id, foundCount)
      if (needed > 0) {
        say(t('mobile:elf.lockedLine', { count: needed }))
        return
      }
      if (tab === 'hat') {
        equip('hat', id)
        sceneRef.current?.react('twirl')
        return
      }
      placeDecor(tab, id)
      sceneRef.current?.admireSlot(tab)
    },
    [placeDecor, equip, foundCount, say, t],
  )

  /* ---------- The elf's own voice ---------- */

  const greeting = useReturnGreeting({
    focused,
    awake,
    lastInteraction,
    onGreet: () => {
      sceneRef.current?.react('greet')
      const letterWaits = !awayRef.current && Boolean(stateRef.current?.letters.some((letter) => !letter.read))
      sayNext(t(letterWaits ? 'mobile:elf.letterWaiting' : 'mobile:elf.greetHint'))
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
    tutorial.note('pet')
  }, [pet, tutorial])

  const onPokeElf = useCallback(() => {
    sceneRef.current?.react('poke')
  }, [])

  /* The finger moving over the body: the rules count a pet, the scene
     already plays the stroke and its hearts. */
  const onStrokeElf = useCallback(() => {
    const counted = pet()
    if (counted) tutorial.note('pet')
    return counted
  }, [pet, tutorial])

  /* The hatch is the player's: once the egg is ready it rocks on its own
     every few seconds and the name block says to tap it; the first tap
     cracks it (a word from inside), the second breaks it in the scene,
     which calls back when the elf is to step out: the rules hatch it then,
     and the elf hops with a cheer and says hello before the sheet asks for
     its name. A tap while it breaks does nothing. */
  const cracks = useRef(0)
  const [eggCracks, setEggCracks] = useState(0)
  useEffect(() => {
    if (!hatchReady || stage !== 'egg' || !focused || panel !== 'none') return
    cracks.current = 0
    setEggCracks(0)
    const timer = setInterval(() => sceneRef.current?.react('egg'), HATCH_ROCK_MS)
    return () => clearInterval(timer)
  }, [hatchReady, stage, focused, panel])
  const onPetEgg = useCallback(() => {
    if (hatchReady) {
      if (cracks.current >= HATCH_TAPS) return
      cracks.current += 1
      setEggCracks(cracks.current)
      if (cracks.current < HATCH_TAPS) {
        sceneRef.current?.react('egg')
        say(t('mobile:elf.crackLine'))
        return
      }
      sceneRef.current?.hatch(() => {
        hatchNow()
        setTimeout(() => sceneRef.current?.react('cheer'), HATCH_CHEER_DELAY_MS)
        say(t('mobile:elf.hatchHello'))
      })
      return
    }
    tendEgg('rock')
    sceneRef.current?.react('egg')
    tutorial.note('egg')
  }, [hatchReady, hatchNow, tendEgg, say, t, tutorial])

  /* Returns how the rules took it, so the drag-to-feed can tell an eaten
     acorn from a refused one. */
  const onCare = useCallback(
    (id: ElfCareAction) => {
      const outcome = elf.care(id)
      if (outcome.kind === 'refused') say(t(elfKey('guard', outcome.reason)))
      else if (outcome.kind === 'asleep') say(t('mobile:elf.asleepHint'))
      else if (outcome.kind === 'done') {
        sceneRef.current?.react(id === 'feed' ? 'feed' : id === 'play' ? 'play' : 'bath')
        if (id === 'feed') tutorial.note('feed')
        /* The scene and the "+N" over the chip show it; a screen reader
           is told the need and its gain. */
        const need = ELF_CARE_NEEDS[id]
        const gain = Math.round(outcome.state.needs[need] - (stateRef.current?.needs[need] ?? outcome.state.needs[need]))
        if (gain > 0) announce(t('mobile:elf.needGainAria', { need: t(elfKey('need', need)), value: gain }))
      }
      return outcome.kind
    },
    [elf, say, t, tutorial],
  )

  const onTendEgg = useCallback(
    (id: ElfEggAction) => {
      tendEgg(id)
      sceneRef.current?.react('egg')
      tutorial.note(id === 'warm' ? 'warm' : 'egg')
    },
    [tendEgg, tutorial],
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
  /* What covers the view's bottom, for the room's band: the care band (and
     the tutorial's card over it) or the decorating catalogue, both on the
     tab bar. */
  const bottomInset = panel === 'none' ? tabBarHeight + bandHeight + (tutorial.step || askReminders ? cardHeight + space.md : 0) : tabBarHeight + panelHeight

  return (
    <View ref={rootRef} style={styles.screen} onLayout={onLayout}>
      {size ? (
        <View key={state.eggAppearedAt} style={StyleSheet.absoluteFill}>
          <CottageScene
            ref={sceneRef}
            stage={stage}
            form={drawnForm}
            mood={mood}
            sleeping={state.sleeping}
            sleepy={sleepy}
            warmth={state.warmth}
            eggCracks={eggCracks}
            decor={decor}
            hat={outfit.hat}
            focusElf={editing && decorTab === 'hat'}
            width={size.width}
            height={size.height}
            paused={!focused}
            editing={editing}
            editable={editableSlots}
            topInset={hudHeight}
            bottomInset={bottomInset}
            selectedSlot={editing && decorTab !== 'hat' ? decorTab : null}
            onSelectSlot={onSelectSlot}
            onPetElf={onPetElf}
            onPokeElf={onPokeElf}
            onStrokeElf={onStrokeElf}
            onPetEgg={onPetEgg}
            onFigureTop={setFigureTop}
            photo={photo}
            onPictureTap={onPictureTap}
            extras={extras}
            onLetterTap={onLetterTap}
            onShelfTap={onShelfTap}
          />
        </View>
      ) : null}

      {/* The strip at the top: the words and the ledger on solid chrome, and
          the room starts under it (the scene is told its height), so
          nothing of the room is ever behind it; the bottom holds the care
          band or the open panel alone. */}
      <View style={[styles.top, { paddingTop: insets.top + space.sm }]} pointerEvents="box-none" onLayout={onTopLayout}>
        {/* While decorating the HUD steps aside: the whole room is there to
            pick from, and no slot's frame hides under the name block. The
            panel has the way out. */}
        {panel === 'none' ? (
          <Animated.View entering={fade()} exiting={leave()} pointerEvents="box-none">
            <ElfHud name={state.name} stage={stage} mood={mood} wantedNeed={wanted} hatchAt={hatchTime} wallet={state.wallet} streak={state.streak} questsDone={state.daily.quests.filter((quest) => quest.done).length} rewardWaiting={state.daily.rewardPicked === null} onDecorate={onDecorate} onLedger={onLedger} />
          </Animated.View>
        ) : null}
        {panel === 'decor' ? (
          <Animated.View entering={fade()} exiting={leave()} style={styles.decorHeader}>
            <View style={styles.decorTitle}>
              <Text weight="bold" variant="compact" accessibilityRole="header" style={styles.chromeInk}>
                {t('mobile:elf.decorTitle')}
              </Text>
              <Text variant="small" numberOfLines={2} style={styles.chromeInk}>
                {t('mobile:elf.decorateHint')}
              </Text>
            </View>
            <Button variant="primary" onPress={closePanel}>
              {t('mobile:elf.done')}
            </Button>
          </Animated.View>
        ) : null}
      </View>

      {/* The elf's line, over its head where the scene says it is. */}
      {size ? <ElfSpeech line={speech} anchor={figureTop} width={size.width} height={size.height} topLimit={hudHeight + space.sm} /> : null}

      {(tutorial.step || askReminders) && panel === 'none' ? (
        <View style={[styles.tutorial, { bottom: tabBarHeight + bandHeight + space.md }]} pointerEvents="box-none">
          {tutorial.step ? (
            <ElfTutorial key={tutorial.step.index} step={tutorial.step} onNext={tutorial.next} onSkip={tutorial.skip} onLayout={onCardLayout} />
          ) : (
            <ElfCard
              key="reminders"
              kicker={t('mobile:reminders.askKicker')}
              text={t(stage === 'egg' ? 'mobile:reminders.askEgg' : 'mobile:reminders.askElf')}
              secondary={{ label: t('mobile:reminders.askNo'), onPress: () => void answerReminders(false) }}
              primary={{ label: t('mobile:reminders.askYes'), onPress: () => void answerReminders(true) }}
              onLayout={onCardLayout}
            />
          )}
        </View>
      ) : null}

      {panel === 'none' ? (
        <Animated.View entering={fade()} exiting={leave()} style={[styles.band, { bottom: tabBarHeight }]} onLayout={onBandLayout} pointerEvents="box-none">
          <ElfActionBar stage={stage} sleeping={state.sleeping} needs={state.needs} careLeft={left} onCare={onCare} onTendEgg={onTendEgg} onToggleSleep={onToggleSleep} onFeedDrag={onFeedDrag} />
        </Animated.View>
      ) : (
        <Animated.View entering={fade()} exiting={leave()} style={[styles.band, { bottom: tabBarHeight }]}>
          <ElfDecorPanel decor={decor} hat={outfit.hat} form={drawnForm} photo={photo} tabs={catalogueTabs} foundCount={foundCount} activeTab={decorTab} onSelectTab={setDecorTab} onPick={onPick} onLayout={onPanelLayout} />
        </Animated.View>
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
  /* The strip: solid chrome edge to edge, the status bar's inset inside
     it, a hairline of the chrome's gold at its foot. */
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
    gap: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: mapPalette.chromeBorder,
    backgroundColor: mapPalette.chromeSolid,
  },
  /* The tutorial's card floats above the care band. */
  tutorial: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
  },
  /* The care band and the decorating catalogue run edge to edge on the
     tab bar. */
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  /* The strip while decorating: the title and the hint, and the way back. */
  decorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  decorTitle: {
    flex: 1,
    gap: 2,
  },
  chromeInk: {
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
