import { useEffect, useState } from 'react'
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { archetypeOf, ELF_PATHS, ELF_TREE, levelOf, nodeStatus, pointsLeft, rankOf, treeNode, xpForLevel, type ElfNodeId, type ElfNodeStatus, type ElfPath } from '@chatynkowo/core'
import { useCloseModal, useElf, useToast } from '../../providers'
import {
  AcornsIcon,
  AntlersIcon,
  BathIcon,
  BigGameIcon,
  BigMealIcon,
  Button,
  CauldronIcon,
  CheckIcon,
  ExtraGameIcon,
  ExtraMealIcon,
  ForgivingStreakIcon,
  HammockIcon,
  LockIcon,
  LongJoyIcon,
  PathGluttonIcon,
  PathPranksterIcon,
  PathTrackerIcon,
  PressableScale,
  QuickHandsIcon,
  SharpEyeIcon,
  SheetRoute,
  SlowHungerIcon,
  SoundSleepIcon,
  StreakIcon,
  Text,
  colors,
  iconSize,
  radius,
  space,
  type Icon,
} from '../../ui'
import { elfKey, nodeKey, pathKey, rankKey } from './labels'

/* The elf's tree of development (the route /elf-tree), from the name
   block at the top of the cottage: the level with its rank and the experience
   towards the next level, the points at hand (one per level past the
   first, less the nodes unlocked), the archetype once chosen, the next
   form (the level it waits for, or, once reached, the button that lets
   the elf grow, which closes the sheet so the moment is seen in the
   room), and the tree itself, drawn as one. A trunk at the bottom carries the level;
   the roots' node sits on it; the tree forks into three branches (the
   glutton's leaning left, the prankster's straight, the tracker's
   leaning right), each forks again into a pair, the pair merges in a
   node the neighbouring branches reach too by a shortcut, and over each
   merge stands the archetype. Every parent-child pair is joined by a
   line that lights up once both ends are owned, so the route climbed
   shows. A node is a circle with its own picture: filled when owned,
   outlined and breathing when open with a point at hand, dim with a lock
   while none of its parents is owned or, for an archetype, once another
   is chosen. Tapping a node picks it, and the card under the tree says
   what it gives and offers the unlock; the first open node is picked on
   arrival; the card is the sheet's footer, pinned under the scrolling
   tree so it stays in view whatever node is tapped. The
   rules hold the shape, the numbers and the effects
   (packages/core: ELF_TREE, nodeStatus, unlockNode, archetypeOf, and the
   care, the drift, the quests' pay, the sill, the streak and the
   catalogue reading the nodes). */

const PATH_ICON: Record<ElfPath, Icon> = { glutton: PathGluttonIcon, prankster: PathPranksterIcon, tracker: PathTrackerIcon }
const NODE_ICON: Record<ElfNodeId, Icon> = {
  roots: QuickHandsIcon,
  belly: SlowHungerIcon,
  smile: LongJoyIcon,
  eye: SharpEyeIcon,
  pantry: ExtraMealIcon,
  feast: BigMealIcon,
  games: ExtraGameIcon,
  party: BigGameIcon,
  trail: ForgivingStreakIcon,
  luck: StreakIcon,
  hearth: SoundSleepIcon,
  fair: AcornsIcon,
  camp: BathIcon,
  glutton: CauldronIcon,
  prankster: HammockIcon,
  tracker: AntlersIcon,
}

/* The drawing, in points: a node's diameter, an archetype's, the
   trunk's, the rows apart, the trunk's distance to the first row, the
   labels' band above the archetypes, a line's thickness. A branch stands
   at 0.3 of the width from the middle and a pair's nodes 0.075 of it to
   each side of their branch, so six nodes share a row on a narrow sheet. */
const NODE = 40
const ARCH = 50
const ROOT = 54
const STEP = 68
const FAN = 34
const LABEL = 28
const LINE = 3
const BRANCH_OUT = 0.3
const PAIR_OUT = 0.075
const ROWS = 5
const HEIGHT = LABEL + ARCH + (ROWS - 1) * STEP + FAN + ROOT

type Point = { x: number; y: number }

const BRANCH_SIDE: Record<ElfPath, number> = { glutton: -1, prankster: 0, tracker: 1 }

/* The centre of a node for the width at hand. */
function nodeCentre(id: ElfNodeId, width: number): Point {
  const node = treeNode(id)
  const branch = node.branch ? BRANCH_SIDE[node.branch] * BRANCH_OUT * width : 0
  return { x: width / 2 + branch + node.side * PAIR_OUT * width, y: HEIGHT - ROOT - FAN - ARCH / 2 - (node.row - 1) * STEP }
}

function rootCentre(width: number): Point {
  return { x: width / 2, y: HEIGHT - ROOT / 2 }
}

export function ElfTreeSheet() {
  const { t } = useTranslation()
  const toast = useToast()
  const close = useCloseModal()
  const { state, unlockNode, nextForm, growUp, pendingEvolution } = useElf()
  const [width, setWidth] = useState(0)
  const [picked, setPicked] = useState<ElfNodeId | null>(null)
  const reduceMotion = useReducedMotion()

  /* The breath of the open nodes while a point waits to be spent: a few
     breaths on arrival and after every unlock, then still (a drawing
     that never settles would wear the eye and the battery). */
  const breath = useSharedValue(0)
  const points = state ? pointsLeft(state) : 0
  useEffect(() => {
    breath.value = points > 0 && !reduceMotion ? withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), 6, true) : withTiming(0, { duration: 300 })
  }, [breath, points, reduceMotion])

  if (!state) return <SheetRoute>{null}</SheetRoute>
  const level = levelOf(state.xp)
  const rank = t(rankKey(rankOf(level)))
  const from = xpForLevel(level)
  const span = xpForLevel(level + 1) - from
  const into = state.xp - from
  const archetype = archetypeOf(state)

  /* The node the card speaks of: the one tapped, else the first open one. */
  const firstOpen = ELF_TREE.find((node) => nodeStatus(state, node.id) === 'open')?.id ?? null
  const selected = picked ?? firstOpen
  const selectedNode = selected ? treeNode(selected) : null
  const selectedStatus = selected ? nodeStatus(state, selected) : null

  const unlock = (id: ElfNodeId) => {
    if (!unlockNode(id)) return
    const name = t(nodeKey(id))
    toast.show({ tone: 'success', text: treeNode(id).row === ROWS ? t('mobile:elf.archetypeToast', { name }) : t('mobile:elf.nodeUnlockedToast', { name }) })
  }
  const statusWord = (status: ElfNodeStatus) =>
    t(status === 'owned' ? 'mobile:elf.nodeOwned' : status === 'open' ? 'mobile:elf.nodeOpen' : status === 'taken' ? 'mobile:elf.nodeTaken' : 'mobile:elf.nodeLocked')
  const onLayout = (event: LayoutChangeEvent) => setWidth(Math.round(event.nativeEvent.layout.width))

  /* The picked node's card, pinned under the tree. */
  const card = (
    <View style={styles.card} accessibilityLiveRegion="polite">
          {selected && selectedNode && selectedStatus ? (
            <>
              <Text variant="eyebrow">
                {selectedNode.row === ROWS ? t('mobile:elf.treeArchetypeKicker') : selectedNode.branch ? t(pathKey(selectedNode.branch)) : t('mobile:elf.treeTrunk')}
              </Text>
              <Text variant="heading" accessibilityRole="header">
                {t(nodeKey(selected))}
              </Text>
              <Text tone="soft">{t(nodeKey(selected, 'effect'))}</Text>
              {selectedStatus === 'open' ? (
                <Button variant="primary" block disabled={points <= 0} accessibilityLabel={t('mobile:elf.nodeUnlockAria', { name: t(nodeKey(selected)) })} onPress={() => unlock(selected)}>
                  {points > 0 ? t('mobile:elf.nodeUnlock') : t('mobile:elf.nodeNoPoints')}
                </Button>
              ) : (
                <View style={styles.cardState}>
                  {selectedStatus === 'owned' ? <CheckIcon size={iconSize.md} weight="bold" color={colors.success} /> : <LockIcon size={iconSize.md} color={colors.inkFaint} />}
                  <Text variant="small" tone="soft">
                    {statusWord(selectedStatus)}
                  </Text>
                </View>
              )}
            </>
          ) : (
            <Text variant="small" tone="soft">
              {t('mobile:elf.treePick')}
            </Text>
          )}
        </View>
  )

  return (
    <SheetRoute scroll footer={card}>
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
          {archetype ? <Text weight="semibold">{t('mobile:elf.treeArchetype', { name: t(pathKey(archetype)) })}</Text> : null}
          {nextForm?.ready && !pendingEvolution ? (
            <View style={styles.grow}>
              <Text weight="semibold" tone="accent" style={styles.growWords}>
                {t('mobile:elf.treeGrowReady', { form: t(elfKey('stage', nextForm.form)) })}
              </Text>
              <Button
                variant="primary"
                onPress={() => {
                  if (growUp()) close()
                }}
              >
                {t('mobile:elf.growNow')}
              </Button>
            </View>
          ) : nextForm ? (
            <Text variant="small" tone="soft">
              {t('mobile:elf.treeGrowAt', { form: t(elfKey('stage', nextForm.form)), level: nextForm.level })}
            </Text>
          ) : null}
        </View>

        {/* The tree: lines first, the nodes over them, the trunk last. */}
        <View style={styles.tree} onLayout={onLayout}>
          {width > 0 ? (
            <>
              {ELF_TREE.map((node) =>
                (node.parents.length ? node.parents : [null]).map((parent) => (
                  <Branch
                    key={`${parent ?? 'root'}-${node.id}`}
                    from={parent ? nodeCentre(parent, width) : rootCentre(width)}
                    to={nodeCentre(node.id, width)}
                    lit={state.nodes.includes(node.id) && (parent === null || state.nodes.includes(parent))}
                  />
                )),
              )}
              {ELF_PATHS.map((path) => {
                const Glyph = PATH_ICON[path]
                const top = nodeCentre(path, width)
                return (
                  <View key={path} style={[styles.pathLabel, { left: top.x - 60, top: top.y - ARCH / 2 - LABEL }]} accessible accessibilityRole="header">
                    <Glyph size={iconSize.sm} weight="duotone" color={colors.accentStrong} />
                    <Text variant="label" weight="semibold" tone="soft">
                      {t(pathKey(path))}
                    </Text>
                  </View>
                )
              })}
              {ELF_TREE.map((node) => {
                const status = nodeStatus(state, node.id)
                const name = t(nodeKey(node.id))
                const where = node.branch ? t(pathKey(node.branch)) : t('mobile:elf.treeTrunk')
                return (
                  <TreeNode
                    key={node.id}
                    id={node.id}
                    status={status}
                    archetype={node.row === ROWS}
                    selected={node.id === selected}
                    breath={breath}
                    centre={nodeCentre(node.id, width)}
                    accessibilityLabel={t('mobile:elf.treeNodeAria', { name, path: where, status: statusWord(status) })}
                    onPress={() => setPicked(node.id)}
                  />
                )
              })}
              <View
                accessible
                accessibilityLabel={t('mobile:elf.treeRootAria', { level, rank })}
                style={[styles.root, { left: rootCentre(width).x - ROOT / 2, top: rootCentre(width).y - ROOT / 2 }]}
              >
                <Text variant="heading" weight="bold" style={styles.rootLevel}>
                  {level}
                </Text>
              </View>
            </>
          ) : null}
        </View>

        <Text variant="small" tone="soft">
          {t('mobile:elf.treeLead')}
        </Text>
      </View>
    </SheetRoute>
  )
}

/* The line from a parent (or the trunk) to a node: laid through the
   midpoint and turned to the angle between them. */
function Branch({ from, to, lit }: { from: Point; to: Point; lit: boolean }) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy)
  const angle = Math.atan2(dy, dx)
  return (
    <View
      pointerEvents="none"
      style={[
        styles.line,
        { left: (from.x + to.x) / 2 - length / 2, top: (from.y + to.y) / 2 - LINE / 2, width: length, transform: [{ rotate: `${angle}rad` }] },
        lit && styles.lineLit,
      ]}
    />
  )
}

type TreeNodeProps = {
  id: ElfNodeId
  status: ElfNodeStatus
  /* An archetype, drawn larger. */
  archetype: boolean
  selected: boolean
  breath: SharedValue<number>
  centre: Point
  accessibilityLabel: string
  onPress: () => void
}

function TreeNode({ id, status, archetype, selected, breath, centre, accessibilityLabel, onPress }: TreeNodeProps) {
  const Glyph = NODE_ICON[id]
  const size = archetype ? ARCH : NODE
  const halo = useAnimatedStyle(() => ({
    opacity: status === 'open' ? 0.55 - 0.45 * breath.value : 0,
    transform: [{ scale: 1 + 0.35 * breath.value }],
  }))
  const shut = status === 'locked' || status === 'taken'
  const iconColor = status === 'owned' ? colors.accentInk : status === 'open' ? colors.accentStrong : colors.inkFaint
  return (
    <View style={[styles.nodeSlot, { left: centre.x - size / 2, top: centre.y - size / 2, width: size, height: size }]}>
      <Animated.View pointerEvents="none" style={[styles.halo, { borderRadius: size / 2 }, halo]} />
      <PressableScale
        scaleTo={0.92}
        pressedFill="transparent"
        ripple={false}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ selected }}
        onPress={onPress}
        style={[
          styles.node,
          { width: size, height: size, borderRadius: size / 2 },
          status === 'owned' && styles.nodeOwned,
          status === 'open' && styles.nodeOpen,
          shut && styles.nodeShut,
          selected && styles.nodeSelected,
        ]}
      >
        <Glyph size={archetype ? iconSize.lg : iconSize.md} weight={status === 'owned' ? 'fill' : 'duotone'} color={iconColor} />
      </PressableScale>
      {status === 'owned' ? (
        <View style={[styles.badge, styles.badgeOwned]} pointerEvents="none">
          <CheckIcon size={12} weight="bold" color={colors.accentInk} />
        </View>
      ) : shut ? (
        <View style={styles.badge} pointerEvents="none">
          <LockIcon size={12} weight="fill" color={colors.inkFaint} />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  /* The next form reached: its line and the button that lets the elf grow. */
  grow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.xs,
  },
  growWords: {
    flex: 1,
  },
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
  /* The drawing: everything inside is placed by its centre. */
  tree: {
    height: HEIGHT,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  line: {
    position: 'absolute',
    height: LINE,
    borderRadius: LINE / 2,
    backgroundColor: colors.line,
  },
  lineLit: {
    backgroundColor: colors.accentStrong,
  },
  pathLabel: {
    position: 'absolute',
    width: 120,
    height: LABEL,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
  },
  nodeSlot: {
    position: 'absolute',
  },
  halo: {
    position: 'absolute',
    inset: 0,
    backgroundColor: colors.accentStrong,
  },
  node: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.pageRaised,
  },
  nodeOwned: {
    borderColor: colors.accentStrong,
    backgroundColor: colors.accentStrong,
  },
  nodeOpen: {
    borderColor: colors.accentStrong,
    backgroundColor: colors.surface,
  },
  nodeShut: {
    opacity: 0.6,
  },
  nodeSelected: {
    borderWidth: 3,
    borderColor: colors.ink,
  },
  /* The small mark at a node's foot: a check when owned, a lock when shut. */
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  badgeOwned: {
    borderColor: colors.accentStrong,
    backgroundColor: colors.accentStrong,
  },
  /* The trunk: the level, where the branches meet. */
  root: {
    position: 'absolute',
    width: ROOT,
    height: ROOT,
    borderRadius: ROOT / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.accentStrong,
    backgroundColor: colors.accentWash,
  },
  rootLevel: {
    color: colors.accentStrong,
  },
  card: {
    gap: space.sm,
    padding: space.md,
    paddingBottom: space.sm,
  },
  cardState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
})
