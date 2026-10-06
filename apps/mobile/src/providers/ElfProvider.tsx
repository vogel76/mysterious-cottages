import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AppState } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { STORAGE_KEYS } from '../config'
import { DECOR_IDS, DEFAULT_DECOR, type Decor, type SlotId } from '../features/elf/cottage/items'
import { DEFAULT_OUTFIT, WEARABLE_IDS, WEARABLE_SLOTS } from '../features/elf/cottage/wearables'
import {
  applyElapsed,
  equip as equipElf,
  moodOf,
  newElf,
  normalizeElf,
  performCare,
  pet as petElf,
  PET_COOLDOWN_MS,
  placeDecor as placeElfDecor,
  rewardCatch,
  stageOf,
  tendEgg,
  toggleSleep as toggleElfSleep,
  touch,
  type CareActionId,
  type CareOutcome,
  type EggActionId,
  type ElfState,
  type Growth,
  type Mood,
  type Outfit,
  type Stage,
  type StarterId,
  type WearableSlot,
} from '../features/elf/rules'
import { readJson, writeJson } from '../lib/storage'

/* The elf companion's state for the whole app: the Elf tab reads and acts
   on it, the catch route (a modal over the tabs) rewards it. The state is
   read from the device when the provider mounts (the elf is not on the
   first screen, so it stays out of the bootstrap), brought up to date every
   second while the app is in the foreground, and saved after every action
   and, while it drifts, every few seconds and when the app leaves the
   foreground. A form reached by a gain waits in `pendingEvolution` until
   the Elf tab has shown its card. Reactions the scene plays once (a happy
   hop after a care action, a level gained) are published as events rather
   than kept as state.

   The wardrobe and the decor are stored as the slots the player changed
   (rules.ts keeps them as plain strings) and handed to the scene resolved
   against the cottage's catalogues: an id the catalogue no longer knows
   falls back to the slot's default, and the resolved records are memoised
   on the stored ones, so the scene's memo holds through the drift that
   commits a new state every second. Every action the player takes (a
   care, a pet, the egg, sleep, a swap) also records the time, so the tab
   can greet a return after a long absence. */

export type ElfReaction = 'care' | 'pet' | 'levelUp' | 'egg' | 'wake'
type ReactionListener = (reaction: ElfReaction) => void

export type ElfValue = {
  /* Null until the device has been read, then the elf or null for no egg. */
  state: ElfState | null
  loaded: boolean
  stage: Stage
  mood: Mood
  /* What the elf wears and what stands in the room, every slot filled. */
  outfit: Outfit
  decor: Decor
  /* When the player last did something for the elf; 0 without an elf. */
  lastInteraction: number
  adopt: (name: string, starter: StarterId) => void
  /* Lets the egg go; the next visit starts with a fresh one. */
  reset: () => void
  care: (id: CareActionId) => CareOutcome
  tendEgg: (id: EggActionId) => void
  toggleSleep: () => void
  /* A tap on the elf; false while asleep, an egg or within the cooldown. */
  pet: () => boolean
  /* Puts a wearable on (the slot's 'none' takes it off); unknown ids are ignored. */
  equip: (slot: WearableSlot, id: string) => void
  /* Swaps the furniture in a slot of the room; unknown ids are ignored. */
  placeDecor: (slot: SlotId, id: string) => void
  /* The catch in the camera view succeeded. */
  catchReward: () => void
  pendingEvolution: Exclude<Stage, 'egg'> | null
  acknowledgeEvolution: () => void
  /* Subscribe to one-shot reactions; returns the unsubscribe function. */
  onReaction: (listener: ReactionListener) => () => void
}

const ElfContext = createContext<ElfValue | null>(null)

const TICK_MS = 1000
/* How often a drifting state is written while nothing else saves it. */
const DRIFT_SAVE_MS = 10000

/* The stored choices against the catalogues: a slot the player never
   changed, or changed to an id the catalogue no longer has, shows its default. */
function resolveOutfit(stored: Partial<Outfit> | undefined): Outfit {
  const outfit: Outfit = { ...DEFAULT_OUTFIT }
  for (const slot of WEARABLE_SLOTS as readonly WearableSlot[]) {
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

export function ElfProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ElfState | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [pendingEvolution, setPendingEvolution] = useState<Exclude<Stage, 'egg'> | null>(null)
  const stateRef = useRef<ElfState | null>(null)
  const dirtyRef = useRef(false)
  const petAtRef = useRef(0)
  const listeners = useRef(new Set<ReactionListener>())

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    let current = true
    void readJson<unknown>(STORAGE_KEYS.elf).then((raw) => {
      if (!current) return
      const stored = raw ? normalizeElf(raw) : null
      stateRef.current = stored ? applyElapsed(stored, Date.now()) : null
      setState(stateRef.current)
      setLoaded(true)
    })
    return () => {
      current = false
    }
  }, [])

  const persist = useCallback((next: ElfState | null) => {
    dirtyRef.current = false
    if (next) void writeJson(STORAGE_KEYS.elf, next)
    else void AsyncStorage.removeItem(STORAGE_KEYS.elf).catch(() => undefined)
  }, [])

  /* Every change goes through here: the ref for the next caller, the state
     for React, the device when asked. */
  const commit = useCallback(
    (next: ElfState | null, save: boolean) => {
      stateRef.current = next
      setState(next)
      if (save) persist(next)
      else dirtyRef.current = true
    },
    [persist],
  )

  const emit = useCallback((reaction: ElfReaction) => {
    for (const listener of listeners.current) listener(reaction)
  }, [])

  const onReaction = useCallback((listener: ReactionListener) => {
    listeners.current.add(listener)
    return () => {
      listeners.current.delete(listener)
    }
  }, [])

  const growth = useCallback(
    (result: Growth) => {
      if (result.evolvedTo) setPendingEvolution(result.evolvedTo)
      else if (result.leveled) emit('levelUp')
    },
    [emit],
  )

  /* The needs drift once a second while the app is in front; the drift is
     saved every few seconds and when the app goes to the background. */
  useEffect(() => {
    if (!loaded) return
    let lastSave = Date.now()
    const tick = () => {
      const current = stateRef.current
      if (!current || !current.hatched) return
      const now = Date.now()
      const next = applyElapsed(current, now)
      if (next === current) return
      const save = now - lastSave >= DRIFT_SAVE_MS
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
  }, [loaded, commit, persist])

  const adopt = useCallback(
    (name: string, starter: StarterId) => {
      commit(newElf(name, starter, Date.now()), true)
      setPendingEvolution(null)
      emit('egg')
    },
    [commit, emit],
  )

  const reset = useCallback(() => {
    commit(null, true)
    setPendingEvolution(null)
  }, [commit])

  const care = useCallback(
    (id: CareActionId): CareOutcome => {
      const current = stateRef.current
      if (!current) return { kind: 'egg' }
      const now = Date.now()
      const outcome = performCare(applyElapsed(current, now), id, now)
      if (outcome.kind !== 'done') return outcome
      commit(touch(outcome.state, now), true)
      emit('care')
      growth(outcome.growth)
      return outcome
    },
    [commit, emit, growth],
  )

  const tend = useCallback(
    (id: EggActionId) => {
      const current = stateRef.current
      if (!current || current.hatched) return
      const now = Date.now()
      const outcome = tendEgg(current, id, now)
      commit(touch(outcome.state, now), true)
      emit('egg')
      if (outcome.hatched) setPendingEvolution('baby')
    },
    [commit, emit],
  )

  const toggleSleep = useCallback(() => {
    const current = stateRef.current
    if (!current || !current.hatched) return
    const now = Date.now()
    const next = toggleElfSleep(applyElapsed(current, now), now)
    commit(touch(next, now), true)
    if (!next.sleeping) emit('wake')
  }, [commit, emit])

  const pet = useCallback((): boolean => {
    const current = stateRef.current
    if (!current) return false
    const now = Date.now()
    if (now < petAtRef.current) return false
    const outcome = petElf(applyElapsed(current, now), now)
    if (outcome.kind !== 'petted') return false
    petAtRef.current = now + PET_COOLDOWN_MS
    commit(touch(outcome.state, now), true)
    emit('pet')
    growth(outcome.growth)
    return true
  }, [commit, emit, growth])

  const equip = useCallback(
    (slot: WearableSlot, id: string) => {
      const current = stateRef.current
      if (!current || !WEARABLE_IDS[slot]?.includes(id)) return
      const now = Date.now()
      commit(touch(equipElf(current, slot, id), now), true)
    },
    [commit],
  )

  const placeDecor = useCallback(
    (slot: SlotId, id: string) => {
      const current = stateRef.current
      if (!current || !DECOR_IDS[slot]?.includes(id)) return
      const now = Date.now()
      commit(touch(placeElfDecor(current, slot, id), now), true)
    },
    [commit],
  )

  const catchReward = useCallback(() => {
    const current = stateRef.current
    if (!current) return
    const now = Date.now()
    const outcome = rewardCatch(applyElapsed(current, now), now)
    commit(touch(outcome.state, now), true)
    growth(outcome.growth)
  }, [commit, growth])

  const acknowledgeEvolution = useCallback(() => setPendingEvolution(null), [])

  /* The stored records keep their reference through the drift (applyElapsed
     spreads the state, not its nested records), so these only recompute
     after a swap or a reload. */
  const storedOutfit = state?.outfit
  const storedDecor = state?.decor
  const outfit = useMemo(() => resolveOutfit(storedOutfit), [storedOutfit])
  const decor = useMemo(() => resolveDecor(storedDecor), [storedDecor])

  const value = useMemo<ElfValue>(
    () => ({
      state,
      loaded,
      stage: state ? stageOf(state) : 'egg',
      mood: state ? moodOf(state) : 'ok',
      outfit,
      decor,
      lastInteraction: state?.lastInteraction ?? state?.last ?? 0,
      adopt,
      reset,
      care,
      tendEgg: tend,
      toggleSleep,
      pet,
      equip,
      placeDecor,
      catchReward,
      pendingEvolution,
      acknowledgeEvolution,
      onReaction,
    }),
    [state, loaded, outfit, decor, adopt, reset, care, tend, toggleSleep, pet, equip, placeDecor, catchReward, pendingEvolution, acknowledgeEvolution, onReaction],
  )

  return <ElfContext.Provider value={value}>{children}</ElfContext.Provider>
}

export function useElf(): ElfValue {
  const value = useContext(ElfContext)
  if (!value) throw new Error('useElf must be used within ElfProvider')
  return value
}
