import { ElfPictureView } from '../src/features/elf/ElfPictureView'

/* The painting's route: a transparent modal the Elf tab presents over
   itself when the painting on the wall is touched. The picture and its
   rules live in ElfPictureView. */
export default function ElfPictureScreen() {
  return <ElfPictureView />
}
