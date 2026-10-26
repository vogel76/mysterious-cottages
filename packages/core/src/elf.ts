/* The rules of the elf companion: the egg in the family's own cottage and
   the young elf that hatches from it, written for the rhythm the players
   actually have. Finds happen on a trip to Jura a few times a year; between
   trips the elf is a two-minute daily visit that can never fail. Pure
   functions over an immutable state: every mutation returns a new state and
   what happened, so the app's provider can save it and the screens can
   react; the clock is always handed in, never read here.

   What the rules say:

   - Three needs (fullness, joy, clean) drift towards a floor of 35, never
     below it, with time constants of days (4, 5 and 7), half as fast while
     the elf sleeps. A day away leaves the needs near 90, a week near 50, a
     month at the floor: wistful, never sick. There is no sick state.
   - The elf sleeps by the cottage clock: from 21:00 to 07:00 local time,
     tucked in from 19:00 if the player likes, woken by a touch, dozing off
     again ten minutes later while it is night. No energy meter.
   - Mood: asleep; 'misses' after five days without the player; 'wants'
     when the lowest need is under 60 (the need is named); 'beaming' when
     the needs average 75 and none is under 60; 'content' otherwise.
   - Care has daily caps (three feeds, two plays, one bath) and a full
     belly refuses a feed without any penalty, so a short session is a
     complete session. A pet is always welcome and adds a little joy.
   - Growth has no points: the forms come from cottages found and from
     time together (young: one find and three days, or three weeks; adult:
     five finds and two weeks, or ninety days; elder: thirteen finds and
     sixty days, only). Nobody reaches the last form from the sofa, and a
     single big weekend does not skip forms.
   - The egg waits in the nest from the first visit and hatches at the
     first opening six hours later, or the moment the first cottage story
     is read; warming and rocking are play, not a gate.
   - A daily life: each calendar day deals three small quests from a pool
     (feed, play, bathe, pet, swap a piece of furniture, tuck the elf in,
     look in during the evening), paid in acorns, with a grain of star dust
     for the full set; a daily reward to pick from (acorns, now and then
     dust); and a streak of consecutive days visited, which milestones
     reward with dust and which a missed day resets (the loss is the
     counter, never the elf). Acorns and dust are the two currencies the
     cosmetics will be bought with; nothing here spends them yet, and
     nothing about care, forms or finds ever depends on them.

   The state also carries what the player chose for the elf and its room:
   the outfit (one id per wearable slot) and the decor (one id per
   furniture slot), as plain strings the rules never interpret (the
   catalogues live in the app, which resolves a stored id against them).
   Like the progress rules, this module stores milliseconds since the epoch
   and reads the local calendar through Date, which is the device's. */

export const ELF_VERSION = 2

export type ElfStarter = 'forest' | 'ember' | 'mystic'
export const ELF_STARTERS: readonly ElfStarter[] = ['forest', 'ember', 'mystic']

export type ElfStage = 'egg' | 'baby' | 'young' | 'adult' | 'elder'
export type ElfForm = Exclude<ElfStage, 'egg'>
export const ELF_FORMS: readonly ElfForm[] = ['baby', 'young', 'adult', 'elder']

export type ElfNeedId = 'fullness' | 'joy' | 'clean'
export const ELF_NEEDS: readonly ElfNeedId[] = ['fullness', 'joy', 'clean']
export type ElfNeeds = Record<ElfNeedId, number>

export type ElfMood = 'beaming' | 'content' | 'wants' | 'misses' | 'asleep'

/* The wearable slots of the elf; the app's catalogue lists the ids each
   one takes and imports this union, so it is declared once. */
export type WearableSlot = 'hat' | 'outfit' | 'neck' | 'hand' | 'face'
export const WEARABLE_SLOT_IDS: readonly WearableSlot[] = ['hat', 'outfit', 'neck', 'hand', 'face']
/* What the elf wears: a wearable id per slot. */
export type ElfOutfit = Record<WearableSlot, string>
/* What stands in the room: a decor id per furniture slot. The rules do
   not know the slot union (it belongs to the app's catalogue), so the key
   is a string. */
export type ElfDecor = Record<string, string>

export type ElfCareAction = 'feed' | 'play' | 'bath'
export const ELF_CARE_ACTIONS: readonly ElfCareAction[] = ['feed', 'play', 'bath']

export type ElfEggAction = 'warm' | 'rock'
export const ELF_EGG_ACTIONS: readonly ElfEggAction[] = ['warm', 'rock']

/* What the quests count: the care actions, a pet, a swapped piece of
   furniture, the elf tucked in, the egg tended, a visit, a visit in the
   evening. */
export type ElfEvent = ElfCareAction | 'pet' | 'decor' | 'sleep' | 'egg' | 'open' | 'evening'

export type ElfQuestId = 'feedOnce' | 'feedTwice' | 'playOnce' | 'bathOnce' | 'petFive' | 'petTen' | 'decorOne' | 'tuckIn' | 'eggThree' | 'evening' | 'open'

export type ElfQuest = {
  id: ElfQuestId
  event: ElfEvent
  target: number
  progress: number
  /* The acorns the quest pays when done. */
  acorns: number
  done: boolean
}

export type ElfReward = { kind: 'acorns' | 'dust'; amount: number }

export type ElfWallet = { acorns: number; dust: number }

/* One calendar day of the elf's life: the quests dealt for it, the reward
   offered for it, and how much care it has had. */
export type ElfDaily = {
  /* The local day, YYYY-MM-DD. */
  day: string
  quests: ElfQuest[]
  /* The star dust for the full set of quests was granted. */
  bonusGranted: boolean
  /* The day's reward to pick from, one of them, once. */
  rewardOptions: ElfReward[]
  rewardClaimed: boolean
  feed: number
  play: number
  bath: number
}

export type ElfState = {
  version: typeof ELF_VERSION
  name: string
  starter: ElfStarter
  hatched: boolean
  /* The egg's warmth, 0..100, a measure of the care it had, not a gate. */
  warmth: number
  /* When the egg appeared, and when it hatched (the same until it does);
     milliseconds since the epoch. */
  eggAppearedAt: number
  born: number
  needs: ElfNeeds
  /* Whether the elf is asleep right now, derived by applyElapsed from the
     clock and the two moments below. */
  sleeping: boolean
  /* Tucked in early by the player (from 19:00): asleep until the morning. */
  tuckedAt: number | null
  /* Woken by the player during the night: awake for a few minutes. */
  wokenAt: number | null
  /* When the needs were last brought up to date. */
  last: number
  /* When the player last did something for the elf (a care, a pet, the
     egg, sleep, a swap). */
  lastInteraction: number
  /* The local day of the last visit, and the run of consecutive days. */
  lastVisitDay: string | null
  streak: number
  bestStreak: number
  daily: ElfDaily
  wallet: ElfWallet
  /* The form the app has shown the player last; a form reached since
     waits for its card. */
  stageShown: ElfForm | null
  /* The chosen clothes and furniture, only the slots the player changed;
     the cottage fills the rest with its defaults. */
  outfit?: Partial<ElfOutfit>
  decor?: ElfDecor
}

/* ---------- The numbers ---------- */

const NEED_FLOOR = 35
/* Days for a need to cover about two thirds of its way to the floor. */
const NEED_TAU_DAYS: ElfNeeds = { fullness: 4, joy: 5, clean: 7 }
/* The drift's pace while the elf sleeps. */
const SLEEP_DRIFT_RATE = 0.5

const NIGHT_FROM_HOUR = 21
const NIGHT_TO_HOUR = 7
const TUCK_IN_FROM_HOUR = 19
const EVENING_FROM_HOUR = 18
/* A woken elf dozes off again after this long, while it is night. */
const DOZE_MS = 10 * 60 * 1000

const CARE: Record<ElfCareAction, { need: ElfNeedId; gain: number; cap: number }> = {
  feed: { need: 'fullness', gain: 25, cap: 3 },
  play: { need: 'joy', gain: 30, cap: 2 },
  bath: { need: 'clean', gain: 60, cap: 1 },
}
/* A feed is refused at this fullness, with no penalty. */
const FULL_AT = 90

const PET_JOY = 3
export const PET_COOLDOWN_MS = 1400

const EGG_WARMTH: Record<ElfEggAction, number> = { warm: 18, rock: 13 }
const HATCH_AFTER_MS = 6 * 60 * 60 * 1000
const HATCHED_NEEDS: ElfNeeds = { fullness: 78, joy: 82, clean: 84 }

/* Under this the lowest need is named as a want. */
const WANT_BELOW = 60
const BEAMING_FROM = 75
const MISSES_AFTER_DAYS = 5

/* The forms: cottages found together with days since the egg appeared,
   or days alone. */
const FORMS = {
  young: { finds: 1, days: 3, daysAlone: 21 },
  adult: { finds: 5, days: 14, daysAlone: 90 },
  elder: { finds: 13, days: 60 },
} as const

const QUESTS_PER_DAY = 3
const QUEST_SET_DUST = 1
/* The dust a streak pays when it reaches a milestone. */
const STREAK_MILESTONES: Record<number, number> = { 7: 1, 30: 3 }

export const NAME_MAX_LENGTH = 16

const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000

/* The pool the day's quests are dealt from: for the egg its own two, for
   the elf the care. The visit quests suit both. */
type QuestSpec = { id: ElfQuestId; event: ElfEvent; target: number; acorns: number; stage: 'egg' | 'elf' | 'any' }
const QUEST_POOL: readonly QuestSpec[] = [
  { id: 'feedOnce', event: 'feed', target: 1, acorns: 6, stage: 'elf' },
  { id: 'feedTwice', event: 'feed', target: 2, acorns: 9, stage: 'elf' },
  { id: 'playOnce', event: 'play', target: 1, acorns: 6, stage: 'elf' },
  { id: 'bathOnce', event: 'bath', target: 1, acorns: 6, stage: 'elf' },
  { id: 'petFive', event: 'pet', target: 5, acorns: 5, stage: 'elf' },
  { id: 'petTen', event: 'pet', target: 10, acorns: 8, stage: 'elf' },
  { id: 'decorOne', event: 'decor', target: 1, acorns: 6, stage: 'any' },
  { id: 'tuckIn', event: 'sleep', target: 1, acorns: 6, stage: 'elf' },
  { id: 'eggThree', event: 'egg', target: 3, acorns: 6, stage: 'egg' },
  { id: 'evening', event: 'evening', target: 1, acorns: 5, stage: 'any' },
  { id: 'open', event: 'open', target: 1, acorns: 3, stage: 'any' },
]

/* ---------- The calendar ---------- */

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}

/* The local calendar day of a moment, YYYY-MM-DD. */
export function dayKey(ms: number): string {
  const date = new Date(ms)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function hourOf(ms: number): number {
  const date = new Date(ms)
  return date.getHours() + date.getMinutes() / 60
}

function isNightAt(ms: number): boolean {
  const hour = hourOf(ms)
  return hour >= NIGHT_FROM_HOUR || hour < NIGHT_TO_HOUR
}

/* The next 07:00 after a moment. */
function nextMorning(ms: number): number {
  const date = new Date(ms)
  date.setHours(NIGHT_TO_HOUR, 0, 0, 0)
  if (date.getTime() <= ms) date.setDate(date.getDate() + 1)
  return date.getTime()
}

function startOfDay(ms: number): number {
  const date = new Date(ms)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/* Whole calendar days from one moment to another. */
export function daysBetween(from: number, to: number): number {
  return Math.max(0, Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS))
}

/* ---------- Small helpers ---------- */

export function clamp(value: number, low = 0, high = 100): number {
  return Math.max(low, Math.min(high, value))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function number(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function count(value: unknown): number {
  return Math.max(0, Math.floor(number(value, 0)))
}

/* FNV-1a over a string: the day's deal, the same on every device. */
function hashOf(text: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash
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

/* ---------- The day's deal ---------- */

function questFrom(spec: QuestSpec): ElfQuest {
  return { id: spec.id, event: spec.event, target: spec.target, progress: 0, acorns: spec.acorns, done: false }
}

/* Three quests for a day, dealt by the day and the elf's name so every
   device deals the same, from the pool that suits the egg or the elf. */
function dealQuests(day: string, name: string, hatched: boolean): ElfQuest[] {
  const eligible = QUEST_POOL.filter((spec) => spec.stage === 'any' || spec.stage === (hatched ? 'elf' : 'egg'))
  const dealt: ElfQuest[] = []
  let seed = hashOf(`${day}|${name}|quests`)
  while (dealt.length < QUESTS_PER_DAY && dealt.length < eligible.length) {
    const spec = eligible[seed % eligible.length]!
    if (!dealt.some((quest) => quest.id === spec.id)) dealt.push(questFrom(spec))
    seed = hashOf(`${seed}`)
  }
  return dealt
}

/* The reward offered for a day: a small and a larger handful of acorns,
   and every third day or so a grain of dust in place of a middling one. */
function dealRewards(day: string, name: string): ElfReward[] {
  const seed = hashOf(`${day}|${name}|reward`)
  const third: ElfReward = seed % 3 === 0 ? { kind: 'dust', amount: 1 } : { kind: 'acorns', amount: 20 }
  return [{ kind: 'acorns', amount: 15 }, { kind: 'acorns', amount: 30 }, third]
}

function freshDaily(day: string, name: string, hatched: boolean): ElfDaily {
  return { day, quests: dealQuests(day, name, hatched), bonusGranted: false, rewardOptions: dealRewards(day, name), rewardClaimed: false, feed: 0, play: 0, bath: 0 }
}

/* ---------- A new elf and a stored one ---------- */

export function newElf(name: string, starter: ElfStarter, now: number): ElfState {
  const trimmed = name.trim().slice(0, NAME_MAX_LENGTH) || 'Elf'
  return {
    version: ELF_VERSION,
    name: trimmed,
    starter,
    hatched: false,
    warmth: 0,
    eggAppearedAt: now,
    born: now,
    needs: { ...HATCHED_NEEDS },
    sleeping: false,
    tuckedAt: null,
    wokenAt: null,
    last: now,
    lastInteraction: now,
    lastVisitDay: null,
    streak: 0,
    bestStreak: 0,
    daily: freshDaily(dayKey(now), trimmed, false),
    wallet: { acorns: 0, dust: 0 },
    stageShown: null,
  }
}

function normalizeQuest(raw: unknown): ElfQuest | null {
  if (!isRecord(raw) || typeof raw.id !== 'string') return null
  const spec = QUEST_POOL.find((entry) => entry.id === raw.id)
  if (!spec) return null
  const quest = questFrom(spec)
  quest.progress = Math.min(quest.target, count(raw.progress))
  quest.done = raw.done === true || quest.progress >= quest.target
  return quest
}

function normalizeReward(raw: unknown): ElfReward | null {
  if (!isRecord(raw) || (raw.kind !== 'acorns' && raw.kind !== 'dust')) return null
  return { kind: raw.kind, amount: count(raw.amount) }
}

function normalizeDaily(raw: unknown, name: string, hatched: boolean, now: number): ElfDaily {
  const today = dayKey(now)
  if (!isRecord(raw) || typeof raw.day !== 'string') return freshDaily(today, name, hatched)
  const quests = Array.isArray(raw.quests) ? raw.quests.map(normalizeQuest).filter((quest): quest is ElfQuest => quest !== null) : []
  const rewards = Array.isArray(raw.rewardOptions) ? raw.rewardOptions.map(normalizeReward).filter((reward): reward is ElfReward => reward !== null) : []
  const fresh = freshDaily(raw.day, name, hatched)
  return {
    day: raw.day,
    quests: quests.length === QUESTS_PER_DAY ? quests : fresh.quests,
    bonusGranted: raw.bonusGranted === true,
    rewardOptions: rewards.length === 3 ? rewards : fresh.rewardOptions,
    rewardClaimed: raw.rewardClaimed === true,
    feed: count(raw.feed),
    play: count(raw.play),
    bath: count(raw.bath),
  }
}

/* A stored state brought back to the shape above, or null when the entry
   is not an elf of this version (then the player starts with a fresh egg;
   the first prototype's version-1 saves are not carried over). Missing or
   broken fields take sane values so a schema tweak never loses the elf. */
export function normalizeElf(raw: unknown, now: number): ElfState | null {
  if (!isRecord(raw) || raw.version !== ELF_VERSION || typeof raw.name !== 'string' || !isRecord(raw.needs)) return null
  const name = raw.name.slice(0, NAME_MAX_LENGTH) || 'Elf'
  const hatched = raw.hatched === true
  const starter = ELF_STARTERS.includes(raw.starter as ElfStarter) ? (raw.starter as ElfStarter) : 'forest'
  const needs = raw.needs
  const eggAppearedAt = number(raw.eggAppearedAt, now)
  const wallet = isRecord(raw.wallet) ? raw.wallet : {}
  const streak = count(raw.streak)
  const stageShown = ELF_FORMS.includes(raw.stageShown as ElfForm) ? (raw.stageShown as ElfForm) : null
  const state: ElfState = {
    version: ELF_VERSION,
    name,
    starter,
    hatched,
    warmth: clamp(number(raw.warmth, 0)),
    eggAppearedAt,
    born: number(raw.born, eggAppearedAt),
    needs: {
      fullness: clamp(number(needs.fullness, HATCHED_NEEDS.fullness)),
      joy: clamp(number(needs.joy, HATCHED_NEEDS.joy)),
      clean: clamp(number(needs.clean, HATCHED_NEEDS.clean)),
    },
    sleeping: raw.sleeping === true,
    tuckedAt: typeof raw.tuckedAt === 'number' ? raw.tuckedAt : null,
    wokenAt: typeof raw.wokenAt === 'number' ? raw.wokenAt : null,
    last: number(raw.last, now),
    lastInteraction: number(raw.lastInteraction, number(raw.last, now)),
    lastVisitDay: typeof raw.lastVisitDay === 'string' ? raw.lastVisitDay : null,
    streak,
    bestStreak: Math.max(streak, count(raw.bestStreak)),
    daily: normalizeDaily(raw.daily, name, hatched, now),
    wallet: { acorns: count(wallet.acorns), dust: count(wallet.dust) },
    stageShown,
  }
  const outfit = stringRecord(raw.outfit, WEARABLE_SLOT_IDS) as Partial<ElfOutfit> | undefined
  const decor = stringRecord(raw.decor)
  if (outfit) state.outfit = outfit
  if (decor) state.decor = decor
  return state
}

/* ---------- Time passing ---------- */

/* Whether the elf may be tucked in at a moment: from the evening until
   the morning. Before that the sleep button answers 'tooEarly'; the scene
   lets the elf yawn and droop in this window, so the player sees it is
   bedtime. */
export function isBedtimeAt(at: number): boolean {
  return hourOf(at) >= TUCK_IN_FROM_HOUR || isNightAt(at)
}

/* Whether the elf is asleep at a moment: woken by the player it stays up a
   few minutes; at night it sleeps; tucked in early it sleeps until the
   morning. */
export function isAsleepAt(state: ElfState, at: number): boolean {
  if (!state.hatched) return false
  if (state.wokenAt !== null && at >= state.wokenAt && at - state.wokenAt < DOZE_MS) return false
  if (isNightAt(at)) return true
  return state.tuckedAt !== null && at >= state.tuckedAt && at < nextMorning(state.tuckedAt)
}

/* The needs as they are now: the time since the last update, walked hour
   by hour so the night counts at half pace, applied as a drift towards the
   floor; and whether the elf sleeps now. An egg does not change. A clock
   turned back changes nothing but the mark. */
export function applyElapsed(state: ElfState, now: number): ElfState {
  if (now === state.last) return state
  if (!state.hatched || now < state.last) return { ...state, last: now }
  let effectiveHours = 0
  let at = state.last
  while (at < now) {
    const end = Math.min(now, Math.floor(at / HOUR_MS) * HOUR_MS + HOUR_MS)
    const hours = (end - at) / HOUR_MS
    effectiveHours += isAsleepAt(state, at) ? hours * SLEEP_DRIFT_RATE : hours
    at = end
  }
  const needs = { ...state.needs }
  for (const need of ELF_NEEDS) {
    const distance = needs[need] - NEED_FLOOR
    needs[need] = distance > 0 ? NEED_FLOOR + distance * Math.exp(-effectiveHours / (NEED_TAU_DAYS[need] * 24)) : needs[need]
  }
  return { ...state, needs, sleeping: isAsleepAt(state, now), last: now }
}

export function averageNeed(needs: ElfNeeds): number {
  return ELF_NEEDS.reduce((sum, need) => sum + needs[need], 0) / ELF_NEEDS.length
}

/* The need the elf would like seen to, when the lowest is under the mark. */
export function wantedNeed(state: ElfState): ElfNeedId | null {
  let worst: ElfNeedId | null = null
  for (const need of ELF_NEEDS) if (worst === null || state.needs[need] < state.needs[worst]) worst = need
  return worst !== null && state.needs[worst] < WANT_BELOW ? worst : null
}

export function moodOf(state: ElfState, now: number): ElfMood {
  if (!state.hatched) return 'content'
  if (state.sleeping) return 'asleep'
  if (daysBetween(state.lastInteraction, now) >= MISSES_AFTER_DAYS) return 'misses'
  if (wantedNeed(state)) return 'wants'
  const needs = state.needs
  if (averageNeed(needs) >= BEAMING_FROM && ELF_NEEDS.every((need) => needs[need] >= WANT_BELOW)) return 'beaming'
  return 'content'
}

/* ---------- The forms ---------- */

/* The elf's form from the cottages found and the days since the egg
   appeared: an egg until it hatches, the baby from the hatch, the next
   forms by finds with time, or by time alone, the elder by both only. */
export function stageOf(state: ElfState, finds: number, now: number): ElfStage {
  if (!state.hatched) return 'egg'
  const days = daysBetween(state.eggAppearedAt, now)
  if (finds >= FORMS.elder.finds && days >= FORMS.elder.days) return 'elder'
  if ((finds >= FORMS.adult.finds && days >= FORMS.adult.days) || days >= FORMS.adult.daysAlone) return 'adult'
  if ((finds >= FORMS.young.finds && days >= FORMS.young.days) || days >= FORMS.young.daysAlone) return 'young'
  return 'baby'
}

/* The form reached but not yet shown, or null. */
export function pendingForm(state: ElfState, finds: number, now: number): ElfForm | null {
  const stage = stageOf(state, finds, now)
  if (stage === 'egg' || stage === state.stageShown) return null
  return stage
}

export function markFormShown(state: ElfState, form: ElfForm): ElfState {
  return state.stageShown === form ? state : { ...state, stageShown: form }
}

/* ---------- The day ---------- */

export type VisitOutcome = {
  state: ElfState
  /* The first visit of a calendar day. */
  newDay: boolean
  /* The streak that ended with the day missed, when one did. */
  streakLost: number | null
  /* The dust a streak milestone paid, 0 when none. */
  milestoneDust: number
  completed: ElfQuestId[]
  setBonus: boolean
}

/* The day the state lives in is the calendar's: on a new day the visit is
   counted (the streak grows by a day, breaks across a gap, pays at its
   milestones), the quests and the reward are dealt afresh and the care
   caps start over. */
function ensureDay(state: ElfState, now: number): { state: ElfState; newDay: boolean; streakLost: number | null; milestoneDust: number } {
  const day = dayKey(now)
  if (state.lastVisitDay === day) return { state, newDay: false, streakLost: null, milestoneDust: 0 }
  const yesterday = dayKey(now - DAY_MS)
  const continues = state.lastVisitDay === yesterday
  const streak = continues ? state.streak + 1 : 1
  const streakLost = !continues && state.lastVisitDay !== null && state.streak > 1 ? state.streak : null
  const milestoneDust = STREAK_MILESTONES[streak] ?? 0
  const next: ElfState = {
    ...state,
    lastVisitDay: day,
    streak,
    bestStreak: Math.max(state.bestStreak, streak),
    daily: freshDaily(day, state.name, state.hatched),
    wallet: milestoneDust ? { ...state.wallet, dust: state.wallet.dust + milestoneDust } : state.wallet,
  }
  return { state: next, newDay: true, streakLost, milestoneDust }
}

/* What happened goes to the day's quests: the ones that count the event
   advance, a quest reaching its target pays its acorns, and the full set
   pays its grain of dust once. */
function recordEvent(state: ElfState, event: ElfEvent): { state: ElfState; completed: ElfQuestId[]; setBonus: boolean } {
  const completed: ElfQuestId[] = []
  let acorns = 0
  let changed = false
  const quests = state.daily.quests.map((quest) => {
    if (quest.done || quest.event !== event) return quest
    changed = true
    const progress = Math.min(quest.target, quest.progress + 1)
    const done = progress >= quest.target
    if (done) {
      completed.push(quest.id)
      acorns += quest.acorns
    }
    return { ...quest, progress, done }
  })
  if (!changed) return { state, completed, setBonus: false }
  const setBonus = !state.daily.bonusGranted && quests.every((quest) => quest.done)
  const wallet = { acorns: state.wallet.acorns + acorns, dust: state.wallet.dust + (setBonus ? QUEST_SET_DUST : 0) }
  return { state: { ...state, daily: { ...state.daily, quests, bonusGranted: state.daily.bonusGranted || setBonus }, wallet }, completed, setBonus }
}

/* A visit to the cottage: the day is settled, the visit counted for the
   quests (and the evening one after 18:00). Call it whenever the tab comes
   into view. */
export function visit(state: ElfState, now: number): VisitOutcome {
  const settled = ensureDay(applyElapsed(state, now), now)
  const opened = recordEvent(settled.state, 'open')
  const evening = hourOf(now) >= EVENING_FROM_HOUR ? recordEvent(opened.state, 'evening') : { state: opened.state, completed: [], setBonus: false }
  return {
    state: evening.state,
    newDay: settled.newDay,
    streakLost: settled.streakLost,
    milestoneDust: settled.milestoneDust,
    completed: [...opened.completed, ...evening.completed],
    setBonus: opened.setBonus || evening.setBonus,
  }
}

/* The day's reward, picked once. */
export function claimDailyReward(state: ElfState, index: number, now: number): ElfState {
  const settled = ensureDay(applyElapsed(state, now), now).state
  const option = settled.daily.rewardOptions[index]
  if (settled.daily.rewardClaimed || !option) return settled
  const wallet = { ...settled.wallet, [option.kind]: settled.wallet[option.kind] + option.amount }
  return { ...settled, daily: { ...settled.daily, rewardClaimed: true }, wallet }
}

/* ---------- Care ---------- */

/* Why a care action was refused: the day's cap for it is used up, or a
   belly too full for another feed. */
export type CareRefusal = 'cap' | 'full'

export type CareOutcome =
  | { kind: 'done'; state: ElfState; completed: ElfQuestId[]; setBonus: boolean }
  | { kind: 'refused'; reason: CareRefusal }
  | { kind: 'asleep' }
  | { kind: 'egg' }

/* A care action: refused while the elf sleeps, past the day's cap, or (a
   feed) on a full belly; otherwise the need rises and the quests hear of it. */
export function performCare(state: ElfState, id: ElfCareAction, now: number): CareOutcome {
  if (!state.hatched) return { kind: 'egg' }
  const current = ensureDay(applyElapsed(state, now), now).state
  if (current.sleeping) return { kind: 'asleep' }
  const spec = CARE[id]
  if (current.daily[id] >= spec.cap) return { kind: 'refused', reason: 'cap' }
  if (id === 'feed' && current.needs.fullness >= FULL_AT) return { kind: 'refused', reason: 'full' }
  const needs = { ...current.needs, [spec.need]: clamp(current.needs[spec.need] + spec.gain) }
  const cared: ElfState = { ...current, needs, daily: { ...current.daily, [id]: current.daily[id] + 1 }, lastInteraction: now }
  const recorded = recordEvent(cared, id)
  return { kind: 'done', ...recorded }
}

/* How many of each care the day still allows. */
export function careLeft(state: ElfState, id: ElfCareAction, now: number): number {
  const current = ensureDay(state, now).state
  return Math.max(0, CARE[id].cap - current.daily[id])
}

export type PetOutcome = { kind: 'petted'; state: ElfState; completed: ElfQuestId[]; setBonus: boolean } | { kind: 'asleep' } | { kind: 'egg' }

/* A tap on the elf: a little joy, always welcome while it is awake. The
   cooldown between taps is the caller's (PET_COOLDOWN_MS). */
export function pet(state: ElfState, now: number): PetOutcome {
  if (!state.hatched) return { kind: 'egg' }
  const current = ensureDay(applyElapsed(state, now), now).state
  if (current.sleeping) return { kind: 'asleep' }
  const needs = { ...current.needs, joy: clamp(current.needs.joy + PET_JOY) }
  const recorded = recordEvent({ ...current, needs, lastInteraction: now }, 'pet')
  return { kind: 'petted', ...recorded }
}

/* ---------- The egg ---------- */

export type EggOutcome = { state: ElfState; completed: ElfQuestId[]; setBonus: boolean }

/* Warming or rocking the egg: care it remembers, and play the quests
   count; it hatches on its own time (hatchDue). */
export function tendEgg(state: ElfState, id: ElfEggAction, now: number): EggOutcome {
  if (state.hatched) return { state, completed: [], setBonus: false }
  const current = ensureDay(state, now).state
  const tended: ElfState = { ...current, warmth: clamp(current.warmth + EGG_WARMTH[id]), lastInteraction: now, last: now }
  return recordEvent(tended, 'egg')
}

/* The egg hatches at the first opening six hours after it appeared, or
   the moment the first cottage story is read. */
export function hatchDue(state: ElfState, now: number, storyRead: boolean): boolean {
  return !state.hatched && (storyRead || now - state.eggAppearedAt >= HATCH_AFTER_MS)
}

export function hatch(state: ElfState, now: number): ElfState {
  if (state.hatched) return state
  const hatched: ElfState = { ...state, hatched: true, warmth: 100, born: now, needs: { ...HATCHED_NEEDS }, last: now, lastInteraction: now }
  const settled = ensureDay(hatched, now).state
  /* The day's quests were dealt for an egg; the elf gets its own. */
  const daily = settled.daily.day === state.daily.day && settled.daily.quests.some((quest) => quest.event === 'egg') ? { ...settled.daily, quests: dealQuests(settled.daily.day, settled.name, true), bonusGranted: false } : settled.daily
  return { ...settled, daily, sleeping: isAsleepAt({ ...settled, hatched: true }, now) }
}

/* ---------- Sleep ---------- */

export type SleepOutcome = { kind: 'slept' | 'woke'; state: ElfState; completed: ElfQuestId[]; setBonus: boolean } | { kind: 'tooEarly' } | { kind: 'egg' }

/* The sleep button: tucks the elf in from 19:00 (asleep until the
   morning), or wakes it (up for a few minutes, then dozing off again while
   it is night). */
export function toggleSleep(state: ElfState, now: number): SleepOutcome {
  if (!state.hatched) return { kind: 'egg' }
  const current = ensureDay(applyElapsed(state, now), now).state
  if (current.sleeping) {
    const woken: ElfState = { ...current, sleeping: false, wokenAt: now, tuckedAt: null, lastInteraction: now }
    return { kind: 'woke', state: woken, completed: [], setBonus: false }
  }
  if (!isBedtimeAt(now)) return { kind: 'tooEarly' }
  const tucked: ElfState = { ...current, sleeping: true, tuckedAt: now, wokenAt: null, lastInteraction: now }
  return { kind: 'slept', ...recordEvent(tucked, 'sleep') }
}

/* ---------- The room and the wardrobe ---------- */

/* A wearable put on (or taken off with the slot's 'none'): the id is kept
   as given, the cottage decides whether it knows it. */
export function equip(state: ElfState, slot: WearableSlot, id: string, now: number): ElfState {
  if (state.outfit?.[slot] === id) return state
  return { ...state, outfit: { ...state.outfit, [slot]: id }, lastInteraction: now }
}

/* A piece of furniture swapped in a slot of the room; the quests count it. */
export function placeDecor(state: ElfState, slotId: string, id: string, now: number): { state: ElfState; completed: ElfQuestId[]; setBonus: boolean } {
  if (state.decor?.[slotId] === id) return { state, completed: [], setBonus: false }
  const current = ensureDay(state, now).state
  return recordEvent({ ...current, decor: { ...current.decor, [slotId]: id }, lastInteraction: now }, 'decor')
}
