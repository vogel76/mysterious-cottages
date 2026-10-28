import { useEffect } from 'react'
import { useIsFocused, useRouter } from 'expo-router'
import { useElf } from '../../providers'

/* The one owner of the elf's cards, mounted by the Elf tab: a hatched elf
   without a name opens the sheet that names it (whatever form the hatch
   landed on), a form reached opens the evolution card, and after both the
   'while you were away' card shows what the days brought. The tab is the
   top screen exactly while it is focused (no modal over it, not even a
   card itself), so the focus drives the presenter, as the Atlas's
   celebration presenter does for the reward card. When the tab is focused
   and a card waits in the provider, it is pushed after a short settle:
   the form changes right after a care action in the tab, so the scene's
   reaction to it gets to start, and a modal that just closed over the tab
   (a card from a moment ago) finishes its dismissal first; the away card
   waits a little longer, so the room and the elf's greeting are seen
   before it. A card clears what it shows before it leaves, so its return
   to the tab pushes nothing. Losing focus before the timer fires cancels
   the push. */

const SETTLE_MS = 350
/* The hatched elf gets its hop and its hello before the sheet asks for a name. */
const HATCH_SETTLE_MS = 2600
const AWAY_SETTLE_MS = 1200

export function useElfCardPresenter() {
  const router = useRouter()
  const isFocused = useIsFocused()
  const { state, pendingEvolution, away } = useElf()
  const unnamed = Boolean(state && state.hatched && state.starter === null)
  const card = unnamed ? 'hatch' : pendingEvolution ? 'evolve' : away ? 'away' : null

  useEffect(() => {
    if (!isFocused || !card) return
    const route = card === 'hatch' ? '/elf-hatch' : card === 'evolve' ? '/elf-evolve' : '/elf-away'
    const timer = setTimeout(() => router.push(route), card === 'hatch' ? HATCH_SETTLE_MS : card === 'evolve' ? SETTLE_MS : AWAY_SETTLE_MS)
    return () => clearTimeout(timer)
  }, [isFocused, card, router])
}
