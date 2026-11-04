import type { ElfGameId, ElfTrickId } from '@chatynkowo/core'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AppState } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  applyElapsed,
  christen as christenElf,
  claimDailyReward as claimElfReward,
  decorFindsNeeded,
  equip as equipElf,
  hatch,
  hatchDue,
  markFormShown,
  moodOf,
  newElf,
  normalizeElf,
  pendingForm,
  performCare,
  pet as petElf,
  PET_COOLDOWN_MS,
  placeDecor as placeElfDecor,
  thankSupport as thankElfSupport,
  adsLeft as elfAdsLeft,
  earnAdDust as earnElfAdDust,
  addDust as addElfDust,
  spendDust as spendElfDust,
  recordAd as recordElfAd,
  applySkip as applyElfSkip,
  nextForm as elfNextForm,
  SKIP_COST,
  unlockNode as unlockElfNode,
  buyItem as buyElfItem,
  buyTrick as buyElfTrick,
  gamePlaysLeft as elfGamePlaysLeft,
  recordGame,
  trainTrick as trainElfTrick,
  grantedItems,
  type ElfSkip,
  type ElfNextForm,
  type ElfNodeId,
  readLetter as readElfLetter,
  settleDay,
  stageOf,
  tendEgg,
  toggleSleep as toggleElfSleep,
  visit as visitElf,
  WEARABLE_SLOT_IDS,
  distanceKm,
  type CareOutcome,
  type ElfAway,
  type ElfCareAction,
  type ElfEggAction,
  type ElfFind,
  type ElfForm,
  type ElfMood,
  type ElfOutfit,
  type ElfQuestPay,
  type ElfStage,
  type ElfStarter,
  type ElfState,
  type SleepOutcome,
  type VisitOutcome,
  type WearableSlot,
} from '@chatynkowo/core'
import { STORAGE_KEYS } from '../config'
import { DECOR_IDS, DEFAULT_DECOR, DEFAULT_OUTFIT, PHOTO_ID, WEARABLE_IDS, type Decor, type SlotId } from '../features/elf/cottage/catalogue'
import { readJsonStrict, writeJson } from '../lib/storage'
import { useContent } from './ContentProvider'
import { useProgress } from './ProgressProvider'

/* The elf companion's state for the whole app, on the rules in
   @chatynkowo/core (elf.ts): the Elf tab reads and acts on it. The state is
   read from the device when the provider mounts (the elf is not on the
   first screen, so it stays out of the bootstrap), and a device with
   nothing stored gets its fresh egg at the first visit to the tab, so the
   egg's clock starts when the player first sees it; a read that fails is retried, and until one
   succeeds there is no state to show and nothing is written, so a storage
   hiccup never lets a fresh egg overwrite the elf.
   While the app is in the foreground the needs are brought up to date every
   few seconds (the drift is slow, days not minutes), the calendar day is
   settled as it turns, the egg hatches when its time has come and the elf
   sleeps and wakes by the clock; the drift is saved every few seconds and
   when the app leaves the foreground, every action at once. The day is
   settled on every path (the tick, the visit, each action) and its news
   reported from whichever path settled it, so the new day is never
   consumed in silence. A form reached (by the hatch, by the cottages found, by
   time) waits in `pendingEvolution` until the Elf tab has shown its card.
   What the day's rules said about an action or a visit (a quest completed
   and its pay, the full set, a new day, a streak milestone or a streak
   lost, a cottage found to cheer about, what an absence brought) is
   published as `news`, one record the tab turns into the elf's lines; an
   absence worth its card (two days or more, a letter, the plant grown)
   also waits in `away` until the tab has shown it. The cottages proposed
   for the letters' invitations are the ones not found, nearest first to
   the latest find, from the content provider this one mounts under.

   The cottages found come from the progress provider, which this one
   mounts under: they decide the form, a find while the egg waits hatches
   it early, each find is credited to the day's find quest by the rules,
   and a find from an earlier day is celebrated on the next visit (never
   on its own day, which belongs to the expedition); finds from before the
   egg appeared are the expedition's past and stay quiet. The wardrobe and the decor
   are stored as the slots the player changed (the rules keep them as plain
   strings) and handed to the scene resolved against the cottage's
   catalogues: an id the catalogue no longer knows falls back to the slot's
   default, and the resolved records are memoised on the stored ones, so the
   scene's memo holds through the drift. */

/* What the day's rules reported on the last action or visit. */
export type ElfNews = {
  seq: number
  /* The quests completed by the action, each with what it paid. */
  completed: ElfQuestPay[]
  /* The full set of the day's quests, paid in dust. */
  setBonus: boolean
  /* A visit on a new day (fresh quests and a reward to pick): the streak
     that ended with a missed day, and the dust a milestone paid; the
     streak as it stands now. */
  newDay: boolean
  streakLost: number | null
  milestoneDust: number
  streak: number
  /* Cottages found on an earlier day, for the elf to cheer about. */
  celebrate: string[]
  /* What the absence behind a new day brought (the things found, a
     letter, the plant grown), when it brought something. */
  away: ElfAway | null
}

export type ElfValue = {
  /* Null until the device has been read, then the elf or null for no egg. */
  state: ElfState | null
  loaded: boolean
  /* The cottages found, as the rules take them (for the reminders). */
  finds: readonly ElfFind[]
  stage: ElfStage
  mood: ElfMood
  /* What the elf wears and what stands in the room, every slot filled. */
  outfit: ElfOutfit
  decor: Decor
  /* When the player last did something for the elf; 0 without an elf. */
  lastInteraction: number
  /* The hatched elf named and given its element, which marks the first
     form as seen is the tab's business (acknowledgeEvolution). */
  christen: (name: string, starter: ElfStarter) => void
  /* Lets the elf go: a fresh egg takes the nest. */
  reset: () => void
  /* The tab came into view: the day is settled and the visit counted; the
     first visit ever puts the egg in the nest. */
  visit: () => void
  care: (id: ElfCareAction) => CareOutcome
  tendEgg: (id: ElfEggAction) => void
  toggleSleep: () => SleepOutcome['kind']
  /* A tap on the elf; false while asleep, an egg or within the cooldown. */
  pet: () => boolean
  /* The egg is ready to hatch: the tab lets the player crack it. */
  hatchReady: boolean
  hatchNow: () => void
  /* Puts a wearable on (the slot's 'none' takes it off); unknown ids are ignored. */
  equip: (slot: WearableSlot, id: string) => void
  /* Swaps the furniture in a slot of the room; unknown ids and pieces the
     finds have not unlocked yet are ignored (the tab says why first). */
  placeDecor: (slot: SlotId, id: string) => void
  /* The elf has thanked for the player's support up to this count of the
     support ledger (the tab plays the sip and says so). */
  thankSupport: (total: number) => void
  /* Star dust, the premium currency: how many rewarded ads may still be
     watched today (for dust or a skip), an ad watched for dust (its
     dust, or 0 past the cap), a pack bought in the store, and a wait
     skipped, paid in dust (SKIP_COST) or with an ad watched to the end:
     false when there was nothing to skip or the pay fell short. */
  adsLeft: number
  earnAdDust: () => number
  addDust: (amount: number) => void
  skip: (kind: ElfSkip, pay: 'dust' | 'ad') => boolean
  /* The form ahead and what it waits for, null for the egg and the elder. */
  nextForm: ElfNextForm | null
  /* A node of the tree unlocked for a point; false out of order or without one. */
  unlockNode: (id: ElfNodeId) => boolean
  /* A piece of the shop bought for dust: false without the dust or when it is not on sale. */
  buyItem: (slot: string, id: string) => boolean
  /* The tricks: one bought for acorns (false when owned or short), one
     practised (its outcome, or null when it is not in learning), and
     the trick the tab is to play next with the elf's line, set by the
     tricks sheet as it closes and cleared by the tab once played. */
  buyTrick: (id: ElfTrickId) => boolean
  trainTrick: (id: ElfTrickId) => 'trained' | 'learned' | 'asleep' | 'done' | null
  trickPlay: { id: ElfTrickId; outcome: 'trained' | 'learned' | 'shown'; at: number } | null
  playTrick: (id: ElfTrickId, outcome: 'trained' | 'learned' | 'shown') => void
  clearTrickPlay: () => void
  /* The games: the rounds of one still open today, a round finished with
     its points (what it paid, or null when the day's rounds are used up),
     and the result the tab is to greet next, cleared once greeted. */
  gamePlaysLeft: (id: ElfGameId) => number
  finishGame: (id: ElfGameId, points: number) => { acorns: number; xp: number; best: boolean } | null
  gameResult: { id: ElfGameId; points: number; acorns: number; best: boolean; at: number } | null
  clearGameResult: () => void
  /* The pieces the tree granted or the shop sold, free of the finds (slot:id). */
  granted: string[]
  /* Picks one of the day's reward options, once a day. */
  claimDailyReward: (index: number) => void
  pendingEvolution: ElfForm | null
  acknowledgeEvolution: () => void
  news: ElfNews | null
  /* The 'while you were away' card waiting to be shown, and its dismissal. */
  away: ElfAway | null
  dismissAway: () => void
  /* A letter opened. */
  readLetter: (n: number) => void
}

const ElfContext = createContext<ElfValue | null>(null)

const TICK_MS = 5000
/* How often a drifting state is written while nothing else saves it. */
const DRIFT_SAVE_MS = 10000
/* A failed read of the storage is tried again after these delays. */
const READ_RETRY_MS = [1000, 5000, 15000, 60000]

/* The stored choices against the catalogues: a slot the player never
   changed, or changed to an id the catalogue no longer has, shows its default. */
function resolveOutfit(stored: Partial<ElfOutfit> | undefined): ElfOutfit {
  const outfit: ElfOutfit = { ...DEFAULT_OUTFIT }
  for (const slot of WEARABLE_SLOT_IDS) {
    const id = stored?.[slot]
    if (id && WEARABLE_IDS[slot].includes(id)) outfit[slot] = id
  }
  return outfit
}

/* The frame shows the latest cottage's photo once there is one, unless the
   player chose another picture. */
function resolveDecor(stored: Record<string, string> | undefined, found: boolean): Decor {
  const decor: Decor = { ...DEFAULT_DECOR, ...(found ? { picture: PHOTO_ID } : {}) }
  for (const slot of Object.keys(DECOR_IDS) as SlotId[]) {
    const id = stored?.[slot]
    if (id && DECOR_IDS[slot].includes(id)) decor[slot] = id
  }
  return decor
}

/* What the quests said about an action, as the rules return it, and what
   the day said as it was settled (its quests credited from the finds). */
type QuestReport = { state: ElfState; completed: ElfQuestPay[]; setBonus: boolean; celebrate?: string[] }
type DayReport = VisitOutcome

export function ElfProvider({ children }: { children: ReactNode }) {
  const { foundCount, state: progress } = useProgress()
  const [state, setState] = useState<ElfState | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [pendingEvolution, setPendingEvolution] = useState<ElfForm | null>(null)
  const [news, setNews] = useState<ElfNews | null>(null)
  const stateRef = useRef<ElfState | null>(null)
  /* The cottages found with their moments, as the rules take them. */
  const finds = useMemo<ElfFind[]>(
    () =>
      Object.entries(progress.found)
        .map(([slug, find]) => ({ slug, at: Date.parse(find.foundAt) }))
        .filter((find) => Number.isFinite(find.at)),
    [progress.found],
  )
  const findsRef = useRef(finds)
  /* The cottages proposed for an invitation: those not found, nearest
     first to the latest find (to the middle of the map before any). */
  const { cottages } = useContent()
  const invites = useMemo(() => {
    const unfound = cottages.filter((cottage) => !progress.found[cottage.slug])
    if (unfound.length === 0) return []
    const latest = Object.entries(progress.found).sort((a, b) => Date.parse(b[1].foundAt) - Date.parse(a[1].foundAt))[0]
    const anchor = (latest && cottages.find((cottage) => cottage.slug === latest[0])) || {
      lat: cottages.reduce((sum, cottage) => sum + cottage.lat, 0) / cottages.length,
      lng: cottages.reduce((sum, cottage) => sum + cottage.lng, 0) / cottages.length,
    }
    return [...unfound].sort((a, b) => distanceKm(anchor, a) - distanceKm(anchor, b)).slice(0, 5).map((cottage) => cottage.slug)
  }, [cottages, progress.found])
  const invitesRef = useRef(invites)
  useEffect(() => {
    invitesRef.current = invites
  }, [invites])
  const [away, setAway] = useState<ElfAway | null>(null)
  const dirtyRef = useRef(false)
  const petAtRef = useRef(0)
  const newsSeq = useRef(0)

  useEffect(() => {
    stateRef.current = state
  }, [state])
  useEffect(() => {
    findsRef.current = finds
  }, [finds])

  const persist = useCallback((next: ElfState | null) => {
    dirtyRef.current = false
    if (next) void writeJson(STORAGE_KEYS.elf, next)
    else void AsyncStorage.removeItem(STORAGE_KEYS.elf).catch(() => undefined)
  }, [])

  /* The form reached and not shown yet: derived from the state and the
     finds whenever either changes. */
  const refreshPending = useCallback((next: ElfState | null, now: number) => {
    setPendingEvolution(next ? pendingForm(next, findsRef.current.length, now) : null)
  }, [])

  /* Every change goes through here: the ref for the next caller, the state
     for React, the device when asked. */
  const commit = useCallback(
    (next: ElfState | null, save: boolean) => {
      stateRef.current = next
      setState(next)
      refreshPending(next, Date.now())
      if (save) persist(next)
      else dirtyRef.current = true
    },
    [persist, refreshPending],
  )

  /* The elf as it is now: the drift applied, the day settled (its news
     handed back for the caller to report). */
  const settle = useCallback((current: ElfState, now: number): { state: ElfState; day: DayReport } => {
    const settled = settleDay(current, now, findsRef.current, invitesRef.current)
    return { state: settled.state, day: settled }
  }, [])


  useEffect(() => {
    let current = true
    let attempt = 0
    let timer: ReturnType<typeof setTimeout> | null = null
    const read = async () => {
      try {
        const raw = await readJsonStrict<unknown>(STORAGE_KEYS.elf)
        if (!current) return
        const now = Date.now()
        const stored = raw ? normalizeElf(raw, now) : null
        /* Only the drift here: the day and the hatch wait for the first
           tick or visit, which report their news. */
        const next = stored ? applyElapsed(stored, now) : null
        stateRef.current = next
        setState(next)
        refreshPending(next, now)
        setLoaded(true)
      } catch {
        if (!current) return
        timer = setTimeout(() => void read(), READ_RETRY_MS[Math.min(attempt, READ_RETRY_MS.length - 1)])
        attempt += 1
      }
    }
    void read()
    return () => {
      current = false
      if (timer) clearTimeout(timer)
    }
  }, [refreshPending])

  /* What the rules reported, as one news record for the tab: what the day
     said as it was settled (a find credited to its quest) and what the
     action said, each quest completed with its own pay. Nothing to tell
     stays quiet. */
  const report = useCallback((before: ElfState, quests: QuestReport, day?: DayReport) => {
    /* The first visit ever is not a new day to announce. */
    const newDay = (day?.newDay ?? false) && before.lastVisitDay !== null
    const streakLost = day?.streakLost ?? null
    const milestoneDust = day?.milestoneDust ?? 0
    const completed = [...(day?.completed ?? []), ...quests.completed]
    const setBonus = (day?.setBonus ?? false) || quests.setBonus
    const celebrate = quests.celebrate ?? []
    const absence = day?.away ?? null
    if (absence?.card) setAway(absence)
    if (!completed.length && !setBonus && !newDay && streakLost === null && !milestoneDust && !celebrate.length && !absence) return
    newsSeq.current += 1
    setNews({
      seq: newsSeq.current,
      completed,
      setBonus,
      newDay,
      streakLost,
      milestoneDust,
      streak: quests.state.streak,
      celebrate,
      away: absence,
    })
  }, [])

  /* The needs drift every few seconds while the app is in front, the day
     turns, the egg hatches when due, the elf sleeps and wakes by the
     clock; the drift is saved every few seconds and when the app goes to
     the background, a new day or a hatch at once. */
  useEffect(() => {
    if (!loaded) return
    let lastSave = Date.now()
    const tick = () => {
      const current = stateRef.current
      if (!current) return
      const now = Date.now()
      const { state: next, day } = settle(current, now)
      if (next === current) return
      const save = now - lastSave >= DRIFT_SAVE_MS || day.newDay
      if (save) lastSave = now
      commit(next, save)
      if (day.newDay || day.completed.length) report(current, { state: next, completed: [], setBonus: false }, day)
    }
    let timer: ReturnType<typeof setInterval> | null = AppState.currentState === 'active' ? setInterval(tick, TICK_MS) : null
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') {
        tick()
        if (!timer) timer = setInterval(tick, TICK_MS)
      } else {
        if (timer) clearInterval(timer)
        timer = null
        if (dirtyRef.current && stateRef.current) persist(stateRef.current)
      }
    })
    return () => {
      if (timer) clearInterval(timer)
      subscription.remove()
    }
  }, [loaded, commit, persist, settle, report])

  /* The finds decide the form: a find that arrives while the elf is on
     screen is seen on the next render. */
  useEffect(() => {
    refreshPending(stateRef.current, Date.now())
  }, [foundCount, refreshPending])

  const christen = useCallback(
    (name: string, starter: ElfStarter) => {
      const current = stateRef.current
      if (!current) return
      commit(christenElf(current, name, starter), true)
    },
    [commit],
  )

  const reset = useCallback(() => {
    commit(newElf(Date.now()), true)
    setNews(null)
    setAway(null)
  }, [commit])

  const dismissAway = useCallback(() => setAway(null), [])
  const readLetter = useCallback(
    (n: number) => {
      const current = stateRef.current
      if (!current) return
      const next = readElfLetter(current, n)
      if (next !== current) commit(next, true)
    },
    [commit],
  )

  const visit = useCallback(() => {
    const now = Date.now()
    /* The first visit ever lays the egg in the nest. */
    const current = stateRef.current ?? newElf(now)
    const { state: settled, day } = settle(current, now)
    const outcome = visitElf(settled, now, findsRef.current, invitesRef.current)
    if (outcome.state !== current) commit(outcome.state, true)
    report(current, outcome, day)
  }, [commit, settle, report])

  /* The player cracks the ready egg: the hatch, with the day settled first. */
  const hatchNow = useCallback(() => {
    const current = stateRef.current
    if (!current) return
    const now = Date.now()
    if (!hatchDue(current, now, findsRef.current)) return
    const { state: settled, day } = settle(current, now)
    const next = hatch(settled, now)
    commit(next, true)
    report(current, { state: next, completed: [], setBonus: false }, day)
  }, [commit, settle, report])

  const care = useCallback(
    (id: ElfCareAction): CareOutcome => {
      const current = stateRef.current
      if (!current) return { kind: 'egg' }
      const now = Date.now()
      const { state: settled, day } = settle(current, now)
      const outcome = performCare(settled, id, now)
      if (outcome.kind !== 'done') return outcome
      commit(outcome.state, true)
      report(current, outcome, day)
      return outcome
    },
    [commit, report, settle],
  )

  const tend = useCallback(
    (id: ElfEggAction) => {
      const current = stateRef.current
      if (!current || current.hatched) return
      const now = Date.now()
      const { state: settled, day } = settle(current, now)
      const outcome = tendEgg(settled, id, now)
      commit(outcome.state, true)
      report(current, outcome, day)
    },
    [commit, report, settle],
  )

  const toggleSleep = useCallback((): SleepOutcome['kind'] => {
    const current = stateRef.current
    if (!current) return 'egg'
    const now = Date.now()
    const { state: settled, day } = settle(current, now)
    const outcome = toggleElfSleep(settled, now)
    if (outcome.kind === 'slept' || outcome.kind === 'woke') {
      commit(outcome.state, true)
      report(current, outcome, day)
    }
    return outcome.kind
  }, [commit, report, settle])

  const pet = useCallback((): boolean => {
    const current = stateRef.current
    if (!current) return false
    const now = Date.now()
    if (now < petAtRef.current) return false
    const { state: settled, day } = settle(current, now)
    const outcome = petElf(settled, now)
    if (outcome.kind !== 'petted') return false
    petAtRef.current = now + PET_COOLDOWN_MS
    commit(outcome.state, true)
    report(current, outcome, day)
    return true
  }, [commit, report, settle])

  const equip = useCallback(
    (slot: WearableSlot, id: string) => {
      const current = stateRef.current
      if (!current || !WEARABLE_IDS[slot]?.includes(id)) return
      commit(equipElf(current, slot, id, Date.now()), true)
    },
    [commit],
  )

  const thankSupport = useCallback(
    (total: number) => {
      const current = stateRef.current
      if (!current) return
      const next = thankElfSupport(current, total)
      if (next !== current) commit(next, true)
    },
    [commit],
  )

  const earnAdDust = useCallback((): number => {
    const current = stateRef.current
    if (!current) return 0
    const outcome = earnElfAdDust(current, Date.now())
    if (outcome.earned) commit(outcome.state, true)
    return outcome.earned
  }, [commit])

  const addDust = useCallback(
    (amount: number) => {
      const current = stateRef.current
      if (!current) return
      const next = addElfDust(current, amount)
      if (next !== current) commit(next, true)
    },
    [commit],
  )

  const skip = useCallback(
    (kind: ElfSkip, pay: 'dust' | 'ad'): boolean => {
      const current = stateRef.current
      if (!current) return false
      const now = Date.now()
      const paid = pay === 'dust' ? spendElfDust(current, SKIP_COST[kind]) : recordElfAd(current, now)
      if (!paid) return false
      const next = applyElfSkip(paid, kind, finds.length, now)
      if (!next) return false
      commit(next, true)
      return true
    },
    [commit, finds.length],
  )

  const unlockNode = useCallback(
    (id: ElfNodeId): boolean => {
      const current = stateRef.current
      if (!current) return false
      const next = unlockElfNode(current, id)
      if (!next) return false
      commit(next, true)
      return true
    },
    [commit],
  )
  const buyTrick = useCallback(
    (id: ElfTrickId): boolean => {
      const current = stateRef.current
      if (!current) return false
      const next = buyElfTrick(current, id)
      if (!next) return false
      commit(next, true)
      return true
    },
    [commit],
  )
  const trainTrick = useCallback(
    (id: ElfTrickId): 'trained' | 'learned' | 'asleep' | 'done' | null => {
      const current = stateRef.current
      if (!current) return null
      const outcome = trainElfTrick(current, id, Date.now())
      if (!outcome) return null
      if (outcome.kind === 'trained' || outcome.kind === 'learned') commit(outcome.state, true)
      return outcome.kind
    },
    [commit],
  )
  const [trickPlay, setTrickPlay] = useState<ElfValue['trickPlay']>(null)
  const playTrick = useCallback((id: ElfTrickId, outcome: 'trained' | 'learned' | 'shown') => setTrickPlay({ id, outcome, at: Date.now() }), [])
  const clearTrickPlay = useCallback(() => setTrickPlay(null), [])
  const gamePlaysLeft = useCallback((id: ElfGameId): number => (stateRef.current ? elfGamePlaysLeft(stateRef.current, id, Date.now()) : 0), [])
  const [gameResult, setGameResult] = useState<ElfValue['gameResult']>(null)
  const finishGame = useCallback(
    (id: ElfGameId, points: number) => {
      const current = stateRef.current
      if (!current) return null
      const outcome = recordGame(current, id, points, Date.now())
      if (!outcome) return null
      commit(outcome.state, true)
      setGameResult({ id, points, acorns: outcome.acorns, best: outcome.best, at: Date.now() })
      return { acorns: outcome.acorns, xp: outcome.xp, best: outcome.best }
    },
    [commit],
  )
  const clearGameResult = useCallback(() => setGameResult(null), [])
  const buyItem = useCallback(
    (slot: string, id: string): boolean => {
      const current = stateRef.current
      if (!current) return false
      const next = buyElfItem(current, slot, id, findsRef.current.length)
      if (!next) return false
      commit(next, true)
      return true
    },
    [commit],
  )

  const placeDecor = useCallback(
    (slot: SlotId, id: string) => {
      const current = stateRef.current
      if (!current || !DECOR_IDS[slot]?.includes(id) || decorFindsNeeded(slot, id, findsRef.current.length, grantedItems(current)) > 0) return
      const now = Date.now()
      const { state: settled, day } = settle(current, now)
      const outcome = placeElfDecor(settled, slot, id, now)
      if (outcome.state === current) return
      commit(outcome.state, true)
      report(current, outcome, day)
    },
    [commit, report, settle],
  )

  const claimDailyReward = useCallback(
    (index: number) => {
      const current = stateRef.current
      if (!current) return
      const now = Date.now()
      const { state: settled, day } = settle(current, now)
      const next = claimElfReward(settled, index, now)
      if (next !== current) commit(next, true)
      if (day.newDay || day.completed.length) report(current, { state: next, completed: [], setBonus: false }, day)
    },
    [commit, settle, report],
  )

  const acknowledgeEvolution = useCallback(() => {
    const current = stateRef.current
    if (!current || !pendingEvolution) return
    commit(markFormShown(current, pendingEvolution), true)
  }, [commit, pendingEvolution])

  /* The stored records keep their reference through the drift (applyElapsed
     spreads the state, not its nested records), so these only recompute
     after a swap or a reload. */
  const storedOutfit = state?.outfit
  const storedDecor = state?.decor
  const hasFinds = finds.length > 0
  const outfit = useMemo(() => resolveOutfit(storedOutfit), [storedOutfit])
  const decor = useMemo(() => resolveDecor(storedDecor, hasFinds), [storedDecor, hasFinds])

  const value = useMemo<ElfValue>(() => {
    const now = Date.now()
    return {
      state,
      loaded,
      finds,
      stage: state ? stageOf(state, foundCount, now) : 'egg',
      mood: state ? moodOf(state, now) : 'content',
      outfit,
      decor,
      lastInteraction: state?.lastInteraction ?? 0,
      christen,
      reset,
      visit,
      care,
      tendEgg: tend,
      toggleSleep,
      pet,
      hatchReady: state ? hatchDue(state, now, finds) : false,
      hatchNow,
      equip,
      placeDecor,
      thankSupport,
      adsLeft: state ? elfAdsLeft(state, now) : 0,
      earnAdDust,
      addDust,
      skip,
      nextForm: state ? elfNextForm(state, foundCount, now) : null,
      unlockNode,
      buyItem,
      buyTrick,
      trainTrick,
      trickPlay,
      playTrick,
      clearTrickPlay,
      gamePlaysLeft,
      finishGame,
      gameResult,
      clearGameResult,
      granted: state ? grantedItems(state) : [],
      claimDailyReward,
      pendingEvolution,
      acknowledgeEvolution,
      news,
      away,
      dismissAway,
      readLetter,
    }
  }, [state, loaded, foundCount, finds, outfit, decor, christen, reset, visit, care, tend, toggleSleep, pet, hatchNow, equip, placeDecor,
      thankSupport, earnAdDust, addDust, skip, unlockNode, buyItem, buyTrick, trainTrick, trickPlay, playTrick, clearTrickPlay, gamePlaysLeft, finishGame, gameResult, clearGameResult, claimDailyReward, pendingEvolution, acknowledgeEvolution, news, away, dismissAway, readLetter])

  return <ElfContext.Provider value={value}>{children}</ElfContext.Provider>
}

export function useElf(): ElfValue {
  const value = useContext(ElfContext)
  if (!value) throw new Error('useElf must be used within ElfProvider')
  return value
}
