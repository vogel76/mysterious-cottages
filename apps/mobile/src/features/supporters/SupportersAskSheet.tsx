import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useCloseModal, useSession, useToast } from '../../providers'
import { Button, SheetRoute, Text, space } from '../../ui'

/* The question about the support ranking (the route /supporters-ask):
   a sheet with what the board is, what it would show of the seeker, and
   the two answers. Yes lists the account and lets its ledger go up
   (SupportExport); no is kept too, so the question is not asked again on
   another phone. Either can be changed on the account screen. A refused
   save keeps the sheet for another try; opened signed out, or before the
   profile is read, the sheet closes at once. */

export function SupportersAskSheet() {
  const { t } = useTranslation()
  const account = useSession()
  const toast = useToast()
  const close = useCloseModal()
  const [saving, setSaving] = useState<boolean | null>(null)
  const mounted = useRef(true)
  useEffect(
    () => () => {
      mounted.current = false
    },
    [],
  )

  const known = Boolean(account.session && account.profile)
  useEffect(() => {
    if (!known) close()
  }, [known, close])

  async function answer(listed: boolean) {
    if (saving !== null) return
    setSaving(listed)
    try {
      await account.saveSupporter(listed)
      if (listed) toast.show({ tone: 'success', text: t('mobile:supporters.joined') })
      if (mounted.current) close()
    } catch (error) {
      console.error('[support] board answer', error)
      toast.show({ tone: 'error', text: t('mobile:supporters.saveFailed') })
      if (mounted.current) setSaving(null)
    }
  }

  return (
    <SheetRoute>
      <View style={styles.sheet}>
        <View style={styles.heading}>
          <Text variant="eyebrow">{t('mobile:support.eyebrow')}</Text>
          <Text variant="title" accessibilityRole="header">
            {t('mobile:supporters.askTitle')}
          </Text>
          <Text tone="soft">{t('mobile:supporters.askBody')}</Text>
        </View>
        <View style={styles.actions}>
          <Button variant="primary" block busy={saving === true} disabled={saving === false} onPress={() => void answer(true)}>
            {t('mobile:supporters.askYes')}
          </Button>
          <Button block busy={saving === false} disabled={saving === true} onPress={() => void answer(false)}>
            {t('mobile:supporters.askNo')}
          </Button>
          <Text variant="small" tone="faint" align="center">
            {t('mobile:supporters.askNote')}
          </Text>
        </View>
      </View>
    </SheetRoute>
  )
}

const styles = StyleSheet.create({
  sheet: {
    paddingTop: space.sm,
    gap: space.lg,
  },
  heading: {
    gap: space.xs,
  },
  actions: {
    gap: space.sm,
  },
})
