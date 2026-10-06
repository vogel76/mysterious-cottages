/* Prepares the elf's glTF model for the app: assets/elf/elf.glb from the
   Elfostudio prototype's assets/elf.glb.

   The prototype stores its textures as WebP through the required glTF
   extension EXT_texture_webp. On the web that is the smallest file, but
   three's GLTFLoader decides whether it can use WebP by decoding a probe
   image through a DOM Image, which React Native does not have, so on the
   device the loader refuses the file ("missing extension") before any
   texture is read. The model therefore ships with the textures transcoded
   to formats every platform decodes natively: the base colour and the
   metallic-roughness map as JPEG (quality 88, no alpha in either), the
   normal map as PNG (lossless, so the encoded normals stay exact) resized
   to 512 px, which keeps the file close to the WebP one. The result in the
   repository was produced exactly this way (3.19 MB to 3.79 MB, textures
   1024 / 1024 / 512).

   The work is done by the glTF Transform CLI, run through npx at a pinned
   version so the output is reproducible; nothing is added to the app's
   dependencies. The normal texture is found by reading the GLB's JSON
   chunk, because the CLI's resize step addresses textures by name.

   Usage: node scripts/prepare-elf-model.mjs <source.glb> [<out.glb>] */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const GLTF_TRANSFORM = '@gltf-transform/cli@4.5.1'
const JPEG_QUALITY = 88
const NORMAL_SIZE = 512

const here = dirname(fileURLToPath(import.meta.url))
const [sourceArg, outArg] = process.argv.slice(2)
if (!sourceArg) {
  console.error('usage: node scripts/prepare-elf-model.mjs <source.glb> [<out.glb>]')
  process.exit(1)
}
const source = resolve(sourceArg)
const out = resolve(outArg ?? join(here, '../assets/elf/elf.glb'))

/* The JSON chunk of a GLB: a 12-byte header (magic "glTF", version 2, the
   file length) followed by chunks, the first of which is the JSON. */
function readGltfJson(file) {
  const buffer = readFileSync(file)
  if (buffer.length < 20 || buffer.toString('ascii', 0, 4) !== 'glTF') throw new Error(`${file}: not a GLB file`)
  const version = buffer.readUInt32LE(4)
  if (version !== 2) throw new Error(`${file}: GLB version ${version}, expected 2`)
  const length = buffer.readUInt32LE(8)
  if (length !== buffer.length) throw new Error(`${file}: header says ${length} bytes, the file has ${buffer.length}`)
  const chunkLength = buffer.readUInt32LE(12)
  const chunkType = buffer.toString('ascii', 16, 20)
  if (chunkType !== 'JSON') throw new Error(`${file}: the first chunk is "${chunkType}", expected JSON`)
  return JSON.parse(buffer.toString('utf8', 20, 20 + chunkLength))
}

/* The image a texture reads: the core `source`, or the one the WebP
   extension carries when the core field is left out. */
function imageOfTexture(json, index) {
  const texture = json.textures?.[index]
  if (!texture) throw new Error(`texture ${index} is missing`)
  const source = texture.source ?? texture.extensions?.EXT_texture_webp?.source
  if (source === undefined) throw new Error(`texture ${index} names no image`)
  return json.images?.[source]
}

function normalTextureName(json) {
  const normal = json.materials?.[0]?.normalTexture
  if (!normal) throw new Error('materials[0] has no normal texture')
  const image = imageOfTexture(json, normal.index)
  if (!image?.name) throw new Error('the normal texture\'s image has no name to address it by')
  return image.name
}

function megabytes(file) {
  return `${(statSync(file).size / 1_000_000).toFixed(2)} MB`
}

function gltfTransform(...args) {
  console.log(`gltf-transform ${args.join(' ')}`)
  execFileSync('npx', ['--yes', '--package', GLTF_TRANSFORM, 'gltf-transform', ...args], { stdio: 'inherit' })
}

const json = readGltfJson(source)
const normalName = normalTextureName(json)
/* The prefix before the first space: the names look like "<uuid> image"
   and the pattern is matched as a glob by the CLI. */
const normalPrefix = normalName.split(' ')[0]
console.log(`source: ${source} (${megabytes(source)})`)
console.log(`normal texture: "${normalName}", images: ${json.images.map((image) => image.mimeType).join(', ')}`)

const work = mkdtempSync(join(tmpdir(), 'elf-model-'))
try {
  const step1 = join(work, 'step1.glb')
  const step2 = join(work, 'step2.glb')
  gltfTransform('jpeg', source, step1, '--slots', '{baseColorTexture,metallicRoughnessTexture}', '--formats', '*', '--quality', String(JPEG_QUALITY))
  gltfTransform('png', step1, step2, '--slots', 'normalTexture', '--formats', '*')
  gltfTransform('resize', step2, out, '--pattern', `*${normalPrefix}*`, '--width', String(NORMAL_SIZE), '--height', String(NORMAL_SIZE))
} finally {
  rmSync(work, { recursive: true, force: true })
}

const result = readGltfJson(out)
console.log(`written: ${out} (${megabytes(source)} -> ${megabytes(out)})`)
console.log(`images: ${result.images.map((image) => image.mimeType).join(', ')}; required extensions: ${(result.extensionsRequired ?? []).join(', ') || 'none'}`)
