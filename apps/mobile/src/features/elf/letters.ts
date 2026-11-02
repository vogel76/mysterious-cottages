import type { Cottage, ElfLetter, ElfLetterKind } from '@chatynkowo/core'

/* The words of a letter from the elves of the cottages. The rules
   (@chatynkowo/core) say only who writes and when. A cottage's own words
   come with its story (the frontmatter's letterFound and letterInvite,
   written in the admin editor, {{elf}} standing for the elf's name); a
   cottage without them gets the dictionary's templates (letterFound0..,
   letterInvite0.., the letter's number picking one, so the letters of
   one kind take turns). A cottage found signs with its occupant and
   names its motto; one not found yet signs with its title and keeps its
   motto for the visit. The forest writes for the season of the letter's
   day, each season with a signature of its own. */

const TEMPLATES: Record<Exclude<ElfLetterKind, 'forest'>, number> = { found: 3, invite: 3 }

/* The forest's seasons: the four of the year, with the December
   holidays and the first days of the summer holidays as seasons of
   their own. */
export type ForestSeason = 'Spring' | 'Summer' | 'Autumn' | 'Winter' | 'Yule' | 'Holidays'

export function forestSeason(day: string): ForestSeason {
  const [, month = 1, date = 1] = day.split('-').map(Number)
  if (month === 12 && date >= 6) return 'Yule'
  if ((month === 6 && date >= 20) || (month === 7 && date <= 10)) return 'Holidays'
  if (month >= 3 && month <= 5) return 'Spring'
  if (month >= 6 && month <= 8) return 'Summer'
  if (month >= 9 && month <= 11) return 'Autumn'
  return 'Winter'
}

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
    const season = forestSeason(letter.day)
    return { from: t('mobile:elf.letterFromForest'), greeting, body: t(`mobile:elf.letterForest${season}`, { elf: elfName }), sign: t(`mobile:elf.letterSign${season}`) }
  }
  const own = letter.kind === 'found' ? cottage.letterFound : cottage.letterInvite
  const body = own
    ? own.replace(/\{\{\s*elf\s*\}\}/g, elfName)
    : t(`mobile:elf.${letter.kind === 'found' ? 'letterFound' : 'letterInvite'}${letter.n % TEMPLATES[letter.kind]}`, { virtue: cottage.virtue.toLocaleLowerCase(language) })
  return { from: cottage.title, greeting, body, sign: letter.kind === 'found' ? cottage.occupant : cottage.title }
}

/* Who a letter is from, without its words. */
export function letterFrom(t: Translate, letter: ElfLetter, cottages: readonly Cottage[]): string {
  const cottage = letter.slug ? cottages.find((candidate) => candidate.slug === letter.slug) : undefined
  return letter.kind === 'forest' || !cottage ? t('mobile:elf.letterFromForest') : cottage.title
}
