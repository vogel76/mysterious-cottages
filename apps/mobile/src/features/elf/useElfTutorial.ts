import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { STORAGE_KEYS } from '../../config'
import { readJson, writeJson } from '../../lib/storage'

/* The tutorial of the Elf tab: a few short cards the player clicks
   through at their own pace, one flow for the egg (tap it, warm and rock
   it, the day's quests, what waits for the hatch, the free hurry) and
   one for the hatched and named elf (pet it, feed it, the rings and the
   energy, the buttons on the right, the quests and the badges on the
   left, the level with the tree, the purse with the shop's plus). A step
   that asks for a move waits for it (the tab reports the moves as they
   happen) before "next" lights up; a step lights what it is about, the
   move it waits for or the place it shows, so the tab can ring it
   (TutorialHalo); "skip" ends the flow. Each
   flow is shown once per device, remembered in AsyncStorage, and a
   flow only starts while the tab is in view with no panel over it and
   the egg not yet ready to hatch (the hatch has its own ritual). */

export type TutorialFlow = 'egg' | 'elf'
/* The moves a step can wait for, and the places it can show. */
export type TutorialMove = 'egg' | 'warm' | 'quests' | 'pet' | 'feed'
export type TutorialSpot = TutorialMove | 'rock' | 'games' | 'hurry' | 'name' | 'purse'

export type TutorialStep = {
  index: number
  total: number
  text: string
  /* The move this step waits for, still to be made. */
  waiting: boolean
  /* What to light: the move still to be made, else the place the step
     is about (the egg or the elf in the room, a button of the care band
     or the rails, the name block, the purse, the hurry); null for a step
     that only tells. */
  target: TutorialSpot | null
  last: boolean
}

type Flags = Partial<Record<TutorialFlow, boolean>>
type StepSpec = { key: string; waits?: TutorialMove; shows?: TutorialSpot }

const FLOWS: Record<TutorialFlow, readonly StepSpec[]> = {
  egg: [
    { key: 'tutorialEgg1', waits: 'egg' },
    { key: 'tutorialEgg2', waits: 'warm', shows: 'rock' },
    { key: 'tutorialEgg3', waits: 'quests' },
    { key: 'tutorialEgg4', shows: 'games' },
    { key: 'tutorialEgg5', shows: 'hurry' },
  ],
  elf: [
    { key: 'tutorialElf1', waits: 'pet' },
    { key: 'tutorialElf2', waits: 'feed' },
    { key: 'tutorialElf3' },
    { key: 'tutorialElf4', shows: 'games' },
    { key: 'tutorialElf5', shows: 'quests' },
    { key: 'tutorialElf6', shows: 'name' },
    { key: 'tutorialElf7', shows: 'purse' },
  ],
}

export type ElfTutorial = {
  /* The card to show, or null when no flow is on. */
  step: TutorialStep | null
  next: () => void
  skip: () => void
  /* The tab reports a move; the waiting step takes it. */
  note: (move: TutorialMove) => void
}

export function useElfTutorial({ flow, ready }: { flow: TutorialFlow | null; ready: boolean }): ElfTutorial {
  const { t } = useTranslation()
  const [flags, setFlags] = useState<Flags | null>(null)
  const [index, setIndex] = useState(0)
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
    setIndex(index + 1)
    setMade(false)
  }, [spec, index, specs.length, finish])

  const note = useCallback(
    (move: TutorialMove) => {
      if (spec?.waits === move) setMade(true)
    },
    [spec],
  )

  const step = useMemo<TutorialStep | null>(() => {
    if (!active || !spec) return null
    const waiting = Boolean(spec.waits) && !made
    return { index, total: specs.length, text: t(`mobile:elf.${spec.key}`), waiting, target: (waiting ? spec.waits : undefined) ?? spec.shows ?? null, last: index + 1 >= specs.length }
  }, [active, spec, index, specs.length, made, t])

  return { step, next, skip: finish, note }
}
