/* Sprite playback for the art pipeline's atlases (apps/mobile/art): the
   manifest, the bundled characters, the decoded sheets, one sprite or a
   layered character on a shared frame clock, and the demo stage. */
export { SPRITE_CHARACTERS, clipOf, sheetModules, sheetsOf, type SpriteClip, type SpriteManifest, type SpriteSheet, type SpriteSource } from './manifest'
export { useSpriteImages, type SpriteImages } from './useSpriteImages'
export { useSpriteClock, type SpriteClockOptions } from './clock'
export { SpriteFrame, type SpriteFrameProps } from './SpriteFrame'
export { SpritePlayer, type SpritePlayerProps } from './SpritePlayer'
export { LayeredSprite, type LayeredSpriteProps, type SpriteLayer } from './LayeredSprite'
export { SpriteDemo, type SpriteDemoProps } from './SpriteDemo'
