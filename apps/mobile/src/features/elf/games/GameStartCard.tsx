import { StyleSheet, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { Button, Text, colors, fade, leave, radius, space, withAlpha } from '../../../ui'

/* How a game is played and the way to start it, as a card over the game's
   board before the first move: the board waits under a veil, so the
   player sees what is coming, and the start is always on screen whatever
   the board's size (it used to sit under the board and fall off a short
   phone). Each game lays it over its own board and drops it at the
   start. */

export function GameStartCard({ how, onStart }: { how: string; onStart: () => void }) {
  const { t } = useTranslation()
  return (
    <Animated.View entering={fade()} exiting={leave()} style={styles.veil}>
      <View style={styles.card}>
        <Text align="center">{how}</Text>
        <Button variant="primary" block onPress={onStart}>
          {t('mobile:elf.gameStart')}
        </Button>
      </View>
    </Animated.View>
  )
}

/* The side of a square cell that lets a grid of the given columns and
   rows, with its gaps, fit both the width and the height it has. */
export function fitCell(width: number, height: number, columns: number, rows: number, gap: number): number {
  if (width <= 0 || height <= 0) return 0
  return Math.floor(Math.min((width - gap * (columns - 1)) / columns, (height - gap * (rows - 1)) / rows))
}

const styles = StyleSheet.create({
  veil: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
    borderRadius: radius.card,
    backgroundColor: withAlpha(colors.pageRaised, 0.72),
  },
  card: {
    alignSelf: 'stretch',
    gap: space.md,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
})
