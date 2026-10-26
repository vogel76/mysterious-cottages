import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AppState } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  applyElapsed,
  claimDailyReward as claimElfReward,
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
  stageOf,
  tendEgg,
  toggleSleep as toggleElfSleep,
  visit as visitElf,
  WEARABLE_SLOT_IDS,
  type CareOutcome,
  type ElfCareAction,
  type ElfEggAction,
  type ElfForm,
  type ElfMood,
  type ElfOutfit,
  type ElfQuestId,
  type ElfStage,
  type ElfStarter,
  type ElfState,
  type SleepOutcome,
  type VisitOutcome,
  type WearableSlot,
} from '@chatynkowo/core'
import { STORAGE_KEYS } from '../config'
import { DECOR_IDS, DEFAULT_DECOR, DEFAULT_OUTFIT, WEARABLE_IDS, type Decor, type SlotId } from '../features/elf/cottage/catalogue'
import { readJsonStrict, writeJson } from '../lib/storage'
import { useProgress } from './ProgressProvider'

/* The elf companion's state for the whole app, on the rules in
   @chatynkowo/core (elf.ts): the Elf tab reads and acts on it. The state is
   read from the device when the provider mounts (the elf is not on the
   first screen, so it stays out of the bootstrap); a read that fails is
   retried, and until one succeeds there is no state to show and nothing is
   written, so a storage hiccup never lets a fresh egg overwrite the elf.
   While the app is in the foreground the needs are brought up to date every
   few seconds (the drift is slow, days not minutes), the egg hatches when
   its time has come and the elf sleeps and wakes by the clock; the drift is
   saved every few seconds and when the app leaves the foreground, every
   action at once. A form reached (by the hatch, by the cottages found, by
   time) waits in `pendingEvolution` until the Elf tab has shown its card.
   What the day's rules said about an action or a visit (a quest completed
   and its acorns, the full set, a new day, a streak milestone or a streak
   lost) is published as `news`, one record the tab turns into the elf's
   lines.

   The cottages found come from the progress provider, which this one
   mounts under: they decide the form, and the first find counts as the
   first story read, which hatches the egg early. The wardrobe and the decor
   are stored as the slots the player changed (the rules keep them as plain
   strings) and handed to the scene resolved against the cottage's
   catalogues: an id the catalogue no longer knows falls back to the slot's
   default, and the resolved records are memoised on the stored ones, so the
   scene's memo holds through the drift. */

/* What the day's rules reported on the last action or visit. */
export type ElfNews = {
  seq: number
  /* The quests completed by the action and the acorns they paid. */
  completed: ElfQuestId[]
  acorns: number
  /* The full set of the day's quests, paid in dust. */
  setBonus: boolean
  /* A visit on a new day (fresh quests and a reward to pick): the streak
     that ended with a missed day, and the dust a milestone paid; the
     streak as it stands now. */
  newDay: boolean
  streakLost: number | null
  milestoneDust: number
  streak: number
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
  adopt: (name: string, starter: ElfStarter) => void
  /* Lets the egg go; the next visit starts with a fresh one. */
  reset: () => void
  /* The tab came into view: the day is settled and the visit counted. */
  visit: () => void
  care: (id: ElfCareAction) => CareOutcome
  tendEgg: (id: ElfEggAction) => void
  toggleSleep: () => SleepOutcome['kind']
  /* A tap on the elf; false while asleep, an egg or within the cooldown. */
  pet: () => boolean
  /* Puts a wearable on (the slot's 'none' takes it off); unknown ids are ignored. */
  equip: (slot: WearableSlot, id: string) => void
  /* Swaps the furniture in a slot of the room; unknown ids are ignored. */
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

function resolveDecor(stored: Record<string, string> | undefined): Decor {
  const decor: Decor = { ...DEFAULT_DECOR }
  for (const slot of Object.keys(DECOR_IDS) as SlotId[]) {
    const id = stored?.[slot]
    if (id && DECOR_IDS[slot].includes(id)) decor[slot] = id
  }
  return decor
}

/* What the quests said about an action, as the rules return it. */
type QuestReport = { state: ElfState; completed: ElfQuestId[]; setBonus: boolean }
type DayReport = Pick<VisitOutcome, 'newDay' | 'streakLost' | 'milestoneDust'>

export function ElfProvider({ children }: { children: ReactNode }) {
  const { foundCount } = useProgress()
  const [state, setState] = useState<ElfState | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [pendingEvolution, setPendingEvolution] = useState<ElfForm | null>(null)
  const [news, setNews] = useState<ElfNews | null>(null)
  const stateRef = useRef<ElfState | null>(null)
  const findsRef = useRef(foundCount)
  const dirtyRef = useRef(false)
  const petAtRef = useRef(0)
  const newsSeq = useRef(0)

  useEffect(() => {
    stateRef.current = state
  }, [state])
  useEffect(() => {
    findsRef.current = foundCount
  }, [foundCount])

  const persist = useCallback((next: ElfState | null) => {
    dirtyRef.current = false
    if (next) void writeJson(STORAGE_KEYS.elf, next)
    else void AsyncStorage.removeItem(STORAGE_KEYS.elf).catch(() => undefined)
  }, [])

  /* The form reached and not shown yet: derived from the state and the
     finds whenever either changes. */
  const refreshPending = useCallback((next: ElfState | null, now: number) => {
    setPendingEvolution(next ? pendingForm(next, findsRef.current, now) : null)
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

  /* The elf as it is now: the drift applied, the egg hatched when its
     time has come (the first find counts as the first story read). */
  const settle = useCallback((current: ElfState, now: number): ElfState => {
    const drifted = applyElapsed(current, now)
    return hatchDue(drifted, now, findsRef.current > 0) ? hatch(drifted, now) : drifted
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
        const next = stored ? settle(stored, now) : null
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
  }, [settle, refreshPending])

  /* What the rules reported, as one news record for the tab: the acorns
     are the purse's growth from before the action. Nothing to tell stays
     quiet. */
  const report = useCallback((before: ElfState, quests: QuestReport, day?: DayReport) => {
    const newDay = day?.newDay ?? false
    const streakLost = day?.streakLost ?? null
    const milestoneDust = day?.milestoneDust ?? 0
    if (!quests.completed.length && !quests.setBonus && !newDay && streakLost === null && !milestoneDust) return
    newsSeq.current += 1
    setNews({
      seq: newsSeq.current,
      completed: quests.completed,
      acorns: Math.max(0, quests.state.wallet.acorns - before.wallet.acorns),
      setBonus: quests.setBonus,
      newDay,
      streakLost,
      milestoneDust,
      streak: quests.state.streak,
    })
  }, [])

  /* The needs drift every few seconds while the app is in front, the egg
     hatches when due, the elf sleeps and wakes by the clock; the drift is
     saved every few seconds and when the app goes to the background. */
  useEffect(() => {
    if (!loaded) return
    let lastSave = Date.now()
    const tick = () => {
      const current = stateRef.current
      if (!current) return
      const now = Date.now()
      const next = settle(current, now)
      if (next === current) return
      const save = now - lastSave >= DRIFT_SAVE_MS || next.hatched !== current.hatched
      if (save) lastSave = now
      commit(next, save)
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
  }, [loaded, commit, persist, settle])

  /* The finds decide the form: a find that arrives while the elf is on
     screen is seen on the next render. */
  useEffect(() => {
    refreshPending(stateRef.current, Date.now())
  }, [foundCount, refreshPending])

  const adopt = useCallback(
    (name: string, starter: ElfStarter) => {
      const now = Date.now()
      const fresh = newElf(name, starter, now)
      const outcome = visitElf(fresh, now)
      commit(outcome.state, true)
      report(fresh, outcome, outcome)
    },
    [commit, report],
  )

  const reset = useCallback(() => {
    commit(null, true)
    setNews(null)
  }, [commit])

  const visit = useCallback(() => {
    const current = stateRef.current
    if (!current) return
    const now = Date.now()
    const outcome = visitElf(settle(current, now), now)
    if (outcome.state !== current) commit(outcome.state, true)
    report(current, outcome, outcome)
  }, [commit, settle, report])

  const care = useCallback(
    (id: ElfCareAction): CareOutcome => {
      const current = stateRef.current
      if (!current) return { kind: 'egg' }
      const now = Date.now()
      const outcome = performCare(settle(current, now), id, now)
      if (outcome.kind !== 'done') return outcome
      commit(outcome.state, true)
      report(current, outcome)
      return outcome
    },
    [commit, report, settle],
  )

  const tend = useCallback(
    (id: ElfEggAction) => {
      const current = stateRef.current
      if (!current || current.hatched) return
      const now = Date.now()
      const outcome = tendEgg(settle(current, now), id, now)
      commit(outcome.state, true)
      report(current, outcome)
    },
    [commit, report, settle],
  )

  const toggleSleep = useCallback((): SleepOutcome['kind'] => {
    const current = stateRef.current
    if (!current) return 'egg'
    const now = Date.now()
    const outcome = toggleElfSleep(settle(current, now), now)
    if (outcome.kind === 'slept' || outcome.kind === 'woke') {
      commit(outcome.state, true)
      report(current, outcome)
    }
    return outcome.kind
  }, [commit, report, settle])

  const pet = useCallback((): boolean => {
    const current = stateRef.current
    if (!current) return false
    const now = Date.now()
    if (now < petAtRef.current) return false
    const outcome = petElf(settle(current, now), now)
    if (outcome.kind !== 'petted') return false
    petAtRef.current = now + PET_COOLDOWN_MS
    commit(outcome.state, true)
    report(current, outcome)
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
      if (!current || !DECOR_IDS[slot]?.includes(id)) return
      const outcome = placeElfDecor(current, slot, id, Date.now())
      if (outcome.state === current) return
      commit(outcome.state, true)
      report(current, outcome)
    },
    [commit, report],
  )

  const claimDailyReward = useCallback(
    (index: number) => {
      const current = stateRef.current
      if (!current) return
      const next = claimElfReward(current, index, Date.now())
      if (next !== current) commit(next, true)
    },
    [commit],
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
  const outfit = useMemo(() => resolveOutfit(storedOutfit), [storedOutfit])
  const decor = useMemo(() => resolveDecor(storedDecor), [storedDecor])

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
      adopt,
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
  }, [state, loaded, foundCount, outfit, decor, adopt, reset, visit, care, tend, toggleSleep, pet, equip, placeDecor, claimDailyReward, pendingEvolution, acknowledgeEvolution, news])

  return <ElfContext.Provider value={value}>{children}</ElfContext.Provider>
}

export function useElf(): ElfValue {
  const value = useContext(ElfContext)
  if (!value) throw new Error('useElf must be used within ElfProvider')
  return value
}
