import { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import { Canvas } from '@shopify/react-native-skia'
import { Button, Text, colors, space } from '../../../ui'
import { LayeredSprite, type SpriteLayer } from './LayeredSprite'
import type { SpriteSource } from './manifest'
import { useSpriteImages } from './useSpriteImages'

/* A self-contained stage for looking at a packed character in the app: the
   sprite on a plain floor with a button per clip, a pause and a mirror
   toggle. No route of its own; whoever wants to see a freshly packed
   character mounts it with the character's source, e.g.
   <SpriteDemo source={SPRITE_CHARACTERS.elf} />. Every overlay of the
   manifest is drawn over the body, so a layered character shows whole. */

export type SpriteDemoProps = {
  source: SpriteSource
}

/* The sprite takes this share of the stage's height. */
const STAGE_FILL = 0.7

export function SpriteDemo({ source }: SpriteDemoProps) {
  const { manifest } = source
  const images = useSpriteImages(source)
  const clipNames = useMemo(() => Object.keys(manifest.clips), [manifest])
  const [clip, setClip] = useState(clipNames[0] ?? '')
  const [playing, setPlaying] = useState(true)
  const [flipX, setFlipX] = useState(false)
  const [stage, setStage] = useState({ width: 0, height: 0 })

  const layers = useMemo<SpriteLayer[]>(() => {
    if (!images) return []
    return [{ sheets: images.body }, ...Object.entries(images.layers).map(([layer, sheets]) => ({ layer, sheets }))]
  }, [images])

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setStage({ width, height })
  }
  const scale = stage.height > 0 ? (stage.height * STAGE_FILL) / manifest.frameHeight : 1
  const ready = images !== null && stage.width > 0 && clip !== ''

  return (
    <View style={styles.root}>
      <View style={styles.stage} onLayout={onLayout}>
        {ready ? (
          <Canvas style={StyleSheet.absoluteFill}>
            <LayeredSprite
              manifest={manifest}
              layers={layers}
              clip={clip}
              playing={playing}
              x={stage.width / 2}
              y={stage.height * (0.5 + STAGE_FILL / 2)}
              scale={scale}
              flipX={flipX}
            />
          </Canvas>
        ) : (
          <View style={styles.loading}>
            <Text tone="soft">{images ? 'No clips in the manifest' : 'Decoding the sheets'}</Text>
          </View>
        )}
      </View>
      <ScrollView horizontal contentContainerStyle={styles.clips} showsHorizontalScrollIndicator={false}>
        {clipNames.map((name) => (
          <Button key={name} variant={name === clip ? 'primary' : 'ghost'} onPress={() => setClip(name)}>
            {name}
          </Button>
        ))}
      </ScrollView>
      <View style={styles.controls}>
        <Button variant="subtle" onPress={() => setPlaying((value) => !value)}>
          {playing ? 'Pause' : 'Play'}
        </Button>
        <Button variant="subtle" onPress={() => setFlipX((value) => !value)}>
          {flipX ? 'Face right' : 'Face left'}
        </Button>
        <Text variant="small" tone="faint">
          {`${manifest.frameWidth} x ${manifest.frameHeight} px, ${manifest.fps} fps`}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  stage: { flex: 1, backgroundColor: colors.surface },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  clips: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md },
  controls: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.lg },
})
