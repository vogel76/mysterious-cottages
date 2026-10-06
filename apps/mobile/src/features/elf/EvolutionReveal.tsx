import { useCallback, useEffect, useRef } from 'react'
import { BackHandler, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { useFocusEffect, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { announce } from '../../lib/announce'
import { useElf } from '../../providers'
import { Button, ElfIcon, GlowPulse, SPRINGS, Text, colors, fade, iconSize, radius, space, useReducedMotion } from '../../ui'
import { elfKey } from './labels'

/* The card for a form reached: the egg hatching, or the elf growing into
   its next form. A card rises over the Elf tab with the emblem glowing, the
   kicker, the title and a few lines of lore, and leaves only through its
   button, which marks the form as seen. Modelled on the Kronika's reward
   reveal, without the haptic: the phone stirs for a discovery and a seal,
   not for the companion. */

const CARD_MAX_WIDTH = 420
const EMBLEM = 112
const GLOW_MARGIN = 48
const RISE = 40
const SHRINK = 0.1

export function EvolutionReveal() {
  const { t } = useTranslation()
  const router = useRouter()
  const { width } = useWindowDimensions()
  const reduceMotion = useReducedMotion()
  const { state, pendingEvolution, acknowledgeEvolution } = useElf()

  /* The form shown is the one waiting when the card mounted: acknowledging
     clears the provider's slot before the modal has faded, and the card
     must not go blank meanwhile. */
  const stage = useRef(pendingEvolution).current
  const name = state?.name ?? t('mobile:elf.defaultName')

  /* Every way out passes this flag, so a double back can never happen. */
  const leaving = useRef(false)
  const leave = useCallback(() => {
    if (leaving.current) return
    leaving.current = true
    acknowledgeEvolution()
    router.back()
  }, [acknowledgeEvolution, router])

  /* Presented with nothing to show (a stale push): gone at once. */
  useEffect(() => {
    if (!stage) leave()
  }, [stage, leave])

  /* Android back is acknowledged, not obeyed, while this card is showing. */
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => true)
      return () => subscription.remove()
    }, []),
  )

  /* 1 at rest below and smaller; 0 in place. */
  const rise = useSharedValue(reduceMotion ? 0 : 1)
  useEffect(() => {
    rise.value = withSpring(0, SPRINGS.reveal)
  }, [rise])
  const cardMotion = useAnimatedStyle(() => ({
    transform: [{ translateY: rise.value * RISE }, { scale: 1 - rise.value * SHRINK }],
  }))

  const title = stage === 'baby' ? t('mobile:elf.evoHatchTitle', { name }) : t('mobile:elf.evoTitle', { name })

  useEffect(() => {
    if (stage) announce(title)
  }, [stage, title])

  if (!stage) return null

  const cardWidth = Math.min(CARD_MAX_WIDTH, width - 2 * space.xl)

  return (
    <View style={styles.screen} accessibilityViewIsModal>
      <Animated.View entering={fade(250)} style={styles.backdrop}>
        <Pressable accessible={false} style={styles.backdropTouch} />
      </Animated.View>
      <Animated.View style={[styles.card, { width: cardWidth }, cardMotion]}>
        <Text variant="eyebrow" align="center">
          {t('mobile:elf.evoKicker')}
        </Text>
        <GlowPulse size={EMBLEM + GLOW_MARGIN} cycles={3}>
          <View style={styles.emblem}>
            <ElfIcon size={iconSize.emblem} weight="fill" color={colors.accentStrong} />
          </View>
        </GlowPulse>
        <Text variant="title" align="center" accessibilityRole="header">
          {title}
        </Text>
        <Text tone="soft" align="center">
          {t(elfKey('evo', stage), { name })}
        </Text>
        <Button variant="primary" block onPress={leave} style={styles.action}>
          {t('mobile:elf.evoOk')}
        </Button>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.backdrop,
  },
  backdropTouch: {
    flex: 1,
  },
  card: {
    alignItems: 'center',
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    padding: space.xl,
  },
  emblem: {
    width: EMBLEM,
    height: EMBLEM,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.pageRaised,
  },
  action: {
    marginTop: space.sm,
  },
})
