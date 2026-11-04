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
   - Growth goes by the level: everything done together earns
     experience, the cottages found the most, and the next form opens at
     a level (young at 3, adult at 6, elder at 10); the elf never grows
     on its own, the player lets it grow (growUp), and a form ahead of
     its level can be bought in the shop (growNow). The levels also give
     the points of the tree of development.
   - Care has a pantry for the peddler's gifts (a treat, a toy, a soap):
     a gift is taken whatever the charges and the belly, with a little
     joy on top (performCare).
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

/* The tree of development, climbed with the points the levels give
   (see "Experience" below): a trunk every elf takes first, a fork into
   three branches (the belly, the smile, the eye), each branch forking
   again into two nodes that merge in a hearth, a fair or a camp, which
   the neighbouring branches also reach by a shortcut, and over each
   merge an archetype, the one choice that closes the other two. A node
   opens when any one of its parents is owned, so a route can cross from
   one branch to the next before it settles. */
export type ElfPath = 'glutton' | 'prankster' | 'tracker'
export const ELF_PATHS: readonly ElfPath[] = ['glutton', 'prankster', 'tracker']
export type ElfNodeId = 'roots' | 'belly' | 'smile' | 'eye' | 'pantry' | 'feast' | 'games' | 'party' | 'trail' | 'luck' | 'hearth' | 'fair' | 'camp' | ElfPath
export type ElfTreeNode = {
  id: ElfNodeId
  /* The row above the trunk, 1 at the bottom; the archetypes stand in the fifth. */
  row: 1 | 2 | 3 | 4 | 5
  /* The branch the node grows on; the trunk's node belongs to none. */
  branch: ElfPath | null
  /* Left (-1) or right (1) of the branch's line in a row of pairs, else on it. */
  side: -1 | 0 | 1
  /* Any one of them owned opens the node. */
  parents: readonly ElfNodeId[]
}
export const ELF_TREE: readonly ElfTreeNode[] = [
  { id: 'roots', row: 1, branch: null, side: 0, parents: [] },
  { id: 'belly', row: 2, branch: 'glutton', side: 0, parents: ['roots'] },
  { id: 'smile', row: 2, branch: 'prankster', side: 0, parents: ['roots'] },
  { id: 'eye', row: 2, branch: 'tracker', side: 0, parents: ['roots'] },
  { id: 'pantry', row: 3, branch: 'glutton', side: -1, parents: ['belly'] },
  { id: 'feast', row: 3, branch: 'glutton', side: 1, parents: ['belly'] },
  { id: 'games', row: 3, branch: 'prankster', side: -1, parents: ['smile'] },
  { id: 'party', row: 3, branch: 'prankster', side: 1, parents: ['smile'] },
  { id: 'trail', row: 3, branch: 'tracker', side: -1, parents: ['eye'] },
  { id: 'luck', row: 3, branch: 'tracker', side: 1, parents: ['eye'] },
  { id: 'hearth', row: 4, branch: 'glutton', side: 0, parents: ['pantry', 'feast', 'games'] },
  { id: 'fair', row: 4, branch: 'prankster', side: 0, parents: ['games', 'party', 'feast', 'trail'] },
  { id: 'camp', row: 4, branch: 'tracker', side: 0, parents: ['trail', 'luck', 'party'] },
  { id: 'glutton', row: 5, branch: 'glutton', side: 0, parents: ['hearth'] },
  { id: 'prankster', row: 5, branch: 'prankster', side: 0, parents: ['fair'] },
  { id: 'tracker', row: 5, branch: 'tracker', side: 0, parents: ['camp'] },
]
export function treeNode(id: ElfNodeId): ElfTreeNode {
  return ELF_TREE.find((node) => node.id === id)!
}
export type ElfRank = 'spark' | 'forester' | 'warden' | 'sage' | 'legend'

/* The tricks: bought for acorns, practised once a day until learned
   (the sessions each needs), then shown on demand; the app plays each
   as one of the elf's reactions. */
export type ElfTrickId = 'wave' | 'twirl' | 'bow' | 'cheer' | 'applause' | 'toast'
export type ElfTrickSpec = { id: ElfTrickId; acorns: number; sessions: number }
export const ELF_TRICKS: readonly ElfTrickSpec[] = [
  { id: 'wave', acorns: 40, sessions: 2 },
  { id: 'twirl', acorns: 60, sessions: 3 },
  { id: 'bow', acorns: 60, sessions: 3 },
  { id: 'cheer', acorns: 80, sessions: 3 },
  { id: 'applause', acorns: 80, sessions: 4 },
  { id: 'toast', acorns: 100, sessions: 4 },
]
export type ElfTrick = { sessions: number; day: string | null }

/* The games played from the couch (the app holds the boards): a few
   rounds a day each, a round paying acorns by its points, up to a cap,
   and experience. */
export type ElfGameId = 'acorns' | 'memory'
export const ELF_GAMES: readonly ElfGameId[] = ['acorns', 'memory']
export const GAME_PLAYS_PER_DAY = 3
export const GAME_ACORNS_MAX = 20
/* The points of a round that pay one acorn: two catches in the acorns'
   game, a point in memory. */
export const GAME_POINTS_PER_ACORN: Record<ElfGameId, number> = { acorns: 2, memory: 1 }
export type ElfGameRecord = { best: number; played: number }

/* The travelling peddler: three wares a day drawn from his basket, each
   for acorns and each once a day; a treat, a toy or a soap bring a
   care's charges back at once, a ticket adds a round to each game for
   the day, a grain of dust is a grain of dust, and a trick is one the
   elf has not got, a little under its price in the tricks' catalogue. */
export type ElfWareId = 'treat' | 'toy' | 'soap' | 'ticket' | 'dust' | 'trick'
export const ELF_WARES: readonly ElfWareId[] = ['treat', 'toy', 'soap', 'ticket', 'dust', 'trick']
export const WARES_A_DAY = 3
export type ElfWare = { id: ElfWareId; acorns: number; trick: ElfTrickId | null; bought: boolean }
export type ElfPeddler = { day: string; bought: ElfWareId[] }

/* The badges: what the elf and its family have done often enough, each
   with a reward to take once reached (acorns, or a grain or three of
   dust for the long ones). The counts live with the elf; the streak,
   the level, the archetype and the tricks are read from where they are. */
export type ElfCountId = 'feed' | 'play' | 'bath' | 'pet' | 'letters' | 'tricks' | 'games' | 'wares'
export type ElfCounts = Record<ElfCountId, number>
export type ElfBadgeId =
  | 'meals10'
  | 'meals100'
  | 'games10'
  | 'games50'
  | 'pets50'
  | 'baths10'
  | 'streak7'
  | 'streak30'
  | 'level5'
  | 'level10'
  | 'archetype'
  | 'tricks1'
  | 'tricksAll'
  | 'letters5'
  | 'wares10'
export type ElfBadgeSpec = { id: ElfBadgeId; target: number; reward: ElfReward }
export const ELF_BADGES: readonly ElfBadgeSpec[] = [
  { id: 'meals10', target: 10, reward: { kind: 'acorns', amount: 15 } },
  { id: 'baths10', target: 10, reward: { kind: 'acorns', amount: 15 } },
  { id: 'pets50', target: 50, reward: { kind: 'acorns', amount: 15 } },
  { id: 'games10', target: 10, reward: { kind: 'acorns', amount: 20 } },
  { id: 'letters5', target: 5, reward: { kind: 'acorns', amount: 15 } },
  { id: 'tricks1', target: 1, reward: { kind: 'acorns', amount: 10 } },
  { id: 'wares10', target: 10, reward: { kind: 'acorns', amount: 20 } },
  { id: 'level5', target: 5, reward: { kind: 'acorns', amount: 20 } },
  { id: 'streak7', target: 7, reward: { kind: 'dust', amount: 1 } },
  { id: 'meals100', target: 100, reward: { kind: 'dust', amount: 2 } },
  { id: 'games50', target: 50, reward: { kind: 'dust', amount: 2 } },
  { id: 'level10', target: 10, reward: { kind: 'dust', amount: 2 } },
  { id: 'archetype', target: 1, reward: { kind: 'dust', amount: 2 } },
  { id: 'tricksAll', target: 6, reward: { kind: 'dust', amount: 3 } },
  { id: 'streak30', target: 30, reward: { kind: 'dust', amount: 3 } },
]

export type ElfEggAction = 'warm' | 'rock'
export const ELF_EGG_ACTIONS: readonly ElfEggAction[] = ['warm', 'rock']

/* What the quests count: the care, a pet, a swap, the tuck-in, the egg
   tended, a visit, an evening visit, a cottage found in the field, and a
   game played. */
export type ElfEvent = ElfCareAction | 'pet' | 'decor' | 'sleep' | 'egg' | 'open' | 'evening' | 'find' | 'game'

export type ElfQuestId = 'feedOnce' | 'feedTwice' | 'playOnce' | 'bathOnce' | 'petFive' | 'petTen' | 'decorOne' | 'tuckIn' | 'eggThree' | 'evening' | 'open' | 'findOne' | 'gameOnce'

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
  /* How many rounds of each game were played today, and the rounds the
     peddler's ticket added to the day's cap. */
  games: Partial<Record<ElfGameId, number>>
  extraRounds: number
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
  /* The form the elf has grown to (the baby from the hatch; the next
     ones when the player lets it grow, growUp), and the form the app has
     shown the player last: a form reached since waits for its card. */
  form: ElfForm
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
  /* How much of the player's support (coffees and ads, as the support
     ledger counts them) the elf has thanked for, with its sip. */
  supportThanked: number
  /* The charges of each care spent and not yet back (the moments they
     were spent; each returns CARE[id].recharge later). */
  care: Record<ElfCareAction, number[]>
  /* The peddler's gifts in the pantry, one care each (a treat, a toy, a
     soap): a care the elf takes whatever its charges and its belly. */
  gifts: Record<ElfCareAction, number>
  /* The hatch bought before its hour (the moment it was bought), or null. */
  hatchReadyAt: number | null
  /* The rewarded ads watched on a day (the day's cap, DUST.adCap): for
     dust or for a skip alike. */
  ads: { day: string; count: number }
  /* The experience gathered (XP) and the nodes of the tree unlocked. */
  xp: number
  nodes: ElfNodeId[]
  /* The pieces bought in the shop for dust (slot:id), free of the finds. */
  items: string[]
  /* The tricks bought, with the practice they have had: the sessions
     done and the day of the last one. */
  tricks: Partial<Record<ElfTrickId, ElfTrick>>
  /* The games' records: the best points and the rounds played, ever. */
  games: Partial<Record<ElfGameId, ElfGameRecord>>
  /* The peddler's day and what was bought from him that day. */
  peddler: ElfPeddler
  /* How often things have happened, ever: the badges count them. */
  counts: ElfCounts
  /* The badges whose reward was taken. */
  badges: ElfBadgeId[]
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

/* Each care has a few charges; a charge spent comes back after its
   recharge (milliseconds), so three meals at once wait four hours
   together. */
const CARE: Record<ElfCareAction, { need: ElfNeedId; gain: number; charges: number; recharge: number }> = {
  feed: { need: 'fullness', gain: 25, charges: 3, recharge: 4 * 60 * 60 * 1000 },
  play: { need: 'joy', gain: 30, charges: 2, recharge: 6 * 60 * 60 * 1000 },
  bath: { need: 'clean', gain: 60, charges: 1, recharge: 12 * 60 * 60 * 1000 },
}
/* The care as the tree has it: the feast's bigger meals, the pantry's
   extra meal, the games' extra game, the party's bigger games, the
   camp's extra bath, the roots' quicker charges. */
function careSpec(state: ElfState, id: ElfCareAction): { need: ElfNeedId; gain: number; charges: number; recharge: number } {
  const base = CARE[id]
  const has = (node: ElfNodeId) => state.nodes.includes(node)
  return {
    need: base.need,
    gain: base.gain + (id === 'feed' && has('feast') ? 10 : 0) + (id === 'play' && has('party') ? 15 : 0),
    charges: base.charges + ((id === 'feed' && has('pantry')) || (id === 'play' && has('games')) || (id === 'bath' && has('camp')) ? 1 : 0),
    recharge: has('roots') ? base.recharge * 0.75 : base.recharge,
  }
}

/* The drift as the tree has it: a need eases half as fast with its node. */
function needTauDays(state: ElfState, need: ElfNeedId): number {
  const slower = (need === 'fullness' && state.nodes.includes('belly')) || (need === 'joy' && state.nodes.includes('smile'))
  return NEED_TAU_DAYS[need] * (slower ? 1.5 : 1)
}

/* The pieces the finds unlock, by slot and id: a piece stays locked in
   the decorating catalogue until this many cottages are found. Every
   place keeps one choice besides its default free from the start, so a
   new player can arrange the room at once; the rest come one or two at a
   time up to the eighth cottage. The ids are the app's catalogue's; the
   rules keep only the thresholds, and the shop (shopItems below) prices
   a locked piece from the same table. What a player placed before a lock
   existed is never taken away. */
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
export function decorFindsNeeded(slot: string, id: string, finds: number, granted: readonly string[] = []): number {
  if (granted.includes(`${slot}:${id}`)) return 0
  return Math.max(0, (DECOR_UNLOCKS[`${slot}:${id}`] ?? 0) - finds)
}

/* How many times a day each care is welcome, for the buttons to show,
   and which need each care answers, for the app to name the gain. */
export function careCharges(state: ElfState, id: ElfCareAction): number {
  return careSpec(state, id).charges
}
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

/* The forms past the first, by the level the elf must have reached
   before the player lets it grow (growUp); the cottages found feed the
   level through their experience. */
export const FORM_LEVELS: Record<Exclude<ElfForm, 'baby'>, number> = { young: 3, adult: 6, elder: 10 }
/* The joy a gift brings on top of its care. */
const GIFT_JOY = 5

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
  { id: 'gameOnce', event: 'game', target: 1, acorns: 8, stage: 'elf' },
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
  return { day, quests: dealQuests(day, name, hatched), bonusGranted: false, rewardOptions: dealRewards(day, name), rewardPicked: null, games: {}, extraRounds: 0 }
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
    form: 'baby',
    stageShown: null,
    findsCredited: [],
    findsCelebrated: [],
    sill: [],
    collection: {},
    letters: [],
    lettersSent: 0,
    supportThanked: 0,
    care: { feed: [], play: [], bath: [] },
    gifts: { feed: 0, play: 0, bath: 0 },
    hatchReadyAt: null,
    ads: { day: '', count: 0 },
    xp: 0,
    nodes: [],
    items: [],
    tricks: {},
    games: {},
    peddler: { day: '', bought: [] },
    counts: { ...NO_COUNTS },
    badges: [],
  }
}

function normalizeAds(raw: unknown): { day: string; count: number } {
  const record = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  return { day: typeof record.day === 'string' ? record.day : '', count: count(record.count) }
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
    games: normalizeGamePlays(raw.games),
    extraRounds: count(raw.extraRounds),
  }
}

/* The charges spent per care: only the moments survive. */
function normalizeCare(raw: unknown): Record<ElfCareAction, number[]> {
  const record = isRecord(raw) ? raw : {}
  const moments = (value: unknown) => (Array.isArray(value) ? value.filter((entry): entry is number => typeof entry === 'number' && Number.isFinite(entry)) : [])
  return { feed: moments(record.feed), play: moments(record.play), bath: moments(record.bath) }
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
  /* An elf stored before the forms went by level keeps the form it was shown last. */
  const form = ELF_FORMS.includes(raw.form as ElfForm) ? (raw.form as ElfForm) : (stageShown ?? 'baby')
  const gifts = isRecord(raw.gifts) ? raw.gifts : {}
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
    form,
    stageShown,
    findsCredited: stringList(raw.findsCredited),
    findsCelebrated: stringList(raw.findsCelebrated),
    sill: stringList(raw.sill).filter(isSillItem).slice(0, SILL_SIZE),
    collection: normalizeCollection(raw.collection),
    letters: Array.isArray(raw.letters) ? raw.letters.map(normalizeLetter).filter((letter): letter is ElfLetter => letter !== null).slice(-LETTERS_KEPT) : [],
    lettersSent: count(raw.lettersSent),
    supportThanked: count(raw.supportThanked),
    care: normalizeCare(raw.care),
    gifts: { feed: count(gifts.feed), play: count(gifts.play), bath: count(gifts.bath) },
    hatchReadyAt: typeof raw.hatchReadyAt === 'number' ? raw.hatchReadyAt : null,
    ads: normalizeAds(raw.ads),
    xp: count(raw.xp),
    nodes: stringList(raw.nodes).filter(isNodeId),
    items: stringList(raw.items),
    tricks: normalizeTricks(raw.tricks),
    games: normalizeGames(raw.games),
    peddler: normalizePeddler(raw.peddler),
    counts: normalizeCounts(raw.counts),
    badges: stringList(raw.badges).filter(isBadgeId),
  }
  const outfit = stringRecord(raw.outfit, WEARABLE_SLOT_IDS) as Partial<ElfOutfit> | undefined
  const decor = stringRecord(raw.decor)
  if (outfit) state.outfit = outfit
  if (decor) state.decor = decor
  return state
}

/* ---------- Time passing ---------- */

/* Whether the night takes the elf to sleep on its own and bedtime waits
   for the evening. A demo build turns this off (configureElfNight), so
   the elf sleeps only when tucked in and may be tucked in at any hour;
   nothing else reads the switch. */
let nightSleep = true
export function configureElfNight(enabled: boolean): void {
  nightSleep = enabled
}

/* Whether the elf may be tucked in at a moment: from the evening until
   the morning. Before that the sleep button answers 'tooEarly'; the scene
   lets the elf yawn and droop in this window, so the player sees it is
   bedtime. */
export function isBedtimeAt(at: number): boolean {
  return !nightSleep || hourOf(at) >= TUCK_IN_FROM_HOUR || isNightAt(at)
}

/* Whether the elf is asleep at a moment: woken by the player it stays up a
   few minutes; at night it sleeps; tucked in early it sleeps until the
   morning. */
export function isAsleepAt(state: ElfState, at: number): boolean {
  if (!state.hatched) return false
  if (state.wokenAt !== null && at >= state.wokenAt && at - state.wokenAt < DOZE_MS) return false
  if (nightSleep && isNightAt(at)) return true
  return state.tuckedAt !== null && at >= state.tuckedAt && at < nextMorning(state.tuckedAt)
}

/* The needs as they are now: the time since the last update, walked hour
   by hour so the night counts at half pace, applied as a drift towards the
   floor; and whether the elf sleeps now. An egg does not change. A clock
   turned back changes nothing but the mark. */
export function applyElapsed(state: ElfState, now: number): ElfState {
  if (now === state.last) return state
  if (!state.hatched || now < state.last) return { ...state, last: now }
  let awakeHours = 0
  let asleepHours = 0
  let at = state.last
  while (at < now) {
    const end = Math.min(now, Math.floor(at / HOUR_MS) * HOUR_MS + HOUR_MS)
    const hours = (end - at) / HOUR_MS
    if (isAsleepAt(state, at)) asleepHours += hours
    else awakeHours += hours
    at = end
  }
  const needs = { ...state.needs }
  for (const need of ELF_NEEDS) {
    /* Asleep, a need eases at half the rate; the hearth's fullness holds through the night. */
    const effectiveHours = awakeHours + asleepHours * (need === 'fullness' && state.nodes.includes('hearth') ? 0 : SLEEP_DRIFT_RATE)
    const distance = needs[need] - NEED_FLOOR
    needs[need] = distance > 0 ? NEED_FLOOR + distance * Math.exp(-effectiveHours / (needTauDays(state, need) * 24)) : needs[need]
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

/* The elf's form: an egg until it hatches, then the form it has grown to. */
export function stageOf(state: ElfState): ElfStage {
  return state.hatched ? state.form : 'egg'
}

/* The form reached but not yet shown, or null. */
export function pendingForm(state: ElfState): ElfForm | null {
  if (!state.hatched || state.form === state.stageShown) return null
  return state.form
}

export function markFormShown(state: ElfState, form: ElfForm): ElfState {
  return state.stageShown === form ? state : { ...state, stageShown: form }
}

/* The form after the current one, the level it asks for and whether the
   elf is there: null for the egg and the elder. */
export type ElfNextForm = { form: Exclude<ElfForm, 'baby'>; level: number; ready: boolean }

export function nextForm(state: ElfState): ElfNextForm | null {
  if (!state.hatched || state.form === 'elder') return null
  const form = state.form === 'baby' ? 'young' : state.form === 'young' ? 'adult' : 'elder'
  const level = FORM_LEVELS[form]
  return { form, level, ready: levelOf(state.xp) >= level }
}

/* Whether the elf may grow now: the next form's level is reached. */
export function growthReady(state: ElfState): boolean {
  return nextForm(state)?.ready ?? false
}

/* The elf grown to its next form, at the player's word; null when there
   is no form ahead or its level is not reached. The form's card waits
   on stageShown as a hatch's would. */
export function growUp(state: ElfState, now: number): ElfState | null {
  const next = nextForm(state)
  return next?.ready ? { ...state, form: next.form, lastInteraction: now } : null
}

/* The next form ahead of its level, bought: null when there is nothing
   to buy (no form ahead, or one the elf may grow to for free). */
export function growNow(state: ElfState, now: number): ElfState | null {
  const next = nextForm(state)
  return next && !next.ready ? { ...state, form: next.form, lastInteraction: now } : null
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
  for (let back = 0; back < Math.min(days + (state.nodes.includes('eye') ? 1 : 0), SILL_FINDS_MAX); back += 1) {
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
  return { ...state, letters: state.letters.map((letter) => (letter.n === n ? { ...letter, read: true } : letter)), xp: state.xp + XP.letter, counts: counted(state.counts, 'letters') }
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
  /* The trail's forgiving streak: one day missed does not break it. */
  const forgiven = state.nodes.includes('trail') && state.lastVisitDay === dayKey(previousDay(previousDay(now)))
  const continues = state.lastVisitDay === yesterday || forgiven
  const streak = continues ? state.streak + 1 : 1
  const streakLost = !continues && state.lastVisitDay !== null && state.streak > 1 ? state.streak : null
  const milestoneDust = (STREAK_MILESTONES[streak] ?? 0) * (state.nodes.includes('luck') ? 2 : 1)
  const next: ElfState = {
    ...state,
    lastVisitDay: day,
    streak,
    bestStreak: Math.max(state.bestStreak, streak),
    xp: state.xp + (continues ? XP.streakDay : 0),
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
      const pay = { id: quest.id, acorns: questAcorns(state, quest.acorns), dust: quest.dust }
      completed.push(pay)
      acorns += pay.acorns
      dust += pay.dust
    }
    return { ...quest, progress, done }
  })
  if (!changed) return { state, completed, setBonus: false }
  const setBonus = !state.daily.bonusGranted && quests.every((quest) => quest.done)
  const wallet = { acorns: state.wallet.acorns + acorns, dust: state.wallet.dust + dust + (setBonus ? QUEST_SET_DUST : 0) }
  const xp = state.xp + completed.length * XP.quest + (setBonus ? XP.questSet : 0)
  return { state: { ...state, daily: { ...state.daily, quests, bonusGranted: state.daily.bonusGranted || setBonus }, wallet, xp }, completed, setBonus }
}

/* A quest's acorns as the tree pays them: half as much again with the fair. */
function questAcorns(state: ElfState, acorns: number): number {
  return state.nodes.includes('fair') ? Math.ceil(acorns * 1.5) : acorns
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
    current = { ...current, findsCredited: [...current.findsCredited, find.slug], xp: current.xp + XP.find }
    if (day === current.daily.day) {
      const recorded = recordEvent(current, 'find')
      current = recorded.state
      completed.push(...recorded.completed)
      setBonus = setBonus || recorded.setBonus
    } else if (day > current.daily.day && isWeekend(day)) {
      const spec = QUEST_POOL.find((entry) => entry.id === 'findOne')!
      const pay = { id: spec.id, acorns: questAcorns(current, spec.acorns), dust: spec.dust ?? 0 }
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

/* Why a care action was refused: no charge of it is back yet, or a
   belly too full for another feed. */
export type CareRefusal = 'charging' | 'full'

export type CareOutcome =
  /* Done with a charge, or with a gift from the pantry (gift). */
  | { kind: 'done'; state: ElfState; completed: ElfQuestPay[]; setBonus: boolean; gift: boolean }
  | { kind: 'refused'; reason: CareRefusal }
  | { kind: 'asleep' }
  | { kind: 'egg' }

/* The charges of a care spent and not yet back at a moment (a moment
   from the future, after a clock change, counts as spent now). */
function spentCharges(state: ElfState, id: ElfCareAction, now: number): number[] {
  const { recharge } = careSpec(state, id)
  return state.care[id].filter((at) => now - at < recharge)
}

/* A care action: refused while the elf sleeps; otherwise a charge is
   spent and the need rises, or, with no charge back yet or (a feed) on a
   full belly, a gift from the pantry is given instead (the need rises
   and a little joy with it), and the quests hear of either; with neither
   the care is refused. */
export function performCare(state: ElfState, id: ElfCareAction, now: number): CareOutcome {
  if (!state.hatched) return { kind: 'egg' }
  const current = ensureDay(applyElapsed(state, now), now).state
  if (current.sleeping) return { kind: 'asleep' }
  const spec = careSpec(current, id)
  const spent = spentCharges(current, id, now)
  const refusal: CareRefusal | null = spent.length >= spec.charges ? 'charging' : id === 'feed' && current.needs.fullness >= FULL_AT ? 'full' : null
  const gift = refusal !== null
  if (gift && current.gifts[id] <= 0) return { kind: 'refused', reason: refusal }
  const needs = { ...current.needs, [spec.need]: clamp(current.needs[spec.need] + spec.gain) }
  if (gift) needs.joy = clamp(needs.joy + GIFT_JOY)
  const cared: ElfState = {
    ...current,
    needs,
    care: gift ? current.care : { ...current.care, [id]: [...spent, now] },
    gifts: gift ? { ...current.gifts, [id]: current.gifts[id] - 1 } : current.gifts,
    lastInteraction: now,
    xp: current.xp + XP.care,
    counts: counted(current.counts, id),
  }
  const recorded = recordEvent(cared, id)
  return { kind: 'done', ...recorded, gift }
}

/* The gifts of a care in the pantry. */
export function giftsLeft(state: ElfState, id: ElfCareAction): number {
  return state.gifts[id]
}

/* How many charges of a care are back. */
export function careLeft(state: ElfState, id: ElfCareAction, now: number): number {
  return Math.max(0, careSpec(state, id).charges - spentCharges(state, id, now).length)
}

/* When the next charge of a care is back; null with none spent. */
export function careNextAt(state: ElfState, id: ElfCareAction, now: number): number | null {
  const spent = spentCharges(state, id, now)
  return spent.length ? Math.min(...spent.map((at) => Math.min(at, now))) + careSpec(state, id).recharge : null
}

/* Every charge of a care back at once (a refill bought). */
export function refillCare(state: ElfState, id: ElfCareAction): ElfState {
  return state.care[id].length ? { ...state, care: { ...state.care, [id]: [] } } : state
}

export type PetOutcome = { kind: 'petted'; state: ElfState; completed: ElfQuestPay[]; setBonus: boolean } | { kind: 'asleep' } | { kind: 'egg' }

/* A tap on the elf: a little joy, always welcome while it is awake. The
   cooldown between taps is the caller's (PET_COOLDOWN_MS). */
export function pet(state: ElfState, now: number): PetOutcome {
  if (!state.hatched) return { kind: 'egg' }
  const current = ensureDay(applyElapsed(state, now), now).state
  if (current.sleeping) return { kind: 'asleep' }
  const needs = { ...current.needs, joy: clamp(current.needs.joy + PET_JOY) }
  const recorded = recordEvent({ ...current, needs, lastInteraction: now, counts: counted(current.counts, 'pet') }, 'pet')
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

/* When the egg hatches on its own (or, bought, at once), for a
   countdown; null once hatched. */
export function hatchAt(state: ElfState): number | null {
  if (state.hatched) return null
  const natural = state.eggAppearedAt + HATCH_AFTER_MS
  return state.hatchReadyAt === null ? natural : Math.min(natural, state.hatchReadyAt)
}

/* The egg is ready to hatch six hours after it appeared, or the moment a
   cottage is found while it waits (a find from before it appeared is the
   expedition's past and does not count: a veteran gets the egg's wait
   like everyone), or at once when the wait was bought. The hatch itself
   is the player's: the app calls hatch when the player cracks the ready
   egg. */
export function hatchDue(state: ElfState, now: number, finds: readonly ElfFind[]): boolean {
  const at = hatchAt(state)
  return at !== null && (finds.some((find) => find.at >= state.eggAppearedAt) || now >= at)
}

/* The egg's wait bought: ready from now on. */
export function skipHatch(state: ElfState, now: number): ElfState | null {
  const at = hatchAt(state)
  return at === null || at <= now ? null : { ...state, hatchReadyAt: now }
}

/* The hatched elf named and given its element by the player; the app
   supplies the name a blank one falls back to, in the player's language. */
export function christen(state: ElfState, name: string, starter: ElfStarter): ElfState {
  return { ...state, name: name.trim().slice(0, NAME_MAX_LENGTH), starter }
}

export function hatch(state: ElfState, now: number): ElfState {
  if (state.hatched) return state
  const hatched: ElfState = { ...state, hatched: true, form: 'baby', warmth: 100, born: now, needs: { ...HATCHED_NEEDS }, last: now, lastInteraction: now }
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
  const tucked: ElfState = { ...current, sleeping: true, tuckedAt: now, wokenAt: null, lastInteraction: now, xp: current.xp + XP.sleep }
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

/* ---------- Star dust as the premium currency ---------- */

/* What the dust is earned and spent in: a rewarded ad pays `ad` dust,
   and any ad (for dust or for a skip) counts towards `adCap` a day; the
   skips cost their price (the hatch before its hour, a care's charges
   before their time, a form before its days), or one ad; the store's
   packs (the app's product ids) add what they say. */
export const DUST = { ad: 5, adCap: 3, hatchSkip: 20, careRefill: 5, growNow: 30 } as const

/* The waits that can be bought, and what each costs in dust. */
export type ElfSkip = 'hatch' | ElfCareAction | 'grow'
export const ELF_SKIPS: readonly ElfSkip[] = ['hatch', 'feed', 'play', 'bath', 'grow']
export const SKIP_COST: Record<ElfSkip, number> = { hatch: DUST.hatchSkip, feed: DUST.careRefill, play: DUST.careRefill, bath: DUST.careRefill, grow: DUST.growNow }

/* How many rewarded ads may still be watched today. */
export function adsLeft(state: ElfState, now: number): number {
  return state.ads.day === dayKey(now) ? Math.max(0, DUST.adCap - state.ads.count) : DUST.adCap
}

/* An ad watched to the end, counted against the day's cap; null past it. */
export function recordAd(state: ElfState, now: number): ElfState | null {
  if (adsLeft(state, now) <= 0) return null
  const day = dayKey(now)
  return { ...state, ads: { day, count: (state.ads.day === day ? state.ads.count : 0) + 1 } }
}

/* An ad watched for dust: its dust, within the day's cap. */
export function earnAdDust(state: ElfState, now: number): { state: ElfState; earned: number } {
  const counted = recordAd(state, now)
  return counted ? { state: addDust(counted, DUST.ad), earned: DUST.ad } : { state, earned: 0 }
}

/* A wait skipped (paid for already, in dust or with an ad): the state
   without it, or null when there was nothing to skip. */
export function applySkip(state: ElfState, kind: ElfSkip, now: number): ElfState | null {
  if (kind === 'hatch') return skipHatch(state, now)
  if (kind === 'grow') return growNow(state, now)
  return careLeft(state, kind, now) >= careSpec(state, kind).charges ? null : refillCare(state, kind)
}

/* Dust bought as a pack (or granted), any amount. */
export function addDust(state: ElfState, amount: number): ElfState {
  return amount > 0 ? { ...state, wallet: { ...state.wallet, dust: state.wallet.dust + amount } } : state
}

/* Dust spent on a skip: the state with less, or null when there is not enough. */
export function spendDust(state: ElfState, cost: number): ElfState | null {
  return state.wallet.dust >= cost ? { ...state, wallet: { ...state.wallet, dust: state.wallet.dust - cost } } : null
}

/* ---------- Experience, levels, the tree and the ranks ---------- */

/* What experience comes from: a cottage found (the most), a quest done,
   the full set, each day a streak goes on, a care given, a letter read,
   the elf tucked in, a trick practised, a game played. */
export const XP = { find: 40, quest: 8, questSet: 15, streakDay: 5, care: 2, letter: 10, sleep: 3, trick: 4, game: 5 } as const

/* The experience a level starts at: 0, 40, 120, 240, 400, 600... (each
   level forty more than the last), so the early levels come fast and the
   later ones ask for the cottages. */
export function xpForLevel(level: number): number {
  return 20 * (level - 1) * level
}

export function levelOf(xp: number): number {
  return Math.max(1, Math.floor((1 + Math.sqrt(1 + xp / 5)) / 2))
}

/* The rank by level, for the elf's name and the ranking. */
export function rankOf(level: number): ElfRank {
  if (level >= 12) return 'legend'
  if (level >= 9) return 'sage'
  if (level >= 6) return 'warden'
  if (level >= 3) return 'forester'
  return 'spark'
}

/* Every level past the first gives a point; a node costs one. */
export function pointsLeft(state: ElfState): number {
  return Math.max(0, levelOf(state.xp) - 1 - state.nodes.length)
}

function isNodeId(value: string): value is ElfNodeId {
  return ELF_TREE.some((node) => node.id === value)
}

/* The piece each archetype grants, free of the finds. */
const TREE_ITEMS: Partial<Record<ElfNodeId, string>> = {
  glutton: 'candle:cauldron',
  prankster: 'bed:hammock',
  tracker: 'picture:antlers',
}

/* The pieces the player has free of the finds: the tree's grants and the shop's purchases (slot:id). */
export function grantedItems(state: ElfState): string[] {
  return [...state.nodes.flatMap((node) => (TREE_ITEMS[node] ? [TREE_ITEMS[node]!] : [])), ...state.items]
}

/* ---------- The shop's pieces ---------- */

/* A piece the finds have not unlocked yet can be bought for dust instead:
   ten dust per cottage of its threshold, fifteen at least. */
export const ITEM_DUST_PER_FIND = 10
export const ITEM_DUST_MIN = 15
export type ElfShopItem = { slot: string; id: string; finds: number; cost: number }

export function itemDust(slot: string, id: string): number {
  return Math.max(ITEM_DUST_MIN, (DECOR_UNLOCKS[`${slot}:${id}`] ?? 0) * ITEM_DUST_PER_FIND)
}

/* The pieces on sale: those the finds still lock and neither the tree
   nor a purchase has given, in the order of the unlock table, each with
   the cottages it still needs and its price. */
export function shopItems(state: ElfState, finds: number): ElfShopItem[] {
  const granted = grantedItems(state)
  return Object.keys(DECOR_UNLOCKS).flatMap((key) => {
    const [slot, id] = key.split(':') as [string, string]
    const left = decorFindsNeeded(slot, id, finds, granted)
    return left > 0 ? [{ slot, id, finds: left, cost: itemDust(slot, id) }] : []
  })
}

/* A piece bought: null when it is not on sale or the dust is short. */
export function buyItem(state: ElfState, slot: string, id: string, finds: number): ElfState | null {
  if (!shopItems(state, finds).some((item) => item.slot === slot && item.id === id)) return null
  const paid = spendDust(state, itemDust(slot, id))
  return paid ? { ...paid, items: [...paid.items, `${slot}:${id}`] } : null
}

/* The archetype chosen, the one node of the fifth row owned. */
export function archetypeOf(state: ElfState): ElfPath | null {
  return ELF_PATHS.find((path) => state.nodes.includes(path)) ?? null
}

/* Where a node stands: owned, open (a parent owned, whether or not a
   point is at hand), locked behind its parents, or taken, an archetype
   closed by the one already chosen. */
export type ElfNodeStatus = 'owned' | 'open' | 'locked' | 'taken'

export function nodeStatus(state: ElfState, id: ElfNodeId): ElfNodeStatus {
  if (state.nodes.includes(id)) return 'owned'
  const node = treeNode(id)
  if (node.row === 5 && archetypeOf(state)) return 'taken'
  return node.parents.length === 0 || node.parents.some((parent) => state.nodes.includes(parent)) ? 'open' : 'locked'
}

/* A node unlocked for a point: null without a point or out of order. */
export function unlockNode(state: ElfState, id: ElfNodeId): ElfState | null {
  if (pointsLeft(state) <= 0 || nodeStatus(state, id) !== 'open') return null
  return { ...state, nodes: [...state.nodes, id] }
}

/* The elf has thanked for the player's support up to `total` (the
   support ledger's count); the thanks itself is the app's sip. */
export function thankSupport(state: ElfState, total: number): ElfState {
  return total > state.supportThanked ? { ...state, supportThanked: total } : state
}

/* ---------- Tricks ---------- */

export function trickSpec(id: ElfTrickId): ElfTrickSpec {
  return ELF_TRICKS.find((trick) => trick.id === id)!
}

function isTrickId(value: string): value is ElfTrickId {
  return ELF_TRICKS.some((trick) => trick.id === value)
}

function normalizeTricks(raw: unknown): Partial<Record<ElfTrickId, ElfTrick>> {
  const tricks: Partial<Record<ElfTrickId, ElfTrick>> = {}
  if (!isRecord(raw)) return tricks
  for (const [id, value] of Object.entries(raw)) {
    if (isTrickId(id) && isRecord(value)) tricks[id] = { sessions: count(value.sessions), day: typeof value.day === 'string' ? value.day : null }
  }
  return tricks
}

/* Where a trick stands: not bought, in practice, or learned. */
export type ElfTrickStatus = 'unowned' | 'learning' | 'learned'

export function trickStatus(state: ElfState, id: ElfTrickId): ElfTrickStatus {
  const trick = state.tricks[id]
  if (!trick) return 'unowned'
  return trick.sessions >= trickSpec(id).sessions ? 'learned' : 'learning'
}

/* Acorns spent: the state with less, or null when there are not enough. */
export function spendAcorns(state: ElfState, cost: number): ElfState | null {
  return state.wallet.acorns >= cost ? { ...state, wallet: { ...state.wallet, acorns: state.wallet.acorns - cost } } : null
}

/* A trick bought: null when owned already or the acorns are short. */
export function buyTrick(state: ElfState, id: ElfTrickId): ElfState | null {
  if (state.tricks[id]) return null
  const paid = spendAcorns(state, trickSpec(id).acorns)
  return paid ? { ...paid, tricks: { ...paid.tricks, [id]: { sessions: 0, day: null } } } : null
}

/* Whether a trick had its practice today. */
export function trickTrainedToday(state: ElfState, id: ElfTrickId, now: number): boolean {
  return state.tricks[id]?.day === dayKey(now)
}

/* The tricks in learning that still wait for today's practice. */
export function tricksToTrain(state: ElfState, now: number): ElfTrickId[] {
  return ELF_TRICKS.filter((trick) => trickStatus(state, trick.id) === 'learning' && !trickTrainedToday(state, trick.id, now)).map((trick) => trick.id)
}

export type TrickOutcome = { kind: 'trained' | 'learned'; state: ElfState } | { kind: 'asleep' } | { kind: 'done' }

/* A practice session: once a day for a trick in learning, by an awake
   elf; it pays its experience, and the last session learns the trick. */
export function trainTrick(state: ElfState, id: ElfTrickId, now: number): TrickOutcome | null {
  const trick = state.tricks[id]
  if (!trick || trickStatus(state, id) === 'learned') return null
  const current = ensureDay(applyElapsed(state, now), now).state
  if (current.sleeping) return { kind: 'asleep' }
  if (trickTrainedToday(current, id, now)) return { kind: 'done' }
  const sessions = trick.sessions + 1
  const next: ElfState = { ...current, tricks: { ...current.tricks, [id]: { sessions, day: dayKey(now) } }, lastInteraction: now, xp: current.xp + XP.trick, counts: counted(current.counts, 'tricks') }
  return { kind: sessions >= trickSpec(id).sessions ? 'learned' : 'trained', state: next }
}

/* ---------- Games ---------- */

function isGameId(value: string): value is ElfGameId {
  return (ELF_GAMES as readonly string[]).includes(value)
}

function normalizeGamePlays(raw: unknown): Partial<Record<ElfGameId, number>> {
  const plays: Partial<Record<ElfGameId, number>> = {}
  if (!isRecord(raw)) return plays
  for (const [id, value] of Object.entries(raw)) if (isGameId(id)) plays[id] = count(value)
  return plays
}

function normalizeGames(raw: unknown): Partial<Record<ElfGameId, ElfGameRecord>> {
  const games: Partial<Record<ElfGameId, ElfGameRecord>> = {}
  if (!isRecord(raw)) return games
  for (const [id, value] of Object.entries(raw)) {
    if (isGameId(id) && isRecord(value)) games[id] = { best: count(value.best), played: count(value.played) }
  }
  return games
}

/* The rounds of a game still open today. */
export function gamePlaysLeft(state: ElfState, id: ElfGameId, now: number): number {
  const daily = state.daily.day === dayKey(now) ? state.daily : null
  return Math.max(0, GAME_PLAYS_PER_DAY + (daily?.extraRounds ?? 0) - (daily?.games[id] ?? 0))
}

/* The acorns a round pays for its points: the game's rate, up to the
   cap, half as much again with the fair. */
export function gameAcorns(state: ElfState, id: ElfGameId, points: number): number {
  return questAcorns(state, Math.max(0, Math.min(GAME_ACORNS_MAX, Math.floor(points / GAME_POINTS_PER_ACORN[id]))))
}

export type GameOutcome = { state: ElfState; acorns: number; xp: number; best: boolean; completed: ElfQuestPay[]; setBonus: boolean }

/* A round played, with its points: the acorns and the experience paid,
   the record kept, the day's quests told; null when the day's rounds of
   that game are used up. */
export function recordGame(state: ElfState, id: ElfGameId, points: number, now: number): GameOutcome | null {
  const current = ensureDay(applyElapsed(state, now), now).state
  if (gamePlaysLeft(current, id, now) <= 0) return null
  const acorns = gameAcorns(current, id, points)
  const record = current.games[id] ?? { best: 0, played: 0 }
  const best = record.played > 0 && points > record.best
  const played: ElfState = {
    ...current,
    daily: { ...current.daily, games: { ...current.daily.games, [id]: (current.daily.games[id] ?? 0) + 1 } },
    games: { ...current.games, [id]: { best: Math.max(record.best, Math.floor(points)), played: record.played + 1 } },
    wallet: { ...current.wallet, acorns: current.wallet.acorns + acorns },
    xp: current.xp + XP.game,
    lastInteraction: now,
    counts: counted(current.counts, 'games'),
  }
  const recorded = recordEvent(played, 'game')
  return { state: recorded.state, acorns, xp: XP.game, best, completed: recorded.completed, setBonus: recorded.setBonus }
}

/* ---------- The peddler ---------- */

const WARE_ACORNS: Record<Exclude<ElfWareId, 'trick'>, number> = { treat: 20, toy: 25, soap: 30, ticket: 15, dust: 60 }
/* The peddler's trick costs this much less than the catalogue. */
const TRICK_WARE_OFF = 10

function isWareId(value: string): value is ElfWareId {
  return (ELF_WARES as readonly string[]).includes(value)
}

function normalizePeddler(raw: unknown): ElfPeddler {
  if (!isRecord(raw)) return { day: '', bought: [] }
  return { day: typeof raw.day === 'string' ? raw.day : '', bought: stringList(raw.bought).filter(isWareId) }
}

/* The day's wares: three of the basket drawn by the day (the same on
   every device, different from the day before), the trick among them
   only while the elf has one still to buy, with what was bought today. */
export function peddlerWares(state: ElfState, now: number): ElfWare[] {
  const day = dayKey(now)
  const unowned = ELF_TRICKS.filter((trick) => !state.tricks[trick.id])
  const pool = unowned.length ? ELF_WARES : ELF_WARES.filter((id) => id !== 'trick')
  const picked: ElfWareId[] = []
  let seed = hashOf(`${day}|${state.born}|peddler`)
  while (picked.length < WARES_A_DAY && picked.length < pool.length) {
    const id = pool[seed % pool.length]!
    if (!picked.includes(id)) picked.push(id)
    seed = hashOf(`${seed}`)
  }
  const trick = unowned.length ? unowned[hashOf(`${day}|${state.born}|trick`) % unowned.length]!.id : null
  const bought = state.peddler.day === day ? state.peddler.bought : []
  return picked.map((id) => ({
    id,
    acorns: id === 'trick' && trick ? Math.max(10, trickSpec(trick).acorns - TRICK_WARE_OFF) : WARE_ACORNS[id as Exclude<ElfWareId, 'trick'>],
    trick: id === 'trick' ? trick : null,
    bought: bought.includes(id),
  }))
}

/* Whether the peddler still has something unbought today. */
export function peddlerFresh(state: ElfState, now: number): boolean {
  return peddlerWares(state, now).some((ware) => !ware.bought)
}

/* A ware bought: null when it is not on offer today, bought already or
   the acorns are short; the ware does what it does at once. */
export function buyWare(state: ElfState, id: ElfWareId, now: number): ElfState | null {
  const current = ensureDay(applyElapsed(state, now), now).state
  const ware = peddlerWares(current, now).find((offer) => offer.id === id)
  if (!ware || ware.bought) return null
  const paid = spendAcorns(current, ware.acorns)
  if (!paid) return null
  const day = dayKey(now)
  let next: ElfState = { ...paid, peddler: { day, bought: [...(paid.peddler.day === day ? paid.peddler.bought : []), id] }, lastInteraction: now, counts: counted(paid.counts, 'wares') }
  if (id === 'treat') next = { ...next, gifts: { ...next.gifts, feed: next.gifts.feed + 1 } }
  else if (id === 'toy') next = { ...next, gifts: { ...next.gifts, play: next.gifts.play + 1 } }
  else if (id === 'soap') next = { ...next, gifts: { ...next.gifts, bath: next.gifts.bath + 1 } }
  else if (id === 'ticket') next = { ...next, daily: { ...next.daily, extraRounds: next.daily.extraRounds + 1 } }
  else if (id === 'dust') next = addDust(next, 1)
  else if (ware.trick && !next.tricks[ware.trick]) next = { ...next, tricks: { ...next.tricks, [ware.trick]: { sessions: 0, day: null } } }
  return next
}

/* ---------- The badges ---------- */

const NO_COUNTS: ElfCounts = { feed: 0, play: 0, bath: 0, pet: 0, letters: 0, tricks: 0, games: 0, wares: 0 }

function counted(counts: ElfCounts, id: ElfCountId): ElfCounts {
  return { ...counts, [id]: counts[id] + 1 }
}

function normalizeCounts(raw: unknown): ElfCounts {
  const counts = { ...NO_COUNTS }
  if (!isRecord(raw)) return counts
  for (const id of Object.keys(NO_COUNTS) as ElfCountId[]) counts[id] = count(raw[id])
  return counts
}

function isBadgeId(value: string): value is ElfBadgeId {
  return ELF_BADGES.some((badge) => badge.id === value)
}

export function badgeSpec(id: ElfBadgeId): ElfBadgeSpec {
  return ELF_BADGES.find((badge) => badge.id === id)!
}

/* How far a badge has come, in its own count. */
export function badgeProgress(state: ElfState, id: ElfBadgeId): number {
  switch (id) {
    case 'meals10':
    case 'meals100':
      return state.counts.feed
    case 'baths10':
      return state.counts.bath
    case 'pets50':
      return state.counts.pet
    case 'games10':
    case 'games50':
      return state.counts.games
    case 'letters5':
      return state.counts.letters
    case 'wares10':
      return state.counts.wares
    case 'tricks1':
    case 'tricksAll':
      return ELF_TRICKS.filter((trick) => trickStatus(state, trick.id) === 'learned').length
    case 'streak7':
    case 'streak30':
      return state.bestStreak
    case 'level5':
    case 'level10':
      return levelOf(state.xp)
    case 'archetype':
      return archetypeOf(state) ? 1 : 0
  }
}

/* Where a badge stands: still to reach, reached with its reward waiting, or taken. */
export type ElfBadgeStatus = 'locked' | 'earned' | 'claimed'

export function badgeStatus(state: ElfState, id: ElfBadgeId): ElfBadgeStatus {
  if (state.badges.includes(id)) return 'claimed'
  return badgeProgress(state, id) >= badgeSpec(id).target ? 'earned' : 'locked'
}

/* The badges reached whose reward still waits. */
export function badgesToClaim(state: ElfState): ElfBadgeId[] {
  return ELF_BADGES.filter((badge) => badgeStatus(state, badge.id) === 'earned').map((badge) => badge.id)
}

/* A badge's reward taken: null unless the badge is reached and untaken. */
export function claimBadge(state: ElfState, id: ElfBadgeId): ElfState | null {
  if (badgeStatus(state, id) !== 'earned') return null
  const { reward } = badgeSpec(id)
  const wallet = reward.kind === 'acorns' ? { ...state.wallet, acorns: state.wallet.acorns + reward.amount } : { ...state.wallet, dust: state.wallet.dust + reward.amount }
  return { ...state, wallet, badges: [...state.badges, id] }
}

/* ---------- Reminders ---------- */

/* What the app may tell the player while it is closed, as a reaction to
   something happening in the cottage, never at a time the player picks:
   the egg ready to hatch (at that moment), the elf reaching a form by time
   alone, a letter come, the plant grown (on their day), and the day's new
   quests and reward (only on the first days after a visit, while the
   player has not come by yet). At most one a day, the most important of
   the day's (egg, form, letter, plant, then the quests; an event inside
   the days of the daily reminder mentions the quests too); never at night
   (an egg ready in the night waits for the morning); nothing on a day a
   cottage was found, which belongs to the expedition. The daily one comes
   at the player's own hour (the app learns it from the visits), so does
   an event of a day; four weeks after the last visit the cottage falls
   silent until the player comes back. The app schedules the list when it goes to the
   background and drops it when it comes back. */
export type ElfReminderKind = 'egg' | 'letter' | 'plant' | 'day'
export type ElfReminder = {
  at: number
  kind: ElfReminderKind
  /* The day's quests are new and the player has not come by yet. */
  quests: boolean
}

/* The night the reminders keep, minutes of the local day. */
export const REMINDER_QUIET = { from: 21 * 60, to: 8 * 60 } as const
/* The day's reminder comes on this many days after the last visit, then
   only the events do. */
export const REMINDER_DAILY_DAYS = 3
const REMINDER_HORIZON_DAYS = 60
/* After this many days without a visit nothing more is told. */
const REMINDER_AWAY_DAYS = 28
const REMINDERS_MAX = 8
const REMINDER_RANK: Record<ElfReminderKind, number> = { egg: 5, letter: 3, plant: 2, day: 1 }

/* The local moment of a day at a minute of it. */
function atMinute(day: string, minute: number): number {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y!, m! - 1, d!, 0, minute).getTime()
}

/* A moment moved out of the night: before the morning to the morning,
   after the evening to the next morning. */
function outOfQuiet(ms: number): number {
  const date = new Date(ms)
  const minute = date.getHours() * 60 + date.getMinutes()
  if (minute >= REMINDER_QUIET.to && minute < REMINDER_QUIET.from) return ms
  const day = minute < REMINDER_QUIET.to ? dayKey(ms) : dayKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime())
  return atMinute(day, REMINDER_QUIET.to)
}

export function elfReminders(state: ElfState, now: number, finds: readonly ElfFind[], habitMinute: number): ElfReminder[] {
  const today = dayKey(now)
  const lastVisit = state.lastVisitDay ?? today
  const minute = Math.min(REMINDER_QUIET.from - 30, Math.max(REMINDER_QUIET.to, Math.round(habitMinute)))
  const candidates: ElfReminder[] = []
  const [y, m, d] = today.split('-').map(Number)
  const dayAt = (offset: number) => dayKey(new Date(y!, m! - 1, d! + offset).getTime())
  /* The egg: at the moment it is ready. */
  const ready = hatchAt(state)
  if (ready !== null && ready > now) candidates.push({ at: outOfQuiet(ready), kind: 'egg', quests: false })
  const visitedToday = lastVisit === today
  for (let offset = 0; offset <= REMINDER_HORIZON_DAYS; offset += 1) {
    const day = dayAt(offset)
    const before = dayAt(offset - 1)
    const at = atMinute(day, minute)
    /* Today's events are the visit's when the player came by already. */
    const open = offset > 0 || !visitedToday
    const away = calendarDaysBetween(lastVisit, day)
    if (away > REMINDER_AWAY_DAYS) break
    const quests = open && away >= 1 && away <= REMINDER_DAILY_DAYS
    if (state.hatched && open) {
      const daysOld = calendarDaysBetween(dayKey(state.born), day)
      const due = lettersDueBy(daysOld)
      if (due > lettersDueBy(daysOld - 1) && (offset > 0 || due > state.lettersSent)) candidates.push({ at, kind: 'letter', quests })
      if (plantStageOn(state, day) > plantStageOn(state, before)) candidates.push({ at, kind: 'plant', quests })
    }
    if (quests && (state.hatched || hatchDue(state, at, finds))) candidates.push({ at, kind: 'day', quests: true })
  }
  /* One a day, the most important; none on the day of a find. */
  const foundToday = finds.some((find) => dayKey(find.at) === today)
  const byDay = new Map<string, ElfReminder>()
  for (const candidate of candidates) {
    if (candidate.at <= now) continue
    const day = dayKey(candidate.at)
    if (foundToday && day === today) continue
    const held = byDay.get(day)
    const quests = (held?.quests ?? false) || candidate.quests
    if (!held || REMINDER_RANK[candidate.kind] > REMINDER_RANK[held.kind]) byDay.set(day, { ...candidate, quests: candidate.kind === 'day' || quests })
    else byDay.set(day, { ...held, quests: held.kind === 'day' || quests })
  }
  return [...byDay.values()].sort((a, b) => a.at - b.at).slice(0, REMINDERS_MAX)
}
