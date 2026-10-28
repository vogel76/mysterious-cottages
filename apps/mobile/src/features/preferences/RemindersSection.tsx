import { useEffect, useState } from 'react'
import { AppState, Linking, Switch } from 'react-native'
import { useTranslation } from 'react-i18next'
import { notificationPermission, requestNotificationPermission, type NotificationPermission } from '../../lib/notifications'
import { setReminders } from '../../lib/reminders-store'
import { useReminderPrefs } from '../elf/useElfReminders'
import { ElfIcon, SettingsRow, SettingsSection, colors, iconSize } from '../../ui'

/* The elf's reminders in the preferences: one switch and what it does,
   with no choice of hours (the reminders come when something happens,
   at the player's own hour, src/features/elf/useElfReminders.ts).
   Turning it on asks the system when it has not been asked yet; when the
   phone's settings block the app's notifications the section says so and
   offers the way to those settings, and the switch follows the system
   again once the player is back. */

export function RemindersSection() {
  const { t } = useTranslation()
  const prefs = useReminderPrefs()
  const [permission, setPermission] = useState<NotificationPermission | null>(null)
  useEffect(() => {
    const read = () => void notificationPermission().then(setPermission)
    read()
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') read()
    })
    return () => subscription.remove()
  }, [])

  const blocked = permission === 'denied'
  const on = prefs.enabled && permission === 'granted'
  const toggle = async (next: boolean) => {
    if (!next) {
      await setReminders(false)
      return
    }
    const granted = permission === 'granted' || (await requestNotificationPermission(t('mobile:reminders.channel')))
    setPermission(granted ? 'granted' : await notificationPermission())
    await setReminders(granted)
  }

  return (
    <SettingsSection title={t('mobile:reminders.sectionTitle')} footer={blocked ? t('mobile:reminders.blocked') : t('mobile:reminders.footer')}>
      <SettingsRow
        icon={<ElfIcon size={iconSize.md} color={colors.accentStrong} />}
        label={t('mobile:reminders.row')}
        trailing={
          <Switch
            value={on}
            disabled={!prefs.loaded || permission === null || blocked}
            onValueChange={(next) => void toggle(next)}
            trackColor={{ false: colors.line, true: colors.accent }}
            thumbColor={on ? colors.accentStrong : colors.inkFaint}
            accessibilityLabel={t('mobile:reminders.row')}
          />
        }
      />
      {blocked ? <SettingsRow label={t('mobile:reminders.openSettings')} trailing="external" onPress={() => void Linking.openSettings()} /> : null}
    </SettingsSection>
  )
}
