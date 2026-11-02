import { useSyncExternalStore } from 'react'
import { STORAGE_KEYS } from '../config'
import { readJson, writeJson } from './storage'

/* Whether the elf's sounds play on this device, on by default (they
   follow the phone's media volume and keep quiet while the phone is on
   silent or vibrate anyway). The same shape as the reminders' store
   (reminders-store.ts): one read of AsyncStorage, one snapshot,
   subscribers re-rendered on a change. */

export type SoundPrefs = {
  enabled: boolean
  /* False until the device has been read. */
  loaded: boolean
}

let snapshot: SoundPrefs = { enabled: true, loaded: false }
const listeners = new Set<() => void>()
let reading: Promise<void> | null = null

function publish(next: SoundPrefs) {
  snapshot = next
  listeners.forEach((listener) => listener())
}

function ensureRead(): Promise<void> {
  if (!reading) {
    reading = readJson<unknown>(STORAGE_KEYS.elfSounds).then((raw) => {
      const enabled = typeof raw === 'object' && raw !== null && (raw as Record<string, unknown>).enabled === false ? false : true
      publish({ enabled, loaded: true })
    })
  }
  return reading
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  void ensureRead()
  return () => listeners.delete(listener)
}

function getSnapshot(): SoundPrefs {
  return snapshot
}

export function useSoundPrefs(): SoundPrefs {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export async function setSounds(enabled: boolean): Promise<void> {
  await ensureRead()
  publish({ enabled, loaded: true })
  await writeJson(STORAGE_KEYS.elfSounds, { enabled })
}
