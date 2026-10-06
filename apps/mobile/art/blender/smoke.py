"""Smoke test of the sprite pipeline: a few spheres in the shared light.

Why: before the elf and the room are built, this checks that Blender runs
headless on this machine, that common.py's scene, camera, light rig,
materials and outline do what the art direction asks, and it produces a
small layered clip (a body and a hat bobbing in step) that exercises pack.py.
It is also the quickest way to look at the light and the outline after a
change to common.py: render, open smoke.png, compare.

    /snap/bin/blender --background --python art/blender/smoke.py -- <out_dir>

Writes <out_dir>/smoke.png (one still), <out_dir>/frames/body/bob_####.png
and <out_dir>/frames/hat/bob_####.png (12 frames each, same camera) with an
anchor.json next to them, and <out_dir>/smoke.blend.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402

import common  # noqa: E402

FRAMES = 12
SIZE = 512


def build():
    scene = common.setup_scene(SIZE, SIZE)
    common.add_light_rig(target=(0.0, 0.0, 0.8))
    camera = common.add_ortho_camera(center=(0.0, 0.0, 0.8), ortho_scale=2.2)

    skin = common.toon_material('Skin', '#f1d2b0', roughness=0.55, subsurface=0.3)
    tunic = common.toon_material('Tunic', '#4e8a54', roughness=0.7)
    hat_cloth = common.toon_material('Hat', '#4e8a54', roughness=0.7)
    pompom = common.toon_material('Pompom', '#c79a4b', roughness=0.9)
    ember = common.toon_material('Ember', '#e08a3d', roughness=0.5, emission='#f4c76b', emission_strength=0.6)

    body = common.add_sphere('Body', 0.36, (0.0, 0.0, 0.36), tunic, scale=(1.0, 0.9, 1.0))
    head = common.add_sphere('Head', 0.42, (0.0, 0.0, 1.05), skin)
    hat = common.add_sphere('HatDome', 0.44, (0.0, 0.0, 1.18), hat_cloth, scale=(1.0, 1.0, 0.8))
    tip = common.add_sphere('Pompom', 0.1, (0.3, -0.05, 1.55), pompom)
    glow = common.add_sphere('Ember', 0.08, (0.55, -0.2, 0.2), ember)
    for obj in (body, head, hat, tip, glow):
        common.outline_modifier(obj, thickness=0.012)

    # The bob: body and head rise together, the hat follows one frame late
    # so the layers are a real test of staying in step after packing.
    for frame in range(1, FRAMES + 1):
        phase = (frame - 1) / FRAMES * math.tau
        lift = 0.06 * math.sin(phase)
        for obj, base in ((body, 0.36), (head, 1.05)):
            obj.location.z = base + lift
            obj.keyframe_insert('location', frame=frame)
        lag = 0.06 * math.sin(phase - 0.5)
        for obj, base in ((hat, 1.18), (tip, 1.55)):
            obj.location.z = base + lag
            obj.keyframe_insert('location', frame=frame)
    scene.frame_set(1)
    return scene, camera, {'body': [body, head, glow], 'hat': [hat, tip]}


def main():
    out_dir = common.script_args()[0] if common.script_args() else os.path.join(os.getcwd(), 'smoke-out')
    scene, camera, layers = build()
    scene.frame_set(4)
    common.render_still(scene, os.path.join(out_dir, 'smoke.png'))
    everything = [obj for group in layers.values() for obj in group]
    for layer, objects in layers.items():
        common.hide_for_render(everything, True)
        common.hide_for_render(objects, False)
        frames_dir = os.path.join(out_dir, 'frames', layer)
        common.render_frames(scene, frames_dir, 'bob', 1, FRAMES)
        common.write_anchor(scene, camera, frames_dir)
    common.hide_for_render(everything, False)
    common.save_blend(os.path.join(out_dir, 'smoke.blend'))


if __name__ == '__main__':
    main()
