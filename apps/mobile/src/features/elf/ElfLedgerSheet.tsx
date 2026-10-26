import { StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useElf } from '../../providers'
import { AcornsIcon, DustIcon, SheetRoute, StreakIcon, Text, colors, iconSize, space, type Icon } from '../../ui'

/* What the three figures of the HUD's ledger mean, as a sheet sized to
   its content: for each of the acorns, the star dust and the streak its
   glyph, the count as it stands, how it is earned and what it is for, and
   the longest streak so far under them. Opened by a tap on the ledger;
   dismissed like every sheet. */

export function ElfLedgerSheet() {
  const { t } = useTranslation()
  const { state } = useElf()
  const wallet = state?.wallet ?? { acorns: 0, dust: 0 }
  const streak = state?.streak ?? 0
  const best = state?.bestStreak ?? 0
  return (
    <SheetRoute>
      <View style={styles.sheet}>
        <Text variant="eyebrow" accessibilityRole="header">
          {t('mobile:elf.ledgerTitle')}
        </Text>
        <Row Glyph={AcornsIcon} title={t('mobile:elf.ledgerAcorns')} value={wallet.acorns} body={t('mobile:elf.ledgerAcornsBody')} />
        <Row Glyph={DustIcon} title={t('mobile:elf.ledgerDust')} value={wallet.dust} body={t('mobile:elf.ledgerDustBody')} />
        <Row Glyph={StreakIcon} title={t('mobile:elf.ledgerStreak')} value={streak} body={t('mobile:elf.ledgerStreakBody')} />
        <Text variant="small" tone="faint">
          {t('mobile:elf.ledgerBest', { count: best })}
        </Text>
      </View>
    </SheetRoute>
  )
}

function Row({ Glyph, title, value, body }: { Glyph: Icon; title: string; value: number; body: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.glyph}>
        <Glyph size={iconSize.md} weight="fill" color={colors.accentStrong} />
      </View>
      <View style={styles.column}>
        <Text weight="bold">
          {title}: {value}
        </Text>
        <Text variant="small">{body}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  sheet: {
    gap: space.md,
    paddingTop: space.sm,
  },
  row: {
    flexDirection: 'row',
    gap: space.md,
    alignItems: 'flex-start',
  },
  /* The glyph lines up with the first line of the title. */
  glyph: {
    paddingTop: 2,
  },
  column: {
    flex: 1,
    gap: space.xs,
  },
})
