/* Metro in the pnpm monorepo: watch the repository root so the workspace
   packages (@chatynkowo/core, api, i18n — TypeScript sources, no build
   step) are bundled together with the app, and resolve modules from both
   the app's and the root node_modules. The elf's glTF model (assets/elf)
   is bundled as an asset, which Metro does not do for .glb by default. */
const path = require('node:path')
const { getDefaultConfig } = require('expo/metro-config')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]
config.resolver.assetExts = [...config.resolver.assetExts, 'glb']

/* three is ESM-only from 0.186: its "require" entry is a shim that calls
   process.emitWarning, which Hermes does not have, so the module throws at
   load. Metro prefers the "require" condition, hence the bare specifier
   (also the one three's own addons import) is pointed at the ES module.
   The path is built by hand: the package's exports map hides the file
   from require.resolve. */
const THREE_MODULE = path.resolve(projectRoot, 'node_modules/three/build/three.module.js')
const defaultResolveRequest = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'three') return { type: 'sourceFile', filePath: THREE_MODULE }
  return defaultResolveRequest ? defaultResolveRequest(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform)
}

module.exports = config
