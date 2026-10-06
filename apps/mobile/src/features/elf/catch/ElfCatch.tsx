import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppState, StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { LinearGradient } from 'expo-linear-gradient'
import { useIsFocused } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Canvas } from '@react-three/fiber/native'
import { useCloseModal, useElf } from '../../../providers'
import {
  Button,
  CameraIcon,
  CrossfadeText,
  ElfIcon,
  EmptyState,
  NATIVE_HEADER_HEIGHT,
  OrbIcon,
  PressableScale,
  ReduceMotion,
  Text,
  useReducedMotion,
  colors,
  iconSize,
  mapPalette,
  radius,
  space,
} from '../../../ui'
import { CanvasBoundary } from './CanvasBoundary'
import { ORB_FLY_MS, ORB_SIZE, OrbThrow, type OrbThrowHandle } from './OrbThrow'
import { useDeviceParallax } from './useDeviceParallax'
import { Wanderer } from './Wanderer'
import { CATCH_RADIUS, dodge, elfOffsetX, newWorld, pickTarget, resetWorld } from './world'

/* The catch, the prototype's "Pokemon GO" half: the back camera as the
   world, a transparent GL canvas over it with the elf wandering about and
   anchored to the phone's tilt, and at the bottom a pill that says what is
   happening and the gold orb to throw. The orb flies to where the elf is
   at that moment; close enough to the centre catches it (a flash, the elf
   shrinks away, the companion is rewarded once), otherwise the elf dodges
   to the far side. Without the camera (refused, or skipped) the hunt
   happens in a dark forest mist. The route is a full screen modal under
   a transparent header, like the scanner, so the top stays clear of the
   bar. The tab keeps this closed for an egg and a sleeping elf; the guards
   here only cover a stale link (an egg has nobody to catch, a sleeping elf
   would win nothing). */

/* How often the elf picks a new place to head for. */
const WANDER_INTERVAL_MS = 2200
/* The orb lands a little after its flight ends, as in the prototype. */
const RESOLVE_MS = ORB_FLY_MS + 20
/* Where on the screen the orb lands, as a share of the height. */
const LANDING_Y = 0.42
const FLASH_MS = 500
const ORB_BUTTON = 56

/* The scene camera: the prototype's framing of a figure standing at the
   origin. */
const CAMERA_FOV = 46
const CAMERA_HEIGHT = 1.0
const CAMERA_POSITION: [number, number, number] = [0, CAMERA_HEIGHT, 4.2]
const SKY = 0xffffff
const GROUND = 0x556655
const SUN = 0xfff2d0
const SUN_POSITION: [number, number, number] = [3, 6, 4]
/* The prototype's intensities were in three's legacy light units, which the
   renderer scaled by PI; three now uses physical units, hence the factor. */
const SKY_INTENSITY = 0.95 * Math.PI
const SUN_INTENSITY = 1.1 * Math.PI

const MIST = [colors.surfaceSoft, colors.page] as const

type Status = 'searching' | 'missed' | 'caught' | 'noModel'

export function ElfCatch() {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const focused = useIsFocused()
  const reduceMotion = useReducedMotion()
  const close = useCloseModal()
  const [permission, requestPermission] = useCameraPermissions()
  const { state, loaded, stage, mood, catchReward } = useElf()

  const world = useMemo(newWorld, [])
  useDeviceParallax(world)

  const [appActive, setAppActive] = useState(AppState.currentState === 'active')
  const [skipCamera, setSkipCamera] = useState(false)
  const [status, setStatus] = useState<Status>('searching')
  const [caught, setCaught] = useState(false)
  /* The screen's size, for where the orb starts and lands. */
  const frame = useRef({ width: 0, height: 0 })
  const orb = useRef<OrbThrowHandle>(null)
  const inFlight = useRef(false)
  const resolveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flash = useSharedValue(0)

  /* The camera is off while the app is in the background. */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => setAppActive(next === 'active'))
    return () => subscription.remove()
  }, [])

  /* The elf keeps picking new places for as long as the view is open; a
     caught elf declines them. */
  useEffect(() => {
    const timer = setInterval(() => pickTarget(world), WANDER_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [world])

  useEffect(
    () => () => {
      if (resolveTimer.current) clearTimeout(resolveTimer.current)
    },
    [],
  )

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    frame.current.width = width
    frame.current.height = height
  }, [])

  const onModelError = useCallback(() => setStatus('noModel'), [])

  const throwOrb = useCallback(() => {
    if (world.caught || inFlight.current || status === 'noModel') return
    inFlight.current = true
    const thrownX = elfOffsetX(world)
    const { width, height } = frame.current
    orb.current?.throwTo({
      fromX: width / 2,
      fromY: height - insets.bottom - space.xl - ORB_BUTTON / 2,
      toX: width / 2 + thrownX,
      toY: height * LANDING_Y,
    })
    resolveTimer.current = setTimeout(() => {
      resolveTimer.current = null
      inFlight.current = false
      if (Math.abs(thrownX) < CATCH_RADIUS) {
        world.caught = true
        flash.value = 1
        flash.value = withTiming(0, { duration: FLASH_MS, reduceMotion: ReduceMotion.System })
        setStatus('caught')
        setCaught(true)
        catchReward()
      } else {
        setStatus('missed')
        dodge(world, thrownX)
      }
    }, RESOLVE_MS)
  }, [world, status, insets.bottom, flash, catchReward])

  const retry = useCallback(() => {
    resetWorld(world)
    setCaught(false)
    setStatus('searching')
  }, [world])

  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }))

  /* Nothing until the elf and the permission are known: no flash of a
     rationale or an empty state that is about to go. */
  if (!loaded || permission === null) {
    return <View style={styles.screen} />
  }

  if (!state || !state.hatched || state.sleeping) {
    const body = state && state.hatched ? t('mobile:elf.asleepHint', { name: state.name }) : t('mobile:elf.catchNoElf')
    return (
      <View style={[styles.screen, styles.centre, { paddingTop: insets.top + NATIVE_HEADER_HEIGHT, paddingBottom: insets.bottom + space.xl }]}>
        <EmptyState icon={ElfIcon} title={t('mobile:elf.catchTitle')} body={body} action={{ label: t('mobile:common.close'), onPress: close }} />
      </View>
    )
  }

  const blocked = !permission.granted && permission.canAskAgain === false
  const useCamera = permission.granted && !skipCamera

  if (!permission.granted && !blocked && !skipCamera) {
    return (
      <View style={[styles.screen, styles.ask, { paddingTop: insets.top + NATIVE_HEADER_HEIGHT + space.lg, paddingBottom: insets.bottom + space.xl }]}>
        <View style={styles.askIcon}>
          <CameraIcon size={iconSize.emblem} weight="duotone" color={colors.accentStrong} />
        </View>
        <Text tone="soft" align="center">
          {t('mobile:elf.catchCameraRequest')}
        </Text>
        <View style={styles.askActions}>
          <Button variant="primary" block onPress={() => void requestPermission()}>
            {t('mobile:elf.catchCameraAllow')}
          </Button>
          <Button block onPress={() => setSkipCamera(true)}>
            {t('mobile:elf.catchWithoutCamera')}
          </Button>
        </View>
      </View>
    )
  }

  const pill =
    status === 'caught'
      ? t('mobile:elf.catchCaught', { name: state.name })
      : status === 'missed'
        ? t('mobile:elf.catchMissed')
        : status === 'noModel'
          ? t('mobile:elf.catchNoModel')
          : blocked
            ? t('mobile:elf.catchNoCamera')
            : t('mobile:elf.catchSearching')

  return (
    <View style={styles.screen} onLayout={onLayout}>
      {useCamera ? <CameraView style={StyleSheet.absoluteFill} facing="back" active={focused && appActive} /> : <LinearGradient pointerEvents="none" colors={MIST} style={StyleSheet.absoluteFill} />}
      <CanvasBoundary onError={onModelError}>
        <Suspense fallback={null}>
          <Canvas
            style={styles.canvas}
            pointerEvents="none"
            frameloop={focused && appActive ? 'always' : 'never'}
            gl={{ alpha: true, antialias: true }}
            flat
            camera={{ fov: CAMERA_FOV, near: 0.1, far: 100, position: CAMERA_POSITION }}
            onCreated={({ gl, camera }) => {
              gl.setClearColor(0x000000, 0)
              camera.lookAt(0, CAMERA_HEIGHT, 0)
            }}
          >
            <hemisphereLight args={[SKY, GROUND, SKY_INTENSITY]} />
            <directionalLight color={SUN} intensity={SUN_INTENSITY} position={SUN_POSITION} />
            <Suspense fallback={null}>
              <Wanderer world={world} stage={stage} starter={state.starter} mood={mood} motion={!reduceMotion} />
            </Suspense>
          </Canvas>
        </Suspense>
      </CanvasBoundary>
      <OrbThrow ref={orb} />
      <Animated.View pointerEvents="none" style={[styles.flash, flashStyle]} />
      <View style={[styles.hud, { bottom: insets.bottom + space.xl }]}>
        <View style={styles.pill} accessibilityLiveRegion="polite">
          <CrossfadeText value={pill} variant="small" weight="semibold" align="center" style={styles.pillText} />
        </View>
        <View style={styles.slot}>
          {caught ? (
            <Button onPress={retry}>{t('mobile:elf.catchRetry')}</Button>
          ) : (
            <PressableScale
              accessibilityLabel={t('mobile:elf.catchThrow')}
              disabled={status === 'noModel'}
              scaleTo={0.92}
              pressedFill={colors.accentBorder}
              onPress={throwOrb}
              style={[styles.orbButton, status === 'noModel' && styles.disabled]}
            >
              <OrbIcon size={iconSize.xl} weight="duotone" color={colors.accentInk} />
            </PressableScale>
          )}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.page,
  },
  centre: {
    justifyContent: 'center',
  },
  canvas: {
    ...StyleSheet.absoluteFill,
  },
  flash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.ink,
  },
  hud: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    alignItems: 'center',
    gap: space.lg,
  },
  pill: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: mapPalette.chromeBorder,
    backgroundColor: mapPalette.chrome,
  },
  pillText: {
    color: mapPalette.chromeInk,
  },
  /* The orb and the retry button take turns in one slot, so the pill
     stays put. */
  slot: {
    height: ORB_BUTTON,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbButton: {
    width: ORB_BUTTON,
    height: ORB_BUTTON,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: ORB_BUTTON / 2,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    backgroundColor: colors.accent,
    shadowColor: colors.accentStrong,
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  disabled: {
    opacity: 0.5,
  },
  ask: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xl,
    paddingHorizontal: space.lg,
  },
  askIcon: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 48,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
  },
  askActions: {
    alignSelf: 'stretch',
    gap: space.sm,
  },
})
