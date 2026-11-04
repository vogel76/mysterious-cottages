import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { useLocalSearchParams } from 'expo-router'
import { ELF_GAMES, type ElfGameId } from '@chatynkowo/core'
import { useCloseModal, useElf } from '../../../providers'
import { AcornsIcon, Button, CloseIcon, IconButton, Text, colors, iconSize, radius, space } from '../../../ui'
import { AcornsGame } from './AcornsGame'
import { MemoryGame } from './MemoryGame'
import { GAME_ICON, gameKey } from './games'

/* A game from the couch (the route /elf-game/[id], a page sheet over the
   Elf tab): the frame around a board, with the game's name, the rounds
   still open today and a close button at the top, the board in the
   middle, and once a round ends its card: the points, the acorns and
   the experience paid, a word on a new best, and the way on (once more
   while rounds remain, or back to the elf). The round is handed to the
   rules as it ends (finishGame in the provider), which also leaves the
   result for the tab to greet with the elf's reaction. */

export function ElfGameScreen() {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const close = useCloseModal()
  const params = useLocalSearchParams<{ id?: string }>()
  const id: ElfGameId = (ELF_GAMES as readonly string[]).includes(params.id ?? '') ? (params.id as ElfGameId) : 'acorns'
  const { state, gamePlaysLeft, finishGame } = useElf()
  const [round, setRound] = useState(0)
  const [result, setResult] = useState<{ points: number; acorns: number; xp: number; best: boolean } | null>(null)
  const left = gamePlaysLeft(id)
  const best = state?.games[id]?.best ?? 0
  const Glyph = GAME_ICON[id]

  const onFinish = (points: number) => {
    const pay = finishGame(id, points)
    setResult({ points, acorns: pay?.acorns ?? 0, xp: pay?.xp ?? 0, best: pay?.best ?? false })
  }
  const again = () => {
    setResult(null)
    setRound((current) => current + 1)
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.lg }]}>
      <View style={styles.head}>
        <View style={styles.title}>
          <Glyph size={iconSize.lg} weight="duotone" color={colors.accentStrong} />
          <View style={styles.titleWords}>
            <Text variant="heading" accessibilityRole="header">
              {t(gameKey(id))}
            </Text>
            <Text variant="small" tone="soft">
              {left > 0 ? t('mobile:elf.gamePlaysLeft', { count: left }) : t('mobile:elf.gamePlaysNone')}
              {best > 0 ? ` · ${t('mobile:elf.gameBest', { count: best })}` : ''}
            </Text>
          </View>
        </View>
        <IconButton label={t('mobile:elf.gameClose')} onPress={close}>
          <CloseIcon size={iconSize.md} color={colors.accentStrong} />
        </IconButton>
      </View>

      {result ? (
        <View style={styles.card}>
          <Text variant="eyebrow">{t('mobile:elf.gameOver')}</Text>
          <Text variant="title" accessibilityRole="header">
            {t('mobile:elf.gameOverPoints', { count: result.points })}
          </Text>
          {result.best ? (
            <Text weight="bold" tone="accent">
              {t('mobile:elf.gameNewBest')}
            </Text>
          ) : null}
          <View style={styles.pay}>
            <AcornsIcon size={iconSize.md} weight="fill" color={colors.accentStrong} />
            <Text weight="semibold">{t('mobile:elf.gameOverAcorns', { count: result.acorns })}</Text>
            <Text variant="small" tone="soft">
              {t('mobile:elf.gameOverXp', { count: result.xp })}
            </Text>
          </View>
          {left > 0 ? (
            <Button variant="primary" block onPress={again}>
              {t('mobile:elf.gameAgain')}
            </Button>
          ) : null}
          <Button block onPress={close}>
            {t('mobile:elf.gameBack')}
          </Button>
        </View>
      ) : left > 0 ? (
        id === 'acorns' ? (
          <AcornsGame key={round} onFinish={onFinish} />
        ) : (
          <MemoryGame key={round} onFinish={onFinish} />
        )
      ) : (
        <View style={styles.card}>
          <Text tone="soft">{t('mobile:elf.gamePlaysNone')}</Text>
          <Button block onPress={close}>
            {t('mobile:elf.gameBack')}
          </Button>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    gap: space.lg,
    paddingHorizontal: space.lg,
    backgroundColor: colors.pageRaised,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  title: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  titleWords: {
    flex: 1,
    gap: 2,
  },
  card: {
    gap: space.md,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  pay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
})
