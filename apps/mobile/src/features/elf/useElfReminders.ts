import { useEffect, useRef, useSyncExternalStore } from 'react'
import { AppState } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { elfReminders, type ElfReminder } from '@chatynkowo/core'
import { cancelScheduled, notificationPermission, onNotificationTap, replaceScheduled, type ScheduledNote } from '../../lib/notifications'
import { getSnapshot, habitMinute, recordVisit, subscribe, type ReminderPrefs } from '../../lib/reminders-store'
import { useElf } from '../../providers'

/* The elf's reminders as React state: the player's answer and the hours
   of the last visits, read once from the device. */
export function useReminderPrefs(): ReminderPrefs {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/* The copy of a reminder: a title for what happened and a line under it,
   with the day's quests added while they wait. */
function noteOf(reminder: ElfReminder, name: string, hatched: boolean, t: (key: string, values?: Record<string, string>) => string): ScheduledNote {
  const values = { name: name || t('mobile:elf.defaultName') }
  const kind = reminder.kind === 'day' && !hatched ? 'eggWaits' : reminder.kind
  const title = t(`mobile:reminders.${kind}Title`, values)
  const line = t(`mobile:reminders.${kind}Body`, values)
  const body = reminder.quests && reminder.kind !== 'day' ? `${line} ${t('mobile:reminders.questsToo')}` : line
  return { at: reminder.at, title, body, url: '/elf' }
}

/* The one owner of the reminders, mounted by the tab layout: the first
   visit of each day is noted (its minute is the player's hour), the
   reminders the rules give (packages/core, elfReminders) are scheduled
   whenever the app goes to the background and dropped whenever it comes
   to the front (nothing rings while the player is here, and every leave
   plans afresh from the elf as it is), and a tapped reminder opens the
   Elf tab. Nothing is scheduled without the player's yes and the
   system's permission. */
export function useElfReminders() {
  const { t } = useTranslation()
  const router = useRouter()
  const { state, finds } = useElf()
  const prefs = useReminderPrefs()

  const visitDay = state?.lastVisitDay ?? null
  useEffect(() => {
    if (visitDay) void recordVisit(visitDay, Date.now())
  }, [visitDay])

  /* The latest values for the app state's edges. */
  const latest = useRef({ state, finds, prefs, t })
  latest.current = { state, finds, prefs, t }

  useEffect(() => {
    const plan = async () => {
      const { state: elf, finds: found, prefs: answer, t: translate } = latest.current
      if (!elf || !answer.enabled || (await notificationPermission()) !== 'granted') {
        await cancelScheduled()
        return
      }
      const notes = elfReminders(elf, Date.now(), found, habitMinute(answer)).map((reminder) => noteOf(reminder, elf.name, elf.hatched, translate))
      await replaceScheduled(notes, translate('mobile:reminders.channel'))
    }
    void cancelScheduled()
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') void cancelScheduled()
      else if (status === 'background') void plan().catch((error) => console.warn('[reminders] plan', error))
    })
    return () => subscription.remove()
  }, [])

  /* The switch turned off drops what was planned at once. */
  useEffect(() => {
    if (prefs.loaded && !prefs.enabled) void cancelScheduled()
  }, [prefs.loaded, prefs.enabled])

  useEffect(() => onNotificationTap((url) => router.navigate(url as '/elf')), [router])
}
