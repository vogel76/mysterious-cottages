import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import Animated from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { Button, Text, enterUp, leaveDown, mapPalette, radius, space } from '../../ui'
import type { TutorialStep } from './useElfTutorial'

/* One card of the tutorial, in the HUD's chrome above the care band: the
   step's place in the flow, what to do or know, and the way on. A step
   that waits for a move keeps "next" dark until the move is made; "skip"
   ends the flow at any step. The card reports its height, so the room is
   lifted above it. */

export type ElfTutorialProps = {
  step: TutorialStep
  onNext: () => void
  onSkip: () => void
  onLayout: (event: LayoutChangeEvent) => void
}

export function ElfTutorial({ step, onNext, onSkip, onLayout }: ElfTutorialProps) {
  const { t } = useTranslation()
  return (
    <Animated.View key={step.index} entering={enterUp()} exiting={leaveDown()} style={styles.card} onLayout={onLayout} accessibilityLiveRegion="polite">
      <Text variant="caption" style={styles.kicker}>
        {t('mobile:elf.tutorialTitle')} · {t('mobile:elf.tutorialStep', { step: step.index + 1, total: step.total })}
      </Text>
      <Text style={styles.ink}>{step.text}</Text>
      <View style={styles.row}>
        <Button variant="subtle" onPress={onSkip}>
          {t('mobile:elf.tutorialSkip')}
        </Button>
        <Button variant="primary" onPress={onNext} disabled={step.waiting}>
          {t(step.last ? 'mobile:elf.tutorialDone' : 'mobile:elf.tutorialNext')}
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
