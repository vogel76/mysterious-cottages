import AsyncStorage from '@react-native-async-storage/async-storage'
import { newPublicId } from '@chatynkowo/api'
import { STORAGE_KEYS } from '../config'

/* What the support ledger needs to reach the account (the supporters'
   board, src/features/supporters): this install's name for itself, under
   which its ledger is kept apart from the account's other devices, and
   the word that an export got through, for a board on screen to load
   again. The export itself is the SupportExport component; the ledger is
   support-store.ts. */

let known: Promise<string> | null = null

/* A random name made once per install and kept: a reinstall is a new
   device with an empty ledger, and the old one's row stays in the sum,
   as what was given through it was given. It names nothing about the
   phone. A storage that cannot be written gives a name for this run
   only, so the export still has one row to write over. */
export function deviceId(): Promise<string> {
  known ??= (async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.deviceId)
      if (stored) return stored
    } catch {
      // Read as absent.
    }
    const made = newPublicId()
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.deviceId, made)
    } catch {
      // Kept in memory for this run.
    }
    return made
  })()
  return known
}

const listeners = new Set<() => void>()

/* Called once a ledger reached the account, or the seeker's place on the
   board changed. */
export function notifySupportExported(): void {
  listeners.forEach((listener) => listener())
}

export function onSupportExported(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
