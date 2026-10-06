import { useCallback, useEffect, useRef } from 'react'
import { useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { clipOf, type SpriteManifest } from './manifest'

/* The frame clock of a sprite: a shared value holding the global frame
   index of the clip being played, advanced on the UI thread by a frame
   callback at the manifest's frame rate. Nothing re-renders per frame;
   the frame components read the value in their buffers. A looping clip
   wraps, a one-shot clip holds its last frame and reports the end once
   (onEnd, on the JS thread). Changing the clip restarts from its first
   frame; pausing holds the frame and resuming carries on from it. To play
   the same one-shot clip again, remount the player (a key) or switch to
   another clip in between. The step between two callbacks is capped at a
   tenth of a second: after a pause nothing else animated, the first
   callback would otherwise report the whole gap and skip half the clip. */

const MAX_STEP_MS = 100

export type SpriteClockOptions = {
  manifest: SpriteManifest
  clip: string
  playing: boolean
  /* Overrides the manifest's loop flag of the clip. */
  loop?: boolean
  onEnd?: () => void
}

export function useSpriteClock({ manifest, clip, playing, loop, onEnd }: SpriteClockOptions): SharedValue<number> {
  const range = clipOf(manifest, clip)
  const from = range.from
  const count = range.to - range.from + 1
  const loops = loop ?? range.loop
  const fps = manifest.fps

  const frame = useSharedValue(from)
  const elapsed = useSharedValue(0)
  const ended = useSharedValue(false)

  const onEndRef = useRef(onEnd)
  onEndRef.current = onEnd
  const finish = useCallback(() => onEndRef.current?.(), [])

  const tick = useCallback(
    (info: { timeSincePreviousFrame: number | null }) => {
      'worklet'
      const period = (count * 1000) / fps
      elapsed.value += Math.min(info.timeSincePreviousFrame ?? 0, MAX_STEP_MS)
      if (elapsed.value >= period) {
        if (loops) {
          elapsed.value %= period
        } else {
          elapsed.value = period
          if (!ended.value) {
            ended.value = true
            scheduleOnRN(finish)
          }
        }
      }
      frame.value = from + Math.min(count - 1, Math.floor((elapsed.value * fps) / 1000))
    },
    [count, fps, loops, from, frame, elapsed, ended, finish],
  )
  const callback = useFrameCallback(tick, false)

  useEffect(() => {
    elapsed.value = 0
    ended.value = false
    frame.value = from
  }, [clip, from, frame, elapsed, ended])

  useEffect(() => {
    callback.setActive(playing && count > 1)
  }, [callback, playing, count])

  return frame
}
