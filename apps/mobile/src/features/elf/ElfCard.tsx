import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import Animated from 'react-native-reanimated'
import { Button, Text, enterUp, leaveDown, mapPalette, radius, space } from '../../ui'

/* A card of the elf's in the HUD's chrome above the care band: a kicker,
   what the elf says or asks, and two ways on (the quiet one at the left,
   the main one at the right). The tutorial's steps and the questions
   about the reminders and the growing are such cards. A card can also be
   left altogether (the tutorial's "skip"): that way out is a small button
   beside the kicker, so the row below keeps to two buttons and fits a
   narrow window; a card without a quiet way (the tutorial's first step
   has no step back) keeps its main one at the right. The card reports
   its height, so the room is lifted above it; a new key plays its
   entrance again. */

export type ElfCardAction = { label: string; onPress: () => void; disabled?: boolean }

export type ElfCardProps = {
  kicker: string
  text: string
  secondary?: ElfCardAction
  primary: ElfCardAction
  /* The way out of the whole run of cards, beside the kicker. */
  dismiss?: ElfCardAction
  onLayout: (event: LayoutChangeEvent) => void
}

/* The small button's height, and the room around it that still takes a
   finger (together a 48-point target). */
const DISMISS_HEIGHT = 32
const DISMISS_SLOP = 8

export function ElfCard({ kicker, text, secondary, primary, dismiss, onLayout }: ElfCardProps) {
  return (
    <Animated.View entering={enterUp()} exiting={leaveDown()} style={styles.card} onLayout={onLayout} accessibilityLiveRegion="polite">
      <View style={styles.head}>
        <Text variant="caption" style={[styles.kicker, styles.kickerWords]}>
          {kicker}
        </Text>
        {dismiss ? (
          <Button variant="subtle" onPress={dismiss.onPress} disabled={dismiss.disabled} hitSlop={DISMISS_SLOP} style={styles.dismiss}>
            {dismiss.label}
          </Button>
        ) : null}
      </View>
      <Text style={styles.ink}>{text}</Text>
      <View style={styles.row}>
        {secondary ? (
          <Button variant="subtle" onPress={secondary.onPress} disabled={secondary.disabled}>
            {secondary.label}
          </Button>
        ) : null}
        <Button variant="primary" onPress={primary.onPress} disabled={primary.disabled} style={styles.primary}>
          {primary.label}
        </Button>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  card: {
    gap: space.sm,
    padding: space.lg,
    borderWidth: 1,
    borderColor: mapPalette.chromeBorder,
    borderRadius: radius.card,
    backgroundColor: mapPalette.chrome,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  kicker: {
    color: mapPalette.chromeIcon,
  },
  kickerWords: {
    flex: 1,
  },
  /* A button's face at the height of a line of small print. */
  dismiss: {
    minHeight: DISMISS_HEIGHT,
    paddingVertical: 0,
    paddingHorizontal: space.md,
  },
  ink: {
    color: mapPalette.chromeInk,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  /* At the right, with or without a quiet button at the left. */
  primary: {
    marginLeft: 'auto',
  },
})
