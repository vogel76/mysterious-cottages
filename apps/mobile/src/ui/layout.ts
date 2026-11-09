import { useWindowDimensions, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { sizes } from './tokens'

/* The column reading content lives in: the whole width of a phone, at most
   `sizes.readable` on a tablet or in a wide window, centred beyond that.
   For the content containers of scroll views and lists and the columns of
   sheets; full-bleed screens (the Atlas) do not take it. */
export const readable: ViewStyle = { width: '100%', maxWidth: sizes.readable, alignSelf: 'center' }

/* The side padding of a readable column, `base` plus whatever of the side
   safe area the column would otherwise reach. A column spanning the width
   takes the insets in full (the status bar and camera stand along one edge
   of a foldable's cover screen, and a phone on its side has the notch at
   an edge); a centred column on a wide screen is clear of them by its own
   margin and keeps `base`. */
export function useReadablePadding(base: number): { paddingLeft: number; paddingRight: number } {
  const { width } = useWindowDimensions()
  const { left, right } = useSafeAreaInsets()
  const margin = Math.max(0, (width - sizes.readable) / 2)
  return { paddingLeft: base + Math.max(0, left - margin), paddingRight: base + Math.max(0, right - margin) }
}

/* Whether the window is narrow (under `sizes.narrow`): an iPhone in its
   zoomed display gives an app 320 points across, Android's largest
   display size about the same, and both are chosen by people who want
   everything bigger, so a layout that cannot fit four fixed columns or a
   button beside its words there takes its compact form instead of
   running off the screen. */
export function useNarrow(): boolean {
  return useWindowDimensions().width < sizes.narrow
}
