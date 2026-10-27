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
  settleDay,
  stageOf,
  tendEgg,
  toggleSleep as toggleElfSleep,
  visit as visitElf,
  WEARABLE_SLOT_IDS,
  type CareOutcome,
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
   lost, a cottage found to cheer about) is published as `news`, one
   record the tab turns into the elf's lines.

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
}

export type ElfValue = {
  /* Null until the device has been read, then the elf or null for no egg. */
  state: ElfState | null
  loaded: boolean
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
  /* Puts a wearable on (the slot's 'none' takes it off); unknown ids are ignored. */
  equip: (slot: WearableSlot, id: string) => void
  /* Swaps the furniture in a slot of the room; unknown ids and pieces the
     finds have not unlocked yet are ignored (the tab says why first). */
  placeDecor: (slot: SlotId, id: string) => void
  /* Picks one of the day's reward options, once a day. */
  claimDailyReward: (index: number) => void
  pendingEvolution: ElfForm | null
  acknowledgeEvolution: () => void
  news: ElfNews | null
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
     handed back for the caller to report), the egg hatched when its time
     has come (or a cottage was found while it waited). */
  const settle = useCallback((current: ElfState, now: number): { state: ElfState; day: DayReport } => {
    const settled = settleDay(current, now, findsRef.current)
    const next = hatchDue(settled.state, now, findsRef.current) ? hatch(settled.state, now) : settled.state
    return { state: next, day: settled }
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
    if (!completed.length && !setBonus && !newDay && streakLost === null && !milestoneDust && !celebrate.length) return
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
      const save = now - lastSave >= DRIFT_SAVE_MS || next.hatched !== current.hatched || day.newDay
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
  }, [commit])

  const visit = useCallback(() => {
    const now = Date.now()
    /* The first visit ever lays the egg in the nest. */
    const current = stateRef.current ?? newElf(now)
    const { state: settled, day } = settle(current, now)
    const outcome = visitElf(settled, now, findsRef.current)
    if (outcome.state !== current) commit(outcome.state, true)
    report(current, outcome, day)
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

  const placeDecor = useCallback(
    (slot: SlotId, id: string) => {
      const current = stateRef.current
      if (!current || !DECOR_IDS[slot]?.includes(id) || decorFindsNeeded(slot, id, findsRef.current.length) > 0) return
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
      equip,
      placeDecor,
      claimDailyReward,
      pendingEvolution,
      acknowledgeEvolution,
      news,
    }
  }, [state, loaded, foundCount, outfit, decor, christen, reset, visit, care, tend, toggleSleep, pet, equip, placeDecor, claimDailyReward, pendingEvolution, acknowledgeEvolution, news])

  return <ElfContext.Provider value={value}>{children}</ElfContext.Provider>
}

export function useElf(): ElfValue {
  const value = useContext(ElfContext)
  if (!value) throw new Error('useElf must be used within ElfProvider')
  return value
}
