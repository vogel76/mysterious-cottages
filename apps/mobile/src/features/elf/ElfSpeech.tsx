import { StyleSheet, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { Text, colors, enterUp, leave, radius, space } from '../../ui'

/* What the elf says, as a comic speech bubble over its head: a refusal
   ("I'm full already"), a good night, a greeting, a call for attention, a
   quest done, the streak, a new day. The tab keeps the queue and the
   timing (one line at a time, a few seconds each) and speaks each line to
   a screen reader as it starts; this draws the current line at the anchor
   the scene gives for the figure's top, in the tab's view coordinates,
   keeps the bubble inside the side margins and under the HUD (a lifted
   room can put the head high up), and restarts the entrance for every
   line, the same words twice included. Light on the dark room, with the
   ink of the gold buttons, so it reads as the elf's voice and not as
   another HUD chip; the tail points at the head. It never takes a touch. */

export type ElfSpeechProps = {
  /* The line and its number in the tab's count: a new number is a new
     bubble, even for the same words. */
  line: { text: string; seq: number } | null
  /* The view point just above the figure's head. */
  anchor: { x: number; y: number } | null
  /* The tab's size, to place the bubble from its bottom edge, and how far
     the HUD reaches down from the top, which the bubble stays under. */
  width: number
  height: number
  topLimit: number
}

/* The bubble's widest, and the room kept from the tab's sides. */
const MAX_WIDTH = 300
const MARGIN = space.lg
/* The tail's side, and the gap it leaves over the head. */
const TAIL = 12
const GAP = 10
/* A two-line bubble with its tail, the room kept under the HUD. */
const BUBBLE_HEIGHT = 84

export function ElfSpeech({ line, anchor, width, height, topLimit }: ElfSpeechProps) {
  if (!line || !anchor) return null
  const boxWidth = Math.min(MAX_WIDTH, width - MARGIN * 2)
  const left = Math.min(Math.max(anchor.x - boxWidth / 2, MARGIN), width - MARGIN - boxWidth)
  const bottom = Math.min(height - anchor.y + GAP, height - topLimit - BUBBLE_HEIGHT)
  return (
    <Animated.View key={line.seq} entering={enterUp()} exiting={leave()} style={[styles.box, { left, bottom, width: boxWidth }]} pointerEvents="none">
      <View style={styles.bubble}>
        <Text variant="compact" weight="semibold" align="center" style={styles.ink}>
          {line.text}
        </Text>
      </View>
      <View style={styles.tail} />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    alignItems: 'center',
  },
  bubble: {
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    backgroundColor: colors.ink,
    shadowColor: colors.page,
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  ink: {
    color: colors.accentInk,
  },
  /* A square turned on its corner, tucked under the bubble's edge. */
  tail: {
    width: TAIL,
    height: TAIL,
    marginTop: -TAIL / 2 - 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.accentBorder,
    backgroundColor: colors.ink,
    transform: [{ rotate: '45deg' }],
  },
})
