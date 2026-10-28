import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

/* The system notifications the elf's reminders go out through: local
   ones only, scheduled on the device by expo-notifications (no server, no
   push token, nothing leaves the phone). One Android channel of the
   default importance with the system's default sound and vibration, so
   the phone's own settings (and the channel's, in the system settings)
   decide how a reminder rings; the app never silences it. A reminder that
   comes while the app is in front is not shown: the app drops its
   reminders whenever it comes to the front and plans them again when it
   leaves. A notification carries the route a tap opens. */

const CHANNEL = 'elf'

export type NotificationPermission = 'granted' | 'denied' | 'undetermined'

/* A reminder as the system shows it, at its moment. */
export type ScheduledNote = { at: number; title: string; body: string; url: string }

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false }),
})

/* The channel, named in the player's language (a rename only updates it). */
async function ensureChannel(name: string): Promise<void> {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync(CHANNEL, { name, importance: Notifications.AndroidImportance.DEFAULT })
}

export async function notificationPermission(): Promise<NotificationPermission> {
  const { status } = await Notifications.getPermissionsAsync()
  return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined'
}

/* Asks the system (Android 13 and later, iOS), the channel first, since
   Android shows the question for a channel. */
export async function requestNotificationPermission(channelName: string): Promise<boolean> {
  await ensureChannel(channelName)
  const { status } = await Notifications.requestPermissionsAsync()
  return status === 'granted'
}

/* Replaces whatever is scheduled with these. */
export async function replaceScheduled(notes: readonly ScheduledNote[], channelName: string): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync()
  if (notes.length === 0) return
  await ensureChannel(channelName)
  for (const note of notes) {
    await Notifications.scheduleNotificationAsync({
      content: { title: note.title, body: note.body, data: { url: note.url } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: note.at, channelId: CHANNEL },
    })
  }
}

export function cancelScheduled(): Promise<void> {
  return Notifications.cancelAllScheduledNotificationsAsync()
}

/* Calls back with the route of a tapped notification: the one that
   opened the app, and every one tapped while it runs. Returns the
   unsubscribe. */
export function onNotificationTap(open: (url: string) => void): () => void {
  /* A response is cleared once routed, so a later start does not open it again. */
  const route = (response: Notifications.NotificationResponse | null) => {
    const url = response?.notification.request.content.data?.url
    if (typeof url !== 'string') return
    Notifications.clearLastNotificationResponse()
    open(url)
  }
  route(Notifications.getLastNotificationResponse())
  const subscription = Notifications.addNotificationResponseReceivedListener(route)
  return () => subscription.remove()
}
