import { useEffect } from 'react'
import { useIsFocused, useRouter } from 'expo-router'
import { useElf } from '../../providers'

/* The one owner of the evolution card, mounted by the Elf tab. The tab is
   the top screen exactly while it is focused (no modal over it, not even
   the card itself), so the focus drives the presenter, as the Atlas's
   celebration presenter does for the reward card. When the tab is focused
   and a form waits in the provider, the card is pushed after a short
   settle: the form changes right after a care action in the tab, so the
   scene's reaction to it gets to start, and a modal that just closed over
   the tab (a card from a moment ago) finishes its dismissal first. The
   card clears the pending form before it leaves, so its return to the tab
   pushes nothing. Losing focus before the timer fires cancels the push. */

const SETTLE_MS = 350

export function useEvolutionPresenter() {
  const router = useRouter()
  const isFocused = useIsFocused()
  const { pendingEvolution } = useElf()

  useEffect(() => {
    if (!isFocused || !pendingEvolution) return
    const timer = setTimeout(() => router.push('/elf-evolve'), SETTLE_MS)
    return () => clearTimeout(timer)
  }, [isFocused, pendingEvolution, router])
}
