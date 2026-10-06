import { EvolutionReveal } from '../src/features/elf/EvolutionReveal'

/* The evolution route: a transparent modal the Elf tab presents over itself
   when the elf hatches or reaches a new form. The card and its rules live
   in EvolutionReveal. */
export default function ElfEvolveScreen() {
  return <EvolutionReveal />
}
