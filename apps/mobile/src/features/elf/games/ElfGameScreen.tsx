import { useState } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ELF_GAMES, type ElfGameId } from '@chatynkowo/core'
import { useCloseModal, useElf } from '../../../providers'
import { AcornsIcon, Button, CloseIcon, HurryIcon, IconButton, SleepIcon, Text, colors, iconSize, radius, space } from '../../../ui'
import { AcornsGame } from './AcornsGame'
import { EchoGame } from './EchoGame'
import { MemoryGame } from './MemoryGame'
import { MushroomsGame } from './MushroomsGame'
import { StarRainGame } from './StarRainGame'
import { GAME_ICON, gameKey } from './games'

/* A game with the elf (the route /elf-game/[id], a page sheet over the
   Elf tab): the frame around a board, with the game's name, the rounds
   the elf's energy still allows and a close button at the top, the
   board in the middle, and once a round ends its card: the points, the
   acorns and the experience paid, a word on a new best, and the way on
   (once more while the energy lasts, or back to the elf); with no
   energy left the card says sleep brings it back and offers the hurry of
   the energy (/elf-hurry) right there, and a sleeping elf does not play
   at all: the card says to wake it first. The board takes the room
   between the head and the foot, and each game fits itself into it. On
   iOS the page sheet starts below the status bar, so only Android's
   full-screen modal takes the top inset (as the cottage directory). The round
   is handed to the rules as it ends (finishGame in the provider), which
   also leaves the result for the tab to greet with the elf's reaction. */

export function ElfGameScreen() {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const close = useCloseModal()
  const params = useLocalSearchParams<{ id?: string }>()
  const id: ElfGameId = (ELF_GAMES as readonly string[]).includes(params.id ?? '') ? (params.id as ElfGameId) : 'acorns'
  const router = useRouter()
  const { state, gameRounds, finishGame } = useElf()
  const [round, setRound] = useState(0)
  const [result, setResult] = useState<{ points: number; acorns: number; xp: number; best: boolean } | null>(null)
  const left = gameRounds
  const best = state?.games[id]?.best ?? 0
  const asleep = Boolean(state?.sleeping)
  const Glyph = GAME_ICON[id]
  const topInset = Platform.OS === 'android' ? insets.top : 0

  const onFinish = (points: number) => {
    const pay = finishGame(id, points)
    setResult({ points, acorns: pay?.acorns ?? 0, xp: pay?.xp ?? 0, best: pay?.best ?? false })
  }
  const again = () => {
    setResult(null)
    setRound((current) => current + 1)
  }

  return (
    <View style={[styles.screen, { paddingTop: topInset + space.lg, paddingBottom: insets.bottom + space.lg }]}>
      <View style={styles.head}>
        <View style={styles.title}>
          <Glyph size={iconSize.lg} weight="duotone" color={colors.accentStrong} />
          <View style={styles.titleWords}>
            <Text variant="heading" accessibilityRole="header">
              {t(gameKey(id))}
            </Text>
            <Text variant="small" tone="soft">
              {left > 0 ? t('mobile:elf.energyRounds', { count: left }) : t('mobile:elf.energyNone')}
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
      ) : asleep ? (
        <View style={styles.card}>
          <View style={styles.pay}>
            <SleepIcon size={iconSize.lg} weight="duotone" color={colors.accentStrong} />
            <Text style={styles.grow}>{t('mobile:elf.gameAsleepCard')}</Text>
          </View>
          <Button block onPress={close}>
            {t('mobile:elf.gameBack')}
          </Button>
        </View>
      ) : left > 0 ? (
        <View style={styles.board}>
          <Board key={round} id={id} onFinish={onFinish} />
        </View>
      ) : (
        <View style={styles.card}>
          <Text tone="soft">{t('mobile:elf.energyNoneLong')}</Text>
          <Button variant="primary" block icon={<HurryIcon size={iconSize.md} weight="fill" color={colors.accentInk} />} onPress={() => router.push({ pathname: '/elf-hurry', params: { kind: 'energy' } })}>
            {t('mobile:elf.hurryAction')}
          </Button>
          <Button block onPress={close}>
            {t('mobile:elf.gameBack')}
          </Button>
        </View>
      )}
    </View>
  )
}

/* The board of a game. */
const BOARDS: Record<ElfGameId, (props: { onFinish: (points: number) => void }) => React.JSX.Element> = {
  acorns: AcornsGame,
  memory: MemoryGame,
  echo: EchoGame,
  stars: StarRainGame,
  mushrooms: MushroomsGame,
}

function Board({ id, onFinish }: { id: ElfGameId; onFinish: (points: number) => void }) {
  const Game = BOARDS[id]
  return <Game onFinish={onFinish} />
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
  grow: {
    flex: 1,
  },
  /* The room between the head and the foot, for the board. */
  board: {
    flex: 1,
  },
})
