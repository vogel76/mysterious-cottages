import { StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { BadgesIcon, DecorIcon, GamesIcon, LockIcon, PeddlerIcon, PressableScale, ProgressRing, Text, TricksIcon, colors, iconSize, mapPalette, radius, space, useNarrow, withAlpha, type Icon } from '../../ui'
import { TutorialHalo } from './TutorialHalo'

/* The round buttons along the sides of the cottage, the way a game's home
   screen keeps what there is to do one tap away: on the left the day's
   quests (a ring of how many are done, a dot while the day's reward waits)
   and the badges; on the right the games, the skills, the peddler and the
   decorating. Each is a round button in the HUD's chrome with its one-word
   name under it on a pill, so it reads over the busy room. A button with
   something new behind it wears a gold dot. Before the hatch the elf's own
   things (the games, the skills, the peddler) stand dimmed under a lock:
   seen, so the player knows what is coming, and a tap says they open once
   the elf has hatched (the tab says it). A tutorial step can light one
   button with a breathing ring. The rails take no touch between their
   buttons, so the room under them stays alive. On a narrow window (a
   phone in its zoomed display, 320 points) the columns, buttons and
   rings take their compact size (RAIL_SIZES), so the two rails cover
   less of the room and the left one clears the bed the elf sleeps in,
   and a name too long for its pill shrinks instead of being cut. */

export type RailId = 'quests' | 'badges' | 'games' | 'skills' | 'peddler' | 'decor'

export type ElfRailsProps = {
  /* Where the rails start, under the strip at the top. */
  top: number
  /* The egg: the elf's own things are locked. */
  egg: boolean
  questsDone: number
  questsTotal: number
  rewardWaiting: boolean
  badgesToClaim: boolean
  peddlerFresh: boolean
  skillToTrain: boolean
  /* The button a tutorial step lights. */
  lit?: RailId | null
  onPress: (id: RailId) => void
  /* A locked button was tapped. */
  onLocked: (id: RailId) => void
}

type Rail = { id: RailId; Glyph: Icon; label: string; dot?: boolean; locked?: boolean }

/* The button's circle, the ring's box around it, and the column's width
   (the longest one-word name fits under the circle), at full size and
   compact for a narrow window. */
type RailSizes = { button: number; ring: number; column: number }
const RAIL_SIZES: Record<'full' | 'compact', RailSizes> = {
  full: { button: 50, ring: 56, column: 92 },
  compact: { button: 44, ring: 50, column: 72 },
}

export function ElfRails({ top, egg, questsDone, questsTotal, rewardWaiting, badgesToClaim, peddlerFresh, skillToTrain, lit = null, onPress, onLocked }: ElfRailsProps) {
  const { t } = useTranslation()
  const size = RAIL_SIZES[useNarrow() ? 'compact' : 'full']
  const left: Rail[] = [{ id: 'badges', Glyph: BadgesIcon, label: t('mobile:elf.railBadges'), dot: badgesToClaim }]
  const right: Rail[] = [
    { id: 'games', Glyph: GamesIcon, label: t('mobile:elf.railGames'), locked: egg },
    { id: 'skills', Glyph: TricksIcon, label: t('mobile:elf.railSkills'), locked: egg, dot: skillToTrain },
    { id: 'peddler', Glyph: PeddlerIcon, label: t('mobile:elf.railPeddler'), locked: egg, dot: peddlerFresh },
    { id: 'decor', Glyph: DecorIcon, label: t('mobile:elf.decorate') },
  ]
  const press = (rail: Rail) => (rail.locked ? onLocked(rail.id) : onPress(rail.id))
  return (
    <>
      <View style={[styles.rail, styles.left, { top, width: size.column }]} pointerEvents="box-none">
        <QuestsButton done={questsDone} total={questsTotal} rewardWaiting={rewardWaiting} lit={lit === 'quests'} size={size} onPress={() => onPress('quests')} />
        {left.map((rail) => (
          <RailButton key={rail.id} rail={rail} lit={lit === rail.id} size={size} onPress={() => press(rail)} />
        ))}
      </View>
      <View style={[styles.rail, styles.right, { top, width: size.column }]} pointerEvents="box-none">
        {right.map((rail) => (
          <RailButton key={rail.id} rail={rail} lit={lit === rail.id} size={size} onPress={() => press(rail)} />
        ))}
      </View>
    </>
  )
}

/* One round button with its name; a dot for something new, a lock while
   it waits for the hatch. */
function RailButton({ rail, lit, size, onPress }: { rail: Rail; lit: boolean; size: RailSizes; onPress: () => void }) {
  const { t } = useTranslation()
  const { Glyph, label, dot, locked } = rail
  return (
    <View style={styles.item} pointerEvents="box-none">
      <View style={[styles.well, { width: size.ring, height: size.ring }]}>
        {lit ? <TutorialHalo /> : null}
        <PressableScale
          onPress={onPress}
          scaleTo={0.9}
          accessibilityRole="button"
          accessibilityLabel={locked ? t('mobile:elf.railLockedAria', { name: label }) : dot ? `${label}. ${t('mobile:elf.railFreshAria')}` : label}
          pressedFill={colors.accentWash}
          style={[styles.button, { width: size.button, height: size.button }, locked && styles.buttonLocked]}
        >
          <Glyph size={size.button < RAIL_SIZES.full.button ? iconSize.md : iconSize.lg} weight="duotone" color={locked ? mapPalette.chromeInk : colors.accentStrong} />
        </PressableScale>
        {dot && !locked ? <View style={styles.dot} pointerEvents="none" /> : null}
        {locked ? (
          <View style={styles.lock} pointerEvents="none">
            <LockIcon size={iconSize.xs} weight="fill" color={mapPalette.chromeInk} />
          </View>
        ) : null}
      </View>
      <Name text={label} width={size.column} dim={locked} />
    </View>
  )
}

/* The day's quests: the count inside a ring of their progress, a dot
   while the day's reward waits. */
function QuestsButton({ done, total, rewardWaiting, lit, size, onPress }: { done: number; total: number; rewardWaiting: boolean; lit: boolean; size: RailSizes; onPress: () => void }) {
  const { t } = useTranslation()
  const label = t('mobile:elf.railQuests')
  return (
    <View style={styles.item} pointerEvents="box-none">
      <View style={[styles.well, { width: size.ring, height: size.ring }]}>
        {lit ? <TutorialHalo /> : null}
        <PressableScale
          onPress={onPress}
          scaleTo={0.9}
          accessibilityRole="button"
          accessibilityLabel={`${t('mobile:elf.railQuestsAria', { done, total })}${rewardWaiting ? ` ${t('mobile:elf.rewardWaitingAria')}` : ''}`}
          pressedFill={colors.accentWash}
          style={[styles.button, { width: size.button, height: size.button }]}
        >
          <Text weight="bold" variant="compact" style={styles.count}>
            {done}/{total}
          </Text>
        </PressableScale>
        <View style={styles.ring} pointerEvents="none">
          <ProgressRing size={size.ring} value={done} max={Math.max(1, total)} stroke={3} color={done >= total ? colors.success : colors.accent} track={withAlpha(mapPalette.chromeInk, 0.2)} decorative />
        </View>
        {rewardWaiting ? <View style={styles.dot} pointerEvents="none" /> : null}
      </View>
      <Name text={label} width={size.column} />
    </View>
  )
}

/* A button's name on a pill of the chrome, so it reads over the room; a
   name longer than the pill shrinks to fit rather than being cut. */
function Name({ text, width, dim = false }: { text: string; width: number; dim?: boolean }) {
  return (
    <View style={[styles.name, { maxWidth: width }]} pointerEvents="none">
      <Text variant="small" weight="semibold" align="center" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[styles.nameInk, dim && styles.nameDim]}>
        {text}
      </Text>
    </View>
  )
}

const DOT = 12
const LOCK = 20

const styles = StyleSheet.create({
  rail: {
    position: 'absolute',
    gap: space.sm,
    alignItems: 'center',
  },
  left: {
    left: space.xs,
  },
  right: {
    right: space.xs,
  },
  item: {
    alignItems: 'center',
    gap: 2,
  },
  well: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: mapPalette.chromeBorder,
    backgroundColor: mapPalette.chromeSolid,
  },
  buttonLocked: {
    opacity: 0.6,
  },
  ring: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  count: {
    color: mapPalette.chromeInk,
  },
  dot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: DOT,
    height: DOT,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accentInk,
    backgroundColor: colors.accentStrong,
  },
  lock: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: LOCK,
    height: LOCK,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: mapPalette.chromeBorder,
    backgroundColor: mapPalette.chromeSolid,
  },
  name: {
    paddingHorizontal: space.sm,
    paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: mapPalette.chromeSolid,
  },
  nameInk: {
    color: mapPalette.chromeInk,
  },
  nameDim: {
    opacity: 0.7,
  },
})
