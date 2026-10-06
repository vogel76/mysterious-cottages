The elf companion's assets: `elf.glb`, the animated elf (one skinned mesh, 65 bones, a 6.19 s waving clip, JPEG and PNG textures at 1024 / 1024 / 512 px), and `background.webp`, the Chatynkowo painting behind the scene (1536 x 1024).
Both come from the Elfostudio prototype (`mc-pokemon`), where the character was cut out of the original diorama and its textures were later transcoded from WebP for React Native.
The model is based on "Animated Elf & Venus Flytrap on Floating Island" by LasquetiSpice on Sketchfab (<https://sketchfab.com/3d-models/none-b5a81f2135f74486a816388752881d0a>), licensed under CC BY 4.0 (<http://creativecommons.org/licenses/by/4.0/>); the painting is Chatynkowo's own material.
`node scripts/prepare-elf-model.mjs <source.glb>` (from `apps/mobile`) regenerates `elf.glb` from the prototype's WebP-textured file.
The copy in the repository is exactly that script's output; edit the source model, not this file.
