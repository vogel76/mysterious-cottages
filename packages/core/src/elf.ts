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
     for the full set; on Friday, Saturday and Sunday one of them is always
     "discover a cottage", paid in acorns and dust; a daily reward to pick
     from (acorns, now and then dust); and a streak of consecutive days
     visited, which milestones reward with dust and which a missed day
     resets (the loss is the counter, never the elf). Acorns and dust are
     the two currencies the cosmetics will be bought with; a few pieces of
     furniture take a number of finds instead (DECOR_UNLOCKS); nothing else
     about care, forms or finds ever depends on them.
   - The cottages found reach the rules as finds: each is credited once to
     the find quest of its own day (a weekend find seen later still pays),
     and a find from an earlier day is handed back once, on the next
     visit, for the elf to celebrate; the find's own day belongs to the
     expedition.
   - An absence leaves something, never takes: the first visit of a day
     after it finds one small thing per day away for the windowsill (the
     newest SILL_SIZE lie there, all are counted in a collection), brings
     the letter that fell due meanwhile (on the 2nd, 5th and 9th day after
     the hatch, then weekly: from a cottage found, an invitation from one
     the app proposes, or the forest's), and tells whether the plant on
     the sill reached a new stage (7, 30, 90 and 180 days). Two days away,
     a letter or a new stage make it worth the app's card (ElfAway).

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
/* The small things the elf finds while the player is away, one for each
   calendar day of an absence: they lie on the windowsill (the newest
   SILL_SIZE, the places the room's render has beside the plant) and every
   one is counted in the collection. */
export const SILL_ITEMS = ['pinecone', 'feather', 'pebble', 'acorn', 'mushroom', 'leaf', 'berries', 'fossil'] as const
export type ElfSillItem = (typeof SILL_ITEMS)[number]
export const SILL_SIZE = 3

/* A letter from the elves of the cottages: from one already found (a
   thank-you and a word about its virtue), an invitation from the nearest
   one not found yet, or a word from the forest when there is neither. */
export type ElfLetterKind = 'found' | 'invite' | 'forest'
export type ElfLetter = {
  /* The letter's number, from 1. */
  n: number
  /* The local day it arrived. */
  day: string
  kind: ElfLetterKind
  /* The cottage it comes from; null for the forest's. */
  slug: string | null
  read: boolean
}

/* What came of an absence on the first visit of a new day: the days since
   the last visit, the things found for them, the letter that arrived and
   the plant's new stage when it grew. `card` says whether it is worth the
   'while you were away' card (two days or more, a letter or a grown
   plant); a single night's find is only said. */
export type ElfAway = {
  days: number
  found: ElfSillItem[]
  letter: ElfLetter | null
  plantStage: number | null
  card: boolean
}

/* What stands in the room: a decor id per furniture slot. The rules do
   not know the slot union (it belongs to the app's catalogue), so the key
   is a string. */
export type ElfDecor = Record<string, string>

export type ElfCareAction = 'feed' | 'play' | 'bath'
export const ELF_CARE_ACTIONS: readonly ElfCareAction[] = ['feed', 'play', 'bath']

export type ElfEggAction = 'warm' | 'rock'
export const ELF_EGG_ACTIONS: readonly ElfEggAction[] = ['warm', 'rock']

/* What the quests count: the care, a pet, a swap, the tuck-in, the egg
   tended, a visit, an evening visit, and a cottage found in the field. */
export type ElfEvent = ElfCareAction | 'pet' | 'decor' | 'sleep' | 'egg' | 'open' | 'evening' | 'find'

export type ElfQuestId = 'feedOnce' | 'feedTwice' | 'playOnce' | 'bathOnce' | 'petFive' | 'petTen' | 'decorOne' | 'tuckIn' | 'eggThree' | 'evening' | 'open' | 'findOne'

export type ElfQuest = {
  id: ElfQuestId
  event: ElfEvent
  target: number
  progress: number
  /* The acorns the quest pays when done, and the star dust (the rare
     ones only). */
  acorns: number
  dust: number
  done: boolean
}

/* A cottage found in the field, as the app's progress records it. */
export type ElfFind = { slug: string; at: number }

/* A quest completed, with what it paid: the news the app tells. */
export type ElfQuestPay = { id: ElfQuestId; acorns: number; dust: number }

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
  /* The day's reward to pick from, one of them, once: the index picked,
     or null while the pick is still open. */
  rewardOptions: ElfReward[]
  rewardPicked: number | null
  feed: number
  play: number
  bath: number
}

export type ElfState = {
  version: typeof ELF_VERSION
  /* Empty, and no element, until the hatch, when the player names the
     elf and picks its element; the egg needs neither. */
  name: string
  starter: ElfStarter | null
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
  /* The cottages found that the day's quests have taken into account,
     and those the elf has already celebrated on a later day. */
  findsCredited: string[]
  findsCelebrated: string[]
  /* The chosen clothes and furniture, only the slots the player changed;
     the cottage fills the rest with its defaults. */
  outfit?: Partial<ElfOutfit>
  decor?: ElfDecor
  /* The windowsill, newest first, and how many of each thing were found. */
  sill: ElfSillItem[]
  collection: Partial<Record<ElfSillItem, number>>
  /* The letters kept (the latest LETTERS_KEPT, oldest first) and how many
     the schedule has delivered or passed. */
  letters: ElfLetter[]
  lettersSent: number
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
/* The pieces the finds unlock, by slot and id: a piece stays locked in
   the decorating catalogue until this many cottages are found. Every
   place keeps one choice besides its default free from the start, so a
   new player can arrange the room at once; the rest come one or two at a
   time up to the eighth cottage. The ids are the app's catalogue's; the
   rules keep only the thresholds, so a shop paid in acorns can use the
   same table later. What a player placed before a lock existed is never
   taken away. */
export const DECOR_UNLOCKS: Record<string, number> = {
  'rug:moss': 1,
  'lantern:bell': 1,
  'shelf:seedlings': 2,
  'basket:pumpkins': 2,
  'floor:flagstones': 2,
  'window:round': 3,
  'herbs:dreamcatcher': 3,
  'wall:logs': 3,
  'fern:mushroom': 4,
  'candle:cauldron': 4,
  'bed:hammock': 5,
  'floor:terracotta': 5,
  'bed:nest': 8,
  'picture:antlers': 8,
  'hat:flowerCrown': 2,
  'hat:mushroomCap': 4,
  'hat:nightcap': 6,
}

/* How many more cottages a piece needs before it can be placed; 0 when it
   is free. */
export function decorFindsNeeded(slot: string, id: string, finds: number): number {
  return Math.max(0, (DECOR_UNLOCKS[`${slot}:${id}`] ?? 0) - finds)
}

/* How many times a day each care is welcome, for the buttons to show,
   and which need each care answers, for the app to name the gain. */
export const ELF_CARE_CAPS: Record<ElfCareAction, number> = { feed: CARE.feed.cap, play: CARE.play.cap, bath: CARE.bath.cap }
export const ELF_CARE_NEEDS: Record<ElfCareAction, ElfNeedId> = { feed: CARE.feed.need, play: CARE.play.need, bath: CARE.bath.need }
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
   the elf the care. The visit quests suit both. The find quest is not
   drawn but dealt on every weekend day, when the forest is near, and pays
   in dust as well. */
type QuestSpec = { id: ElfQuestId; event: ElfEvent; target: number; acorns: number; dust?: number; stage: 'egg' | 'elf' | 'any'; when?: 'weekend' }
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
  { id: 'findOne', event: 'find', target: 1, acorns: 25, dust: 1, stage: 'any', when: 'weekend' },
]

/* ---------- The calendar ---------- */

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}

/* The same time of day on the previous local calendar day: a day of
   23 or 25 hours (the clock change) is still one day back. */
function previousDay(ms: number): number {
  const date = new Date(ms)
  date.setDate(date.getDate() - 1)
  return date.getTime()
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

/* A stored list of ids: only the strings survive. */
function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
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
  return { id: spec.id, event: spec.event, target: spec.target, progress: 0, acorns: spec.acorns, dust: spec.dust ?? 0, done: false }
}

/* Friday to Sunday: the days the seekers go to the forest. Noon keeps the
   day's own date through a clock change. */
function isWeekend(day: string): boolean {
  const weekday = new Date(`${day}T12:00:00`).getDay()
  return weekday === 5 || weekday === 6 || weekday === 0
}

/* Three quests for a day, dealt by the day and the elf's name so every
   device deals the same, from the pool that suits the egg or the elf. */
function dealQuests(day: string, name: string, hatched: boolean): ElfQuest[] {
  const stage = hatched ? 'elf' : 'egg'
  const weekend = isWeekend(day)
  const fixed = QUEST_POOL.filter((spec) => spec.when === 'weekend' && weekend)
  const eligible = QUEST_POOL.filter((spec) => !spec.when && (spec.stage === 'any' || spec.stage === stage))
  const dealt: ElfQuest[] = fixed.map(questFrom)
  let seed = hashOf(`${day}|${name}|quests`)
  while (dealt.length < QUESTS_PER_DAY && dealt.length < fixed.length + eligible.length) {
    const spec = eligible[seed % eligible.length]!
    if (!dealt.some((quest) => quest.id === spec.id)) dealt.push(questFrom(spec))
    seed = hashOf(`${seed}`)
  }
  return dealt
}

/* The reward offered for a day: a small and a larger handful of acorns,
   and every third day or so a grain of dust in place of a middling one,
   shuffled by the same seed so the face-down pick is blind on every day
   and yet the same on every device. */
function dealRewards(day: string, name: string): ElfReward[] {
  const seed = hashOf(`${day}|${name}|reward`)
  const third: ElfReward = seed % 3 === 0 ? { kind: 'dust', amount: 1 } : { kind: 'acorns', amount: 20 }
  const cards: ElfReward[] = [{ kind: 'acorns', amount: 15 }, { kind: 'acorns', amount: 30 }, third]
  let roll = hashOf(`${seed}|order`)
  for (let index = cards.length - 1; index > 0; index -= 1) {
    const other = roll % (index + 1)
    ;[cards[index], cards[other]] = [cards[other]!, cards[index]!]
    roll = hashOf(`${roll}`)
  }
  return cards
}

function freshDaily(day: string, name: string, hatched: boolean): ElfDaily {
  return { day, quests: dealQuests(day, name, hatched), bonusGranted: false, rewardOptions: dealRewards(day, name), rewardPicked: null, feed: 0, play: 0, bath: 0 }
}

/* ---------- A new elf and a stored one ---------- */

/* A fresh egg in the nest: unnamed and of no element until it hatches. */
export function newElf(now: number): ElfState {
  return {
    version: ELF_VERSION,
    name: '',
    starter: null,
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
    daily: freshDaily(dayKey(now), '', false),
    wallet: { acorns: 0, dust: 0 },
    stageShown: null,
    findsCredited: [],
    findsCelebrated: [],
    sill: [],
    collection: {},
    letters: [],
    lettersSent: 0,
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
    rewardPicked: typeof raw.rewardPicked === 'number' && raw.rewardPicked >= 0 && raw.rewardPicked < 3 ? Math.floor(raw.rewardPicked) : null,
    feed: count(raw.feed),
    play: count(raw.play),
    bath: count(raw.bath),
  }
}

function isSillItem(value: string): value is ElfSillItem {
  return (SILL_ITEMS as readonly string[]).includes(value)
}

function normalizeCollection(raw: unknown): Partial<Record<ElfSillItem, number>> {
  const collection: Partial<Record<ElfSillItem, number>> = {}
  if (!isRecord(raw)) return collection
  for (const item of SILL_ITEMS) {
    const value = count(raw[item])
    if (value > 0) collection[item] = value
  }
  return collection
}

function normalizeLetter(raw: unknown): ElfLetter | null {
  if (!isRecord(raw) || typeof raw.day !== 'string') return null
  const kind = raw.kind === 'found' || raw.kind === 'invite' || raw.kind === 'forest' ? raw.kind : null
  if (!kind) return null
  return { n: count(raw.n), day: raw.day, kind, slug: typeof raw.slug === 'string' ? raw.slug : null, read: raw.read === true }
}

/* A stored state brought back to the shape above, or null when the entry
   is not an elf of this version (then the player starts with a fresh egg;
   the first prototype's version-1 saves are not carried over). Missing or
   broken fields take sane values so a schema tweak never loses the elf. */
export function normalizeElf(raw: unknown, now: number): ElfState | null {
  if (!isRecord(raw) || raw.version !== ELF_VERSION || typeof raw.name !== 'string' || !isRecord(raw.needs)) return null
  const name = raw.name.slice(0, NAME_MAX_LENGTH)
  const hatched = raw.hatched === true
  const starter = ELF_STARTERS.includes(raw.starter as ElfStarter) ? (raw.starter as ElfStarter) : null
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
    findsCredited: stringList(raw.findsCredited),
    findsCelebrated: stringList(raw.findsCelebrated),
    sill: stringList(raw.sill).filter(isSillItem).slice(0, SILL_SIZE),
    collection: normalizeCollection(raw.collection),
    letters: Array.isArray(raw.letters) ? raw.letters.map(normalizeLetter).filter((letter): letter is ElfLetter => letter !== null).slice(-LETTERS_KEPT) : [],
    lettersSent: count(raw.lettersSent),
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

/* The calendar days from one local day key to another (0 for the same
   day), whatever the clock changes between them. */
function calendarDaysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  return Math.round((Date.UTC(ty!, tm! - 1, td!) - Date.UTC(fy!, fm! - 1, fd!)) / 86400000)
}

/* The plant on the windowsill grows with the days together since the
   hatch: a seedling, then a sprout at a week, a small plant at a month, a
   bush at three months, in flower at half a year. */
export const PLANT_STAGE_DAYS = [0, 7, 30, 90, 180] as const

function plantStageOn(state: ElfState, day: string): number {
  if (!state.hatched) return 0
  const days = calendarDaysBetween(dayKey(state.born), day)
  let stage = 0
  PLANT_STAGE_DAYS.forEach((threshold, index) => {
    if (days >= threshold) stage = index
  })
  return stage
}

/* The plant's stage at a moment, 0..4. */
export function plantStageAt(state: ElfState, now: number): number {
  return plantStageOn(state, dayKey(now))
}

/* Letters come on the 2nd, 5th and 9th day together, then every week;
   how many are due by a number of days. */
const LETTER_DAYS = [2, 5, 9] as const
function lettersDueBy(days: number): number {
  const early = LETTER_DAYS.filter((day) => days >= day).length
  return early + (days > 9 ? Math.floor((days - 9) / 7) : 0)
}
const LETTERS_KEPT = 12

/* What the elf found on a day of the player's absence: chosen by the day
   and the elf's name, so it is the same however often the day is settled. */
function sillFindOn(day: string, name: string): ElfSillItem {
  return SILL_ITEMS[hashOf(`${day}:${name}`) % SILL_ITEMS.length]!
}

/* The longest absence the sill is filled for: a long one brings a full
   sill, not a heap. */
const SILL_FINDS_MAX = SILL_SIZE

/* Who writes the next letter: the odd ones (the first, the third...) come
   from a cottage found and not written from yet when there is one, the
   others are an invitation from the first of the cottages the app
   proposes (the ones not found, nearest first) that has not invited the
   elf yet, and the forest writes when there is neither. */
function nextLetter(state: ElfState, n: number, day: string, finds: readonly ElfFind[], invites: readonly string[]): ElfLetter {
  const written = new Set(state.letters.filter((letter) => letter.kind === 'found').map((letter) => letter.slug))
  const invited = new Set(state.letters.filter((letter) => letter.kind === 'invite').map((letter) => letter.slug))
  const fresh = [...finds].sort((a, b) => a.at - b.at).map((find) => find.slug).filter((slug) => !written.has(slug))
  const invite = invites.find((slug) => !invited.has(slug)) ?? invites[0] ?? null
  const pick = (kind: ElfLetterKind, slug: string | null): ElfLetter => ({ n, day, kind, slug, read: false })
  if (n % 2 === 1 && fresh.length > 0) return pick('found', fresh[0]!)
  if (invite) return pick('invite', invite)
  if (fresh.length > 0) return pick('found', fresh[0]!)
  return pick('forest', null)
}

/* The absence behind a new day: the things found for each day since the
   last visit (on the sill, newest first, and in the collection), the
   letter the schedule has due and whether the plant grew. An egg finds
   nothing and gets no letters; the first visit ever is no absence. */
function settleAbsence(previous: ElfState, state: ElfState, today: string, finds: readonly ElfFind[], invites: readonly string[]): { state: ElfState; away: ElfAway | null } {
  if (!state.hatched || previous.lastVisitDay === null) return { state, away: null }
  const days = Math.max(1, calendarDaysBetween(previous.lastVisitDay, today))
  const found: ElfSillItem[] = []
  const [y, m, d] = today.split('-').map(Number)
  for (let back = 0; back < Math.min(days, SILL_FINDS_MAX); back += 1) {
    const date = new Date(y!, m! - 1, d! - back)
    found.push(sillFindOn(dayKey(date.getTime()), state.name))
  }
  const collection = { ...state.collection }
  for (const item of found) collection[item] = (collection[item] ?? 0) + 1
  let next: ElfState = { ...state, sill: [...found, ...state.sill].slice(0, SILL_SIZE), collection }
  const due = lettersDueBy(calendarDaysBetween(dayKey(state.born), today))
  let letter: ElfLetter | null = null
  if (due > state.lettersSent) {
    letter = nextLetter(next, (state.letters[state.letters.length - 1]?.n ?? 0) + 1, today, finds, invites)
    next = { ...next, letters: [...next.letters, letter].slice(-LETTERS_KEPT), lettersSent: due }
  }
  const before = plantStageOn(state, previous.lastVisitDay)
  const after = plantStageOn(state, today)
  const plantStage = after > before ? after : null
  const card = days >= 2 || letter !== null || plantStage !== null
  return { state: next, away: { days, found, letter, plantStage, card } }
}

/* A letter read. */
export function readLetter(state: ElfState, n: number): ElfState {
  if (!state.letters.some((letter) => letter.n === n && !letter.read)) return state
  return { ...state, letters: state.letters.map((letter) => (letter.n === n ? { ...letter, read: true } : letter)) }
}

export type VisitOutcome = {
  state: ElfState
  /* The first visit of a calendar day. */
  newDay: boolean
  /* The streak that ended with the day missed, when one did. */
  streakLost: number | null
  /* The dust a streak milestone paid, 0 when none. */
  milestoneDust: number
  completed: ElfQuestPay[]
  setBonus: boolean
  /* Cottages found on an earlier day and not celebrated yet: the elf's
     cheer on the first visit after a find (never on the find's own day,
     which belongs to the expedition). */
  celebrate: string[]
  /* What the absence behind a new day brought, when it brought something. */
  away: ElfAway | null
}

/* The day the state lives in is the calendar's: on a new day the visit is
   counted (the streak grows by a day, breaks across a gap, pays at its
   milestones), the quests and the reward are dealt afresh and the care
   caps start over. */
function ensureDay(state: ElfState, now: number): { state: ElfState; newDay: boolean; streakLost: number | null; milestoneDust: number } {
  const day = dayKey(now)
  if (state.lastVisitDay === day) return { state, newDay: false, streakLost: null, milestoneDust: 0 }
  const yesterday = dayKey(previousDay(now))
  const continues = state.lastVisitDay === yesterday
  const streak = continues ? state.streak + 1 : 1
  const streakLost = !continues && state.lastVisitDay !== null && state.streak > 1 ? state.streak : null
  const milestoneDust = STREAK_MILESTONES[streak] ?? 0
  const next: ElfState = {
    ...state,
    lastVisitDay: day,
    streak,
    bestStreak: Math.max(state.bestStreak, streak),
    /* A deal already made for this day (a fresh elf's, a find credited to
       it before the first visit) is kept. */
    daily: state.daily.day === day ? state.daily : freshDaily(day, state.name, state.hatched),
    wallet: milestoneDust ? { ...state.wallet, dust: state.wallet.dust + milestoneDust } : state.wallet,
  }
  return { state: next, newDay: true, streakLost, milestoneDust }
}

/* What happened goes to the day's quests: the ones that count the event
   advance, a quest reaching its target pays its acorns, and the full set
   pays its grain of dust once. */
function recordEvent(state: ElfState, event: ElfEvent): { state: ElfState; completed: ElfQuestPay[]; setBonus: boolean } {
  const completed: ElfQuestPay[] = []
  let acorns = 0
  let dust = 0
  let changed = false
  const quests = state.daily.quests.map((quest) => {
    if (quest.done || quest.event !== event) return quest
    changed = true
    const progress = Math.min(quest.target, quest.progress + 1)
    const done = progress >= quest.target
    if (done) {
      completed.push({ id: quest.id, acorns: quest.acorns, dust: quest.dust })
      acorns += quest.acorns
      dust += quest.dust
    }
    return { ...quest, progress, done }
  })
  if (!changed) return { state, completed, setBonus: false }
  const setBonus = !state.daily.bonusGranted && quests.every((quest) => quest.done)
  const wallet = { acorns: state.wallet.acorns + acorns, dust: state.wallet.dust + dust + (setBonus ? QUEST_SET_DUST : 0) }
  return { state: { ...state, daily: { ...state.daily, quests, bonusGranted: state.daily.bonusGranted || setBonus }, wallet }, completed, setBonus }
}

/* The cottages found go to the day's quests: a find on the day the state
   still lives in counts for that day's find quest (a Saturday find seen on
   Sunday pays Saturday's quest, since the day only turns after this); a
   find on a weekend day the elf was never opened on, between that day and
   today, is paid the find quest's own reward outright, since the day it
   belongs to was never dealt; an older find is simply noted; one dated
   today, before the day has turned, or ahead of the clock waits. */
function creditFinds(state: ElfState, finds: readonly ElfFind[], today: string): { state: ElfState; completed: ElfQuestPay[]; setBonus: boolean } {
  let current = state
  const completed: ElfQuestPay[] = []
  let setBonus = false
  for (const find of finds) {
    if (current.findsCredited.includes(find.slug)) continue
    const day = dayKey(find.at)
    if (day > current.daily.day && day >= today) continue
    current = { ...current, findsCredited: [...current.findsCredited, find.slug] }
    if (day === current.daily.day) {
      const recorded = recordEvent(current, 'find')
      current = recorded.state
      completed.push(...recorded.completed)
      setBonus = setBonus || recorded.setBonus
    } else if (day > current.daily.day && isWeekend(day)) {
      const spec = QUEST_POOL.find((entry) => entry.id === 'findOne')!
      const pay = { id: spec.id, acorns: spec.acorns, dust: spec.dust ?? 0 }
      current = { ...current, wallet: { acorns: current.wallet.acorns + pay.acorns, dust: current.wallet.dust + pay.dust } }
      completed.push(pay)
    }
  }
  return { state: current, completed, setBonus }
}

/* A visit to the cottage: the day is settled, the visit counted for the
   quests (and the evening one after 18:00), and the cottages found on
   earlier days that the elf has not cheered for yet are handed back to
   celebrate. Call it whenever the tab comes into view. */
export function visit(state: ElfState, now: number, finds: readonly ElfFind[] = [], invites: readonly string[] = []): VisitOutcome {
  const settled = settleDay(state, now, finds, invites)
  const opened = recordEvent(settled.state, 'open')
  const evening = hourOf(now) >= EVENING_FROM_HOUR ? recordEvent(opened.state, 'evening') : { state: opened.state, completed: [], setBonus: false }
  const today = dayKey(now)
  /* Finds from before the egg appeared are the expedition's past, noted
     without a cheer: a veteran's first visit is the egg's, not a parade. */
  const celebrate = finds.filter((find) => find.at >= evening.state.eggAppearedAt && dayKey(find.at) < today && !evening.state.findsCelebrated.includes(find.slug)).map((find) => find.slug)
  const noted = finds.filter((find) => find.at < evening.state.eggAppearedAt && !evening.state.findsCelebrated.includes(find.slug)).map((find) => find.slug)
  const state_ = celebrate.length || noted.length ? { ...evening.state, findsCelebrated: [...evening.state.findsCelebrated, ...celebrate, ...noted] } : evening.state
  return {
    state: state_,
    newDay: settled.newDay,
    streakLost: settled.streakLost,
    milestoneDust: settled.milestoneDust,
    completed: [...settled.completed, ...opened.completed, ...evening.completed],
    setBonus: settled.setBonus || opened.setBonus || evening.setBonus,
    celebrate,
    away: settled.away,
  }
}

/* The day settled without a visit's events, for the app's tick and its
   actions: a day that turns while the elf is on screen, or that the hatch
   would otherwise consume, still reports its news (the new day, a streak
   lost, a milestone, what the absence brought), and the cottages found
   are credited to the day they belong to, before and after the turn.
   `invites` are the cottages the app proposes for an invitation (those
   not found, nearest first). */
export function settleDay(state: ElfState, now: number, finds: readonly ElfFind[] = [], invites: readonly string[] = []): VisitOutcome {
  const today = dayKey(now)
  const before = creditFinds(applyElapsed(state, now), finds, today)
  const day = ensureDay(before.state, now)
  const absence = day.newDay ? settleAbsence(before.state, day.state, today, finds, invites) : { state: day.state, away: null }
  const after = creditFinds(absence.state, finds, today)
  return {
    state: after.state,
    newDay: day.newDay,
    streakLost: day.streakLost,
    milestoneDust: day.milestoneDust,
    completed: [...before.completed, ...after.completed],
    setBonus: before.setBonus || after.setBonus,
    celebrate: [],
    away: absence.away,
  }
}

/* The day's reward, picked once: the option at the index goes to the
   purse and the pick is remembered, so the sheet can show the card turned. */
export function claimDailyReward(state: ElfState, index: number, now: number): ElfState {
  const settled = ensureDay(applyElapsed(state, now), now).state
  const option = settled.daily.rewardOptions[index]
  if (settled.daily.rewardPicked !== null || !option) return settled
  const wallet = { ...settled.wallet, [option.kind]: settled.wallet[option.kind] + option.amount }
  return { ...settled, daily: { ...settled.daily, rewardPicked: index }, wallet }
}

/* The next streak milestone above a streak, with the dust it pays; null
   past the last one. */
export function nextStreakMilestone(streak: number): { days: number; dust: number } | null {
  const days = Object.keys(STREAK_MILESTONES)
    .map(Number)
    .filter((day) => day > streak)
    .sort((a, b) => a - b)[0]
  return days === undefined ? null : { days, dust: STREAK_MILESTONES[days] ?? 0 }
}

/* ---------- Care ---------- */

/* Why a care action was refused: the day's cap for it is used up, or a
   belly too full for another feed. */
export type CareRefusal = 'cap' | 'full'

export type CareOutcome =
  | { kind: 'done'; state: ElfState; completed: ElfQuestPay[]; setBonus: boolean }
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

export type PetOutcome = { kind: 'petted'; state: ElfState; completed: ElfQuestPay[]; setBonus: boolean } | { kind: 'asleep' } | { kind: 'egg' }

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

export type EggOutcome = { state: ElfState; completed: ElfQuestPay[]; setBonus: boolean }

/* Warming or rocking the egg: care it remembers, and play the quests
   count; it hatches on its own time (hatchDue). */
export function tendEgg(state: ElfState, id: ElfEggAction, now: number): EggOutcome {
  if (state.hatched) return { state, completed: [], setBonus: false }
  const current = ensureDay(state, now).state
  const tended: ElfState = { ...current, warmth: clamp(current.warmth + EGG_WARMTH[id]), lastInteraction: now, last: now }
  return recordEvent(tended, 'egg')
}

/* When the egg hatches on its own, for a countdown; null once hatched. */
export function hatchAt(state: ElfState): number | null {
  return state.hatched ? null : state.eggAppearedAt + HATCH_AFTER_MS
}

/* The egg is ready to hatch six hours after it appeared, or the moment a
   cottage is found while it waits (a find from before it appeared is the
   expedition's past and does not count: a veteran gets the egg's wait
   like everyone). The hatch itself is the player's: the app calls hatch
   when the player cracks the ready egg. */
export function hatchDue(state: ElfState, now: number, finds: readonly ElfFind[]): boolean {
  return !state.hatched && (finds.some((find) => find.at >= state.eggAppearedAt) || now - state.eggAppearedAt >= HATCH_AFTER_MS)
}

/* The hatched elf named and given its element by the player; the app
   supplies the name a blank one falls back to, in the player's language. */
export function christen(state: ElfState, name: string, starter: ElfStarter): ElfState {
  return { ...state, name: name.trim().slice(0, NAME_MAX_LENGTH), starter }
}

export function hatch(state: ElfState, now: number): ElfState {
  if (state.hatched) return state
  const hatched: ElfState = { ...state, hatched: true, warmth: 100, born: now, needs: { ...HATCHED_NEEDS }, last: now, lastInteraction: now }
  const settled = ensureDay(hatched, now).state
  /* The day's deal stays through the hatch (what was done stays done and
     paid, the set's dust is paid once a day): only a quest about the egg
     that is still open, which the elf can no longer do, gives way to the
     first care quest not in the deal. The hatch is no second set. */
  const taken = new Set(settled.daily.quests.map((quest) => quest.id))
  const quests = settled.daily.quests.map((quest) => {
    if (quest.event !== 'egg' || quest.done) return quest
    const spare = QUEST_POOL.find((spec) => !spec.when && spec.stage === 'elf' && !taken.has(spec.id))
    if (!spare) return quest
    taken.add(spare.id)
    return questFrom(spare)
  })
  return { ...settled, daily: { ...settled.daily, quests }, sleeping: isAsleepAt({ ...settled, hatched: true }, now) }
}

/* ---------- Sleep ---------- */

export type SleepOutcome = { kind: 'slept' | 'woke'; state: ElfState; completed: ElfQuestPay[]; setBonus: boolean } | { kind: 'tooEarly' } | { kind: 'egg' }

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
export function placeDecor(state: ElfState, slotId: string, id: string, now: number): { state: ElfState; completed: ElfQuestPay[]; setBonus: boolean } {
  if (state.decor?.[slotId] === id) return { state, completed: [], setBonus: false }
  const current = ensureDay(state, now).state
  return recordEvent({ ...current, decor: { ...current.decor, [slotId]: id }, lastInteraction: now }, 'decor')
}
