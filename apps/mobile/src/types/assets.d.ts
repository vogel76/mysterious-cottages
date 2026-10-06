/* Static images bundled with the app resolve to a Metro asset id. */
declare module '*.png' {
  const source: number
  export default source
}
declare module '*.webp' {
  const source: number
  export default source
}
/* The elf's glTF model (metro.config.js adds the extension to the assets). */
declare module '*.glb' {
  const source: number
  export default source
}
