import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { STORAGE_KEYS } from '../../config'
import { readJson, writeJson } from '../../lib/storage'

/* The tutorial of the Elf tab: a few short cards the player clicks
   through at their own pace, one flow for the egg (tap it, warm and rock
   it, the day's quests, what waits for the hatch, the hurry) and one for
   the hatched and named elf (pet it, feed it, the rings and the energy,
   the buttons on the right, the quests and the badges on the left, the
   level with the tree, the purse with the shop's plus). A step that asks
   for a move waits for it (the tab reports the moves as they happen)
   before "next" lights up; a step lights everything it speaks of, the
   move it waits for or the places it shows, so the tab can make them
   pulse (TutorialHalo); "back" returns to the card before, which never
   asks for its move again, and "skip" ends the flow. Each flow is shown
   once per device, remembered in AsyncStorage, and a flow only starts
   while the tab is in view with no panel over it and the egg not yet
   ready to hatch (the hatch has its own ritual). */

export type TutorialFlow = 'egg' | 'elf'
/* The moves a step can wait for, and the places it can show: the egg or
   the elf in the room, a button of the care band, the care band's rings,
   a button of the rails, the hurry, the name block, the purse. */
export type TutorialMove = 'egg' | 'warm' | 'quests' | 'pet' | 'feed'
export type TutorialSpot = TutorialMove | 'rock' | 'rings' | 'badges' | 'games' | 'skills' | 'peddler' | 'decor' | 'hurry' | 'name' | 'purse'

export type TutorialStep = {
  index: number
  total: number
  text: string
  /* The move this step waits for, still to be made. */
  waiting: boolean
  /* What to light: the move still to be made, else every place the step
     speaks of; a step looked at again lights its move too. Empty for a
     step that only tells. */
  targets: readonly TutorialSpot[]
  first: boolean
  last: boolean
}

type Flags = Partial<Record<TutorialFlow, boolean>>
type StepSpec = { key: string; waits?: TutorialMove; shows?: readonly TutorialSpot[] }

/* The buttons of the right rail, which two cards speak of together. */
const RIGHT_RAIL: readonly TutorialSpot[] = ['games', 'skills', 'peddler', 'decor']

const FLOWS: Record<TutorialFlow, readonly StepSpec[]> = {
  egg: [
    { key: 'tutorialEgg1', waits: 'egg' },
    { key: 'tutorialEgg2', waits: 'warm', shows: ['rock'] },
    { key: 'tutorialEgg3', waits: 'quests' },
    { key: 'tutorialEgg4', shows: RIGHT_RAIL },
    { key: 'tutorialEgg5', shows: ['hurry'] },
  ],
  elf: [
    { key: 'tutorialElf1', waits: 'pet' },
    { key: 'tutorialElf2', waits: 'feed' },
    { key: 'tutorialElf3', shows: ['rings'] },
    { key: 'tutorialElf4', shows: RIGHT_RAIL },
    { key: 'tutorialElf5', shows: ['quests', 'badges'] },
    { key: 'tutorialElf6', shows: ['name'] },
    { key: 'tutorialElf7', shows: ['purse'] },
  ],
}

const NO_SPOTS: readonly TutorialSpot[] = []

export type ElfTutorial = {
  /* The card to show, or null when no flow is on. */
  step: TutorialStep | null
  next: () => void
  /* To the card before; nothing on the first one. */
  back: () => void
  skip: () => void
  /* The tab reports a move; the waiting step takes it. */
  note: (move: TutorialMove) => void
}

export function useElfTutorial({ flow, ready }: { flow: TutorialFlow | null; ready: boolean }): ElfTutorial {
  const { t } = useTranslation()
  const [flags, setFlags] = useState<Flags | null>(null)
  const [index, setIndex] = useState(0)
  /* The furthest card reached and whether its move is made: a card
     behind it was cleared on the way there, so going back never asks for
     a move twice. */
  const [furthest, setFurthest] = useState(0)
  const [made, setMade] = useState(false)
  const running = useRef<TutorialFlow | null>(flow)

  useEffect(() => {
    let current = true
    void readJson<Flags>(STORAGE_KEYS.elfTutorial)
      .then((stored) => {
        if (current) setFlags(stored ?? {})
      })
      .catch(() => {
        if (current) setFlags({})
      })
    return () => {
      current = false
    }
  }, [])

  /* A flow not yet seen shows while the tab is ready for it (a sheet over
     the tab only hides the card, the place in the flow is kept); a change
     of flow (the hatch) starts over at the first card. */
  const active = flags && flow && !flags[flow] && ready ? flow : null
  useEffect(() => {
    if (running.current !== flow) {
      running.current = flow
      setIndex(0)
      setFurthest(0)
      setMade(false)
    }
  }, [flow])

  const finish = useCallback(() => {
    if (!active) return
    const next = { ...(flags ?? {}), [active]: true }
    setFlags(next)
    void writeJson(STORAGE_KEYS.elfTutorial, next)
  }, [active, flags])

  const specs = active ? FLOWS[active] : []
  const spec = specs[index]

  const next = useCallback(() => {
    if (!spec) return
    if (index + 1 >= specs.length) {
      finish()
      return
    }
    if (index === furthest) {
      setFurthest(index + 1)
      setMade(false)
    }
    setIndex(index + 1)
  }, [spec, index, furthest, specs.length, finish])

  const back = useCallback(() => {
    if (index > 0) setIndex(index - 1)
  }, [index])

  /* The move belongs to the furthest card, whichever card is looked at. */
  const awaited = specs[furthest]?.waits
  const note = useCallback(
    (move: TutorialMove) => {
      if (awaited === move) setMade(true)
    },
    [awaited],
  )

  const step = useMemo<TutorialStep | null>(() => {
    if (!active || !spec) return null
    const cleared = index < furthest
    const waiting = Boolean(spec.waits) && !cleared && !made
    const shows = spec.shows ?? NO_SPOTS
    const targets = spec.waits && waiting ? [spec.waits] : spec.waits && cleared ? [spec.waits, ...shows] : shows
    return { index, total: specs.length, text: t(`mobile:elf.${spec.key}`), waiting, targets, first: index === 0, last: index + 1 >= specs.length }
  }, [active, spec, index, furthest, specs.length, made, t])

  return { step, next, back, skip: finish, note }
}
