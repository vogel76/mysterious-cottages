import type { LayoutChangeEvent } from 'react-native'
import { useTranslation } from 'react-i18next'
import { ElfCard } from './ElfCard'
import type { TutorialStep } from './useElfTutorial'

/* One card of the tutorial (an ElfCard): the step's place in the flow,
   what to do or know, the way on and, from the second step, the way back.
   A step that waits for a move keeps "next" dark until the move is made;
   "skip", beside the kicker, ends the flow at any step. The tab keys the
   card by the step, so each step enters anew. */

export type ElfTutorialProps = {
  step: TutorialStep
  onNext: () => void
  onBack: () => void
  onSkip: () => void
  onLayout: (event: LayoutChangeEvent) => void
}

export function ElfTutorial({ step, onNext, onBack, onSkip, onLayout }: ElfTutorialProps) {
  const { t } = useTranslation()
  return (
    <ElfCard
      kicker={`${t('mobile:elf.tutorialTitle')} · ${t('mobile:elf.tutorialStep', { step: step.index + 1, total: step.total })}`}
      text={step.text}
      secondary={step.first ? undefined : { label: t('mobile:elf.tutorialBack'), onPress: onBack }}
      primary={{ label: t(step.last ? 'mobile:elf.tutorialDone' : 'mobile:elf.tutorialNext'), onPress: onNext, disabled: step.waiting }}
      dismiss={{ label: t('mobile:elf.tutorialSkip'), onPress: onSkip }}
      onLayout={onLayout}
    />
  )
}
