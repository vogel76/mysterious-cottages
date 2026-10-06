"""
room.py - the Chatynkowo cottage interior, built and rendered headlessly in Blender.

Why: the Elf tab shows the pet in a cosy cottage. Instead of drawing the room with
Skia code we model it here by script (walls, beams, window, fireplace, furniture),
light it like a storybook night scene and render it to 2D: one full background
plate, one empty shell plate and every swappable piece of furniture as its own
transparent sprite rendered with the same camera and lights. The app composites
the sprites over the shell plate and places the elf sprite on the rug.

Usage (no GUI, everything is rebuilt from scratch on each run):
  /snap/bin/blender --background --python room.py -- OUT_DIR \
      [--scale 0.4] [--samples 96] [--sprite-samples 64] \
      [--engine CYCLES|BLENDER_EEVEE] [--only plate,plate_empty,rug_braided,...] \
      [--no-sheet] [--save-blend]

Conventions: metres, Z up, the camera looks towards +Y at the back wall which
stands at y = 1.5. The elf (rendered elsewhere) faces -Y, towards the camera.
The plate is 1000 x 1600 and the app shows it with a cover fit, so the layout
is framed for the central 720 px band a phone shows; see the "Layout
constants" section for the numbers.
Output: OUT_DIR/plate.png, plate_empty.png, <slot>_<variant>.png, sprites.json,
contact.png, phone_crop.png (the plate's phone band) and camera.json with
the numbers the app needs.

The "pipeline helpers" section mirrors the API of common.py (setup_scene,
add_light_rig, add_ortho_camera, render_still, render_frames, outline_modifier,
toon_material). Once common.py exists in this directory, replace that section
with `from common import ...`; every call site stays the same.
"""

import json
import math
import os
import random
import subprocess
import sys
import time

import bmesh
import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))

# ----------------------------------------------------------------------------
# Palette (art direction) - sRGB hex, converted to linear for Blender
# ----------------------------------------------------------------------------

PAL = {
    "plaster": "#c9b48c",
    "plaster_dark": "#a8905f",
    "wood": "#5a3b22",
    "wood_light": "#7a5230",
    "wood_pale": "#9c7146",
    "stone": "#6e6a63",
    "stone_light": "#8c877e",
    "mortar": "#4a463f",
    "fire": "#ffb347",
    "ember": "#e08a3d",
    "ember_light": "#f4c76b",
    "gold": "#d2a64d",
    "trim": "#c79a4b",
    "green": "#4e8a54",
    "green_dark": "#3b6e42",
    "red": "#a83a2e",
    "cream": "#e9d8b4",
    "boots": "#3a2616",
    "mystic": "#6b3fa0",
    "mystic_light": "#c39bff",
    "night": "#0b1430",
    "night_light": "#22386e",
    "moon": "#f6f1d8",
    "terracotta": "#b5603a",
    "sage": "#7e8f5e",
    "lavender": "#8a7aa8",
    "dried": "#a9743a",
    "iron": "#2a2724",
    "soil": "#2e2016",
}


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def rgb(hex_or_tuple):
    """Hex colour (or tuple) to linear RGB tuple, as Blender expects."""
    if isinstance(hex_or_tuple, str):
        h = hex_or_tuple.lstrip("#")
        return tuple(srgb_to_linear(int(h[i:i + 2], 16) / 255.0) for i in (0, 2, 4))
    return tuple(hex_or_tuple[:3])


def rgba(c, a=1.0):
    return (*rgb(c), a)


# ----------------------------------------------------------------------------
# Pipeline helpers (same API as common.py; see the module docstring)
# ----------------------------------------------------------------------------

def setup_scene(width, height, engine="BLENDER_EEVEE", samples=32, transparent=True):
    """Reset to an empty scene with the given output size, Standard colour
    management and film transparency; return the scene."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = engine
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = transparent
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0
    if engine == "CYCLES":
        scene.cycles.device = "CPU"
        scene.cycles.samples = samples
        scene.cycles.use_adaptive_sampling = True
        scene.cycles.adaptive_threshold = 0.02
        scene.cycles.use_denoising = True
        scene.cycles.denoiser = "OPENIMAGEDENOISE"
        scene.cycles.max_bounces = 6
        scene.cycles.diffuse_bounces = 3
        scene.cycles.glossy_bounces = 2
        scene.cycles.transparent_max_bounces = 8
        scene.cycles.caustics_reflective = False
        scene.cycles.caustics_refractive = False
        scene.cycles.blur_glossy = 1.0
    else:
        scene.eevee.taa_render_samples = samples
        for attr, value in (("use_shadows", True), ("shadow_ray_count", 2),
                            ("shadow_step_count", 4), ("use_raytracing", True),
                            ("fast_gi_method", "GLOBAL_ILLUMINATION")):
            if hasattr(scene.eevee, attr):
                setattr(scene.eevee, attr, value)
    return scene


def toon_material(name, base_color, roughness=0.6, subsurface=0.0, emission=None):
    """Soft matte Principled material; emission is (colour, strength) or None."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = rgba(base_color)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Specular IOR Level"].default_value = 0.25
    if subsurface:
        bsdf.inputs["Subsurface Weight"].default_value = subsurface
        bsdf.inputs["Subsurface Radius"].default_value = (0.2, 0.1, 0.06)
        bsdf.inputs["Subsurface Scale"].default_value = 0.1
    if emission:
        col, strength = emission
        bsdf.inputs["Emission Color"].default_value = rgba(col)
        bsdf.inputs["Emission Strength"].default_value = strength
    return mat


def _outline_material():
    """Black where the hull faces away from the camera (the far rim), fully
    transparent where it faces the camera: the classic inverted-hull outline."""
    mat = bpy.data.materials.get("Outline")
    if mat:
        return mat
    mat = bpy.data.materials.new("Outline")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    mix = nt.nodes.new("ShaderNodeMixShader")
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    trans = nt.nodes.new("ShaderNodeBsdfTransparent")
    emit = nt.nodes.new("ShaderNodeEmission")
    emit.inputs["Color"].default_value = (0.0, 0.0, 0.0, 1.0)
    emit.inputs["Strength"].default_value = 1.0
    nt.links.new(geo.outputs["Backfacing"], mix.inputs["Fac"])
    nt.links.new(trans.outputs[0], mix.inputs[1])
    nt.links.new(emit.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    mat.surface_render_method = "DITHERED"
    mat.use_backface_culling = False
    return mat


def outline_modifier(obj, thickness=0.01):
    """Inverted-hull outline: a copy of the mesh pushed out along its normals,
    as a child object visible only to camera rays (no outline shadows)."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.normal_update()
    for v in bm.verts:
        v.co += v.normal * thickness
    me = bpy.data.meshes.new(obj.name + ".outline")
    bm.to_mesh(me)
    bm.free()
    me.materials.append(_outline_material())
    for p in me.polygons:
        p.use_smooth = True
    hull = bpy.data.objects.new(obj.name + ".outline", me)
    hull.parent = obj
    hull.matrix_parent_inverse = Matrix.Identity(4)
    hull.visible_shadow = False
    hull.visible_diffuse = False
    hull.visible_glossy = False
    hull.visible_transmission = False
    hull.visible_volume_scatter = False
    for coll in obj.users_collection:
        coll.objects.link(hull)
    return hull


def add_light_rig(target=(0, 0, 0.8), key_strength=400.0, fill_strength=120.0):
    """Generic warm key (upper right) / cool fill (left) / soft top rig.
    The room uses its own motivated lights (fire, moon, candles) instead, see
    add_room_lights, but the helper is kept for API parity with common.py."""
    coll = _collection("lights")
    lights = {}
    key = _light("key", "AREA", (2.5, -2.0, 3.0), "#ffb66b", key_strength, coll, size=1.5)
    fill = _light("fill", "AREA", (-3.0, -1.5, 2.0), "#9fc4ff", fill_strength, coll, size=2.0)
    top = _light("top", "AREA", (0.0, -0.5, 4.0), "#ffffff", key_strength * 0.3, coll, size=3.0)
    for name, l in (("key", key), ("fill", fill), ("top", top)):
        aim(l, target)
        lights[name] = l
    return lights


def add_ortho_camera(center, ortho_scale, distance=10.0, tilt_deg=8.0, aspect=1.0):
    """Orthographic camera at -Y looking towards +Y, tilted down by tilt_deg."""
    cam_data = bpy.data.cameras.new("Camera")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = ortho_scale
    cam = bpy.data.objects.new("Camera", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    t = math.radians(tilt_deg)
    cam.location = (center[0], center[1] - distance * math.cos(t), center[2] + distance * math.sin(t))
    cam.rotation_euler = (math.radians(90.0) - t, 0.0, 0.0)
    bpy.context.scene.camera = cam
    return cam


def render_still(scene, path):
    scene.render.filepath = path
    t0 = time.time()
    bpy.ops.render.render(write_still=True)
    print(f"[room] rendered {os.path.basename(path)} in {time.time() - t0:.1f}s")
    return path


def render_frames(scene, out_dir, name, frame_start, frame_end):
    paths = []
    for f in range(frame_start, frame_end + 1):
        scene.frame_set(f)
        paths.append(render_still(scene, os.path.join(out_dir, f"{name}_{f:04d}.png")))
    return paths


# ----------------------------------------------------------------------------
# Small scene helpers
# ----------------------------------------------------------------------------

def _collection(name):
    coll = bpy.data.collections.get(name)
    if coll is None:
        coll = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(coll)
    return coll


def _light(name, kind, location, color, energy, coll, size=None, radius=0.1):
    data = bpy.data.lights.new(name, kind)
    data.color = rgb(color)
    data.energy = energy
    if kind == "AREA":
        data.shape = "SQUARE"
        data.size = size or 1.0
    elif kind in ("POINT", "SPOT"):
        data.shadow_soft_size = radius
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    coll.objects.link(obj)
    return obj


def aim(obj, target):
    """Point an object's -Z axis (camera/light direction) at target."""
    direction = Vector(target) - Vector(obj.location)
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def finish_mesh(name, verts, faces, smooth=False):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = smooth
    return me


def make_object(name, me, coll, location=(0, 0, 0), rotation=(0, 0, 0), mat=None, outline=0.0):
    obj = bpy.data.objects.new(name, me)
    obj.location = location
    obj.rotation_euler = rotation
    coll.objects.link(obj)
    if mat is not None:
        me.materials.append(mat)
    if outline:
        outline_modifier(obj, outline)
    return obj


def box(name, coll, size, location, mat, outline=0.0, rotation=(0, 0, 0), smooth=False):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = smooth
    return make_object(name, me, coll, location, rotation, mat, outline)


def box_bounds(name, coll, xmin, xmax, ymin, ymax, zmin, zmax, mat, outline=0.0):
    size = (xmax - xmin, ymax - ymin, zmax - zmin)
    loc = ((xmin + xmax) / 2, (ymin + ymax) / 2, (zmin + zmax) / 2)
    return box(name, coll, size, loc, mat, outline)


def cylinder(name, coll, radius, depth, location, mat, outline=0.0, rotation=(0, 0, 0),
             radius2=None, segments=32, smooth=True):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments,
                          radius1=radius, radius2=radius if radius2 is None else radius2,
                          depth=depth)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = smooth
    return make_object(name, me, coll, location, rotation, mat, outline)


def sphere(name, coll, radius, location, mat, outline=0.0, scale=(1, 1, 1), segments=24):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=segments // 2, radius=radius)
    bmesh.ops.scale(bm, vec=Vector(scale), verts=bm.verts)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    return make_object(name, me, coll, location, (0, 0, 0), mat, outline)


def torus(name, coll, major, minor, location, mat, outline=0.0, rotation=(0, 0, 0),
          scale=(1, 1, 1), segments=32, rings=12):
    verts, faces = [], []
    for i in range(segments):
        u = 2 * math.pi * i / segments
        for j in range(rings):
            v = 2 * math.pi * j / rings
            r = major + minor * math.cos(v)
            verts.append((r * math.cos(u) * scale[0], r * math.sin(u) * scale[1],
                          minor * math.sin(v) * scale[2]))
    for i in range(segments):
        for j in range(rings):
            a = i * rings + j
            b = ((i + 1) % segments) * rings + j
            c = ((i + 1) % segments) * rings + (j + 1) % rings
            d = i * rings + (j + 1) % rings
            faces.append((a, b, c, d))
    me = finish_mesh(name, verts, faces, smooth=True)
    return make_object(name, me, coll, location, rotation, mat, outline)


def lathe(name, coll, profile, location, mat, outline=0.0, segments=24, smooth=True,
          rotation=(0, 0, 0), scale_xy=(1, 1)):
    """Revolve a (radius, z) profile around Z. A radius of 0 makes a pole."""
    verts, faces, rings = [], [], []
    for r, z in profile:
        if r <= 1e-6:
            rings.append([len(verts)])
            verts.append((0.0, 0.0, z))
        else:
            idx = []
            for s in range(segments):
                a = 2 * math.pi * s / segments
                idx.append(len(verts))
                verts.append((r * math.cos(a) * scale_xy[0], r * math.sin(a) * scale_xy[1], z))
            rings.append(idx)
    for ra, rb in zip(rings, rings[1:]):
        if len(ra) == 1 and len(rb) == 1:
            continue
        if len(ra) == 1:
            faces += [(ra[0], rb[s], rb[(s + 1) % segments]) for s in range(segments)]
        elif len(rb) == 1:
            faces += [(ra[s], ra[(s + 1) % segments], rb[0]) for s in range(segments)]
        else:
            faces += [(ra[s], ra[(s + 1) % segments], rb[(s + 1) % segments], rb[s])
                      for s in range(segments)]
    if len(rings[0]) > 1:
        faces.append(tuple(rings[0]))
    if len(rings[-1]) > 1:
        faces.append(tuple(rings[-1]))
    me = finish_mesh(name, verts, faces, smooth=smooth)
    return make_object(name, me, coll, location, rotation, mat, outline)


def grid_sheet(name, coll, fn, nu, nv, location, mat, outline=0.0, smooth=True):
    """A quad sheet from a parametric function fn(u, v) -> (x, y, z), u,v in [0,1]."""
    verts, faces = [], []
    for i in range(nu + 1):
        for j in range(nv + 1):
            verts.append(fn(i / nu, j / nv))
    for i in range(nu):
        for j in range(nv):
            a = i * (nv + 1) + j
            faces.append((a, a + nv + 1, a + nv + 2, a + 1))
    me = finish_mesh(name, verts, faces, smooth=smooth)
    return make_object(name, me, coll, location, (0, 0, 0), mat, outline)


def no_shadow(obj):
    """The object is seen by the camera but does not block light."""
    obj.visible_shadow = False
    return obj


# ----------------------------------------------------------------------------
# Procedural materials
# ----------------------------------------------------------------------------

def _nodes(mat):
    nt = mat.node_tree
    return nt, nt.nodes, nt.links, nt.nodes["Principled BSDF"]


def _object_coords(nodes):
    tc = nodes.new("ShaderNodeTexCoord")
    return tc.outputs["Object"]


def noisy_material(name, base, dark, scale=6.0, strength=0.3, roughness=0.75, detail=3.0):
    """Matte material whose base colour is broken up by soft noise."""
    mat = toon_material(name, base, roughness=roughness)
    nt, nodes, links, bsdf = _nodes(mat)
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = scale
    noise.inputs["Detail"].default_value = detail
    noise.inputs["Roughness"].default_value = 0.55
    links.new(_object_coords(nodes), noise.inputs["Vector"])
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.35
    ramp.color_ramp.elements[1].position = 0.65
    ramp.color_ramp.elements[0].color = rgba(dark)
    ramp.color_ramp.elements[1].color = rgba(base)
    links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    mix = nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs["Factor"].default_value = strength
    mix.inputs[6].default_value = rgba(base)
    links.new(ramp.outputs["Color"], mix.inputs[7])
    links.new(mix.outputs[2], bsdf.inputs["Base Color"])
    return mat


def plank_material(name, plank_width=0.16, along="x"):
    """Floor planks: dark seams every plank_width, a per-plank tint and a
    stretched grain noise. Planks run along the given axis."""
    mat = toon_material(name, PAL["wood_light"], roughness=0.7)
    nt, nodes, links, bsdf = _nodes(mat)
    coords = _object_coords(nodes)
    sep = nodes.new("ShaderNodeSeparateXYZ")
    links.new(coords, sep.inputs[0])
    across = sep.outputs["Y" if along == "x" else "X"]
    # plank index -> random tint
    div = nodes.new("ShaderNodeMath")
    div.operation = "DIVIDE"
    div.inputs[1].default_value = plank_width
    links.new(across, div.inputs[0])
    flo = nodes.new("ShaderNodeMath")
    flo.operation = "FLOOR"
    links.new(div.outputs[0], flo.inputs[0])
    white = nodes.new("ShaderNodeTexWhiteNoise")
    white.noise_dimensions = "1D"
    links.new(flo.outputs[0], white.inputs["W"])
    tint = nodes.new("ShaderNodeValToRGB")
    tint.color_ramp.elements[0].color = rgba(PAL["wood"])
    tint.color_ramp.elements[1].color = rgba(PAL["wood_pale"])
    links.new(white.outputs["Value"], tint.inputs["Fac"])
    # grain
    mapping = nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (2.0, 40.0, 1.0) if along == "x" else (40.0, 2.0, 1.0)
    links.new(coords, mapping.inputs["Vector"])
    grain = nodes.new("ShaderNodeTexNoise")
    grain.inputs["Scale"].default_value = 3.0
    grain.inputs["Detail"].default_value = 4.0
    links.new(mapping.outputs[0], grain.inputs["Vector"])
    grain_mix = nodes.new("ShaderNodeMix")
    grain_mix.data_type = "RGBA"
    grain_mix.inputs["Factor"].default_value = 0.35
    links.new(tint.outputs["Color"], grain_mix.inputs[6])
    darker = nodes.new("ShaderNodeMix")
    darker.data_type = "RGBA"
    darker.inputs["Factor"].default_value = 0.5
    links.new(tint.outputs["Color"], darker.inputs[6])
    darker.inputs[7].default_value = rgba(PAL["boots"])
    links.new(darker.outputs[2], grain_mix.inputs[7])
    links.new(grain.outputs["Fac"], grain_mix.inputs["Factor"])
    # seams
    frac = nodes.new("ShaderNodeMath")
    frac.operation = "FRACT"
    links.new(div.outputs[0], frac.inputs[0])
    seam = nodes.new("ShaderNodeMath")
    seam.operation = "LESS_THAN"
    seam.inputs[1].default_value = 0.06
    links.new(frac.outputs[0], seam.inputs[0])
    seam_mix = nodes.new("ShaderNodeMix")
    seam_mix.data_type = "RGBA"
    links.new(seam.outputs[0], seam_mix.inputs["Factor"])
    links.new(grain_mix.outputs[2], seam_mix.inputs[6])
    seam_mix.inputs[7].default_value = rgba("#2a1a0e")
    links.new(seam_mix.outputs[2], bsdf.inputs["Base Color"])
    return mat


def stone_material(name):
    """Fieldstone: Voronoi cells with per-cell shade and dark mortar lines."""
    mat = toon_material(name, PAL["stone"], roughness=0.9)
    nt, nodes, links, bsdf = _nodes(mat)
    coords = _object_coords(nodes)
    mapping = nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (1.0, 1.0, 1.6)
    links.new(coords, mapping.inputs["Vector"])
    vor = nodes.new("ShaderNodeTexVoronoi")
    vor.feature = "F1"
    vor.inputs["Scale"].default_value = 7.0
    vor.inputs["Randomness"].default_value = 0.9
    links.new(mapping.outputs[0], vor.inputs["Vector"])
    edge = nodes.new("ShaderNodeTexVoronoi")
    edge.feature = "DISTANCE_TO_EDGE"
    edge.inputs["Scale"].default_value = 7.0
    edge.inputs["Randomness"].default_value = 0.9
    links.new(mapping.outputs[0], edge.inputs["Vector"])
    shade = nodes.new("ShaderNodeValToRGB")
    shade.color_ramp.elements[0].color = rgba("#5a564f")
    shade.color_ramp.elements[1].color = rgba(PAL["stone_light"])
    # Voronoi colour output has 3 channels; use its red channel as a per-cell random value
    sep = nodes.new("ShaderNodeSeparateColor")
    links.new(vor.outputs["Color"], sep.inputs[0])
    links.new(sep.outputs[0], shade.inputs["Fac"])
    mortar_ramp = nodes.new("ShaderNodeMapRange")
    mortar_ramp.inputs["From Min"].default_value = 0.02
    mortar_ramp.inputs["From Max"].default_value = 0.06
    links.new(edge.outputs["Distance"], mortar_ramp.inputs["Value"])
    mix = nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    links.new(mortar_ramp.outputs[0], mix.inputs["Factor"])
    mix.inputs[6].default_value = rgba(PAL["mortar"])
    links.new(shade.outputs["Color"], mix.inputs[7])
    links.new(mix.outputs[2], bsdf.inputs["Base Color"])
    return mat


def ring_material(name, colors, ring_width):
    """Concentric rings around the object origin (braided rug)."""
    mat = toon_material(name, colors[0], roughness=0.95)
    nt, nodes, links, bsdf = _nodes(mat)
    coords = _object_coords(nodes)
    length = nodes.new("ShaderNodeVectorMath")
    length.operation = "LENGTH"
    links.new(coords, length.inputs[0])
    div = nodes.new("ShaderNodeMath")
    div.operation = "DIVIDE"
    div.inputs[1].default_value = ring_width * len(colors)
    links.new(length.outputs["Value"], div.inputs[0])
    frac = nodes.new("ShaderNodeMath")
    frac.operation = "FRACT"
    links.new(div.outputs[0], frac.inputs[0])
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = "CONSTANT"
    ramp.color_ramp.elements[0].color = rgba(colors[0])
    ramp.color_ramp.elements[1].position = 1.0 / len(colors)
    ramp.color_ramp.elements[1].color = rgba(colors[1])
    for i, c in enumerate(colors[2:], start=2):
        el = ramp.color_ramp.elements.new(i / len(colors))
        el.color = rgba(c)
    links.new(frac.outputs[0], ramp.inputs["Fac"])
    # braid texture: fine noise darkening
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 60.0
    noise.inputs["Detail"].default_value = 2.0
    links.new(coords, noise.inputs["Vector"])
    mix = nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = 0.35
    links.new(ramp.outputs["Color"], mix.inputs[6])
    links.new(noise.outputs["Color"], mix.inputs[7])
    links.new(mix.outputs[2], bsdf.inputs["Base Color"])
    return mat


def checker_material(name, a, b, scale=12.0, roughness=0.9):
    mat = toon_material(name, a, roughness=roughness)
    nt, nodes, links, bsdf = _nodes(mat)
    chk = nodes.new("ShaderNodeTexChecker")
    chk.inputs["Color1"].default_value = rgba(a)
    chk.inputs["Color2"].default_value = rgba(b)
    chk.inputs["Scale"].default_value = scale
    links.new(_object_coords(nodes), chk.inputs["Vector"])
    links.new(chk.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def stripe_material(name, a, b, axis="x", scale=20.0, roughness=0.9):
    mat = toon_material(name, a, roughness=roughness)
    nt, nodes, links, bsdf = _nodes(mat)
    wave = nodes.new("ShaderNodeTexWave")
    wave.wave_type = "BANDS"
    wave.bands_direction = axis.upper()
    wave.wave_profile = "SAW"
    wave.inputs["Scale"].default_value = scale
    links.new(_object_coords(nodes), wave.inputs["Vector"])
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = "CONSTANT"
    ramp.color_ramp.elements[0].color = rgba(a)
    ramp.color_ramp.elements[1].position = 0.5
    ramp.color_ramp.elements[1].color = rgba(b)
    links.new(wave.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def gradient_emission_material(name, stops, strength=1.0, axis="Z", span=(0.0, 1.0)):
    """Pure emission with a colour ramp along a local axis (night sky, flame)."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nodes, links = nt.nodes, nt.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    emit = nodes.new("ShaderNodeEmission")
    emit.inputs["Strength"].default_value = strength
    sep = nodes.new("ShaderNodeSeparateXYZ")
    links.new(_object_coords(nodes), sep.inputs[0])
    rng = nodes.new("ShaderNodeMapRange")
    rng.inputs["From Min"].default_value = span[0]
    rng.inputs["From Max"].default_value = span[1]
    links.new(sep.outputs[axis], rng.inputs["Value"])
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = stops[0][0]
    ramp.color_ramp.elements[0].color = rgba(stops[0][1])
    ramp.color_ramp.elements[1].position = stops[-1][0]
    ramp.color_ramp.elements[1].color = rgba(stops[-1][1])
    for pos, col in stops[1:-1]:
        el = ramp.color_ramp.elements.new(pos)
        el.color = rgba(col)
    links.new(rng.outputs[0], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], emit.inputs["Color"])
    links.new(emit.outputs[0], out.inputs["Surface"])
    return mat


def glass_material(name, tint="#dfe9ff", transparency=0.86):
    """Cheap window glass: mostly transparent with a faint glossy sheen."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nodes, links = nt.nodes, nt.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    mix = nodes.new("ShaderNodeMixShader")
    trans = nodes.new("ShaderNodeBsdfTransparent")
    gloss = nodes.new("ShaderNodeBsdfGlossy") if hasattr(bpy.types, "ShaderNodeBsdfGlossy") else nodes.new("ShaderNodeBsdfAnisotropic")
    gloss.inputs["Roughness"].default_value = 0.15
    gloss.inputs["Color"].default_value = rgba(tint)
    mix.inputs["Fac"].default_value = 1.0 - transparency
    links.new(trans.outputs[0], mix.inputs[1])
    links.new(gloss.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], out.inputs["Surface"])
    mat.surface_render_method = "BLENDED"
    return mat


def contact_shadow_material():
    """Black, fading out radially from the object origin: a baked soft shadow."""
    mat = bpy.data.materials.get("ContactShadow")
    if mat:
        return mat
    mat = bpy.data.materials.new("ContactShadow")
    mat.use_nodes = True
    nt = mat.node_tree
    nodes, links = nt.nodes, nt.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    mix = nodes.new("ShaderNodeMixShader")
    trans = nodes.new("ShaderNodeBsdfTransparent")
    emit = nodes.new("ShaderNodeEmission")
    emit.inputs["Color"].default_value = (0.0, 0.0, 0.0, 1.0)
    length = nodes.new("ShaderNodeVectorMath")
    length.operation = "LENGTH"
    links.new(_object_coords(nodes), length.inputs[0])
    fade = nodes.new("ShaderNodeMapRange")
    fade.inputs["From Min"].default_value = 0.25
    fade.inputs["From Max"].default_value = 1.0
    fade.inputs["To Min"].default_value = 1.0
    fade.inputs["To Max"].default_value = 0.0
    links.new(length.outputs["Value"], fade.inputs["Value"])
    curve = nodes.new("ShaderNodeMath")
    curve.operation = "POWER"
    curve.inputs[1].default_value = 1.6
    links.new(fade.outputs[0], curve.inputs[0])
    # per-object strength from the custom property set in contact_shadow()
    attr = nodes.new("ShaderNodeAttribute")
    attr.attribute_type = "OBJECT"
    attr.attribute_name = "shadow_strength"
    mul = nodes.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    links.new(curve.outputs[0], mul.inputs[0])
    links.new(attr.outputs["Fac"], mul.inputs[1])
    links.new(mul.outputs[0], mix.inputs["Fac"])
    links.new(trans.outputs[0], mix.inputs[1])
    links.new(emit.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], out.inputs["Surface"])
    mat.surface_render_method = "BLENDED"
    return mat


def contact_shadow(coll, center, rx, ry, strength=0.6):
    """A soft dark ellipse on the floor under a piece of furniture. It is only
    seen by the camera (it never blocks light) and gives each sprite its own
    grounding shadow, because the real floor is hidden in sprite renders."""
    bm = bmesh.new()
    bmesh.ops.create_circle(bm, cap_ends=True, segments=40, radius=1.0)
    me = bpy.data.meshes.new("shadow")
    bm.to_mesh(me)
    bm.free()
    obj = make_object("shadow", me, coll, (center[0], center[1], 0.003), mat=contact_shadow_material())
    obj.scale = (rx, ry, 1.0)
    obj.visible_shadow = False
    obj.visible_diffuse = False
    obj.visible_glossy = False
    obj.visible_transmission = False
    obj.visible_volume_scatter = False
    obj["shadow_strength"] = strength
    return obj


# ----------------------------------------------------------------------------
# Layout constants
# ----------------------------------------------------------------------------

# Framing. The app shows the 1000 x 1600 plate with a cover fit: it scales
# the plate to the phone's height and crops the sides, so on a 9:20 phone
# only x = 140..860 of the plate is visible (a 720 px band, the "phone
# crop"). Everything that matters therefore lives inside x = 150..850: the
# room is 2.2 m wide and the camera frame meets the back wall at
# x = +-1.5 m (333 px per metre there), which puts the room's corners at
# x = 133 and 867, just outside the phone crop, and shows a sliver of each
# side wall only on wide screens. The floor line (floor meets the back
# wall) is at 72 percent of the height (y = 1152) and the rug centre at 80
# percent (y = 1280); the app relies on both. With the ceiling at the top
# of the frame that fixes the room height at about 3.45 m.
ROOM_W = 2.2            # inner width (x from -1.1 to 1.1)
WALL_Y = 1.5            # the back wall's front face
CEIL_Z = 3.45
FRAME_HALF_W = 1.5      # the camera frame meets the back wall at x = +-1.5
BEAM = 0.12
TOP_BEAM_Z = CEIL_Z - 0.26
UPRIGHT_X = (-1.04, 0.28)         # a corner post on the left, a post abutting the fireplace
DADO_Z = 0.95

WIN_CX, WIN_CZ = -0.52, 2.0       # small and high: up and left of the elf, never behind it
WIN_W, WIN_H = 0.52, 0.66         # outer frame of the square window
WIN_HOLE = 0.4                    # square hole in the wall, centred on the window
ROUND_R = 0.34                    # outer radius of the round window
RUG_R = 0.58                      # radius of both rug variants

FIRE_X0, FIRE_X1 = 0.34, 0.98     # the whole fireplace, mantel included, sits at x = 610..860 of the plate
FIRE_D = 0.3                      # how far the stone body protrudes from the wall
FIRE_H = 1.22
FIRE_CX = (FIRE_X0 + FIRE_X1) / 2
OPEN_W, OPEN_H = 0.44, 0.54

# Camera: 40 mm on a 36 mm (vertical) sensor, eye height 1.3 m, 5.33 m in
# front of the back wall (so that the frame's half width there is
# FRAME_HALF_W: 11.25 mm is half the sensor width at this aspect). A longer
# lens from further back than the first version (35 mm at 2.5 m) keeps the
# perspective mild while the narrower room fills the phone crop.
CAM_HEIGHT = 1.3
CAM_LENS = 40.0
CAM_Y = WALL_Y - FRAME_HALF_W * CAM_LENS / 11.25
FLOOR_LINE_V = 0.28     # Blender v (from the bottom): floor line at 72 percent from the top
RUG_V = 0.20            # rug centre at 80 percent from the top

RNG = random.Random(7)

MATS = {}


def build_materials():
    MATS["plaster"] = noisy_material("Plaster", PAL["plaster"], PAL["plaster_dark"], scale=4.0, strength=0.35)
    MATS["plaster_plain"] = toon_material("PlasterPlain", PAL["plaster"], roughness=0.9)
    MATS["planks"] = plank_material("Planks", plank_width=0.17, along="x")
    MATS["beam"] = noisy_material("Beam", PAL["wood"], "#3f2816", scale=12.0, strength=0.4, roughness=0.65)
    MATS["wood_light"] = noisy_material("WoodLight", PAL["wood_light"], PAL["wood"], scale=10.0, strength=0.35, roughness=0.6)
    MATS["wood_pale"] = toon_material("WoodPale", PAL["wood_pale"], roughness=0.6)
    MATS["stone"] = stone_material("Stone")
    MATS["firebox"] = toon_material("Firebox", "#1a1310", roughness=1.0)
    MATS["bark"] = noisy_material("Bark", PAL["boots"], "#241609", scale=25.0, strength=0.5, roughness=0.9)
    MATS["log_end"] = toon_material("LogEnd", "#8a5a30", roughness=0.8)
    MATS["flame"] = gradient_emission_material(
        "Flame", [(0.0, "#ff6a1a"), (0.45, PAL["fire"]), (1.0, "#fff2c0")], strength=4.5, span=(0.0, 0.42))
    MATS["ember"] = toon_material("Ember", PAL["ember"], roughness=0.9, emission=(PAL["ember"], 3.0))
    MATS["night"] = gradient_emission_material(
        "Night", [(0.0, PAL["night_light"]), (0.55, "#14224a"), (1.0, PAL["night"])], strength=0.7, span=(-0.45, 0.45))
    MATS["moon"] = toon_material("Moon", PAL["moon"], roughness=1.0, emission=(PAL["moon"], 3.5))
    MATS["star"] = toon_material("Star", "#ffffff", roughness=1.0, emission=("#fff6d8", 12.0))
    MATS["glass"] = glass_material("Glass")
    MATS["drape"] = noisy_material("Drape", PAL["red"], "#7d2a22", scale=18.0, strength=0.4, roughness=0.95)
    MATS["trim"] = toon_material("Trim", PAL["trim"], roughness=0.5)
    MATS["gold"] = toon_material("Gold", PAL["gold"], roughness=0.4)
    MATS["iron"] = toon_material("Iron", PAL["iron"], roughness=0.6)
    MATS["candle"] = toon_material("Candle", PAL["cream"], roughness=0.5, subsurface=0.3)
    MATS["lantern_glow"] = toon_material("LanternGlow", PAL["ember_light"], roughness=1.0, emission=(PAL["ember_light"], 6.0))
    MATS["cream"] = toon_material("Cream", PAL["cream"], roughness=0.9)
    MATS["quilt"] = checker_material("Quilt", PAL["red"], PAL["green"], scale=10.0)
    MATS["quilt_trim"] = toon_material("QuiltTrim", PAL["cream"], roughness=0.9)
    MATS["hammock"] = stripe_material("Hammock", PAL["cream"], PAL["red"], axis="x", scale=14.0)
    MATS["rug_rings"] = ring_material("RugRings", [PAL["red"], PAL["cream"], PAL["wood_light"]], ring_width=0.065)
    MATS["rug_green"] = checker_material("RugGreen", PAL["green"], PAL["green_dark"], scale=40.0)
    MATS["rug_green_trim"] = toon_material("RugGreenTrim", PAL["trim"], roughness=0.9)
    MATS["book"] = [toon_material(f"Book{i}", c, roughness=0.7) for i, c in enumerate(
        ["#8a3a2e", "#3f6e8a", PAL["green"], "#b58a3a", PAL["mystic"], "#6b4a2a"])]
    MATS["paper"] = toon_material("Paper", "#efe4c8", roughness=0.9)
    MATS["potion"] = toon_material("Potion", PAL["mystic"], roughness=0.2, emission=(PAL["mystic_light"], 1.2))
    MATS["cork"] = toon_material("Cork", "#b89a6a", roughness=0.9)
    MATS["canvas"] = gradient_emission_material(
        "Canvas", [(0.0, PAL["green"]), (0.42, PAL["green"]), (0.45, "#2c4a7a"), (1.0, "#0f1d44")], strength=0.6, span=(-0.125, 0.125))
    MATS["wicker"] = stripe_material("Wicker", "#9a7446", "#7a5830", axis="z", scale=60.0)
    MATS["acorn"] = toon_material("Acorn", "#7a4f2a", roughness=0.4)
    MATS["acorn_cap"] = toon_material("AcornCap", PAL["boots"], roughness=0.8)
    MATS["terracotta"] = noisy_material("Terracotta", PAL["terracotta"], "#8c4628", scale=8.0, strength=0.3, roughness=0.8)
    MATS["soil"] = toon_material("Soil", PAL["soil"], roughness=1.0)
    MATS["fern"] = noisy_material("Fern", PAL["green"], PAL["green_dark"], scale=20.0, strength=0.5, roughness=0.8)
    MATS["sage"] = toon_material("Sage", PAL["sage"], roughness=0.9)
    MATS["lavender"] = toon_material("Lavender", PAL["lavender"], roughness=0.9)
    MATS["dried"] = toon_material("Dried", PAL["dried"], roughness=0.9)
    MATS["twine"] = toon_material("Twine", "#c9b48c", roughness=0.9)
    MATS["pillow"] = toon_material("Pillow", "#f3e9d2", roughness=0.9)


# ----------------------------------------------------------------------------
# The shell: walls, floor, beams, fireplace
# ----------------------------------------------------------------------------

SHELL = []   # objects that become shadow catchers in sprite renders


def shell_obj(obj):
    SHELL.append(obj)
    return obj


def build_shell(coll):
    pl = MATS["plaster"]
    wall_y0, wall_y1 = WALL_Y, WALL_Y + 0.12
    hx0, hx1 = WIN_CX - WIN_HOLE / 2, WIN_CX + WIN_HOLE / 2
    hz0, hz1 = WIN_CZ - WIN_HOLE / 2, WIN_CZ + WIN_HOLE / 2
    # back wall in four pieces around the window hole
    shell_obj(box_bounds("wall.left", coll, -ROOM_W / 2, hx0, wall_y0, wall_y1, 0, CEIL_Z, pl))
    shell_obj(box_bounds("wall.right", coll, hx1, ROOM_W / 2, wall_y0, wall_y1, 0, CEIL_Z, pl))
    shell_obj(box_bounds("wall.below", coll, hx0, hx1, wall_y0, wall_y1, 0, hz0, pl))
    shell_obj(box_bounds("wall.above", coll, hx0, hx1, wall_y0, wall_y1, hz1, CEIL_Z, pl))
    # the plug fills the hole for the empty plate; light passes through it
    plug = no_shadow(box_bounds("wall.plug", coll, hx0, hx1, wall_y0, wall_y1, hz0, hz1, pl))
    # floor, ceiling, side walls and a wall behind the camera for light bounce
    shell_obj(box_bounds("floor", coll, -ROOM_W / 2, ROOM_W / 2, CAM_Y - 0.6, WALL_Y, -0.05, 0.0, MATS["planks"]))
    shell_obj(box_bounds("ceiling", coll, -ROOM_W / 2, ROOM_W / 2, CAM_Y - 0.6, WALL_Y, CEIL_Z, CEIL_Z + 0.05, MATS["plaster_plain"]))
    shell_obj(box_bounds("side.left", coll, -ROOM_W / 2 - 0.05, -ROOM_W / 2, CAM_Y - 0.6, WALL_Y, 0, CEIL_Z, pl))
    shell_obj(box_bounds("side.right", coll, ROOM_W / 2, ROOM_W / 2 + 0.05, CAM_Y - 0.6, WALL_Y, 0, CEIL_Z, pl))
    shell_obj(box_bounds("wall.front", coll, -ROOM_W / 2, ROOM_W / 2, CAM_Y - 0.65, CAM_Y - 0.6, 0, CEIL_Z, MATS["plaster_plain"]))
    # beams: top beam, two uprights, dado rail
    bm_ = MATS["beam"]
    shell_obj(box_bounds("beam.top", coll, -ROOM_W / 2, ROOM_W / 2, WALL_Y - 0.11, WALL_Y, TOP_BEAM_Z, CEIL_Z, bm_, outline=0.006))
    for i, ux in enumerate(UPRIGHT_X):
        shell_obj(box_bounds(f"beam.upright{i}", coll, ux - BEAM / 2, ux + BEAM / 2, WALL_Y - 0.08, WALL_Y, 0, TOP_BEAM_Z, bm_, outline=0.006))
    shell_obj(box_bounds("beam.dado", coll, -ROOM_W / 2, FIRE_X0, WALL_Y - 0.05, WALL_Y, DADO_Z - 0.035, DADO_Z + 0.035, bm_, outline=0.005))
    shell_obj(box_bounds("beam.skirting", coll, -ROOM_W / 2, FIRE_X0, WALL_Y - 0.03, WALL_Y, 0, 0.09, bm_))
    build_fireplace(coll)
    return plug


def build_fireplace(coll):
    st = MATS["stone"]
    y0 = WALL_Y - FIRE_D
    # stone body with the arched opening cut by a boolean
    body = shell_obj(box_bounds("fire.body", coll, FIRE_X0, FIRE_X1, y0, WALL_Y, 0, FIRE_H, st, outline=0.007))
    cutter_coll = _collection("cutters")
    cutter_coll.hide_render = True
    arch_z = 0.06 + OPEN_H - OPEN_W / 2
    cut_box = box_bounds("fire.cut.box", cutter_coll, FIRE_CX - OPEN_W / 2, FIRE_CX + OPEN_W / 2,
                         y0 - 0.1, WALL_Y - 0.06, 0.06, arch_z + 0.001, None)
    cut_cyl = cylinder("fire.cut.arch", cutter_coll, OPEN_W / 2, FIRE_D + 0.04,
                       (FIRE_CX, y0 + FIRE_D / 2 - 0.03, arch_z), None, rotation=(math.pi / 2, 0, 0))
    for i, cutter in enumerate((cut_box, cut_cyl)):
        mod = body.modifiers.new(f"cut{i}", "BOOLEAN")
        mod.operation = "DIFFERENCE"
        mod.object = cutter
        mod.solver = "EXACT"
    # rebuild the outline hull after the boolean so the arch is outlined too
    for child in list(body.children):
        bpy.data.objects.remove(child)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    eval_me = bpy.data.meshes.new_from_object(body.evaluated_get(depsgraph))
    tmp = bpy.data.objects.new("fire.body.eval", eval_me)
    outline_modifier(tmp, 0.007)
    hull = tmp.children[0]
    hull.parent = body
    hull.matrix_parent_inverse = Matrix.Identity(4)
    hull.location = (0, 0, 0)
    coll.objects.link(hull)
    for c in tmp.users_collection:
        c.objects.unlink(tmp)
    bpy.data.objects.remove(tmp)
    # chimney breast, mantel, hearth slab
    shell_obj(box_bounds("fire.breast", coll, FIRE_X0 + 0.1, FIRE_X1 - 0.1, WALL_Y - 0.26, WALL_Y, FIRE_H, CEIL_Z, st, outline=0.007))
    shell_obj(box_bounds("fire.mantel", coll, FIRE_X0 - 0.03, FIRE_X1 + 0.03, y0 - 0.06, WALL_Y, FIRE_H, FIRE_H + 0.08, MATS["wood_light"], outline=0.006))
    shell_obj(box_bounds("fire.hearth", coll, FIRE_X0 - 0.03, FIRE_X1 + 0.03, y0 - 0.22, y0, 0, 0.04, MATS["stone"], outline=0.005))
    # firebox back and floor (dark), logs, embers, flames
    shell_obj(box_bounds("fire.back", coll, FIRE_CX - OPEN_W / 2 - 0.02, FIRE_CX + OPEN_W / 2 + 0.02, WALL_Y - 0.08, WALL_Y - 0.05, 0.02, OPEN_H + 0.1, MATS["firebox"]))
    shell_obj(box_bounds("fire.floor", coll, FIRE_CX - OPEN_W / 2 - 0.02, FIRE_CX + OPEN_W / 2 + 0.02, y0 - 0.02, WALL_Y, 0.04, 0.06, MATS["firebox"]))
    ly = y0 + FIRE_D * 0.55
    for i, (dx, dz, rot, length) in enumerate(((-0.06, 0.10, 0.25, 0.3), (0.07, 0.10, -0.3, 0.28), (0.0, 0.17, 0.05, 0.26))):
        log = cylinder(f"fire.log{i}", coll, 0.042, length, (FIRE_CX + dx, ly, dz), MATS["bark"],
                       outline=0.004, rotation=(0, math.pi / 2, rot), segments=14)
        shell_obj(log)
    for i in range(6):
        e = sphere(f"fire.ember{i}", coll, 0.025, (FIRE_CX + RNG.uniform(-0.14, 0.14), ly + RNG.uniform(-0.08, 0.08), 0.075), MATS["ember"], scale=(1, 1, 0.6), segments=10)
        shell_obj(no_shadow(e))
    flame_profile = [(0.0, 0.0), (0.09, 0.03), (0.11, 0.12), (0.075, 0.24), (0.035, 0.34), (0.0, 0.42)]
    for i, (dx, dy, s, tilt) in enumerate(((0.0, 0.0, 0.85, 0.0), (-0.09, 0.03, 0.62, 0.35), (0.08, -0.03, 0.68, -0.3))):
        fl = lathe(f"fire.flame{i}", coll, [(r * s, z * s) for r, z in flame_profile], (FIRE_CX + dx, ly + dy, 0.12), MATS["flame"], segments=16, scale_xy=(1.0, 0.7), rotation=(0, tilt, 0))
        shell_obj(no_shadow(fl))


# ----------------------------------------------------------------------------
# Lights and camera
# ----------------------------------------------------------------------------

def add_room_lights(rug_center):
    """Fire = warm key, moon = cool fill, candles = accents, plus a soft hero
    light on the rug so the elf's spot is the brightest piece of floor."""
    coll = _collection("lights")
    lights = {}
    # fire: orange point light with soft shadows and a weak area light in the opening
    lights["fire"] = _light("fire", "POINT", (FIRE_CX, WALL_Y - FIRE_D * 0.45, 0.42), "#ff9a3c", 140.0, coll, radius=0.14)
    glow = _light("fire.glow", "AREA", (FIRE_CX, WALL_Y - FIRE_D - 0.02, 0.36), PAL["fire"], 12.0, coll, size=0.4)
    aim(glow, (FIRE_CX, WALL_Y - FIRE_D - 1.5, 0.1))
    lights["fire.glow"] = glow
    # moon: blue area light outside the window aimed into the room
    moon = _light("moon", "AREA", (WIN_CX, WALL_Y + 1.0, WIN_CZ + 1.0), "#9fc4ff", 750.0, coll, size=0.5)
    aim(moon, (WIN_CX, -0.5, 0.0))
    lights["moon"] = moon
    # the bed sits under the window where no ray through the hole can reach,
    # so a dim cool fill inside the room gives the left bay its moonlit cast
    moonfill = _light("moon.fill", "AREA", (WIN_CX, WALL_Y - 1.1, 1.5), "#9fc4ff", 18.0, coll, size=1.0)
    aim(moonfill, (-0.67, 1.26, 0.3))
    lights["moon.fill"] = moonfill
    # hero light on the rug: warm white, soft, from above-front
    hero = _light("hero", "SPOT", (rug_center[0] + 0.3, rug_center[1] - 0.9, CEIL_Z - 0.1), "#ffe2b8", 250.0, coll, radius=0.5)
    hero.data.spot_size = math.radians(60)
    hero.data.spot_blend = 0.9
    aim(hero, (rug_center[0], rug_center[1], 0.0))
    lights["hero"] = hero
    # very soft ambient: dark warm world
    world = bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.09, 0.065, 0.05, 1.0)
    bg.inputs["Strength"].default_value = 1.0
    return lights


def add_room_camera(scene):
    """Perspective camera (CAM_LENS mm) at eye height CAM_HEIGHT, CAM_Y in
    front of the wall, tilted down until the floor line (floor meets the
    back wall) sits at FLOOR_LINE_V of the frame: about 2.5 degrees. Returns
    the camera, the tilt and the world y of the floor point at RUG_V, where
    the rug is centred."""
    cam_data = bpy.data.cameras.new("Camera")
    cam_data.type = "PERSP"
    cam_data.sensor_fit = "VERTICAL"
    cam_data.sensor_height = 36.0
    cam_data.lens = CAM_LENS
    cam = bpy.data.objects.new("Camera", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam.location = (0.0, CAM_Y, CAM_HEIGHT)

    def floor_line_v(tilt):
        cam.rotation_euler = (math.radians(90.0 - tilt), 0.0, 0.0)
        bpy.context.view_layer.update()
        return world_to_camera_view(scene, cam, Vector((0.0, WALL_Y, 0.0))).y

    lo, hi = 0.0, 40.0
    for _ in range(50):
        mid = (lo + hi) / 2
        if floor_line_v(mid) > FLOOR_LINE_V:
            hi = mid     # floor line too high in frame: tilt down more
        else:
            lo = mid
    tilt = (lo + hi) / 2
    floor_line_v(tilt)

    def floor_v(y):
        return world_to_camera_view(scene, cam, Vector((0.0, y, 0.0))).y

    lo, hi = CAM_Y + 0.3, WALL_Y
    for _ in range(50):
        mid = (lo + hi) / 2
        if floor_v(mid) > RUG_V:
            hi = mid
        else:
            lo = mid
    rug_y = (lo + hi) / 2
    return cam, tilt, rug_y


# ----------------------------------------------------------------------------
# Swappable furniture, one builder per slot variant
# ----------------------------------------------------------------------------

def build_rug_braided(coll, c):
    radii = tuple(RUG_R - 0.07 * i for i in range(7))
    for i, r in enumerate(radii):
        torus(f"rug.ring{i}", coll, r, 0.036, (c[0], c[1], 0.012), MATS["rug_rings"], outline=0.004,
              scale=(1, 1, 0.42), segments=48, rings=10)
    cylinder("rug.centre", coll, 0.11, 0.026, (c[0], c[1], 0.013), MATS["rug_rings"], outline=0.004)


def build_rug_green(coll, c):
    cylinder("rug.disc", coll, RUG_R, 0.025, (c[0], c[1], 0.0125), MATS["rug_green"], outline=0.005, segments=48)
    torus("rug.border", coll, RUG_R, 0.022, (c[0], c[1], 0.014), MATS["rug_green_trim"], outline=0.004, scale=(1, 1, 0.6), segments=48, rings=8)
    for i in range(36):
        a = 2 * math.pi * i / 36
        cylinder(f"rug.tassel{i}", coll, 0.008, 0.07, (c[0] + (RUG_R + 0.05) * math.cos(a), c[1] + (RUG_R + 0.05) * math.sin(a), 0.008),
                 MATS["rug_green_trim"], rotation=(math.pi / 2, 0, a + math.pi / 2), segments=6)


def build_bed(coll):
    x0, x1, y0, y1 = -0.97, -0.37, 1.02, WALL_Y
    wd = MATS["wood_light"]
    box_bounds("bed.frame", coll, x0, x1, y0, y1, 0.14, 0.3, wd, outline=0.006)
    for i, (x, y) in enumerate(((x0 + 0.04, y0 + 0.04), (x1 - 0.04, y0 + 0.04), (x0 + 0.04, y1 - 0.04), (x1 - 0.04, y1 - 0.04))):
        box(f"bed.leg{i}", coll, (0.06, 0.06, 0.14), (x, y, 0.07), wd)
    # headboard (left end) and footboard (right end) with rounded tops
    box_bounds("bed.head", coll, x0, x0 + 0.05, y0, y1, 0.14, 0.64, wd, outline=0.006)
    box_bounds("bed.foot", coll, x1 - 0.05, x1, y0, y1, 0.14, 0.5, wd, outline=0.006)
    for i, x in enumerate((x0 + 0.025, x1 - 0.025)):
        sphere(f"bed.knob{i}a", coll, 0.045, (x, y0 + 0.03, (0.67 if i == 0 else 0.53)), MATS["wood_pale"], outline=0.004)
        sphere(f"bed.knob{i}b", coll, 0.045, (x, y1 - 0.03, (0.67 if i == 0 else 0.53)), MATS["wood_pale"], outline=0.004)
    # mattress, quilt and pillow
    box_bounds("bed.mattress", coll, x0 + 0.05, x1 - 0.05, y0 + 0.02, y1 - 0.02, 0.3, 0.4, MATS["cream"], outline=0.006)
    quilt = box_bounds("bed.quilt", coll, x0 + 0.3, x1 - 0.04, y0 - 0.02, y1 - 0.02, 0.38, 0.47, MATS["quilt"], outline=0.006)
    quilt.data.materials[0] = MATS["quilt"]
    box_bounds("bed.quilt.hem", coll, x0 + 0.3, x0 + 0.34, y0 - 0.03, y1 - 0.02, 0.37, 0.48, MATS["quilt_trim"])
    sphere("bed.pillow", coll, 0.13, (x0 + 0.2, (y0 + y1) / 2, 0.45), MATS["pillow"], outline=0.006, scale=(0.9, 1.5, 0.5))
    contact_shadow(coll, ((x0 + x1) / 2, (y0 + y1) / 2 - 0.05, 0), (x1 - x0) / 2 + 0.12, (y1 - y0) / 2 + 0.12)


def build_hammock(coll):
    a = Vector((-0.95, 1.36, 1.2))
    b = Vector((-0.37, 1.02, 1.1))
    wd = MATS["wood_light"]
    for i, p in enumerate((a, b)):
        cylinder(f"hammock.post{i}", coll, 0.035, p.z + 0.1, (p.x, p.y, (p.z + 0.1) / 2), wd, outline=0.006, segments=12)
        sphere(f"hammock.knob{i}", coll, 0.05, (p.x, p.y, p.z + 0.12), MATS["wood_pale"], outline=0.004)
        cylinder(f"hammock.foot{i}", coll, 0.16, 0.03, (p.x, p.y, 0.015), wd, outline=0.005, segments=20)
    axis = (b - a)
    side = Vector((-axis.y, axis.x, 0)).normalized()

    def cloth(u, v):
        p = a.lerp(b, u)
        width = 0.34 * math.sin(math.pi * u) ** 0.6 + 0.02
        sag = 0.46 * math.sin(math.pi * u)
        w = (v - 0.5) * width
        return (p.x + side.x * w, p.y + side.y * w, p.z - sag + 0.06 * (2 * v - 1) ** 2 * math.sin(math.pi * u))

    grid_sheet("hammock.cloth", coll, cloth, 24, 10, (0, 0, 0), MATS["hammock"], outline=0.006)
    for i, (p, u) in enumerate(((a, 0.0), (b, 1.0))):
        for k in range(5):
            v = k / 4
            end = Vector(cloth(0.08 if u == 0 else 0.92, v))
            mid = (p + end) / 2
            d = end - p
            cylinder(f"hammock.rope{i}{k}", coll, 0.006, d.length, mid, MATS["twine"], rotation=d.to_track_quat("Z", "Y").to_euler(), segments=6)
    contact_shadow(coll, ((a.x + b.x) / 2, (a.y + b.y) / 2, 0), 0.5, 0.35, strength=0.45)
    for i, p in enumerate((a, b)):
        contact_shadow(coll, (p.x, p.y, 0), 0.24, 0.2)
    sphere("hammock.pillow", coll, 0.12, (a.x * 0.75 + b.x * 0.25, a.y * 0.75 + b.y * 0.25, 0.9), MATS["pillow"], outline=0.005, scale=(1.3, 0.9, 0.5))


def window_common(coll, night_shape):
    """Drapes, rod and tie-backs shared by both window variants."""
    rod_z = WIN_CZ + WIN_H / 2 + 0.06
    cylinder("window.rod", coll, 0.015, WIN_W + 0.3, (WIN_CX, WALL_Y - 0.1, rod_z), MATS["beam"], outline=0.004, rotation=(0, math.pi / 2, 0), segments=10)
    for i, x in enumerate((WIN_CX - WIN_W / 2 - 0.15, WIN_CX + WIN_W / 2 + 0.15)):
        sphere(f"window.finial{i}", coll, 0.035, (x, WALL_Y - 0.1, rod_z), MATS["trim"], outline=0.004)
    z_top, z_tie, z_bot = rod_z - 0.01, WIN_CZ - 0.05, WIN_CZ - WIN_H / 2 - 0.2
    for i, sgn in enumerate((-1, 1)):
        x_hang = WIN_CX + sgn * (WIN_W / 2 + 0.05)
        prof = [(0.0, z_bot), (0.12, z_bot + 0.02), (0.09, z_bot + 0.22), (0.05, z_tie - 0.03), (0.05, z_tie + 0.03), (0.09, z_tie + 0.25), (0.12, z_top - 0.03), (0.0, z_top)]
        lathe(f"window.drape{i}", coll, prof, (x_hang, WALL_Y - 0.09, 0.0), MATS["drape"], outline=0.006, segments=20, scale_xy=(1.0, 0.55))
        torus(f"window.tie{i}", coll, 0.075, 0.028, (x_hang, WALL_Y - 0.09, z_tie), MATS["trim"], outline=0.004, scale=(1.0, 0.6, 1.0), segments=24, rings=8)


def build_window_square(coll):
    fr = MATS["wood_light"]
    x0, x1 = WIN_CX - WIN_W / 2, WIN_CX + WIN_W / 2
    z0, z1 = WIN_CZ - WIN_H / 2, WIN_CZ + WIN_H / 2
    t, d = 0.055, 0.07
    y0, y1 = WALL_Y - d, WALL_Y + 0.01
    box_bounds("window.frame.l", coll, x0, x0 + t, y0, y1, z0, z1, fr, outline=0.005)
    box_bounds("window.frame.r", coll, x1 - t, x1, y0, y1, z0, z1, fr, outline=0.005)
    box_bounds("window.frame.b", coll, x0, x1, y0, y1, z0, z0 + t, fr, outline=0.005)
    box_bounds("window.frame.t", coll, x0, x1, y0, y1, z1 - t, z1, fr, outline=0.005)
    box_bounds("window.mullion", coll, WIN_CX - 0.018, WIN_CX + 0.018, y0 + 0.02, y1, z0, z1, fr, outline=0.004)
    box_bounds("window.transom", coll, x0, x1, y0 + 0.02, y1, WIN_CZ - 0.018, WIN_CZ + 0.018, fr, outline=0.004)
    box_bounds("window.sill", coll, x0 - 0.06, x1 + 0.06, WALL_Y - 0.13, WALL_Y, z0 - 0.045, z0, fr, outline=0.005)
    glass = box_bounds("window.glass", coll, x0 + t, x1 - t, WALL_Y - 0.03, WALL_Y - 0.025, z0 + t, z1 - t, MATS["glass"])
    no_shadow(glass)
    night = box_bounds("window.night", coll, x0 + t * 0.5, x1 - t * 0.5, WALL_Y - 0.012, WALL_Y - 0.008, z0 + t * 0.5, z1 - t * 0.5, MATS["night"])
    night.location = (WIN_CX, WALL_Y - 0.01, WIN_CZ)
    no_shadow(night)
    build_night_sky(coll, WIN_CX, WIN_CZ, (WIN_W - 2 * t) / 2, (WIN_H - 2 * t) / 2)
    window_common(coll, "square")


def build_window_round(coll):
    fr = MATS["wood_light"]
    r_out, r_in = ROUND_R, ROUND_R - 0.065
    y_mid = WALL_Y - 0.035
    # frame ring: a lathe of a rectangular profile, then rotated to face -Y
    ring = lathe("window.ring", coll, [(r_in, -0.035), (r_out, -0.035), (r_out, 0.035), (r_in, 0.035), (r_in, -0.035)],
                 (WIN_CX, y_mid, WIN_CZ), fr, outline=0.005, segments=48, smooth=False, rotation=(math.pi / 2, 0, 0))
    box("window.cross.v", coll, (0.036, 0.05, 2 * r_in), (WIN_CX, WALL_Y - 0.03, WIN_CZ), fr, outline=0.004)
    box("window.cross.h", coll, (2 * r_in, 0.05, 0.036), (WIN_CX, WALL_Y - 0.03, WIN_CZ), fr, outline=0.004)
    glass = cylinder("window.glass", coll, r_in, 0.005, (WIN_CX, WALL_Y - 0.028, WIN_CZ), MATS["glass"], rotation=(math.pi / 2, 0, 0), segments=48)
    no_shadow(glass)
    night = cylinder("window.night", coll, r_in + 0.02, 0.004, (WIN_CX, WALL_Y - 0.01, WIN_CZ), MATS["night"], rotation=(math.pi / 2, 0, 0), segments=48)
    no_shadow(night)
    build_night_sky(coll, WIN_CX, WIN_CZ, r_in * 0.72, r_in * 0.72)
    window_common(coll, "round")


def build_night_sky(coll, cx, cz, half_w, half_h):
    """Moon disc and stars floating just in front of the night plane."""
    moon = cylinder("window.moon", coll, 0.075, 0.004, (cx - half_w * 0.45, WALL_Y - 0.017, cz + half_h * 0.5), MATS["moon"], rotation=(math.pi / 2, 0, 0), segments=32)
    no_shadow(moon)
    rng = random.Random(3)
    for i in range(9):
        sx = cx + rng.uniform(-half_w * 0.95, half_w * 0.95)
        sz = cz + rng.uniform(-half_h * 0.95, half_h * 0.95)
        if abs(sx - moon.location.x) < 0.12 and abs(sz - moon.location.z) < 0.12:
            sz -= 0.25
        s = sphere(f"window.star{i}", coll, rng.uniform(0.006, 0.011), (sx, WALL_Y - 0.017, sz), MATS["star"], segments=8)
        no_shadow(s)


def build_shelf(coll):
    x0, x1 = -0.97, -0.55
    z = 2.58
    wd = MATS["wood_light"]
    box_bounds("shelf.board", coll, x0, x1, WALL_Y - 0.2, WALL_Y, z, z + 0.035, wd, outline=0.005)
    for i, x in enumerate((x0 + 0.05, x1 - 0.05)):
        box(f"shelf.bracket{i}", coll, (0.03, 0.14, 0.1), (x, WALL_Y - 0.08, z - 0.05), wd, outline=0.004)
    # books: a leaning row, then one lying flat with the potion on it
    x = x0 + 0.03
    heights = (0.2, 0.17, 0.22, 0.16, 0.19)
    for i, h in enumerate(heights):
        w = 0.035 + 0.01 * (i % 2)
        box_bounds(f"shelf.book{i}", coll, x, x + w, WALL_Y - 0.17, WALL_Y - 0.02, z + 0.035, z + 0.035 + h, MATS["book"][i % len(MATS["book"])], outline=0.004)
        box_bounds(f"shelf.pages{i}", coll, x + 0.004, x + w - 0.004, WALL_Y - 0.165, WALL_Y - 0.025, z + 0.04, z + 0.03 + h, MATS["paper"])
        x += w + 0.004
    box_bounds("shelf.flat", coll, x + 0.02, x1 - 0.03, WALL_Y - 0.19, WALL_Y - 0.03, z + 0.035, z + 0.07, MATS["book"][5], outline=0.004)
    px = (x + 0.02 + x1 - 0.03) / 2
    lathe("shelf.potion", coll, [(0.0, 0.0), (0.04, 0.01), (0.055, 0.05), (0.045, 0.1), (0.016, 0.13), (0.016, 0.17), (0.0, 0.17)],
          (px, WALL_Y - 0.11, z + 0.07), MATS["potion"], outline=0.004, segments=20)
    cylinder("shelf.cork", coll, 0.018, 0.03, (px, WALL_Y - 0.11, z + 0.07 + 0.18), MATS["cork"], outline=0.003, segments=12)


def build_lantern(coll):
    x, y = FIRE_CX + 0.03, WALL_Y - 0.5
    top = TOP_BEAM_Z
    hook_z = top - 0.02
    links = 9
    for i in range(links):
        torus(f"lantern.chain{i}", coll, 0.018, 0.005, (x, y, hook_z - 0.03 - i * 0.034), MATS["iron"], rotation=(0, math.pi / 2 * (i % 2), 0), segments=12, rings=6)
    lz = hook_z - 0.03 - links * 0.034
    cylinder("lantern.cap", coll, 0.11, 0.07, (x, y, lz - 0.035), MATS["iron"], outline=0.004, radius2=0.025, segments=16)
    cylinder("lantern.ring", coll, 0.1, 0.02, (x, y, lz - 0.08), MATS["iron"], outline=0.004, segments=16)
    body_z0, body_z1 = lz - 0.33, lz - 0.08
    for i in range(4):
        a = math.pi / 4 + i * math.pi / 2
        box(f"lantern.bar{i}", coll, (0.016, 0.016, body_z1 - body_z0), (x + 0.085 * math.cos(a), y + 0.085 * math.sin(a), (body_z0 + body_z1) / 2), MATS["iron"], outline=0.003)
    cylinder("lantern.base", coll, 0.1, 0.03, (x, y, body_z0 - 0.015), MATS["iron"], outline=0.004, segments=16)
    glass = box("lantern.glass", coll, (0.165, 0.165, body_z1 - body_z0), (x, y, (body_z0 + body_z1) / 2), MATS["glass"])
    no_shadow(glass)
    cylinder("lantern.candle", coll, 0.03, 0.1, (x, y, body_z0 + 0.05), MATS["candle"], segments=12)
    flame = sphere("lantern.flame", coll, 0.028, (x, y, body_z0 + 0.13), MATS["lantern_glow"], scale=(1, 1, 1.5), segments=10)
    no_shadow(flame)
    light = _light("lantern.light", "POINT", (x, y, body_z0 + 0.14), PAL["ember_light"], 9.0, coll, radius=0.05)
    return light


def build_picture(coll):
    x, z = 0.08, 1.9
    w, h = 0.24, 0.3
    fr = MATS["trim"]
    t = 0.025
    box_bounds("picture.frame.l", coll, x - w / 2, x - w / 2 + t, WALL_Y - 0.03, WALL_Y, z - h / 2, z + h / 2, fr, outline=0.004)
    box_bounds("picture.frame.r", coll, x + w / 2 - t, x + w / 2, WALL_Y - 0.03, WALL_Y, z - h / 2, z + h / 2, fr, outline=0.004)
    box_bounds("picture.frame.b", coll, x - w / 2, x + w / 2, WALL_Y - 0.03, WALL_Y, z - h / 2, z - h / 2 + t, fr, outline=0.004)
    box_bounds("picture.frame.t", coll, x - w / 2, x + w / 2, WALL_Y - 0.03, WALL_Y, z + h / 2 - t, z + h / 2, fr, outline=0.004)
    canvas = box("picture.canvas", coll, (w - 2 * t, 0.01, h - 2 * t), (x, WALL_Y - 0.012, z), MATS["canvas"])
    # a tiny cottage on the painted hill
    box("picture.cottage", coll, (0.05, 0.01, 0.034), (x + 0.025, WALL_Y - 0.02, z - 0.02), MATS["cream"])
    cylinder("picture.roof", coll, 0.038, 0.012, (x + 0.025, WALL_Y - 0.022, z - 0.003), MATS["drape"], rotation=(math.pi / 2, 0, 0), radius2=0.0, segments=3)
    cylinder("picture.moon", coll, 0.017, 0.006, (x - 0.06, WALL_Y - 0.02, z + 0.08), MATS["moon"], rotation=(math.pi / 2, 0, 0), segments=16)


def build_basket(coll):
    # at the hearth's front left corner, right of the elf's spot; k scales the
    # basket down so it hides as little of the fire as possible
    cx, cy, k = FIRE_X0 + 0.02, WALL_Y - FIRE_D - 0.4, 0.8
    prof = [(r * k, z * k) for r, z in ((0.0, 0.0), (0.13, 0.0), (0.16, 0.08), (0.165, 0.16), (0.15, 0.2), (0.135, 0.2), (0.145, 0.16), (0.14, 0.1), (0.11, 0.06))]
    lathe("basket.body", coll, prof, (cx, cy, 0.0), MATS["wicker"], outline=0.005, segments=24)
    contact_shadow(coll, (cx, cy, 0), 0.26 * k, 0.22 * k)
    torus("basket.rim", coll, 0.15 * k, 0.014, (cx, cy, 0.2 * k), MATS["wood_pale"], outline=0.004, segments=32, rings=8)
    torus("basket.handle", coll, 0.15 * k, 0.012, (cx, cy, 0.2 * k), MATS["wood_pale"], outline=0.004, rotation=(math.pi / 2, 0, math.radians(20)), scale=(1, 1, 1), segments=32, rings=8)
    rng = random.Random(11)
    for i in range(11):
        a = rng.uniform(0, 2 * math.pi)
        r = rng.uniform(0, 0.1) * k
        z = (0.17 + rng.uniform(0, 0.03)) * k
        p = (cx + r * math.cos(a), cy + r * math.sin(a), z)
        sphere(f"basket.acorn{i}", coll, 0.025, p, MATS["acorn"], outline=0.003, scale=(1, 1, 1.25), segments=12)
        cylinder(f"basket.cap{i}", coll, 0.027, 0.018, (p[0], p[1], z + 0.025), MATS["acorn_cap"], radius2=0.018, segments=12)


def build_fern(coll, rug_center):
    cx, cy = -0.55, rug_center[1] - 0.6
    lathe("fern.pot", coll, [(0.0, 0.0), (0.1, 0.0), (0.12, 0.2), (0.145, 0.22), (0.145, 0.27), (0.13, 0.27), (0.11, 0.25), (0.0, 0.25)],
          (cx, cy, 0.0), MATS["terracotta"], outline=0.005, segments=24)
    contact_shadow(coll, (cx, cy, 0), 0.26, 0.22)
    cylinder("fern.soil", coll, 0.12, 0.01, (cx, cy, 0.25), MATS["soil"], segments=24)
    rng = random.Random(5)
    for i in range(15):
        a = 2 * math.pi * i / 15 + rng.uniform(-0.2, 0.2)
        length = rng.uniform(0.24, 0.34)
        lift = rng.uniform(0.18, 0.36)
        ca, sa = math.cos(a), math.sin(a)

        def frond(u, v, ca=ca, sa=sa, length=length, lift=lift):
            # an arching strip: rises then droops; width tapers towards the tip
            r = u * length
            z = 0.26 + lift * math.sin(math.pi * u * 0.85) - 0.1 * u * u
            w = (v - 0.5) * 0.05 * math.sin(math.pi * min(u * 1.1, 1.0)) ** 0.5
            serr = 0.012 * abs(math.sin(u * 40.0))
            return (cx + ca * r - sa * w, cy + sa * r + ca * w, z + (0.0 if abs(v - 0.5) < 0.2 else -0.01) + serr * (1 if v in (0.0, 1.0) else 0))

        grid_sheet(f"fern.frond{i}", coll, frond, 12, 2, (0, 0, 0), MATS["fern"], outline=0.004)


def build_candle(coll, rug_center):
    cx, cy = 0.5, rug_center[1] - 0.62
    wd = MATS["wood_light"]
    top_z = 0.3
    cylinder("candle.stool.top", coll, 0.15, 0.035, (cx, cy, top_z - 0.0175), wd, outline=0.005, segments=24)
    for i in range(3):
        a = 2 * math.pi * i / 3 + math.pi / 2
        base = Vector((cx + 0.14 * math.cos(a), cy + 0.14 * math.sin(a), 0.0))
        topp = Vector((cx + 0.09 * math.cos(a), cy + 0.09 * math.sin(a), top_z - 0.03))
        d = topp - base
        cylinder(f"candle.stool.leg{i}", coll, 0.022, d.length, (base + topp) / 2, wd, outline=0.004, rotation=d.to_track_quat("Z", "Y").to_euler(), segments=10)
    contact_shadow(coll, (cx, cy, 0), 0.26, 0.22)
    cylinder("candle.dish", coll, 0.075, 0.015, (cx, cy, top_z + 0.0075), MATS["trim"], outline=0.004, segments=24)
    lathe("candle.wax", coll, [(0.0, 0.0), (0.034, 0.0), (0.034, 0.13), (0.028, 0.145), (0.0, 0.14)], (cx, cy, top_z + 0.015), MATS["candle"], outline=0.004, segments=16)
    flame = lathe("candle.flame", coll, [(0.0, 0.0), (0.014, 0.012), (0.011, 0.035), (0.0, 0.055)], (cx, cy, top_z + 0.155), MATS["flame"], segments=12)
    no_shadow(flame)
    return _light("candle.light", "POINT", (cx, cy, top_z + 0.19), PAL["ember_light"], 5.0, coll, radius=0.03)


def build_herbs(coll):
    bundles = (
        (-0.25, "sage", 0.26),
        (-0.05, "lavender", 0.3),
        (0.15, "dried", 0.24),
    )
    y = WALL_Y - 0.2
    rng = random.Random(9)
    for i, (x, mat_name, length) in enumerate(bundles):
        string_len = 0.08 + 0.04 * (i % 2)
        cylinder(f"herbs.string{i}", coll, 0.004, string_len, (x, y, TOP_BEAM_Z - string_len / 2), MATS["twine"], segments=6)
        tie_z = TOP_BEAM_Z - string_len
        torus(f"herbs.tie{i}", coll, 0.03, 0.007, (x, y, tie_z), MATS["twine"], segments=16, rings=6)
        for k in range(10):
            a = 2 * math.pi * k / 10
            spread = 0.035 + rng.uniform(0, 0.02)
            top = Vector((x, y, tie_z))
            tip = Vector((x + spread * 2.2 * math.cos(a), y + spread * 1.4 * math.sin(a), tie_z - length - rng.uniform(-0.03, 0.03)))
            d = tip - top
            cylinder(f"herbs.stem{i}{k}", coll, 0.028, d.length, (top + tip) / 2, MATS[mat_name], outline=0.004,
                     rotation=d.to_track_quat("Z", "Y").to_euler(), radius2=0.006, segments=8)


# ----------------------------------------------------------------------------
# Scene assembly and renders
# ----------------------------------------------------------------------------

SLOTS = [
    # (slot, variant, default?)
    ("rug", "braided", True),
    ("rug", "green", False),
    ("bed", "wooden", True),
    ("bed", "hammock", False),
    ("window", "square", True),
    ("window", "round", False),
    ("shelf", "books", True),
    ("lantern", "iron", True),
    ("picture", "framed", True),
    ("basket", "acorns", True),
    ("fern", "potted", True),
    ("candle", "stool", True),
    ("herbs", "dried", True),
]


def build_everything(scene):
    build_materials()
    shell_coll = _collection("shell")
    plug = build_shell(shell_coll)
    cam, tilt, rug_y = add_room_camera(scene)
    rug_center = (0.0, rug_y, 0.0)
    add_room_lights(rug_center)
    builders = {
        ("rug", "braided"): lambda c: build_rug_braided(c, rug_center),
        ("rug", "green"): lambda c: build_rug_green(c, rug_center),
        ("bed", "wooden"): build_bed,
        ("bed", "hammock"): build_hammock,
        ("window", "square"): build_window_square,
        ("window", "round"): build_window_round,
        ("shelf", "books"): build_shelf,
        ("lantern", "iron"): build_lantern,
        ("picture", "framed"): build_picture,
        ("basket", "acorns"): build_basket,
        ("fern", "potted"): lambda c: build_fern(c, rug_center),
        ("candle", "stool"): lambda c: build_candle(c, rug_center),
        ("herbs", "dried"): build_herbs,
    }
    slot_colls = {}
    for slot, variant, _default in SLOTS:
        coll = _collection(f"slot.{slot}.{variant}")
        builders[(slot, variant)](coll)
        slot_colls[(slot, variant)] = coll
    return cam, tilt, rug_center, plug, slot_colls


def show_slots(slot_colls, visible):
    for key, coll in slot_colls.items():
        coll.hide_render = key not in visible


def set_shell_hidden_from_camera(flag):
    """In sprite renders the shell keeps bouncing light and casting shadows
    exactly as in the plate, but camera rays pass through it."""
    for obj in SHELL:
        obj.visible_camera = not flag
        for child in obj.children:
            child.hide_render = flag       # outline hulls off as well


def camera_report(scene, cam, tilt, rug_center, out_dir):
    w, h = scene.render.resolution_x, scene.render.resolution_y

    def px(point):
        v = world_to_camera_view(scene, cam, Vector(point))
        return [round(v.x * w, 1), round((1 - v.y) * h, 1)]

    fl = world_to_camera_view(scene, cam, Vector((0, WALL_Y, 0)))
    rc = world_to_camera_view(scene, cam, Vector(rug_center))
    edge = world_to_camera_view(scene, cam, Vector((RUG_R, rug_center[1], 0)))
    front = world_to_camera_view(scene, cam, Vector((0, rug_center[1] - RUG_R, 0)))
    back = world_to_camera_view(scene, cam, Vector((0, rug_center[1] + RUG_R, 0)))
    report = {
        "image": [w, h],
        "camera": {"location": list(cam.location), "tilt_down_deg": round(tilt, 3),
                   "lens_mm": CAM_LENS, "sensor_height_mm": 36.0,
                   "vertical_fov_deg": round(math.degrees(2 * math.atan(18.0 / CAM_LENS)), 2)},
        "floor_line_px": round((1 - fl.y) * h, 1),
        "rug_center_px": [round(rc.x * w, 1), round((1 - rc.y) * h, 1)],
        "rug_radius_m": RUG_R,
        "rug_ellipse_px": {"half_width": round((edge.x - rc.x) * w, 1),
                           "half_height": round(abs(front.y - back.y) * h / 2, 1)},
        "rug_center_world": list(rug_center),
        "metres_per_px_at_rug": round(RUG_R / ((edge.x - rc.x) * w), 5),
        # where the layout's key points land, to check the phone crop (x = 140..860)
        "landmarks_px": {name: px(point) for name, point in (
            ("wall_left_floor", (-ROOM_W / 2, WALL_Y, 0)),
            ("wall_right_floor", (ROOM_W / 2, WALL_Y, 0)),
            ("wall_left_ceiling", (-ROOM_W / 2, WALL_Y, CEIL_Z)),
            ("wall_right_ceiling", (ROOM_W / 2, WALL_Y, CEIL_Z)),
            ("fireplace_x0_floor", (FIRE_X0, WALL_Y - FIRE_D, 0)),
            ("fireplace_x1_floor", (FIRE_X1, WALL_Y - FIRE_D, 0)),
            ("mantel_x0", (FIRE_X0 - 0.03, WALL_Y - FIRE_D - 0.06, FIRE_H + 0.08)),
            ("mantel_x1", (FIRE_X1 + 0.03, WALL_Y - FIRE_D - 0.06, FIRE_H + 0.08)),
            ("window_centre", (WIN_CX, WALL_Y, WIN_CZ)),
            ("window_bottom_left", (WIN_CX - WIN_W / 2, WALL_Y, WIN_CZ - WIN_H / 2)),
            ("window_top_right", (WIN_CX + WIN_W / 2, WALL_Y, WIN_CZ + WIN_H / 2)),
            ("top_beam_bottom", (0, WALL_Y, TOP_BEAM_Z)),
        )},
    }
    with open(os.path.join(out_dir, "camera.json"), "w") as f:
        json.dump(report, f, indent=2)
    print("[room] camera", json.dumps(report))
    return report


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if not argv:
        print("usage: blender --background --python room.py -- OUT_DIR [options]")
        sys.exit(1)
    out_dir = os.path.abspath(argv[0])
    os.makedirs(out_dir, exist_ok=True)
    opts = {"scale": 1.0, "samples": 96, "sprite_samples": 64, "engine": "CYCLES", "only": None,
            "sheet": True, "save_blend": False}
    i = 1
    while i < len(argv):
        a = argv[i]
        if a == "--scale":
            opts["scale"] = float(argv[i + 1]); i += 1
        elif a == "--samples":
            opts["samples"] = int(argv[i + 1]); i += 1
        elif a == "--sprite-samples":
            opts["sprite_samples"] = int(argv[i + 1]); i += 1
        elif a == "--engine":
            opts["engine"] = argv[i + 1]; i += 1
        elif a == "--only":
            opts["only"] = set(argv[i + 1].split(",")); i += 1
        elif a == "--no-sheet":
            opts["sheet"] = False
        elif a == "--save-blend":
            opts["save_blend"] = True
        i += 1

    width, height = int(round(1000 * opts["scale"])), int(round(1600 * opts["scale"]))
    scene = setup_scene(width, height, engine=opts["engine"], samples=opts["samples"], transparent=False)
    cam, tilt, rug_center, plug, slot_colls = build_everything(scene)
    camera_report(scene, cam, tilt, rug_center, out_dir)
    cycles = opts["engine"] == "CYCLES"

    def wanted(name):
        return opts["only"] is None or name in opts["only"]

    defaults = {(s, v) for s, v, d in SLOTS if d}
    rendered = []
    sprite_files = []

    if opts["save_blend"]:
        show_slots(slot_colls, defaults)
        plug.hide_render = True
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, "room.blend"))

    # (a) the full plate with the default furniture
    if wanted("plate"):
        set_shell_hidden_from_camera(False)
        show_slots(slot_colls, defaults)
        plug.hide_render = True
        scene.render.film_transparent = False
        if cycles:
            scene.cycles.samples = opts["samples"]
        rendered.append(render_still(scene, os.path.join(out_dir, "plate.png")))

    # (b) the empty shell: no swappable furniture, the window hole plugged
    if wanted("plate_empty"):
        set_shell_hidden_from_camera(False)
        show_slots(slot_colls, set())
        plug.hide_render = False
        scene.render.film_transparent = False
        rendered.append(render_still(scene, os.path.join(out_dir, "plate_empty.png")))

    # (c) each slot variant alone, lit by the full room but with the shell
    # invisible to the camera; each piece carries its own contact shadow
    for slot, variant, _default in SLOTS:
        name = f"{slot}_{variant}"
        if not wanted(name):
            continue
        show_slots(slot_colls, {(slot, variant)})
        plug.hide_render = True
        scene.render.film_transparent = True
        set_shell_hidden_from_camera(True)
        if cycles:
            scene.cycles.samples = opts["sprite_samples"]
        rendered.append(render_still(scene, os.path.join(out_dir, name + ".png")))
        sprite_files.append(name + ".png")
    set_shell_hidden_from_camera(False)

    # (d) bounding boxes and the contact sheet, with the system python and Pillow
    if opts["sheet"]:
        sheet = os.path.join(HERE, "room_sheet.py")
        subprocess.run(["/usr/bin/python3", sheet, out_dir, *sprite_files], check=True)
    print("[room] done:", ", ".join(os.path.basename(p) for p in rendered))


if __name__ == "__main__":
    main()
