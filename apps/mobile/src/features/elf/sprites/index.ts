/* Sprite playback for the art pipeline's atlases (apps/mobile/art): the
   manifest, the bundled characters, the decoded sheets, one sprite or a
   layered character on a shared frame clock. */
export { SPRITE_CHARACTERS, cellOf, clipOf, sheetModules, sheetsOf, thumbModule, type SpriteClip, type SpriteManifest, type SpriteOverlay, type SpriteSheet, type SpriteSource } from './manifest'
export { useSpriteImages, useSpriteLayer, useUpcomingSprites, type SpriteImages } from './useSpriteImages'
export { useSpriteClock, type SpriteClockOptions } from './clock'
export { SpriteFrame, type SpriteFrameProps } from './SpriteFrame'
export { SpritePlayer, type SpritePlayerProps } from './SpritePlayer'
export { LayeredSprite, type LayeredSpriteProps, type SpriteLayer } from './LayeredSprite'
