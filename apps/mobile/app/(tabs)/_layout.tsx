import { useEffect, useMemo, useRef } from 'react'
import { Tabs, type BottomTabBarProps, type BottomTabNavigationOptions } from 'expo-router/js-tabs'
import { useRouter, useSegments } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useCelebrationPresenter } from '../../src/features/atlas/useCelebrationPresenter'
import { ELF_ENABLED } from '../../src/config'
import { useElfReminders } from '../../src/features/elf/useElfReminders'
import { useBoot, useElf, useProgress, useToast } from '../../src/providers'
import { TAB_ICONS, TabBar, colors, type DiscoverAction, type Icon } from '../../src/ui'

/* The expedition loop as tabs around one raised action: the Atlas (the
   play field) and the Elf (the companion prototype, see src/features/elf)
   on the left, the Kronika (the collection, with the Ranking on its stack)
   and the Profile on the right, with the gold
   "discover" button in the middle of the bar opening the code sheet (a
   press) or the scanner (a long press). The bar is the app's own
   (src/ui/TabBar.tsx) so the button can rise above it; it floats over the
   tab screens, which read its height through useTabBarHeight(). Icons are
   the vocabulary's tab glyphs, labels come from the "mobile" namespace, and
   the Kronika carries the badge of seals not yet viewed (mounted only while
   the count is above zero). The layout also hosts the things that must
   act once the tabs are in the navigation state: the celebration
   presenter, the route the onboarding left behind, and the elf's
   reminders (planned whenever the app leaves, a tapped one opening the
   Elf tab). Adding a tab is one more
   Tabs.Screen here plus a folder (with a Stack _layout) or a file in this
   directory. */

export default function TabsLayout() {
  const { t } = useTranslation()
  const router = useRouter()
  const { unseenRewards } = useProgress()
  const elfWaiting = useElfWaiting()

  const discover = useMemo<DiscoverAction>(
    () => ({
      label: t('mobile:tabs.discover'),
      accessibilityLabel: t('mobile:tabs.discoverAria'),
      scanLabel: t('mobile:code.scan'),
      onPress: () => router.push('/code'),
      onLongPress: () => router.push('/scan'),
    }),
    [t, router],
  )

  return (
    <>
      <CelebrationPresenter />
      <PendingHref />
      {ELF_ENABLED ? <ElfReminders /> : null}
      <Tabs
        backBehavior="initialRoute"
        tabBar={(props: BottomTabBarProps) => <TabBar {...props} discover={discover} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.page } }}
      >
        <Tabs.Screen name="index" options={{ title: t('mobile:tabs.atlas'), tabBarIcon: tabIcon(TAB_ICONS.index.Glyph) }} />
        {/* Without the elf the route stays (the files are there) but leaves the bar and takes no link. */}
        <Tabs.Screen name="elf" options={{ title: t('mobile:tabs.elf'), tabBarIcon: tabIcon(TAB_ICONS.elf.Glyph), tabBarBadge: badge(elfWaiting), href: ELF_ENABLED ? undefined : null }} />
        <Tabs.Screen
          name="kronika"
          options={{ title: t('mobile:tabs.kronika'), tabBarIcon: tabIcon(TAB_ICONS.kronika.Glyph), tabBarBadge: badge(unseenRewards.length) }}
        />
        <Tabs.Screen name="profile" options={{ title: t('mobile:tabs.profile'), tabBarIcon: tabIcon(TAB_ICONS.profile.Glyph) }} />
      </Tabs>
    </>
  )
}

/* The reward card after a story, presented over whichever tab is showing. */
function CelebrationPresenter() {
  useCelebrationPresenter()
  return null
}

/* The elf's reminders, whichever tab is showing. */
function ElfReminders() {
  useElfReminders()
  return null
}

/* The onboarding leaves a route behind ("Wpisz kod", a plaque link on a
   fresh install). Mounted here, the tabs are in the navigation state by
   definition; the push waits one frame so the Protected swap settles. */
function PendingHref() {
  const router = useRouter()
  const { pendingHref, setPendingHref } = useBoot()

  useEffect(() => {
    if (!pendingHref) return
    const href = pendingHref
    setPendingHref(null)
    requestAnimationFrame(() => router.push(href))
  }, [pendingHref, router, setPendingHref])

  return null
}

/* The vocabulary glyph of a tab: outline idle, filled when selected. */
function tabIcon(Glyph: Icon): BottomTabNavigationOptions['tabBarIcon'] {
  return ({ color, size, focused }) => <Glyph color={String(color)} size={size} weight={focused ? 'fill' : 'regular'} />
}

function badge(count: number) {
  return count > 0 ? count : undefined
}

/* What waits for the player in the cottage, as the Elf tab's badge: an
   egg ready to hatch (or an elf still to be named) and the day's reward
   still to pick. The egg getting ready while another screen is in front
   (a cottage found in the field) is also told once, in a toast with the
   way there, since nothing else says the hatch waits for a tap. */
function useElfWaiting(): number {
  const { t } = useTranslation()
  const router = useRouter()
  const toast = useToast()
  const segments = useSegments()
  const { state, hatchReady } = useElf()
  const unnamed = Boolean(state && state.hatched && state.starter === null)
  const rewardWaiting = Boolean(state && state.daily.rewardPicked === null)
  const onElfTab = segments[1] === 'elf'
  /* An egg already ready at launch has the badge; the toast is for the
     moment it gets ready during a session, a cottage just found. */
  const told = useRef(hatchReady)
  useEffect(() => {
    if (!hatchReady) {
      told.current = false
      return
    }
    if (told.current || onElfTab) return
    told.current = true
    toast.show({ tone: 'info', text: t('mobile:elf.eggReadyToast'), durationMs: 6000, action: { label: t('mobile:elf.eggReadyAction'), onPress: () => router.navigate('/elf') } })
  }, [hatchReady, onElfTab, toast, t, router])
  return (hatchReady || unnamed ? 1 : 0) + (rewardWaiting ? 1 : 0)
}
