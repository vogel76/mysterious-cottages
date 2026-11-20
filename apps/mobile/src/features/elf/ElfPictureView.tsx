import { useCallback, useEffect, useRef } from 'react'
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native'
import Animated from 'react-native-reanimated'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { useCloseModal, useElf } from '../../providers'
import { CloseIcon, IconButton, colors, fade, iconSize, space } from '../../ui'
import { fullPictureFor } from './cottage/roomAssets'
import { elfKey } from './labels'

/* A close look at the painting on the elf's wall: the picture whole on a
   dark veil, as large as the window lets it be and never larger than its
   own pixels, with nothing written under it (the owner's word: the
   painting alone). A touch anywhere, the close button or the system's
   back closes it. A picture that is only a render has no such look, and
   the route presented for one closes at once. */

/* The close button's room above the picture. */
const CLOSE_ROOM = 56

export function ElfPictureView() {
  const { t } = useTranslation()
  const closeModal = useCloseModal()
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const { decor } = useElf()
  /* The picture shown is the one on the wall when the look opened. */
  const variant = useRef(decor.picture).current
  const picture = fullPictureFor(variant)

  /* Every way out passes this flag, so two quick touches close once. */
  const leaving = useRef(false)
  const close = useCallback(() => {
    if (leaving.current) return
    leaving.current = true
    closeModal()
  }, [closeModal])

  useEffect(() => {
    if (!picture) close()
  }, [picture, close])

  if (!picture) return null

  const roomWidth = width - 2 * space.lg
  const roomHeight = height - insets.top - insets.bottom - 2 * CLOSE_ROOM
  const scale = Math.min(1, roomWidth / picture.width, roomHeight / picture.height)
  const size = { width: Math.round(picture.width * scale), height: Math.round(picture.height * scale) }

  return (
    <View style={styles.screen} accessibilityViewIsModal>
      <Animated.View entering={fade(250)} style={styles.veil} />
      <Pressable accessible={false} style={styles.touch} onPress={close}>
        <Animated.View entering={fade()}>
          <Image source={picture.module} style={size} contentFit="contain" accessible accessibilityRole="image" accessibilityLabel={t(elfKey('item', variant))} />
        </Animated.View>
      </Pressable>
      <IconButton label={t('mobile:common.close')} onPress={close} style={[styles.close, { top: insets.top + space.sm }]}>
        <CloseIcon size={iconSize.md} color={colors.ink} />
      </IconButton>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  veil: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.backdrop,
  },
  touch: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  close: {
    position: 'absolute',
    right: space.lg,
  },
})
