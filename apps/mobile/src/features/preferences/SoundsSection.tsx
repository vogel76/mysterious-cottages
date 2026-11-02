import { Switch } from 'react-native'
import { useTranslation } from 'react-i18next'
import { setSounds, useSoundPrefs } from '../../lib/sounds-store'
import { SettingsRow, SettingsSection, SoundOnIcon, colors, iconSize } from '../../ui'

/* The elf's sounds in the preferences: one switch. The sounds follow the
   phone's media volume, mix with whatever else plays and keep quiet while
   the phone is on silent or vibrate (src/features/elf/useElfSounds.ts),
   so the switch is only for a player who wants the cottage quiet. */

export function SoundsSection() {
  const { t } = useTranslation()
  const prefs = useSoundPrefs()
  return (
    <SettingsSection title={t('mobile:sounds.sectionTitle')} footer={t('mobile:sounds.footer')}>
      <SettingsRow
        icon={<SoundOnIcon size={iconSize.md} color={colors.accentStrong} />}
        label={t('mobile:sounds.row')}
        trailing={
          <Switch
            value={prefs.enabled}
            disabled={!prefs.loaded}
            onValueChange={(next) => void setSounds(next)}
            trackColor={{ false: colors.line, true: colors.accent }}
            thumbColor={prefs.enabled ? colors.accentStrong : colors.inkFaint}
            accessibilityLabel={t('mobile:sounds.row')}
          />
        }
      />
    </SettingsSection>
  )
}
