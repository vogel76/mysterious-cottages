import { useLocalSearchParams } from 'expo-router'
import { ElfLetterSheet } from '../src/features/elf/ElfLetterSheet'

/* A letter from the elves of the cottages, by its number (the `n` param),
   a sheet over the Elf tab from the envelope in the room, the 'while you
   were away' card or the keepsake shelf. The sheet and its copy live in
   ElfLetterSheet. */
export default function ElfLetterScreen() {
  const { n } = useLocalSearchParams<{ n: string }>()
  return <ElfLetterSheet n={Number(n)} />
}
