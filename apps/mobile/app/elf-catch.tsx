import { ElfCatch } from '../src/features/elf/catch/ElfCatch'

/* The elf prototype's catch view: a full screen modal over the tabs with
   the camera as the world, presented by the root stack under a
   transparent header that carries the title and the close item (see
   app/_layout.tsx). The screen itself lives with the feature. */

export default function ElfCatchScreen() {
  return <ElfCatch />
}
