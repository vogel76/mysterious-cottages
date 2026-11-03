import { StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { ELF_PATHS, ELF_TREE, levelOf, nodeStatus, pointsLeft, rankOf, xpForLevel, type ElfNodeId, type ElfPath } from '@chatynkowo/core'
import { useElf, useToast } from '../../providers'
import { Button, CheckIcon, LockIcon, PathGluttonIcon, PathPranksterIcon, PathTrackerIcon, SheetRoute, Text, colors, iconSize, radius, space, type Icon } from '../../ui'
import { nodeKey, pathKey, rankKey } from './labels'

/* The elf's tree of development (the route /elf-tree), from the name
   block on the elf's bar: the level with its rank and the experience
   towards the next level, the points at hand (one per level past the
   first, less the nodes unlocked), and the three paths of four nodes
   each, in order: a node owned, the next one open (unlocked here for a
   point, with its effect said plainly), the rest locked behind it. The
   rules hold the numbers and the effects (packages/core: XP, levelOf,
   rankOf, unlockNode, and the care, the drift, the quests' pay, the
   sill, the streak and the catalogue reading the nodes). */

const PATH_ICON: Record<ElfPath, Icon> = { glutton: PathGluttonIcon, prankster: PathPranksterIcon, tracker: PathTrackerIcon }

export function ElfTreeSheet() {
  const { t } = useTranslation()
  const toast = useToast()
  const { state, unlockNode } = useElf()
  if (!state) return <SheetRoute>{null}</SheetRoute>
  const level = levelOf(state.xp)
  const rank = t(rankKey(rankOf(level)))
  const from = xpForLevel(level)
  const span = xpForLevel(level + 1) - from
  const into = state.xp - from
  const points = pointsLeft(state)

  const unlock = (id: ElfNodeId) => {
    if (unlockNode(id)) toast.show({ tone: 'success', text: t('mobile:elf.nodeUnlockedToast', { name: t(nodeKey(id)) }) })
  }

  return (
    <SheetRoute scroll>
      <View style={styles.column}>
        <View style={styles.head}>
          <Text variant="eyebrow">{t('mobile:elf.treeKicker')}</Text>
          <Text variant="title" accessibilityRole="header">
            {t('mobile:elf.treeTitle')}
          </Text>
          <View accessible accessibilityLabel={t('mobile:elf.treeXpAria', { level, rank, xp: into, next: span })} style={styles.progress}>
            <Text weight="bold">{t('mobile:elf.treeLevel', { level, rank })}</Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.round((100 * into) / span)}%` }]} />
            </View>
            <Text variant="small" tone="soft">
              {t('mobile:elf.treeXp', { xp: into, next: span })}
            </Text>
          </View>
          <Text weight="semibold" tone={points > 0 ? 'accent' : 'soft'} accessibilityLiveRegion="polite">
            {points > 0 ? t('mobile:elf.treePoints', { count: points }) : t('mobile:elf.treePointsNone')}
          </Text>
          <Text tone="soft">{t('mobile:elf.treeLead')}</Text>
        </View>

        {ELF_PATHS.map((path) => {
          const Glyph = PATH_ICON[path]
          return (
            <View key={path} style={styles.card}>
              <View style={styles.cardTitle}>
                <Glyph size={iconSize.lg} weight="duotone" color={colors.accentStrong} />
                <Text variant="heading" accessibilityRole="header">
                  {t(pathKey(path))}
                </Text>
              </View>
              {ELF_TREE[path].map((id) => {
                const status = nodeStatus(state, id)
                const name = t(nodeKey(id))
                return (
                  <View key={id} style={[styles.node, status === 'locked' && styles.nodeLocked]}>
                    <View style={styles.nodeWords}>
                      <Text weight="bold" numberOfLines={1}>
                        {name}
                      </Text>
                      <Text variant="small" tone="soft">
                        {t(nodeKey(id, 'effect'))}
                      </Text>
                    </View>
                    {status === 'owned' ? (
                      <View style={styles.mark} accessible accessibilityLabel={t('mobile:elf.nodeOwned')}>
                        <CheckIcon size={iconSize.md} weight="bold" color={colors.success} />
                      </View>
                    ) : status === 'open' ? (
                      <Button variant="primary" disabled={points <= 0} accessibilityLabel={t('mobile:elf.nodeUnlockAria', { name })} onPress={() => unlock(id)}>
                        {points > 0 ? t('mobile:elf.nodeUnlock') : t('mobile:elf.nodeNoPoints')}
                      </Button>
                    ) : (
                      <View style={styles.mark} accessible accessibilityLabel={t('mobile:elf.nodeLocked')}>
                        <LockIcon size={iconSize.md} color={colors.inkFaint} />
                      </View>
                    )}
                  </View>
                )
              })}
            </View>
          )
        })}
      </View>
    </SheetRoute>
  )
}

const styles = StyleSheet.create({
  column: {
    gap: space.lg,
    paddingTop: space.sm,
  },
  head: {
    gap: space.sm,
  },
  progress: {
    gap: space.xs,
  },
  /* The experience towards the next level, as a bar. */
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.line,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.accentStrong,
  },
  card: {
    gap: space.md,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  cardTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  /* A node: its name and effect on the left, its state on the right. */
  node: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.control,
    backgroundColor: colors.pageRaised,
  },
  nodeLocked: {
    opacity: 0.6,
  },
  nodeWords: {
    flex: 1,
    gap: 2,
  },
  mark: {
    width: 40,
    alignItems: 'center',
  },
})
