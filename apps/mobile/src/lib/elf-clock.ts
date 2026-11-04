import { ELF_DEMO } from '../config'

/* The elf's clock: the moment the rules are told, everywhere the elf's
   state is read or changed (the provider, the tab, the sheets, the
   countdowns), so that one build can run it faster than the wall clock.
   In a demo build (ELF_DEMO) it runs seventy-two times faster from a
   fixed moment, a day in twenty minutes, so the waits of the rules pass
   in a sitting; the stored state then carries these fast timestamps,
   which is why a demo build lives under its own package. Animations,
   sounds and the save throttle keep the real clock. */

/* How many times faster the demo's clock runs: a day in twenty minutes. */
export const ELF_DEMO_PACE = 72
/* Where the demo's clock starts counting from, the same on every launch. */
const DEMO_EPOCH = Date.UTC(2026, 10, 4)

/* A real moment on the elf's clock: the same moment, or in a demo the
   one its fast clock shows for it (the cottages' finds are stamped by the
   wall clock and must sit on the elf's clock before the rules compare
   them with the egg or the days). */
export function elfTime(real: number): number {
  return ELF_DEMO ? DEMO_EPOCH + (real - DEMO_EPOCH) * ELF_DEMO_PACE : real
}

export function elfNow(): number {
  return elfTime(Date.now())
}
