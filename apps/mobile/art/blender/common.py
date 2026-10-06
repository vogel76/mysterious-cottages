"""Shared Blender helpers for the elf's sprite pipeline: the scene, the
camera, the light rig, the toon materials, the outline and the renders.

Why this exists: the Elf tab draws a Pou-style companion in its cottage, and
drawing it in code (Skia paths) looked clumsy and stiff. Instead the
character and the room are modelled, lit and animated here in Blender by
script, rendered to PNG frames with alpha, packed into atlases (pack.py) and
played in the app as sprites. Every build script (elf.py, room.py, ...)
imports this module so all renders share one camera, one light and one
material language and can be composed in the app without seams.

Conventions, binding for every script that imports this module:

- Units: 1 Blender unit = 1 metre. The character stands on the ground
  plane with its feet at the origin (Z = 0) and faces -Y, towards the
  camera, which sits at -Y looking at +Y. Z is up, +X is screen right.
- Colour management: the 'Standard' view transform with no look, sRGB
  display, exposure 0 and gamma 1, so a sprite's colours are the palette
  colours and match the app's tokens. Palette values are sRGB hex strings;
  hex_to_linear() turns them into the linear RGB Blender wants.
- Film transparent, PNG RGBA, 8 bit: the frames keep their alpha.
- Engine: Eevee (the only real-time engine in Blender 5, headless over
  OpenGL), 32 render samples, soft jittered shadows. Cycles is for stills
  only, on this machine it has no GPU.
- Light: a warm key from the upper right (the fireplace side), a cool fill
  from the left (moonlight), a soft top light, a dim cool world ambient so
  nothing falls to pure black. See add_light_rig().
- Materials: soft matte Principled BSDF with a touch of subsurface on skin
  (toon_material()); a thin dark outline from an inverted hull (a Solidify
  modifier with flipped normals and a black emission material, both
  materials culling backfaces: outline_modifier()).
- Camera: orthographic with a slight downward tilt, see add_ortho_camera().
  Its ortho_scale is the visible HEIGHT in metres (sensor fit vertical);
  the frame's width follows from the resolution set in setup_scene().
- Frames: render_frames() writes <out_dir>/<name>_####.png with Blender's
  frame number, which is what pack.py expects. write_anchor() stores where
  the feet (the world origin by default) land in those pixels, so the app
  can place the sprite by its feet.

Running a build script, from apps/mobile:

    /snap/bin/blender --background --python art/blender/elf.py -- <out_dir>

Everything after '--' is the script's own argv (sys.argv[sys.argv.index('--') + 1:]).
Scripts build the whole scene from scratch on every run and never depend
on a saved .blend; save_blend() may dump one for inspection.
"""

from __future__ import annotations

import math
import os
import sys
from typing import Iterable, Sequence

import bmesh
import bpy
from mathutils import Vector

SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))

# The light colours of the art direction.
KEY_COLOR = '#ffb66b'
FILL_COLOR = '#9fc4ff'
TOP_COLOR = '#fff4e6'
AMBIENT_COLOR = '#343a48'
OUTLINE_COLOR = '#14100c'


# ---------------------------------------------------------------------------
# Colour

def srgb_to_linear(channel: float) -> float:
    """One sRGB channel (0..1) to linear light."""
    if channel <= 0.04045:
        return channel / 12.92
    return ((channel + 0.055) / 1.055) ** 2.4


def hex_to_linear(value: str, alpha: float = 1.0) -> tuple[float, float, float, float]:
    """'#rrggbb' (an sRGB palette colour) to the linear RGBA Blender uses."""
    value = value.lstrip('#')
    r, g, b = (int(value[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), alpha)


def script_args() -> list[str]:
    """The arguments after '--' on Blender's command line."""
    argv = sys.argv
    return argv[argv.index('--') + 1:] if '--' in argv else []


# ---------------------------------------------------------------------------
# Scene

def setup_scene(width: int, height: int, engine: str = 'BLENDER_EEVEE', samples: int = 32,
                transparent: bool = True) -> bpy.types.Scene:
    """Resets Blender to one empty scene and configures it for sprite renders.

    Resolution, the Eevee defaults (soft shadows, `samples` TAA samples),
    'Standard' colour management, PNG RGBA output and a transparent film.
    Returns the scene; bpy.context.scene is the same object.
    """
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.name = 'Sprites'
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1.0

    render = scene.render
    render.engine = engine
    render.resolution_x = width
    render.resolution_y = height
    render.resolution_percentage = 100
    render.film_transparent = transparent
    render.filter_size = 1.5
    render.use_file_extension = True
    render.image_settings.file_format = 'PNG'
    render.image_settings.color_mode = 'RGBA'
    render.image_settings.color_depth = '8'
    render.image_settings.compression = 50
    render.fps = 24

    scene.display_settings.display_device = 'sRGB'
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0

    if engine == 'BLENDER_EEVEE':
        eevee = scene.eevee
        eevee.taa_render_samples = samples
        eevee.taa_samples = samples
        eevee.use_shadows = True
        eevee.shadow_ray_count = 2
        eevee.shadow_step_count = 4
        eevee.shadow_resolution_scale = 1.0
    elif engine == 'CYCLES':
        scene.cycles.samples = samples
        scene.cycles.use_denoising = True
        scene.cycles.device = 'CPU'

    # A dim, cool ambient: the moonlit room never goes fully black.
    world = bpy.data.worlds.new('Ambient')
    world.use_nodes = True
    background = world.node_tree.nodes.get('Background')
    if background is not None:
        background.inputs['Color'].default_value = hex_to_linear(AMBIENT_COLOR)
        background.inputs['Strength'].default_value = 1.0
    scene.world = world
    return scene


def _link(obj: bpy.types.Object, scene: bpy.types.Scene | None = None) -> bpy.types.Object:
    (scene or bpy.context.scene).collection.objects.link(obj)
    return obj


def _aim(obj: bpy.types.Object, target: Sequence[float]) -> None:
    """Rotates an object so its local -Z (a light's or camera's axis) points at target."""
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()


# ---------------------------------------------------------------------------
# Light

def _area_light(name: str, color: str, energy: float, size: float, location: Sequence[float],
                target: Sequence[float], soft: float) -> bpy.types.Object:
    data = bpy.data.lights.new(name, 'AREA')
    data.color = hex_to_linear(color)[:3]
    data.energy = energy
    data.shape = 'DISK'
    data.size = size
    data.use_shadow = True
    # Jittered shadows are physically softer but grainy at 32 samples; a
    # wide filter radius gives the same softness without the noise.
    data.use_shadow_jitter = False
    data.shadow_filter_radius = soft
    obj = _link(bpy.data.objects.new(name, data))
    obj.location = Vector(location)
    _aim(obj, target)
    return obj


def add_light_rig(target: Sequence[float] = (0.0, 0.0, 0.8), key_strength: float = 1800.0,
                  fill_strength: float = 140.0, top_strength: float = 600.0) -> dict[str, bpy.types.Object]:
    """The storybook light: warm key upper right, cool fill left, soft top.

    `target` is the point the lights look at, usually the character's chest.
    The strengths are area-light watts at the rig's distances (about 5 m);
    the defaults give a lit side at the palette colour and a readable, not
    black, shadow side. Returns {'key', 'fill', 'top'}.
    """
    t = Vector(target)
    key = _area_light('Key', KEY_COLOR, key_strength, 2.0, t + Vector((3.2, -3.4, 3.6)), t, soft=3.0)
    fill = _area_light('Fill', FILL_COLOR, fill_strength, 4.0, t + Vector((-4.2, -2.6, 1.6)), t, soft=3.0)
    top = _area_light('Top', TOP_COLOR, top_strength, 5.0, t + Vector((0.0, -1.2, 5.5)), t, soft=3.0)
    # The fill and the top are there to lift the shadow side, not to draw
    # shadows of their own over the key's.
    fill.data.use_shadow = False
    return {'key': key, 'fill': fill, 'top': top}


# ---------------------------------------------------------------------------
# Camera

def add_ortho_camera(center: Sequence[float] = (0.0, 0.0, 0.8), ortho_scale: float = 2.0, distance: float = 10.0,
                     tilt_deg: float = 8.0, aspect: float | None = None) -> bpy.types.Object:
    """An orthographic camera at -Y looking at +Y, tilted down by tilt_deg.

    `center` is the world point in the middle of the frame, `ortho_scale`
    the visible height in metres (the width follows the scene resolution;
    `aspect` is accepted for the contract and not needed). The camera is
    made the scene camera. Returns the camera object.
    """
    data = bpy.data.cameras.new('Camera')
    data.type = 'ORTHO'
    data.ortho_scale = ortho_scale
    data.sensor_fit = 'VERTICAL'
    data.clip_start = 0.05
    data.clip_end = distance * 4
    cam = _link(bpy.data.objects.new('Camera', data))
    tilt = math.radians(tilt_deg)
    c = Vector(center)
    cam.location = c + Vector((0.0, -distance * math.cos(tilt), distance * math.sin(tilt)))
    cam.rotation_euler = (math.pi / 2 - tilt, 0.0, 0.0)
    bpy.context.scene.camera = cam
    return cam


def project_to_pixels(scene: bpy.types.Scene, camera: bpy.types.Object,
                      point: Sequence[float] = (0.0, 0.0, 0.0)) -> tuple[float, float]:
    """Where a world point lands in the rendered image, in pixels from the top left."""
    from bpy_extras.object_utils import world_to_camera_view
    view = world_to_camera_view(scene, camera, Vector(point))
    width = scene.render.resolution_x * scene.render.resolution_percentage / 100
    height = scene.render.resolution_y * scene.render.resolution_percentage / 100
    return (view.x * width, (1.0 - view.y) * height)


def write_anchor(scene: bpy.types.Scene, camera: bpy.types.Object, out_dir: str,
                 point: Sequence[float] = (0.0, 0.0, 0.0)) -> str:
    """Writes <out_dir>/anchor.json: the feet point (the origin) in frame pixels, for pack.py."""
    import json
    os.makedirs(out_dir, exist_ok=True)
    x, y = project_to_pixels(scene, camera, point)
    path = os.path.join(out_dir, 'anchor.json')
    with open(path, 'w', encoding='utf-8') as handle:
        json.dump({'x': round(x, 2), 'y': round(y, 2)}, handle)
    return path


# ---------------------------------------------------------------------------
# Materials and outline

def toon_material(name: str, base_color: str | Sequence[float], roughness: float = 0.6, subsurface: float = 0.0,
                  emission: str | Sequence[float] | None = None, emission_strength: float = 1.0) -> bpy.types.Material:
    """A soft matte material: Principled BSDF, low specular, optional subsurface and emission.

    `base_color` and `emission` are '#rrggbb' strings or linear RGBA tuples.
    Backface culling is on, which the inverted-hull outline relies on.
    """
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.use_backface_culling = True
    bsdf = mat.node_tree.nodes['Principled BSDF']
    color = hex_to_linear(base_color) if isinstance(base_color, str) else tuple(base_color)
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Specular IOR Level'].default_value = 0.25
    bsdf.inputs['Metallic'].default_value = 0.0
    if subsurface > 0:
        bsdf.inputs['Subsurface Weight'].default_value = subsurface
        bsdf.inputs['Subsurface Radius'].default_value = (1.0, 0.4, 0.25)
        bsdf.inputs['Subsurface Scale'].default_value = 0.05
    if emission is not None:
        glow = hex_to_linear(emission) if isinstance(emission, str) else tuple(emission)
        bsdf.inputs['Emission Color'].default_value = glow
        bsdf.inputs['Emission Strength'].default_value = emission_strength
    return mat


def outline_material(color: str = OUTLINE_COLOR) -> bpy.types.Material:
    """The flat dark material of the inverted hull (one per colour, reused)."""
    name = f'Outline {color}'
    mat = bpy.data.materials.get(name)
    if mat is not None:
        return mat
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.use_backface_culling = True
    nodes = mat.node_tree.nodes
    bsdf = nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (0.0, 0.0, 0.0, 1.0)
    bsdf.inputs['Specular IOR Level'].default_value = 0.0
    bsdf.inputs['Roughness'].default_value = 1.0
    bsdf.inputs['Emission Color'].default_value = hex_to_linear(color)
    bsdf.inputs['Emission Strength'].default_value = 1.0
    return mat


def outline_modifier(obj: bpy.types.Object, thickness: float = 0.01, color: str = OUTLINE_COLOR) -> bpy.types.Modifier:
    """The inverted-hull outline: a Solidify shell pushed outwards with flipped normals.

    The shell wears the dark outline material; because both it and the
    base materials cull backfaces, only the shell's rim beyond the
    silhouette stays visible. `thickness` is in metres: 0.01 is a thin line
    on a 1.5 m character framed at 2 m. Returns the modifier.
    """
    mesh = obj.data
    mesh.materials.append(outline_material(color))
    mod = obj.modifiers.new('Outline', 'SOLIDIFY')
    mod.thickness = thickness
    mod.offset = 1.0
    mod.use_flip_normals = True
    mod.use_rim = False
    mod.use_quality_normals = True
    # The offset is clamped to the last slot, where the outline material sits.
    mod.material_offset = len(mesh.materials)
    return mod


# ---------------------------------------------------------------------------
# Meshes

def mesh_from_bmesh(name: str, bm: bmesh.types.BMesh, material: bpy.types.Material | None = None,
                    smooth: bool = True) -> bpy.types.Object:
    """Turns a bmesh into a linked object (frees the bmesh), optionally smooth with one material."""
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    if smooth:
        mesh.polygons.foreach_set('use_smooth', [True] * len(mesh.polygons))
    if material is not None:
        mesh.materials.append(material)
    return _link(bpy.data.objects.new(name, mesh))


def add_sphere(name: str, radius: float, location: Sequence[float], material: bpy.types.Material | None = None,
               segments: int = 48, rings: int = 24, scale: Sequence[float] = (1.0, 1.0, 1.0)) -> bpy.types.Object:
    """A smooth UV sphere, the building block of the chibi shapes."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings, radius=radius)
    obj = mesh_from_bmesh(name, bm, material)
    obj.location = Vector(location)
    obj.scale = Vector(scale)
    return obj


def parent_armature_auto(mesh_obj: bpy.types.Object, armature_obj: bpy.types.Object) -> None:
    """Parents a mesh to an armature with automatic weights, headless."""
    view_layer = bpy.context.view_layer
    for obj in view_layer.objects:
        obj.select_set(False)
    mesh_obj.select_set(True)
    armature_obj.select_set(True)
    view_layer.objects.active = armature_obj
    with bpy.context.temp_override(view_layer=view_layer, active_object=armature_obj, object=armature_obj,
                                   selected_objects=[mesh_obj, armature_obj],
                                   selected_editable_objects=[mesh_obj, armature_obj]):
        bpy.ops.object.parent_set(type='ARMATURE_AUTO')


# ---------------------------------------------------------------------------
# Rendering

def render_still(scene: bpy.types.Scene, path: str) -> str:
    """Renders the current frame to one PNG at `path` (the directory is created)."""
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return path


def render_frames(scene: bpy.types.Scene, out_dir: str, name: str, frame_start: int, frame_end: int) -> list[str]:
    """Renders frames frame_start..frame_end (inclusive) to <out_dir>/<name>_####.png.

    Returns the paths in frame order.
    """
    os.makedirs(out_dir, exist_ok=True)
    scene.frame_start = frame_start
    scene.frame_end = frame_end
    scene.render.filepath = os.path.join(out_dir, f'{name}_####')
    bpy.ops.render.render(animation=True)
    return [os.path.join(out_dir, f'{name}_{frame:04d}.png') for frame in range(frame_start, frame_end + 1)]


def save_blend(path: str) -> str:
    """Saves the scene for inspection in the Blender GUI; never read back by the scripts."""
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=path, copy=True)
    return path


def hide_for_render(objects: Iterable[bpy.types.Object], hidden: bool) -> None:
    """Hides objects from the render (for rendering one layer of a layered character at a time)."""
    for obj in objects:
        obj.hide_render = hidden
