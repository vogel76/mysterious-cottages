import type { Cottage, ElfLetter, ElfLetterKind } from '@chatynkowo/core'

/* The words of a letter from the elves of the cottages. The rules
   (@chatynkowo/core) say only who writes and when; the copy is the
   dictionary's: a few templates per kind (letterFound0.., letterInvite0..,
   letterForest0..), the letter's number picking one, so the letters of
   one kind take turns. A cottage found signs with its occupant and names
   its motto; one not found yet signs with its title and keeps its motto
   for the visit; the forest's letters each have their own signature. */

const TEMPLATES: Record<ElfLetterKind, number> = { found: 3, invite: 3, forest: 2 }
const FOREST_SIGNS = ['mobile:elf.letterSignOwl', 'mobile:elf.letterSignForest'] as const

type Translate = (key: string, values?: Record<string, string>) => string

export type LetterText = {
  /* Who it is from, for the header and the lists: the cottage's title or the forest. */
  from: string
  greeting: string
  body: string
  sign: string
}

export function letterText(t: Translate, letter: ElfLetter, cottage: Cottage | undefined, elfName: string, language: string): LetterText {
  const greeting = t('mobile:elf.letterGreeting', { elf: elfName })
  if (letter.kind === 'forest' || !cottage) {
    const forest = letter.n % TEMPLATES.forest
    return { from: t('mobile:elf.letterFromForest'), greeting, body: t(`mobile:elf.letterForest${forest}`), sign: t(FOREST_SIGNS[forest]!) }
  }
  const prefix = letter.kind === 'found' ? 'letterFound' : 'letterInvite'
  const body = t(`mobile:elf.${prefix}${letter.n % TEMPLATES[letter.kind]}`, { virtue: cottage.virtue.toLocaleLowerCase(language) })
  return { from: cottage.title, greeting, body, sign: letter.kind === 'found' ? cottage.occupant : cottage.title }
}

/* Who a letter is from, without its words. */
export function letterFrom(t: Translate, letter: ElfLetter, cottages: readonly Cottage[]): string {
  const cottage = letter.slug ? cottages.find((candidate) => candidate.slug === letter.slug) : undefined
  return letter.kind === 'forest' || !cottage ? t('mobile:elf.letterFromForest') : cottage.title
}
