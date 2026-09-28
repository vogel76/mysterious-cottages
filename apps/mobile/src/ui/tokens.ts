/* Design tokens of the app — the same values as the :root block in
   apps/web/src/ui/ui.css, so the app and the site look like one product.
   Change a colour here and in ui.css together. */

export const colors = {
  page: '#0d1c18',
  pageRaised: '#132620',
  surface: '#172d25',
  surfaceSoft: '#1d352b',
  ink: '#f1e8d3',
  inkSoft: '#c7bda8',
  inkFaint: '#9d9483',
  line: 'rgba(211, 177, 100, 0.27)',
  lineStrong: 'rgba(211, 177, 100, 0.55)',
  accent: '#d2a64d',
  accentStrong: '#ebc66f',
  accentInk: '#241a0c',
  accentBorder: '#e4bb62',
  accentWash: 'rgba(210, 166, 77, 0.12)',
  danger: '#f0a28e',
  success: '#9ecb9a',
  backdrop: 'rgba(4, 13, 10, 0.82)',
  ghost: 'rgba(20, 42, 34, 0.84)',
} as const

export const radius = {
  card: 18,
  control: 12,
  pill: 999,
} as const

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const

export const sizes = {
  control: 42,
  button: 48,
  header: 72,
  tabBar: 64,
} as const

/* Family names as expo-font registers them (one name per weight, since
   React Native cannot synthesise weights for custom fonts). The site loads
   exactly these faces: Cormorant Garamond 400, 400 italic and 600 for the
   body, Cinzel Decorative 700 for headings — so "bold" copy is the 600 face
   here as well. */
export const fonts = {
  body: 'CormorantGaramond_400Regular',
  bodyItalic: 'CormorantGaramond_400Regular_Italic',
  semibold: 'CormorantGaramond_600SemiBold',
  display: 'CinzelDecorative_700Bold',
} as const

/* The site's type scale in device pixels: body 18px / 1.55, meta copy at
   0.78rem, subheadings (h3, the cottage panel, markdown headings) at
   1.35rem, section headings in Cinzel with -0.025em tracking, eyebrows in
   small capitals spaced 0.13em. */
export const typeScale = {
  small: { fontSize: 14, lineHeight: 20 },
  body: { fontSize: 18, lineHeight: 28 },
  heading: { fontSize: 24, lineHeight: 30 },
  title: { fontSize: 26, lineHeight: 30, letterSpacing: -0.65 },
  display: { fontSize: 32, lineHeight: 35, letterSpacing: -0.8 },
  eyebrow: { fontSize: 14, lineHeight: 18, letterSpacing: 1.8 },
} as const

/* The expedition map's own palette, copied from the site's map styles: the
   parchment the tiles sit on, the dark chrome cards over it, the pins, the
   clusters, the search area and the parchment panel. */
export const mapPalette = {
  parchment: '#8c7751',
  parchmentTint: '#c0a46b',
  frame: '#2a2419',
  vignette: '#160f08',
  vignetteBorder: 'rgba(40, 29, 16, 0.58)',
  vignetteLine: 'rgba(230, 195, 122, 0.25)',
  glow: '#59724b',
  chrome: 'rgba(40, 32, 23, 0.92)',
  chromeBorder: 'rgba(225, 184, 99, 0.5)',
  chromeDivider: 'rgba(225, 184, 99, 0.25)',
  chromeInk: '#efdcab',
  chromeIcon: '#efcf82',
  pinBorder: '#f0cf7f',
  pinTop: '#7d3f27',
  pinBottom: '#45281c',
  pinInk: '#f4d37f',
  pinFoundBorder: '#d9edbd',
  pinFoundTop: '#517948',
  pinFoundBottom: '#294c36',
  pinFoundInk: '#e3f4c6',
  clusterBorder: '#edc671',
  clusterTop: '#76502a',
  clusterBottom: '#3d2a1d',
  clusterInk: '#f5d783',
  clusterHalo: 'rgba(225, 184, 99, 0.18)',
  searchArea: '#d2a64d',
  userDot: '#3d7fd9',
  userDotBorder: '#f6ecd3',
  userRing: 'rgba(77, 144, 210, 0.55)',
  userAccuracy: '#4d90d2',
  panel: '#dcc69a',
  panelBorder: '#b58b47',
  panelInk: '#48321f',
  panelText: '#4a3824',
  panelMuted: '#76572f',
  panelClose: 'rgba(250, 239, 211, 0.48)',
  panelCloseBorder: 'rgba(78, 54, 31, 0.28)',
  clueFoundBorder: 'rgba(69, 101, 61, 0.3)',
  clueFound: 'rgba(74, 111, 62, 0.1)',
  clueFoundInk: '#3f5835',
  clueBorder: 'rgba(111, 76, 35, 0.28)',
  clue: 'rgba(138, 97, 43, 0.1)',
  clueInk: '#604421',
} as const
