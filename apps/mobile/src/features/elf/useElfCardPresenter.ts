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
   and a card waits in the provider, it is pushed after a settle: the
   evolution card once the tab says the new form has been seen in the
   room (its moment plays a beat after the care that reached the form, or
   once the elf is drawn), a little after it, the away card a little
   after the room and the elf's greeting are seen; a modal that just closed
   over the tab (a card from a moment ago) finishes its dismissal first. A card clears what it shows before it leaves, so its return
   to the tab pushes nothing. Losing focus before the timer fires cancels
   the push. */

/* The hatched elf gets its hop and its hello before the sheet asks for a name. */
const HATCH_SETTLE_MS = 2600
/* The rest of the evolution's moment after the new form is swapped in
   (its first draw holds the flash for most of a second on a large form,
   and the player should see the new form a moment before the card). */
const EVOLVE_SETTLE_MS = 2000
const AWAY_SETTLE_MS = 1200

export function useElfCardPresenter({ evolutionSeen }: { evolutionSeen: boolean }) {
  const router = useRouter()
  const isFocused = useIsFocused()
  const { state, pendingEvolution, away } = useElf()
  const unnamed = Boolean(state && state.hatched && state.starter === null)
  /* A form reached waits for its moment; the away card waits behind it. */
  const card = unnamed ? 'hatch' : pendingEvolution ? (evolutionSeen ? 'evolve' : null) : away ? 'away' : null

  useEffect(() => {
    if (!isFocused || !card) return
    const route = card === 'hatch' ? '/elf-hatch' : card === 'evolve' ? '/elf-evolve' : '/elf-away'
    const timer = setTimeout(() => router.push(route), card === 'hatch' ? HATCH_SETTLE_MS : card === 'evolve' ? EVOLVE_SETTLE_MS : AWAY_SETTLE_MS)
    return () => clearTimeout(timer)
  }, [isFocused, card, router])
}
