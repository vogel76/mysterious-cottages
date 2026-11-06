import { useEffect, useRef, useState } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { DUST, ELF_GAMES, type ElfGameId } from '@chatynkowo/core'
import { useCloseModal, useElf, useOnline } from '../../../providers'
import { AcornsIcon, Button, CloseIcon, DustIcon, HurryIcon, IconButton, JoyIcon, SleepIcon, Text, WatchAdIcon, colors, iconSize, radius, space } from '../../../ui'
import { rewardedAdNoteKey, useRewardedSupportAd } from '../../support/useRewardedSupportAd'
import { AcornsGame } from './AcornsGame'
import { EchoGame } from './EchoGame'
import { GameSounds, useGameSound } from './GameSounds'
import { GameVeil } from './GameStartCard'
import { MemoryGame } from './MemoryGame'
import { MushroomsGame } from './MushroomsGame'
import { StarRainGame } from './StarRainGame'
import { GAME_ICON, gameKey, type GameFinish } from './games'

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
   also leaves the result for the tab to greet with the elf's reaction.
   The frame holds the games' sounds (GameSounds) for every board, and
   the round's card is heard as it appears: a calm close, or a small
   fanfare for a new record. A round lost that the board can undo (the
   last heart, a miss too many, a wrong tile) is not settled at once: a
   card over the board offers one more life, once a round, for its dust
   (DUST.revive; short of it the button opens the shop) or for an ad
   within the day's cap, and the board plays on from where it stopped;
   ending there, or closing the game, settles the round as it stood. */

export function ElfGameScreen() {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const close = useCloseModal()
  const params = useLocalSearchParams<{ id?: string }>()
  const id: ElfGameId = (ELF_GAMES as readonly string[]).includes(params.id ?? '') ? (params.id as ElfGameId) : 'acorns'
  const router = useRouter()
  const { state, gameRounds, finishGame, reviveGame, adsLeft } = useElf()
  const online = useOnline()
  const [round, setRound] = useState(0)
  const [result, setResult] = useState<{ points: number; acorns: number; xp: number; best: boolean } | null>(null)
  /* The round lost and the way on while the offer of one more life
     stands, and whether this round has had its life. */
  const [out, setOut] = useState<{ points: number; revive: () => void } | null>(null)
  const outRef = useRef(out)
  outRef.current = out
  const revived = useRef(false)
  const left = gameRounds
  const best = state?.games[id]?.best ?? 0
  const asleep = Boolean(state?.sleeping)
  const Glyph = GAME_ICON[id]
  const topInset = Platform.OS === 'android' ? insets.top : 0

  const settle = (points: number) => {
    setOut(null)
    const pay = finishGame(id, points)
    setResult({ points, acorns: pay?.acorns ?? 0, xp: pay?.xp ?? 0, best: pay?.best ?? false })
  }
  const onFinish: GameFinish = (points, revive) => {
    if (revive && !revived.current) setOut({ points, revive })
    else settle(points)
  }
  /* One more life paid for: the board plays on. */
  const playOn = (pay: 'dust' | 'ad') => {
    const current = outRef.current
    if (!current || !reviveGame(pay)) return
    revived.current = true
    setOut(null)
    current.revive()
  }
  const ad = useRewardedSupportAd(() => playOn('ad'))
  const adBusy = ad.status === 'loading' || ad.status === 'showing'
  const adNote = rewardedAdNoteKey(ad.status, online)
  const adAllowed = ad.offered && online !== false && adsLeft > 0
  const dust = state?.wallet.dust ?? 0
  const short = dust < DUST.revive
  /* Closing while the offer stands settles the round as it stood. */
  const leave = () => {
    const current = outRef.current
    if (current) finishGame(id, current.points)
    close()
  }
  const again = () => {
    revived.current = false
    setResult(null)
    setRound((current) => current + 1)
  }

  return (
    <GameSounds>
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
          <IconButton label={t('mobile:elf.gameClose')} onPress={leave}>
            <CloseIcon size={iconSize.md} color={colors.accentStrong} />
          </IconButton>
        </View>

        {result ? (
          <View style={styles.card}>
            <EndSound record={result.best} />
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
            {out ? (
              <GameVeil>
                <View style={styles.pay}>
                  <JoyIcon size={iconSize.lg} weight="fill" color={colors.danger} />
                  <Text variant="heading" accessibilityRole="header" style={styles.grow}>
                    {t('mobile:elf.gameReviveTitle')}
                  </Text>
                </View>
                <Text tone="soft">{t('mobile:elf.gameReviveLead')}</Text>
                <Button
                  variant="primary"
                  block
                  disabled={adBusy}
                  icon={<DustIcon size={iconSize.md} weight="fill" color={colors.accentInk} />}
                  onPress={() => (short ? router.push('/elf-shop') : playOn('dust'))}
                >
                  {t('mobile:elf.gameReviveDust', { count: DUST.revive })}
                </Button>
                {ad.offered ? (
                  <Button
                    block
                    busy={adBusy}
                    disabled={!adAllowed || adBusy}
                    icon={<WatchAdIcon size={iconSize.md} color={colors.accentStrong} />}
                    onPress={ad.watch}
                  >
                    {t('mobile:elf.gameReviveAd')}
                  </Button>
                ) : null}
                {short ? (
                  <Text variant="small" tone="soft" align="center">
                    {t('mobile:elf.hurryShort', { count: dust })}
                  </Text>
                ) : null}
                {adNote ? (
                  <Text variant="small" tone="faint" align="center" accessibilityLiveRegion="polite">
                    {t(adNote)}
                  </Text>
                ) : null}
                <Button variant="subtle" block disabled={adBusy} onPress={() => settle(out.points)}>
                  {t('mobile:elf.gameReviveEnd')}
                </Button>
              </GameVeil>
            ) : null}
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
    </GameSounds>
  )
}

/* The round's end, heard as its card appears: a moment after the
   board's last sound (the heart that ended it), so the two never blur. */
const END_SOUND_MS = 450

function EndSound({ record }: { record: boolean }) {
  const play = useGameSound()
  useEffect(() => {
    const timer = setTimeout(() => play(record ? 'record' : 'over'), END_SOUND_MS)
    return () => clearTimeout(timer)
  }, [play, record])
  return null
}

/* The board of a game. */
const BOARDS: Record<ElfGameId, (props: { onFinish: GameFinish }) => React.JSX.Element> = {
  acorns: AcornsGame,
  memory: MemoryGame,
  echo: EchoGame,
  stars: StarRainGame,
  mushrooms: MushroomsGame,
}

function Board({ id, onFinish }: { id: ElfGameId; onFinish: GameFinish }) {
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
