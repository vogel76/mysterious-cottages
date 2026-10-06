import { useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'

/* The greeting after an absence: when the player comes back to the Elf
   tab and has not done anything for the elf in half an hour, the elf
   (awake) greets them once, the way Finch and Tamagotchi welcome a return
   instead of punishing it. A return is the tab coming into focus, or the
   app coming back to the foreground while the tab is on top, the most
   common way back to the pet: both run the same check. The greeting
   itself counts as the last interaction for the next check, so a player
   who only looks, or hops to the Atlas and back, is not told again until
   another half hour has passed; a need that drifts or a hint that passes
   while the tab is open never repeats it either. A short delay lets the
   scene settle out of its paused pose first, and the hook reports that a
   greeting is pending or playing so the tab can hold back the elf's call
   for attention, which would otherwise cut the wave short on the same
   edge. The tab wires what the greeting does (the scene's reaction and
   the hint). */

/* An absence counts from here. */
export const RETURN_AFTER_MS = 30 * 60 * 1000
/* The scene resumes its loops on focus; the greeting follows just after. */
const GREET_DELAY_MS = 500
/* How long the greeting is reported as playing after it starts: the
   'greet' reaction lasts 1800 ms. */
const GREET_HOLD_MS = 2000

type Options = {
  focused: boolean
  /* A hatched elf that is not asleep. */
  awake: boolean
  lastInteraction: number
  onGreet: () => void
}

/* Returns true while a greeting is pending or playing. */
export function useReturnGreeting({ focused, awake, lastInteraction, onGreet }: Options): boolean {
  /* The latest values for the edges, without re-running them. */
  const awakeRef = useRef(awake)
  awakeRef.current = awake
  const lastRef = useRef(lastInteraction)
  lastRef.current = lastInteraction
  const greetRef = useRef(onGreet)
  greetRef.current = onGreet
  /* When the elf last greeted: a greeting is an interaction for the next check. */
  const greetedAt = useRef(0)
  const [greeting, setGreeting] = useState(false)

  useEffect(() => {
    if (!focused) return
    let greetTimer: ReturnType<typeof setTimeout> | null = null
    let holdTimer: ReturnType<typeof setTimeout> | null = null
    const clear = () => {
      if (greetTimer) clearTimeout(greetTimer)
      if (holdTimer) clearTimeout(holdTimer)
      greetTimer = null
      holdTimer = null
    }
    const check = () => {
      clear()
      const since = Date.now() - Math.max(lastRef.current, greetedAt.current)
      const due = awakeRef.current && lastRef.current > 0 && since > RETURN_AFTER_MS
      setGreeting(due)
      if (!due) return
      greetTimer = setTimeout(() => {
        greetTimer = null
        greetedAt.current = Date.now()
        greetRef.current()
        holdTimer = setTimeout(() => {
          holdTimer = null
          setGreeting(false)
        }, GREET_HOLD_MS)
      }, GREET_DELAY_MS)
    }
    check()
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') check()
    })
    return () => {
      clear()
      subscription.remove()
      setGreeting(false)
    }
  }, [focused])

  return greeting
}
