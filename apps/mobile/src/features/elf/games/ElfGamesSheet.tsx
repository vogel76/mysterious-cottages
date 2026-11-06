import { StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { ELF_GAMES } from '@chatynkowo/core'
import { useElf } from '../../../providers'
import { Button, HurryIcon, PressableScale, SheetRoute, SleepIcon, Text, colors, iconSize, radius, space } from '../../../ui'
import { elfNow } from '../../../lib/elf-clock'
import { restText } from '../duration'
import { GAME_ICON, gameKey } from './games'

/* The choice of a game (the route /elf-games), from the games button on
   the side of the cottage: how rested the elf is on top (in words,
   never a count of rounds; the star brew's time while it works), and the
   games as big tiles three to a row (a shorter last row centred), each
   its picture, its name and its record (or a word on how it goes before
   the first round); a tap starts that game's screen in place of this
   sheet. Too tired for a round, the line
   says so and a button beside it opens the hurry of the energy
   (/elf-hurry), so the way back to play is never a search. A sleeping
   elf never gets here (the tab has it say so), but should it, the tiles
   wait and the line says it sleeps. */

export function ElfGamesSheet() {
  const { t } = useTranslation()
  const router = useRouter()
  const { state, gameReady, rest, brewUntil } = useElf()
  if (!state) return <SheetRoute>{null}</SheetRoute>
  const asleep = state.sleeping
  const playable = gameReady
  return (
    <SheetRoute>
      <View style={styles.column}>
        <View style={styles.head}>
          <Text variant="title" accessibilityRole="header">
            {t('mobile:elf.gamesTitle')}
          </Text>
          <View style={styles.energy}>
            <SleepIcon size={iconSize.md} weight="duotone" color={playable ? colors.accentStrong : colors.inkFaint} />
            <Text weight="semibold" tone={playable ? 'ink' : 'soft'} style={styles.energyWords}>
              {asleep ? t('mobile:elf.gamesAsleep') : restText(t, rest, brewUntil, elfNow())}
            </Text>
            {!asleep && !gameReady ? (
              <Button variant="primary" icon={<HurryIcon size={iconSize.sm} weight="fill" color={colors.accentInk} />} onPress={() => router.push({ pathname: '/elf-hurry', params: { kind: 'energy' } })}>
                {t('mobile:elf.hurryAction')}
              </Button>
            ) : null}
          </View>
        </View>
        <View style={styles.tiles}>
          {ELF_GAMES.map((id) => {
            const Glyph = GAME_ICON[id]
            const best = state.games[id]?.best ?? 0
            const name = t(gameKey(id))
            const hint = best > 0 ? t('mobile:elf.gameBest', { count: best }) : t(`${gameKey(id)}Hint`)
            return (
              <PressableScale
                key={id}
                accessibilityRole="button"
                accessibilityLabel={`${name}. ${hint}`}
                accessibilityState={{ disabled: !playable }}
                disabled={!playable}
                onPress={() => router.replace({ pathname: '/elf-game/[id]', params: { id } })}
                style={[styles.tile, !playable && styles.tileWaiting]}
              >
                <View style={styles.picture}>
                  <Glyph size={iconSize.emblem} weight="duotone" color={colors.accentStrong} />
                </View>
                <Text weight="bold" align="center" numberOfLines={2}>
                  {name}
                </Text>
                <Text variant="small" tone="soft" align="center" numberOfLines={3}>
                  {hint}
                </Text>
              </PressableScale>
            )
          })}
        </View>
      </View>
    </SheetRoute>
  )
}

const PICTURE = 72

const styles = StyleSheet.create({
  column: {
    gap: space.lg,
    paddingTop: space.sm,
  },
  head: {
    gap: space.sm,
  },
  /* The elf's energy for the games, with the hurry when it is out. */
  energy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  energyWords: {
    flex: 1,
  },
  /* Three to a row, a shorter last row centred. */
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: space.sm,
  },
  tile: {
    width: '31.5%',
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.md,
    paddingHorizontal: space.xs,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  tileWaiting: {
    opacity: 0.5,
  },
  picture: {
    width: PICTURE,
    height: PICTURE,
    borderRadius: PICTURE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentWash,
    marginBottom: space.xs,
  },
})
