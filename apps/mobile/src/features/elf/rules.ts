/* The rules of the elf companion, ported from the Elfostudio prototype: an
   egg that hatches when it is kept warm, then a creature with four needs
   that fall in real time, care actions that raise them and grant
   experience, levels, and four forms the elf grows through. Pure functions
   over an immutable state: every mutation returns a new state and what
   happened, so the provider can save it and the screens can react.

   The state also carries what the player chose for the elf and its room:
   the outfit (one id per wearable slot) and the decor (one id per
   furniture slot), both as plain strings the rules never interpret (the
   catalogues live in src/features/elf/cottage; the provider resolves a
   stored id against them), and when the player last did something, so the
   tab can greet a return.

   This is a prototype. The rules live in the app until the elf's place in
   the expedition (how the egg is found, what a cottage visit gives it) is
   designed; then they move to @chatynkowo/core next to the progress rules. */

export type StarterId = 'forest' | 'ember' | 'mystic'
export const STARTERS: readonly StarterId[] = ['forest', 'ember', 'mystic']

export type Stage = 'egg' | 'baby' | 'young' | 'adult' | 'elder'
/* The forms in order with the level each one begins at; the egg is the
   state before hatching, not a level. */
export const STAGES: ReadonlyArray<{ id: Exclude<Stage, 'egg'>; minLevel: number }> = [
  { id: 'baby', minLevel: 1 },
  { id: 'young', minLevel: 4 },
  { id: 'adult', minLevel: 8 },
  { id: 'elder', minLevel: 15 },
]

export type Mood = 'ok' | 'happy' | 'sad' | 'sick' | 'sleep'

export type NeedId = 'fullness' | 'joy' | 'energy' | 'clean'
export const NEEDS: readonly NeedId[] = ['fullness', 'joy', 'energy', 'clean']
export type Needs = Record<NeedId, number>

/* The wearable slots of the puppet. The same union is declared in
   cottage/wearables (the catalogue and the drawings); the rules must not
   import from the cottage, so the two are kept identical by hand. */
export type WearableSlot = 'hat' | 'outfit' | 'neck' | 'hand' | 'face'
export const WEARABLE_SLOT_IDS: readonly WearableSlot[] = ['hat', 'outfit', 'neck', 'hand', 'face']
/* What the elf wears: a wearable id per slot. */
export type Outfit = Record<WearableSlot, string>
/* What stands in the room: a decor id per furniture slot. The rules do not
   know the slot union (it belongs to cottage/items), so the key is a string. */
export type Decor = Record<string, string>

export type ElfState = {
  version: 1
  name: string
  starter: StarterId
  hatched: boolean
  /* Warmth of the egg, 0-100; the egg hatches at 100. */
  warmth: number
  level: number
  xp: number
  needs: Needs
  sleeping: boolean
  /* When the egg was taken in, and when the needs were last brought up to
     date, both in milliseconds since the epoch. */
  born: number
  last: number
  /* The chosen clothes and furniture, only the slots the player changed;
     the cottage fills the rest with its defaults. */
  outfit?: Partial<Outfit>
  decor?: Decor
  /* When the player last did something for the elf (a care, a pet, the
     egg, sleep, a swap), in milliseconds since the epoch. */
  lastInteraction?: number
}

export type CareActionId = 'feed' | 'play' | 'bath' | 'train'
export const CARE_ACTIONS: readonly CareActionId[] = ['feed', 'play', 'bath', 'train']

export type EggActionId = 'warm' | 'rock'
export const EGG_ACTIONS: readonly EggActionId[] = ['warm', 'rock']

/* Why a care action was refused. */
export type GuardReason = 'full' | 'tired' | 'weak'

type CareAction = {
  xp: number
  delta: Partial<Needs>
  guard?: (needs: Needs) => GuardReason | null
  /* A side effect after the deltas: overfeeding spoils the mood a little. */
  after?: (needs: Needs) => Needs
}

const CARE: Record<CareActionId, CareAction> = {
  feed: {
    xp: 4,
    delta: { fullness: 26, joy: 3, energy: -2, clean: -6 },
    guard: (needs) => (needs.fullness >= 98 ? 'full' : null),
    after: (needs) => (needs.fullness > 92 ? { ...needs, joy: clamp(needs.joy - 6) } : needs),
  },
  play: {
    xp: 7,
    delta: { joy: 24, energy: -12, fullness: -7 },
    guard: (needs) => (needs.energy <= 10 ? 'tired' : null),
  },
  bath: {
    xp: 3,
    delta: { clean: 42, joy: 4, energy: -5 },
  },
  train: {
    xp: 13,
    delta: { joy: 6, energy: -18, fullness: -8, clean: -6 },
    guard: (needs) => (needs.energy <= 22 ? 'weak' : null),
  },
}

const EGG_WARMTH: Record<EggActionId, number> = { warm: 18, rock: 13 }

/* How much of each need is lost per minute awake; asleep the losses are
   smaller and energy comes back. */
const DECAY_PER_MINUTE: Needs = { fullness: 0.7, joy: 0.55, energy: 0.45, clean: 0.35 }
const SLEEP_DECAY_FACTOR: Needs = { fullness: 0.4, joy: 0.35, energy: 0, clean: 0.3 }
const SLEEP_ENERGY_PER_MINUTE = 1.8
/* An absence longer than this counts as this long: a week away does not
   leave the elf at zero. */
const MAX_ELAPSED_MINUTES = 720

const PET_JOY = 4
const PET_XP = 1
export const PET_COOLDOWN_MS = 1400

const CATCH_JOY = 12
const CATCH_XP = 6

/* Needs below this are called out under the scene. */
export const LOW_NEED = 20

export const NAME_MAX_LENGTH = 16

export function clamp(value: number, low = 0, high = 100): number {
  return Math.max(low, Math.min(high, value))
}

export function xpNeeded(level: number): number {
  return 20 + (level - 1) * 18
}

export function stageForLevel(level: number): Exclude<Stage, 'egg'> {
  let stage: Exclude<Stage, 'egg'> = 'baby'
  for (const entry of STAGES) if (level >= entry.minLevel) stage = entry.id
  return stage
}

export function stageOf(state: ElfState): Stage {
  return state.hatched ? stageForLevel(state.level) : 'egg'
}

export function newElf(name: string, starter: StarterId, now: number): ElfState {
  return {
    version: 1,
    name,
    starter,
    hatched: false,
    warmth: 0,
    level: 1,
    xp: 0,
    needs: { fullness: 76, joy: 80, energy: 80, clean: 82 },
    sleeping: false,
    born: now,
    last: now,
    lastInteraction: now,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function number(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/* A stored record of ids: only the string values survive, and only under
   the keys allowed (every key when none are named). Undefined when nothing
   is left, so a state that never had a choice stays without the field. */
function stringRecord(value: unknown, keys?: readonly string[]): Record<string, string> | undefined {
  if (!isRecord(value)) return undefined
  const result: Record<string, string> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== 'string') continue
    if (keys && !keys.includes(key)) continue
    result[key] = entry
  }
  return Object.keys(result).length ? result : undefined
}

/* A stored state brought back to the shape above, or null when the entry is
   not an elf at all (then the player starts with a fresh egg). Missing or
   broken fields take sane values so a schema tweak never loses the elf. */
export function normalizeElf(raw: unknown): ElfState | null {
  if (!isRecord(raw) || typeof raw.name !== 'string' || !isRecord(raw.needs)) return null
  const starter = STARTERS.includes(raw.starter as StarterId) ? (raw.starter as StarterId) : 'forest'
  const needs = raw.needs
  const now = Date.now()
  const outfit = stringRecord(raw.outfit, WEARABLE_SLOT_IDS) as Partial<Outfit> | undefined
  const decor = stringRecord(raw.decor)
  const state: ElfState = {
    version: 1,
    name: raw.name.slice(0, NAME_MAX_LENGTH) || 'Elf',
    starter,
    hatched: raw.hatched === true,
    warmth: clamp(number(raw.warmth, 0)),
    level: Math.max(1, Math.floor(number(raw.level, 1))),
    xp: Math.max(0, number(raw.xp, 0)),
    needs: {
      fullness: clamp(number(needs.fullness, 70)),
      joy: clamp(number(needs.joy, 70)),
      energy: clamp(number(needs.energy, 70)),
      clean: clamp(number(needs.clean, 70)),
    },
    sleeping: raw.sleeping === true,
    born: number(raw.born, now),
    last: number(raw.last, now),
    /* A state saved before the field existed counts its last update as
       the last interaction, so an old save is greeted only after a real
       absence. */
    lastInteraction: number(raw.lastInteraction, number(raw.last, now)),
  }
  if (outfit) state.outfit = outfit
  if (decor) state.decor = decor
  return state
}

/* The needs as they are now: the time since the last update, capped,
   applied as decay (or as rest while asleep). An egg does not change. */
export function applyElapsed(state: ElfState, now: number): ElfState {
  if (!state.hatched) return state.last === now ? state : { ...state, last: now }
  const minutes = Math.min((now - state.last) / 60000, MAX_ELAPSED_MINUTES)
  if (minutes <= 0) return state
  const needs = { ...state.needs }
  let sleeping = state.sleeping
  if (sleeping) {
    for (const need of NEEDS) needs[need] = clamp(needs[need] - minutes * DECAY_PER_MINUTE[need] * SLEEP_DECAY_FACTOR[need])
    needs.energy = clamp(needs.energy + minutes * SLEEP_ENERGY_PER_MINUTE)
    if (needs.energy >= 100) sleeping = false
  } else {
    for (const need of NEEDS) needs[need] = clamp(needs[need] - minutes * DECAY_PER_MINUTE[need])
  }
  return { ...state, needs, sleeping, last: now }
}

export function averageNeed(needs: Needs): number {
  return NEEDS.reduce((sum, need) => sum + needs[need], 0) / NEEDS.length
}

export function moodOf(state: ElfState): Mood {
  if (!state.hatched) return 'ok'
  if (state.sleeping) return 'sleep'
  if (NEEDS.some((need) => state.needs[need] <= 0)) return 'sick'
  const average = averageNeed(state.needs)
  if (average < 28) return 'sad'
  if (average > 72) return 'happy'
  return 'ok'
}

/* The need most in want, when any is below the low mark. */
export function lowestNeed(state: ElfState): NeedId | null {
  let worst: NeedId | null = null
  for (const need of NEEDS) if (state.needs[need] < LOW_NEED && (worst === null || state.needs[need] < state.needs[worst])) worst = need
  return worst
}

export type Growth = {
  /* The form reached by this gain, if it changed. */
  evolvedTo: Exclude<Stage, 'egg'> | null
  /* A level was gained (without a new form). */
  leveled: boolean
}

function grantXp(state: ElfState, amount: number): { state: ElfState; growth: Growth } {
  const before = stageForLevel(state.level)
  let { xp, level } = state
  xp += amount
  let leveled = false
  while (xp >= xpNeeded(level)) {
    xp -= xpNeeded(level)
    level += 1
    leveled = true
  }
  const after = stageForLevel(level)
  return {
    state: { ...state, xp, level },
    growth: { evolvedTo: after !== before ? after : null, leveled: leveled && after === before },
  }
}

export type CareOutcome = { kind: 'done'; state: ElfState; growth: Growth } | { kind: 'refused'; reason: GuardReason } | { kind: 'asleep' } | { kind: 'egg' }

/* A care action: refused while the elf sleeps or when its guard says so,
   otherwise the deltas, the after-effect and the experience. */
export function performCare(state: ElfState, id: CareActionId, now: number): CareOutcome {
  if (!state.hatched) return { kind: 'egg' }
  if (state.sleeping) return { kind: 'asleep' }
  const action = CARE[id]
  const reason = action.guard?.(state.needs) ?? null
  if (reason) return { kind: 'refused', reason }
  let needs = { ...state.needs }
  for (const need of NEEDS) {
    const delta = action.delta[need]
    if (delta) needs[need] = clamp(needs[need] + delta)
  }
  if (action.after) needs = action.after(needs)
  const granted = grantXp({ ...state, needs, last: now }, action.xp)
  return { kind: 'done', ...granted }
}

export type EggOutcome = { state: ElfState; hatched: boolean }

/* Warming or rocking the egg; at full warmth it hatches into the first
   form with fresh needs and the level count starting over. */
export function tendEgg(state: ElfState, id: EggActionId, now: number): EggOutcome {
  if (state.hatched) return { state, hatched: false }
  const warmth = clamp(state.warmth + EGG_WARMTH[id])
  if (warmth < 100) return { state: { ...state, warmth, last: now }, hatched: false }
  return {
    state: { ...state, warmth: 100, hatched: true, level: 1, xp: 0, needs: { fullness: 78, joy: 82, energy: 80, clean: 84 }, sleeping: false, last: now },
    hatched: true,
  }
}

/* The player did something: remembered for the return greeting. */
export function touch(state: ElfState, now: number): ElfState {
  return state.lastInteraction === now ? state : { ...state, lastInteraction: now }
}

/* A wearable put on (or taken off with the slot's 'none'): the id is kept
   as given, the cottage decides whether it knows it. */
export function equip(state: ElfState, slot: WearableSlot, id: string): ElfState {
  if (state.outfit?.[slot] === id) return state
  return { ...state, outfit: { ...state.outfit, [slot]: id } }
}

/* A piece of furniture swapped in a slot of the room. */
export function placeDecor(state: ElfState, slotId: string, id: string): ElfState {
  if (state.decor?.[slotId] === id) return state
  return { ...state, decor: { ...state.decor, [slotId]: id } }
}

export function toggleSleep(state: ElfState, now: number): ElfState {
  if (!state.hatched) return state
  return { ...state, sleeping: !state.sleeping, last: now }
}

export type PetOutcome = { kind: 'petted'; state: ElfState; growth: Growth } | { kind: 'asleep' } | { kind: 'egg' }

/* A tap on the elf: a little joy and a point of experience. The cooldown
   between taps is the caller's (PET_COOLDOWN_MS). */
export function pet(state: ElfState, now: number): PetOutcome {
  if (!state.hatched) return { kind: 'egg' }
  if (state.sleeping) return { kind: 'asleep' }
  const needs = { ...state.needs, joy: clamp(state.needs.joy + PET_JOY) }
  const granted = grantXp({ ...state, needs, last: now }, PET_XP)
  return { kind: 'petted', ...granted }
}

/* The elf caught in the camera view: joy and experience, unless asleep. */
export function rewardCatch(state: ElfState, now: number): { state: ElfState; growth: Growth } {
  if (!state.hatched || state.sleeping) return { state, growth: { evolvedTo: null, leveled: false } }
  const needs = { ...state.needs, joy: clamp(state.needs.joy + CATCH_JOY) }
  return grantXp({ ...state, needs, last: now }, CATCH_XP)
}
