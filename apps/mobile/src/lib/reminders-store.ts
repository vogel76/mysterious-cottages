import { STORAGE_KEYS } from '../config'
import { readJson, writeJson } from './storage'

/* The elf's reminders on this device: whether the player was asked (the
   elf asks once) and wants them, and the minute of the day of the first
   visit of the last days, from which the daily reminder takes the
   player's own hour. The same shape as the support ledger
   (support-store.ts): one read of AsyncStorage, one snapshot, subscribers
   re-rendered on a change; the hooks live in src/features/elf. */

export type ReminderPrefs = {
  asked: boolean
  enabled: boolean
  /* The first visit of each of the last days: the day and its minute. */
  visits: ReadonlyArray<{ day: string; minute: number }>
  /* False until the device has been read. */
  loaded: boolean
}

const VISITS_KEPT = 7
/* The hour before any visit is known. */
const DEFAULT_MINUTE = 17 * 60

let snapshot: ReminderPrefs = { asked: false, enabled: false, visits: [], loaded: false }
const listeners = new Set<() => void>()
let reading: Promise<void> | null = null

function normalize(raw: unknown): Omit<ReminderPrefs, 'loaded'> {
  if (typeof raw !== 'object' || raw === null) return { asked: false, enabled: false, visits: [] }
  const record = raw as Record<string, unknown>
  const visits = Array.isArray(record.visits)
    ? record.visits.filter((visit): visit is { day: string; minute: number } => typeof visit?.day === 'string' && typeof visit?.minute === 'number').slice(-VISITS_KEPT)
    : []
  return { asked: record.asked === true, enabled: record.enabled === true, visits }
}

function publish(next: ReminderPrefs) {
  snapshot = next
  listeners.forEach((listener) => listener())
}

function save(next: ReminderPrefs) {
  publish(next)
  void writeJson(STORAGE_KEYS.elfReminders, { asked: next.asked, enabled: next.enabled, visits: next.visits })
}

function ensureRead(): Promise<void> {
  if (!reading) reading = readJson<unknown>(STORAGE_KEYS.elfReminders).then((raw) => publish({ ...normalize(raw), loaded: true }))
  return reading
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  void ensureRead()
  return () => listeners.delete(listener)
}

export function getSnapshot(): ReminderPrefs {
  return snapshot
}

/* The answer to the elf's question, or the switch in the preferences. */
export async function setReminders(enabled: boolean): Promise<void> {
  await ensureRead()
  save({ ...snapshot, asked: true, enabled })
}

/* The first visit of a day, once per day. */
export async function recordVisit(day: string, at: number): Promise<void> {
  await ensureRead()
  if (snapshot.visits.some((visit) => visit.day === day)) return
  const date = new Date(at)
  save({ ...snapshot, visits: [...snapshot.visits, { day, minute: date.getHours() * 60 + date.getMinutes() }].slice(-VISITS_KEPT) })
}

/* The player's own hour: the median of the recent first visits. */
export function habitMinute(prefs: ReminderPrefs): number {
  if (prefs.visits.length === 0) return DEFAULT_MINUTE
  const minutes = prefs.visits.map((visit) => visit.minute).sort((a, b) => a - b)
  return minutes[Math.floor(minutes.length / 2)]!
}
