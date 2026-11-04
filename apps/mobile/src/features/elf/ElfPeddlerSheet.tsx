import { StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { peddlerWares, type ElfWare, type ElfWareId } from '@chatynkowo/core'
import { useElf, useToast } from '../../providers'
import { AcornsIcon, BathIcon, Button, CheckIcon, DustIcon, FeedIcon, GameTicketIcon, PeddlerIcon, SheetRoute, Text, ToyIcon, TricksIcon, colors, iconSize, radius, space, type Icon } from '../../ui'
import { trickKey } from './tricks'

/* The travelling peddler (the route /elf-peddler), from the activities
   hub: his greeting, the acorns at hand, and the day's three wares, each
   a row with its picture, its name, what it does and its price in
   acorns, or a mark once bought today. The rules draw the wares by the
   day and do what a ware does as it is bought (packages/core:
   peddlerWares, buyWare): a treat, a toy or a soap bring a care's charges
   back, a ticket adds a round to each game for the day, a grain of dust
   is one, and a trick is one the elf has not got, under its usual price. */

const WARE_ICON: Record<ElfWareId, Icon> = {
  treat: FeedIcon,
  toy: ToyIcon,
  soap: BathIcon,
  ticket: GameTicketIcon,
  dust: DustIcon,
  trick: TricksIcon,
}

function wareKey(id: ElfWareId, part: 'name' | 'desc' = 'name'): string {
  return `mobile:elf.ware${id.charAt(0).toUpperCase()}${id.slice(1)}${part === 'desc' ? 'Desc' : ''}`
}

export function ElfPeddlerSheet() {
  const { t } = useTranslation()
  const toast = useToast()
  const { state, buyWare } = useElf()
  if (!state) return <SheetRoute>{null}</SheetRoute>
  const acorns = state.wallet.acorns
  const wares = peddlerWares(state, Date.now())
  const nameOf = (ware: ElfWare) => (ware.id === 'trick' && ware.trick ? t(wareKey('trick'), { name: t(trickKey(ware.trick)) }) : t(wareKey(ware.id)))
  const buy = (ware: ElfWare) => {
    if (buyWare(ware.id)) toast.show({ tone: 'success', text: t('mobile:elf.wareBoughtToast', { name: nameOf(ware) }) })
  }

  return (
    <SheetRoute scroll>
      <View style={styles.column}>
        <View style={styles.head}>
          <Text variant="eyebrow">{t('mobile:elf.activitiesKicker')}</Text>
          <Text variant="title" accessibilityRole="header">
            {t('mobile:elf.peddlerTitle')}
          </Text>
          <View style={styles.greeting}>
            <PeddlerIcon size={iconSize.xl} weight="duotone" color={colors.accentStrong} />
            <Text tone="soft" style={styles.greetingWords}>
              {t('mobile:elf.peddlerGreeting')}
            </Text>
          </View>
          <View style={styles.balance}>
            <AcornsIcon size={iconSize.md} weight="fill" color={colors.accentStrong} />
            <Text weight="bold">{t('mobile:elf.peddlerBalance', { count: acorns })}</Text>
          </View>
        </View>

        {wares.map((ware) => {
          const Glyph = WARE_ICON[ware.id]
          const name = nameOf(ware)
          const short = acorns < ware.acorns
          return (
            <View key={ware.id} style={[styles.row, ware.bought && styles.rowBought]}>
              <View style={styles.picture}>
                <Glyph size={iconSize.lg} weight="duotone" color={colors.accentStrong} />
              </View>
              <View style={styles.words}>
                <Text weight="bold" numberOfLines={1}>
                  {name}
                </Text>
                <Text variant="small" tone="soft">
                  {t(wareKey(ware.id, 'desc'))}
                </Text>
                {!ware.bought && short ? (
                  <Text variant="small" tone="faint">
                    {t('mobile:elf.wareShort')}
                  </Text>
                ) : null}
              </View>
              {ware.bought ? (
                <View style={styles.mark} accessible accessibilityLabel={t('mobile:elf.wareBought')}>
                  <CheckIcon size={iconSize.md} weight="bold" color={colors.success} />
                  <Text variant="small" tone="soft">
                    {t('mobile:elf.wareBought')}
                  </Text>
                </View>
              ) : (
                <Button
                  variant="primary"
                  disabled={short}
                  accessibilityLabel={t('mobile:elf.wareBuyAria', { name, count: ware.acorns })}
                  icon={<AcornsIcon size={iconSize.sm} weight="fill" color={colors.accentInk} />}
                  onPress={() => buy(ware)}
                >
                  {t('mobile:elf.acornsPrice', { count: ware.acorns })}
                </Button>
              )}
            </View>
          )
        })}
      </View>
    </SheetRoute>
  )
}

const styles = StyleSheet.create({
  column: {
    gap: space.md,
    paddingTop: space.sm,
  },
  head: {
    gap: space.sm,
    marginBottom: space.xs,
  },
  greeting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  greetingWords: {
    flex: 1,
  },
  balance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
  },
  rowBought: {
    opacity: 0.7,
  },
  picture: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentWash,
  },
  words: {
    flex: 1,
    gap: 2,
  },
  mark: {
    alignItems: 'center',
    gap: 2,
    minWidth: 64,
  },
})
