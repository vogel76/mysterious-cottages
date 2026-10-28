import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import Animated from 'react-native-reanimated'
import { Button, Text, enterUp, leaveDown, mapPalette, radius, space } from '../../ui'

/* A card of the elf's in the HUD's chrome above the care band: a kicker,
   what the elf says or asks, and two ways on (the quiet one and the
   main one). The tutorial's steps and the question about the reminders
   are such cards. The card reports its height, so the room is lifted
   above it; a new key plays its entrance again. */

export type ElfCardAction = { label: string; onPress: () => void; disabled?: boolean }

export type ElfCardProps = {
  kicker: string
  text: string
  secondary: ElfCardAction
  primary: ElfCardAction
  onLayout: (event: LayoutChangeEvent) => void
}

export function ElfCard({ kicker, text, secondary, primary, onLayout }: ElfCardProps) {
  return (
    <Animated.View entering={enterUp()} exiting={leaveDown()} style={styles.card} onLayout={onLayout} accessibilityLiveRegion="polite">
      <Text variant="caption" style={styles.kicker}>
        {kicker}
      </Text>
      <Text style={styles.ink}>{text}</Text>
      <View style={styles.row}>
        <Button variant="subtle" onPress={secondary.onPress} disabled={secondary.disabled}>
          {secondary.label}
        </Button>
        <Button variant="primary" onPress={primary.onPress} disabled={primary.disabled}>
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
  kicker: {
    color: mapPalette.chromeIcon,
  },
  ink: {
    color: mapPalette.chromeInk,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.sm,
  },
})
