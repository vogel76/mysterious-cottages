"""
room.py - the Chatynkowo cottage interior, built and rendered headlessly in Blender.

Why: the Elf tab shows the pet in a cosy cottage. Instead of drawing the room with
Skia code we model it here by script (walls, beams, window, fireplace, furniture),
light it like a storybook scene and render it to 2D: one full background plate,
one empty shell plate and every swappable piece of furniture as its own
transparent sprite rendered with the same camera and lights, each by night and
by day, and so are what the days bring (the plant on the windowsill in its
stages, the small things the elf finds, the letter on the floor) and the
egg in its nest before the hatch, in pieces the app animates. The app composites the sprites over the shell plate, crossfades night
and day by its clock and places the elf sprite on the rug. The elf's own frames
are rendered inside this scene too (elf.py imports this module), so the figure
and the room share one light, one painterly shading and one ink.

Usage (no GUI, everything is rebuilt from scratch on each run):
  blender --background --python room.py -- OUT_DIR \
      [--scale 0.4] [--samples 64] [--sprite-samples 32] [--only plate,plate_empty,rug_braided,...] \
      [--night-only] [--no-sheet] [--save-blend] [--ramp 0.4] [--no-ink] [--hull]

Conventions: metres, Z up, the camera looks towards +Y at the back wall which
stands at y = 1.5. The elf faces -Y, towards the camera. The plate is
1000 x 1300, the aspect of the band a phone leaves free of its interface, and
the app shows it there with a cover fit; see the "Layout constants" section.
Output: OUT_DIR/plate.png and plate_day.png (the room with its default
furniture, for review), plate_<wall>_<floor>.png and its _day twin for every
wall and floor (the empty rooms the app draws), <slot>_<variant>.png with its
.day twin and its .thumb close-up, wall_<id>.thumb.png and floor_<id>.thumb.png,
sprites.json, contact.png and camera.json with the numbers the app needs;
room_sheet.py then packs the committed assets.
"""

import json
import math
import os
import random
import subprocess
import sys

import bmesh
import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Euler, Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import common as _common  # noqa: E402

setup_scene = _common.setup_scene
render_still = _common.render_still
render_frames = _common.render_frames

# The look, shared with the elf: the painterly ramp, the Line Art ink and
# the inverted-hull outline as the fallback. The flags override these.
LOOK = {"ramp": 0.4, "ink": True, "hull": False, "ink_radius": 0.0035}

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
    "day": "#8fc3ea",
    "day_light": "#dceefb",
    "moon": "#f6f1d8",
    "terracotta": "#b5603a",
    "sage": "#7e8f5e",
    "lavender": "#8a7aa8",
    "dried": "#a9743a",
    "iron": "#2a2724",
    "soil": "#2e2016",
}


def rgb(hex_or_tuple):
    """Hex colour (or tuple) to linear RGB tuple, as Blender expects."""
    if isinstance(hex_or_tuple, str):
        return _common.hex_to_linear(hex_or_tuple)[:3]
    return tuple(hex_or_tuple[:3])


def rgba(c, a=1.0):
    return (*rgb(c), a)


# ----------------------------------------------------------------------------
# Materials: every matte surface takes the shared painterly look
# ----------------------------------------------------------------------------

def toon_material(name, base_color, roughness=0.6, subsurface=0.0, emission=None, paint=True):
    """A matte Principled material in the room's look; emission is (colour,
    strength) or None, and a glowing thing (a flame, the moon) is not
    painted, so it keeps its even light."""
    color, strength = emission if emission else (None, 1.0)
    mat = _common.toon_material(name, rgba(base_color), roughness=roughness, subsurface=subsurface,
                                emission=rgba(color) if color else None, emission_strength=strength)
    if paint and not emission:
        _common.paint_material(mat, ramp=LOOK["ramp"])
    return mat


def painted(mat):
    """The painterly look over a material whose base colour is a texture."""
    return _common.paint_material(mat, ramp=LOOK["ramp"])


def outline_modifier(obj, thickness=0.01):
    """The inverted-hull outline, only in the hull look (the ink draws the
    lines otherwise)."""
    if LOOK["hull"]:
        _common.outline_modifier(obj, thickness)


def no_ink(obj):
    """The object draws no ink line of its own (a flame, glass, a shadow)."""
    obj.lineart.usage = "EXCLUDE"
    return obj


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


def _object_coords(nodes, world=False):
    """The texture coordinates of a pattern: the object's own, or, for a
    surface made of several pieces (the wall around the window), the
    world's, through an empty at the origin, so the pattern runs on across
    the pieces."""
    tc = nodes.new("ShaderNodeTexCoord")
    if world:
        frame = bpy.data.objects.get("WorldFrame") or bpy.data.objects.new("WorldFrame", None)
        tc.object = frame
    return tc.outputs["Object"]


def noisy_material(name, base, dark, scale=6.0, strength=0.3, roughness=0.75, detail=3.0):
    """Matte material whose base colour is broken up by soft noise."""
    mat = toon_material(name, base, roughness=roughness, paint=False)
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
    return painted(mat)


def plank_material(name, plank_width=0.16, along="x", tint=(PAL["wood"], PAL["wood_pale"]), seam_color="#2a1a0e", world=False):
    """Planks: dark seams every plank_width, a per-plank tint between the
    two colours and a stretched grain noise. Planks run along the given
    axis ('x' or 'y' on a floor, 'z' for upright boards on a wall)."""
    mat = toon_material(name, tint[1], roughness=0.7, paint=False)
    nt, nodes, links, bsdf = _nodes(mat)
    coords = _object_coords(nodes, world)
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
    tint_ramp = nodes.new("ShaderNodeValToRGB")
    tint_ramp.color_ramp.elements[0].color = rgba(tint[0])
    tint_ramp.color_ramp.elements[1].color = rgba(tint[1])
    links.new(white.outputs["Value"], tint_ramp.inputs["Fac"])
    # grain
    mapping = nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = {"x": (2.0, 40.0, 1.0), "y": (40.0, 2.0, 1.0), "z": (40.0, 1.0, 2.0)}[along]
    links.new(coords, mapping.inputs["Vector"])
    grain = nodes.new("ShaderNodeTexNoise")
    grain.inputs["Scale"].default_value = 3.0
    grain.inputs["Detail"].default_value = 4.0
    links.new(mapping.outputs[0], grain.inputs["Vector"])
    grain_mix = nodes.new("ShaderNodeMix")
    grain_mix.data_type = "RGBA"
    grain_mix.inputs["Factor"].default_value = 0.35
    links.new(tint_ramp.outputs["Color"], grain_mix.inputs[6])
    darker = nodes.new("ShaderNodeMix")
    darker.data_type = "RGBA"
    darker.inputs["Factor"].default_value = 0.5
    links.new(tint_ramp.outputs["Color"], darker.inputs[6])
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
    seam_mix.inputs[7].default_value = rgba(seam_color)
    links.new(seam_mix.outputs[2], bsdf.inputs["Base Color"])
    return painted(mat)


def band_material(name, axis, width, stops, seam_color=None, seam=0.05, wobble=0.0, roughness=0.8, world=False):
    """Bands across an object axis, each band shaded by a colour ramp from
    its one edge to the other (`stops`: (position, colour) pairs): round
    logs on a wall (dark edges, a lit middle), zigzag stripes on a kilim
    (`wobble` bends the bands into a zigzag along the other axis), with a
    seam colour at the band's start if given."""
    mat = toon_material(name, stops[0][1], roughness=roughness, paint=False)
    nt, nodes, links, bsdf = _nodes(mat)
    sep = nodes.new("ShaderNodeSeparateXYZ")
    links.new(_object_coords(nodes, world), sep.inputs[0])
    value = sep.outputs[axis.upper()]
    if wobble:
        other = sep.outputs["X" if axis.upper() != "X" else "Y"]
        zig = nodes.new("ShaderNodeMath")
        zig.operation = "PINGPONG"
        zig.inputs[1].default_value = 0.08
        links.new(other, zig.inputs[0])
        amp = nodes.new("ShaderNodeMath")
        amp.operation = "MULTIPLY"
        amp.inputs[1].default_value = wobble
        links.new(zig.outputs[0], amp.inputs[0])
        add = nodes.new("ShaderNodeMath")
        add.operation = "ADD"
        links.new(value, add.inputs[0])
        links.new(amp.outputs[0], add.inputs[1])
        value = add.outputs[0]
    div = nodes.new("ShaderNodeMath")
    div.operation = "DIVIDE"
    div.inputs[1].default_value = width
    links.new(value, div.inputs[0])
    frac = nodes.new("ShaderNodeMath")
    frac.operation = "FRACT"
    links.new(div.outputs[0], frac.inputs[0])
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = "CONSTANT" if wobble else "EASE"
    ramp.color_ramp.elements[0].position = stops[0][0]
    ramp.color_ramp.elements[0].color = rgba(stops[0][1])
    ramp.color_ramp.elements[1].position = stops[-1][0]
    ramp.color_ramp.elements[1].color = rgba(stops[-1][1])
    for pos, col in stops[1:-1]:
        ramp.color_ramp.elements.new(pos).color = rgba(col)
    links.new(frac.outputs[0], ramp.inputs["Fac"])
    out = ramp.outputs["Color"]
    if seam_color:
        less = nodes.new("ShaderNodeMath")
        less.operation = "LESS_THAN"
        less.inputs[1].default_value = seam
        links.new(frac.outputs[0], less.inputs[0])
        mix = nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        links.new(less.outputs[0], mix.inputs["Factor"])
        links.new(out, mix.inputs[6])
        mix.inputs[7].default_value = rgba(seam_color)
        out = mix.outputs[2]
    links.new(out, bsdf.inputs["Base Color"])
    return painted(mat)


def tile_material(name, size, tint, grout_color, grout=0.05, world=False):
    """Square tiles of `size` on a floor: a per-tile tint between the two
    colours and grout lines between them."""
    mat = toon_material(name, tint[1], roughness=0.8, paint=False)
    nt, nodes, links, bsdf = _nodes(mat)
    sep = nodes.new("ShaderNodeSeparateXYZ")
    links.new(_object_coords(nodes, world), sep.inputs[0])
    cells, edges = [], []
    for axis in ("X", "Y"):
        div = nodes.new("ShaderNodeMath")
        div.operation = "DIVIDE"
        div.inputs[1].default_value = size
        links.new(sep.outputs[axis], div.inputs[0])
        flo = nodes.new("ShaderNodeMath")
        flo.operation = "FLOOR"
        links.new(div.outputs[0], flo.inputs[0])
        cells.append(flo.outputs[0])
        frac = nodes.new("ShaderNodeMath")
        frac.operation = "FRACT"
        links.new(div.outputs[0], frac.inputs[0])
        less = nodes.new("ShaderNodeMath")
        less.operation = "LESS_THAN"
        less.inputs[1].default_value = grout
        links.new(frac.outputs[0], less.inputs[0])
        edges.append(less.outputs[0])
    key = nodes.new("ShaderNodeMath")
    key.operation = "MULTIPLY_ADD"
    key.inputs[1].default_value = 17.0
    links.new(cells[1], key.inputs[0])
    links.new(cells[0], key.inputs[2])
    white = nodes.new("ShaderNodeTexWhiteNoise")
    white.noise_dimensions = "1D"
    links.new(key.outputs[0], white.inputs["W"])
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = rgba(tint[0])
    ramp.color_ramp.elements[1].color = rgba(tint[1])
    links.new(white.outputs["Value"], ramp.inputs["Fac"])
    either = nodes.new("ShaderNodeMath")
    either.operation = "MAXIMUM"
    links.new(edges[0], either.inputs[0])
    links.new(edges[1], either.inputs[1])
    mix = nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    links.new(either.outputs[0], mix.inputs["Factor"])
    links.new(ramp.outputs["Color"], mix.inputs[6])
    mix.inputs[7].default_value = rgba(grout_color)
    links.new(mix.outputs[2], bsdf.inputs["Base Color"])
    return painted(mat)


def stone_material(name, scale=7.0, stretch=1.6, shades=("#5a564f", PAL["stone_light"]), mortar=PAL["mortar"], world=False):
    """Fieldstone: Voronoi cells with per-cell shade and dark mortar lines;
    `scale` cells to the metre, stretched along Z by `stretch`."""
    mat = toon_material(name, PAL["stone"], roughness=0.9, paint=False)
    nt, nodes, links, bsdf = _nodes(mat)
    coords = _object_coords(nodes, world)
    mapping = nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (1.0, 1.0, stretch)
    links.new(coords, mapping.inputs["Vector"])
    vor = nodes.new("ShaderNodeTexVoronoi")
    vor.feature = "F1"
    vor.inputs["Scale"].default_value = scale
    vor.inputs["Randomness"].default_value = 0.9
    links.new(mapping.outputs[0], vor.inputs["Vector"])
    edge = nodes.new("ShaderNodeTexVoronoi")
    edge.feature = "DISTANCE_TO_EDGE"
    edge.inputs["Scale"].default_value = scale
    edge.inputs["Randomness"].default_value = 0.9
    links.new(mapping.outputs[0], edge.inputs["Vector"])
    shade = nodes.new("ShaderNodeValToRGB")
    shade.color_ramp.elements[0].color = rgba(shades[0])
    shade.color_ramp.elements[1].color = rgba(shades[1])
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
    mix.inputs[6].default_value = rgba(mortar)
    links.new(shade.outputs["Color"], mix.inputs[7])
    links.new(mix.outputs[2], bsdf.inputs["Base Color"])
    return painted(mat)


def ring_material(name, colors, ring_width):
    """Concentric rings around the object origin (braided rug)."""
    mat = toon_material(name, colors[0], roughness=0.95, paint=False)
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
    return painted(mat)


def checker_material(name, a, b, scale=12.0, roughness=0.9):
    mat = toon_material(name, a, roughness=roughness, paint=False)
    nt, nodes, links, bsdf = _nodes(mat)
    chk = nodes.new("ShaderNodeTexChecker")
    chk.inputs["Color1"].default_value = rgba(a)
    chk.inputs["Color2"].default_value = rgba(b)
    chk.inputs["Scale"].default_value = scale
    links.new(_object_coords(nodes), chk.inputs["Vector"])
    links.new(chk.outputs["Color"], bsdf.inputs["Base Color"])
    return painted(mat)


def stripe_material(name, a, b, axis="x", scale=20.0, roughness=0.9):
    mat = toon_material(name, a, roughness=roughness, paint=False)
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
    return painted(mat)


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
    return no_ink(obj)


# ----------------------------------------------------------------------------
# Layout constants
# ----------------------------------------------------------------------------

# Framing. The app shows the plate in the band of the screen its interface
# leaves free (nothing of the interface lies over the room), with a cover
# fit: the plate is scaled to fill that band and a sliver of its sides or
# of its top and bottom is cropped, depending on the phone. The plate is
# 1000 x 1300, the aspect of that band on a 9:20 phone, so almost all of
# it is on view; everything that matters lives inside x = 60..940 and
# y = 40..1260. The room is 3 m wide and the camera frame meets the back
# wall at x = +-1.65 m (303 px per metre there), which puts the room's
# corners at x = 45 and 955 and shows a sliver of each side wall. The
# floor line (floor meets the back wall) is at 64 percent of the height
# and the rug centre at 78 percent; the app reads both from the manifest.
# With the ceiling at the top of the frame that fixes the room height at
# about 2.75 m: a cottage room, not a hall.
PLATE_W, PLATE_H = 1000, 1300
ROOM_W = 3.0            # inner width (x from -1.5 to 1.5)
WALL_Y = 1.5            # the back wall's front face
CEIL_Z = 2.75
FRAME_HALF_W = 1.65     # the camera frame meets the back wall at x = +-1.65
BEAM = 0.12
TOP_BEAM_Z = CEIL_Z - 0.22
UPRIGHT_X = (-1.44, 0.55)         # a corner post on the left, a post abutting the fireplace
DADO_Z = 0.95

WIN_CX, WIN_CZ = -0.62, 1.8       # over the bed's head, up and left of the elf, never behind it
WIN_W, WIN_H = 0.6, 0.72          # outer frame of the square window
WIN_HOLE = 0.46                   # square hole in the wall, centred on the window
ROUND_R = 0.36                    # outer radius of the round window
RUG_R = 0.6                       # radius of the rugs
FERN_X, CANDLE_X = -0.68, 0.68    # the corner pieces in front, kept inside the phone's band
# The windowsill every window has, where the plant and the things the elf
# finds stand: its top, its depth, the pot at its left end and three
# places for the newest finds beside it.
SILL_Z = WIN_CZ - WIN_H / 2
SILL_Y = WALL_Y - 0.07
SILL_POT_X = -0.8
SILL_ITEM_X = (-0.68, -0.57, -0.46)

FIRE_X0, FIRE_X1 = 0.62, 1.32     # the whole fireplace, mantel included, on the right
FIRE_D = 0.3                      # how far the stone body protrudes from the wall
FIRE_H = 1.15
FIRE_CX = (FIRE_X0 + FIRE_X1) / 2
OPEN_W, OPEN_H = 0.46, 0.56

# Camera: 35 mm on a 36 mm (vertical) sensor, eye height 1.25 m, about
# 4.2 m in front of the back wall (so that the frame's half width there is
# FRAME_HALF_W; the sensor's half width at this aspect is 18 mm times the
# plate's width over its height).
CAM_HEIGHT = 1.25
CAM_LENS = 35.0
CAM_Y = WALL_Y - FRAME_HALF_W * CAM_LENS / (18.0 * PLATE_W / PLATE_H)
FLOOR_LINE_V = 0.36     # Blender v (from the bottom): floor line at 64 percent from the top
RUG_V = 0.22            # rug centre at 78 percent from the top

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
    MATS["day"] = gradient_emission_material(
        "Day", [(0.0, PAL["day_light"]), (0.5, PAL["day"]), (1.0, "#5f9fd6")], strength=1.3, span=(-0.45, 0.45))
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
    # the variants' materials
    MATS["shutter"] = plank_material("Shutter", plank_width=0.07, along="z", tint=("#3f6b47", "#55875c"), seam_color="#22382a")
    MATS["flower_red"] = toon_material("FlowerRed", "#d9473a", roughness=0.8)
    MATS["flower_yellow"] = toon_material("FlowerYellow", "#f2c641", roughness=0.8)
    MATS["red"] = toon_material("Red", PAL["red"], roughness=0.8)
    MATS["kilim"] = band_material("Kilim", "y", 0.34, [(0.0, PAL["red"]), (0.35, PAL["cream"]), (0.5, "#2f4a6e"), (0.72, "#c68a3a"), (1.0, PAL["red"])], wobble=1.2, roughness=0.95)
    MATS["moss"] = noisy_material("Moss", "#5c8a3e", "#2f5226", scale=30.0, strength=0.6, roughness=1.0)
    MATS["straw"] = noisy_material("Straw", "#b08a4a", "#6e5228", scale=40.0, strength=0.5, roughness=0.95)
    MATS["parchment"] = noisy_material("Parchment", "#e8d3a2", "#b9965b", scale=9.0, strength=0.45, roughness=0.95)
    MATS["ink"] = toon_material("Ink", "#3a2a1a", roughness=0.9)
    MATS["antler"] = toon_material("Antler", "#e4d6b8", roughness=0.7)
    MATS["garlic"] = toon_material("Garlic", "#f4e6cc", roughness=0.8)
    MATS["feather"] = toon_material("Feather", "#e9e1d0", roughness=0.9)
    MATS["feather_dark"] = toon_material("FeatherDark", "#8c6a4a", roughness=0.9)
    MATS["paper_glow"] = toon_material("PaperGlow", "#f7d9a6", roughness=1.0, emission=("#ffcf8a", 2.2))
    MATS["iron_light"] = toon_material("IronLight", "#6a7178", roughness=0.5)
    MATS["jam"] = toon_material("Jam", "#9b2335", roughness=0.25)
    MATS["honey"] = toon_material("Honey", "#e3a53a", roughness=0.25)
    MATS["pickles"] = toon_material("Pickles", "#7e9a4a", roughness=0.3)
    MATS["pumpkin"] = toon_material("Pumpkin", "#e07b2a", roughness=0.6)
    MATS["brew"] = toon_material("Brew", "#6fbf4a", roughness=0.3, emission=("#7fdc52", 0.6))
    MATS["ball"] = checker_material("Ball", "#d9473a", "#f3e4c0", scale=4.0, roughness=0.5)
    MATS["mushroom"] = toon_material("Mushroom", "#c0392b", roughness=0.5)
    MATS["stump_rings"] = ring_material("StumpRings", ["#c9a36a", "#a8814c"], ring_width=0.018)
    MATS["flower_pink"] = toon_material("FlowerPink", "#e98aa6", roughness=0.8)
    MATS["pebble"] = noisy_material("Pebble", "#9a948a", "#6f6a62", scale=40.0, strength=0.5, roughness=0.8)
    MATS["autumn_leaf"] = toon_material("AutumnLeaf", "#d0722c", roughness=0.8)
    MATS["berry"] = toon_material("Berry", "#b3263a", roughness=0.3)
    MATS["fossil_line"] = toon_material("FossilLine", "#6a5f52", roughness=0.9)
    MATS["paper_shade"] = toon_material("PaperShade", "#e2d5b6", roughness=0.9)
    MATS["seal"] = toon_material("Seal", "#a3262a", roughness=0.4)
    MATS["egg_shell"] = toon_material("EggShell", "#f2e4c4", roughness=0.7, subsurface=0.05)
    MATS["egg_inside"] = toon_material("EggInside", "#fff6e2", roughness=0.9)
    MATS["egg_band"] = toon_material("EggBand", "#c99a45", roughness=0.5)
    MATS["egg_speck"] = toon_material("EggSpeck", "#8aa36a", roughness=0.8)
    MATS["egg_crack"] = toon_material("EggCrack", "#5a3a1e", roughness=0.9)
    MATS["egg_glow"] = toon_material("EggGlow", "#ffd88a", emission=("#ffd88a", 1.6))
    MATS["nest_floor"] = toon_material("NestFloor", "#3e2a18", roughness=1.0)
    MATS["twig_light"] = toon_material("TwigLight", "#8a6a42", roughness=0.9)
    # the walls and the floors on offer (the plates are rendered for every pair)
    MATS["wall.boards"] = plank_material("WallBoards", plank_width=0.15, along="z", tint=("#8a6440", "#b08a5c"), seam_color="#3a2716", world=True)
    MATS["wall.logs"] = band_material("WallLogs", "z", 0.22, [(0.0, "#3e2716"), (0.25, "#7a5030"), (0.55, "#a07246"), (0.85, "#6a4528"), (1.0, "#3e2716")], seam_color="#24160c", seam=0.04, world=True)
    MATS["floor.flagstones"] = stone_material("FloorFlagstones", scale=2.8, stretch=1.0, shades=("#6b6258", "#a59a88"), mortar="#3f3a33", world=True)
    MATS["floor.terracotta"] = tile_material("FloorTerracotta", 0.3, ("#a2532f", "#c77a4c"), "#6b5a48", world=True)


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
        shell_obj(no_ink(no_shadow(e)))
    flame_profile = [(0.0, 0.0), (0.09, 0.03), (0.11, 0.12), (0.075, 0.24), (0.035, 0.34), (0.0, 0.42)]
    for i, (dx, dy, s, tilt) in enumerate(((0.0, 0.0, 0.85, 0.0), (-0.09, 0.03, 0.62, 0.35), (0.08, -0.03, 0.68, -0.3))):
        fl = lathe(f"fire.flame{i}", coll, [(r * s, z * s) for r, z in flame_profile], (FIRE_CX + dx, ly + dy, 0.12), MATS["flame"], segments=16, scale_xy=(1.0, 0.7), rotation=(0, tilt, 0))
        shell_obj(no_ink(no_shadow(fl)))


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
    lights["world"] = world.node_tree.nodes["Background"]
    set_daylight(lights, False)
    return lights


# The lights by night and by day: the moon through the window becomes the
# sun, the cool fill a neutral daylight, the fire steps back, the ambient
# brightens; the window planes swap their sky and lose the moon and stars.
DAYLIGHT = {
    "moon": {"night": ("#9fc4ff", 750.0), "day": ("#fff1d6", 1500.0)},
    "moon.fill": {"night": ("#9fc4ff", 18.0), "day": ("#eef3ff", 90.0)},
    "fire": {"night": ("#ff9a3c", 200.0), "day": ("#ff9a3c", 110.0)},
    "fire.glow": {"night": (PAL["fire"], 12.0), "day": (PAL["fire"], 8.0)},
    "world": {"night": ((0.09, 0.065, 0.05), 1.0), "day": ((0.30, 0.285, 0.26), 1.0)},
}
SKY_PLANES = []   # the window planes that show the night or the day sky
NIGHT_ONLY = []   # the moon and the stars


def set_daylight(lights, day):
    when = "day" if day else "night"
    for name, spec in DAYLIGHT.items():
        color, energy = spec[when]
        if name == "world":
            lights["world"].inputs["Color"].default_value = (*color, 1.0)
            lights["world"].inputs["Strength"].default_value = energy
        else:
            lights[name].data.color = rgb(color)
            lights[name].data.energy = energy
    for plane in SKY_PLANES:
        plane.data.materials[0] = MATS["day" if day else "night"]
    for obj in NIGHT_ONLY:
        obj.hide_render = day


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


def build_bed_oak(coll):
    x0, x1, y0, y1 = -1.42, -0.7, 1.02, WALL_Y
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


def build_bed_hammock(coll):
    a = Vector((-1.38, 1.36, 1.2))
    b = Vector((-0.7, 1.02, 1.1))
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
    no_ink(no_shadow(glass))
    night = cylinder("window.night", coll, r_in + 0.02, 0.004, (WIN_CX, WALL_Y - 0.01, WIN_CZ), MATS["night"], rotation=(math.pi / 2, 0, 0), segments=48)
    SKY_PLANES.append(no_ink(no_shadow(night)))
    build_night_sky(coll, WIN_CX, WIN_CZ, r_in * 0.72, r_in * 0.72)
    window_sill(coll)
    window_common(coll, "round")


def window_sill(coll):
    """The sill under a window, the one the plant and the finds stand on."""
    box_bounds("window.sill", coll, WIN_CX - WIN_W / 2 - 0.06, WIN_CX + WIN_W / 2 + 0.06, WALL_Y - 0.13, WALL_Y,
               SILL_Z - 0.045, SILL_Z, MATS["wood_light"], outline=0.005)


def build_night_sky(coll, cx, cz, half_w, half_h):
    """Moon disc and stars floating just in front of the night plane."""
    moon = cylinder("window.moon", coll, 0.075, 0.004, (cx - half_w * 0.45, WALL_Y - 0.017, cz + half_h * 0.5), MATS["moon"], rotation=(math.pi / 2, 0, 0), segments=32)
    NIGHT_ONLY.append(no_ink(no_shadow(moon)))
    rng = random.Random(3)
    for i in range(9):
        sx = cx + rng.uniform(-half_w * 0.95, half_w * 0.95)
        sz = cz + rng.uniform(-half_h * 0.95, half_h * 0.95)
        if abs(sx - moon.location.x) < 0.12 and abs(sz - moon.location.z) < 0.12:
            sz -= 0.25
        s = sphere(f"window.star{i}", coll, rng.uniform(0.006, 0.011), (sx, WALL_Y - 0.017, sz), MATS["star"], segments=8)
        NIGHT_ONLY.append(no_ink(no_shadow(s)))


def build_shelf_books(coll):
    x0, x1, z = SHELF
    shelf_board(coll, x0, x1, z)
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


def build_lantern_iron(coll):
    x, y = FIRE_CX + 0.03, WALL_Y - 0.5
    lz = lantern_chain(coll, x, y)
    cylinder("lantern.cap", coll, 0.11, 0.07, (x, y, lz - 0.035), MATS["iron"], outline=0.004, radius2=0.025, segments=16)
    cylinder("lantern.ring", coll, 0.1, 0.02, (x, y, lz - 0.08), MATS["iron"], outline=0.004, segments=16)
    body_z0, body_z1 = lz - 0.33, lz - 0.08
    for i in range(4):
        a = math.pi / 4 + i * math.pi / 2
        box(f"lantern.bar{i}", coll, (0.016, 0.016, body_z1 - body_z0), (x + 0.085 * math.cos(a), y + 0.085 * math.sin(a), (body_z0 + body_z1) / 2), MATS["iron"], outline=0.003)
    cylinder("lantern.base", coll, 0.1, 0.03, (x, y, body_z0 - 0.015), MATS["iron"], outline=0.004, segments=16)
    glass = box("lantern.glass", coll, (0.165, 0.165, body_z1 - body_z0), (x, y, (body_z0 + body_z1) / 2), MATS["glass"])
    no_ink(no_shadow(glass))
    cylinder("lantern.candle", coll, 0.03, 0.1, (x, y, body_z0 + 0.05), MATS["candle"], segments=12)
    flame = sphere("lantern.flame", coll, 0.028, (x, y, body_z0 + 0.13), MATS["lantern_glow"], scale=(1, 1, 1.5), segments=10)
    no_ink(no_shadow(flame))
    light = _light("lantern.light", "POINT", (x, y, body_z0 + 0.14), PAL["ember_light"], 9.0, coll, radius=0.05)
    return light


def build_picture_cottage(coll):
    x, z = 0.15, 1.72
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


def build_basket_acorns(coll):
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


def build_fern_fern(coll, rug_center):
    cx, cy = FERN_X, rug_center[1] - 0.5
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


def build_candle_candle(coll, rug_center):
    cx, cy = CANDLE_X, rug_center[1] - 0.55
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
    no_ink(no_shadow(flame))
    return _light("candle.light", "POINT", (cx, cy, top_z + 0.19), PAL["ember_light"], 5.0, coll, radius=0.03)


def build_herbs_herbs(coll):
    bundles = (
        (-0.2, "sage", 0.26),
        (0.0, "lavender", 0.3),
        (0.2, "dried", 0.24),
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
# More helpers for the variants
# ----------------------------------------------------------------------------

def stick(name, coll, p0, p1, r0, r1, mat, outline=0.0, segments=10):
    """A tapered rod from p0 (radius r0) to p1 (radius r1)."""
    a, b = Vector(p0), Vector(p1)
    d = b - a
    return cylinder(name, coll, r0, d.length, (a + b) / 2, mat, outline=outline,
                    rotation=d.to_track_quat("Z", "Y").to_euler(), radius2=r1, segments=segments)


def prism_xz(name, coll, outline_pts, y0, y1, mat, outline=0.0):
    """A convex polygon in the XZ plane, extruded along Y from y0 to y1."""
    n = len(outline_pts)
    verts = [(x, y0, z) for x, z in outline_pts] + [(x, y1, z) for x, z in outline_pts]
    faces = [tuple(range(n)), tuple(range(2 * n - 1, n - 1, -1))]
    faces += [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    me = finish_mesh(name, verts, faces, smooth=False)
    return make_object(name, me, coll, (0, 0, 0), (0, 0, 0), mat, outline)


def arch_band(name, coll, cx, cz, r_in, r_out, y0, y1, mat, segments=24, outline=0.0):
    """A semicircular band (an arch) in the XZ plane, from y0 to y1."""
    verts, faces = [], []
    for i in range(segments + 1):
        a = math.pi * i / segments
        c, s = math.cos(a), math.sin(a)
        for r in (r_in, r_out):
            for y in (y0, y1):
                verts.append((cx + r * c, y, cz + r * s))
    for i in range(segments):
        b0, b1 = 4 * i, 4 * (i + 1)
        # inner, outer, front, back faces of the segment
        faces += [(b0, b1, b1 + 1, b0 + 1), (b0 + 2, b0 + 3, b1 + 3, b1 + 2),
                  (b0, b0 + 2, b1 + 2, b1), (b0 + 1, b1 + 1, b1 + 3, b0 + 3)]
    me = finish_mesh(name, verts, faces, smooth=False)
    return make_object(name, me, coll, (0, 0, 0), (0, 0, 0), mat, outline)


def arched_outline(cx, cz_bottom, half_w, spring_z, segments=20):
    """A window's arched shape in XZ: straight sides up to spring_z, a
    semicircle over them."""
    pts = [(cx - half_w, cz_bottom), (cx + half_w, cz_bottom)]
    for i in range(segments + 1):
        a = math.pi * i / segments
        pts.append((cx + half_w * math.cos(a), spring_z + half_w * math.sin(a)))
    return pts


def shelf_board(coll, x0, x1, z):
    wd = MATS["wood_light"]
    box_bounds("shelf.board", coll, x0, x1, WALL_Y - 0.2, WALL_Y, z, z + 0.035, wd, outline=0.005)
    for i, x in enumerate((x0 + 0.05, x1 - 0.05)):
        box(f"shelf.bracket{i}", coll, (0.03, 0.14, 0.1), (x, WALL_Y - 0.08, z - 0.05), wd, outline=0.004)


SHELF = (-1.42, -0.98, 2.08)


# ----------------------------------------------------------------------------
# The variants added to the defaults (the catalogue's ids, cottage/catalogue.ts)
# ----------------------------------------------------------------------------

def build_window_arched(coll):
    """A tall window with a round top, its sky arched to match."""
    fr = MATS["wood_light"]
    half = WIN_W / 2 - 0.02
    z0 = WIN_CZ - WIN_H / 2
    spring = WIN_CZ + WIN_H / 2 - half
    t, d = 0.05, 0.07
    y0, y1 = WALL_Y - d, WALL_Y + 0.01
    box_bounds("window.frame.l", coll, WIN_CX - half, WIN_CX - half + t, y0, y1, z0, spring, fr)
    box_bounds("window.frame.r", coll, WIN_CX + half - t, WIN_CX + half, y0, y1, z0, spring, fr)
    box_bounds("window.frame.b", coll, WIN_CX - half, WIN_CX + half, y0, y1, z0, z0 + t, fr)
    arch_band("window.frame.arch", coll, WIN_CX, spring, half - t, half, y0, y1, fr)
    box_bounds("window.mullion", coll, WIN_CX - 0.016, WIN_CX + 0.016, y0 + 0.02, y1, z0, spring + half - t, fr)
    box_bounds("window.transom", coll, WIN_CX - half, WIN_CX + half, y0 + 0.02, y1, spring - 0.016, spring + 0.016, fr)
    box_bounds("window.sill", coll, WIN_CX - half - 0.06, WIN_CX + half + 0.06, WALL_Y - 0.13, WALL_Y, z0 - 0.045, z0, fr)
    glass = prism_xz("window.glass", coll, arched_outline(WIN_CX, z0 + t, half - t, spring), WALL_Y - 0.03, WALL_Y - 0.025, MATS["glass"])
    no_ink(no_shadow(glass))
    night = prism_xz("window.night", coll, arched_outline(WIN_CX, z0 + t * 0.5, half - t * 0.5, spring), WALL_Y - 0.012, WALL_Y - 0.008, MATS["night"])
    SKY_PLANES.append(no_ink(no_shadow(night)))
    build_night_sky(coll, WIN_CX, (z0 + spring + half) / 2, half - t, (spring + half - z0) / 2 - t)
    window_common(coll, "arched")


def build_window_shuttered(coll):
    """The square window with its shutters swung open against the wall and
    a box of flowers on the sill, no curtains."""
    fr = MATS["wood_light"]
    x0, x1 = WIN_CX - WIN_W / 2, WIN_CX + WIN_W / 2
    z0, z1 = WIN_CZ - WIN_H / 2, WIN_CZ + WIN_H / 2
    t, d = 0.055, 0.07
    y0, y1 = WALL_Y - d, WALL_Y + 0.01
    box_bounds("window.frame.l", coll, x0, x0 + t, y0, y1, z0, z1, fr)
    box_bounds("window.frame.r", coll, x1 - t, x1, y0, y1, z0, z1, fr)
    box_bounds("window.frame.b", coll, x0, x1, y0, y1, z0, z0 + t, fr)
    box_bounds("window.frame.t", coll, x0, x1, y0, y1, z1 - t, z1, fr)
    box_bounds("window.mullion", coll, WIN_CX - 0.018, WIN_CX + 0.018, y0 + 0.02, y1, z0, z1, fr)
    box_bounds("window.transom", coll, x0, x1, y0 + 0.02, y1, WIN_CZ - 0.018, WIN_CZ + 0.018, fr)
    glass = box_bounds("window.glass", coll, x0 + t, x1 - t, WALL_Y - 0.03, WALL_Y - 0.025, z0 + t, z1 - t, MATS["glass"])
    no_ink(no_shadow(glass))
    night = box_bounds("window.night", coll, x0 + t * 0.5, x1 - t * 0.5, WALL_Y - 0.012, WALL_Y - 0.008, z0 + t * 0.5, z1 - t * 0.5, MATS["night"])
    SKY_PLANES.append(no_ink(no_shadow(night)))
    build_night_sky(coll, WIN_CX, WIN_CZ, (WIN_W - 2 * t) / 2, (WIN_H - 2 * t) / 2)
    # the shutters: boards with a Z brace, hinged at the frame, swung out
    sh = MATS["shutter"]
    w = WIN_W / 2
    for i, (sgn, hinge_x) in enumerate(((-1, x0), (1, x1))):
        angle = math.radians(18) * sgn
        pivot = Vector((hinge_x, WALL_Y - 0.03, WIN_CZ))
        shutter = box(f"window.shutter{i}", coll, (w, 0.025, WIN_H), (hinge_x + sgn * w / 2, WALL_Y - 0.03, WIN_CZ), sh)
        for k in range(3):
            zz = WIN_CZ + (k - 1) * WIN_H * 0.36
            box(f"window.shutter{i}.slat{k}", coll, (w - 0.04, 0.012, 0.035), (hinge_x + sgn * w / 2, WALL_Y - 0.047, zz), MATS["beam"])
        for obj in [o for o in coll.objects if o.name.startswith(f"window.shutter{i}")]:
            rot = Matrix.Rotation(angle, 4, "Z")
            obj.matrix_basis = Matrix.Translation(pivot) @ rot @ Matrix.Translation(-pivot) @ obj.matrix_basis
    # the flower box on the sill
    window_sill(coll)
    # a little box of flowers at the sill's right end, the left kept for
    # the plant and the finds
    px0 = SILL_ITEM_X[-1] + 0.05
    box_bounds("window.planter", coll, px0, x1 + 0.04, WALL_Y - 0.13, WALL_Y - 0.02, z0, z0 + 0.07, MATS["terracotta"])
    rng = random.Random(21)
    for k in range(4):
        fx = px0 + 0.025 + (x1 + 0.02 - px0 - 0.05) * k / 3
        stem_top = Vector((fx + rng.uniform(-0.01, 0.01), WALL_Y - 0.075, z0 + 0.13 + rng.uniform(0, 0.04)))
        stick(f"window.stem{k}", coll, (fx, WALL_Y - 0.075, z0 + 0.07), stem_top, 0.006, 0.004, MATS["fern"], segments=6)
        petal = MATS["flower_red"] if k % 3 == 0 else MATS["flower_yellow"] if k % 3 == 1 else MATS["lavender"]
        sphere(f"window.flower{k}", coll, 0.024, stem_top, petal, scale=(1, 1, 0.7), segments=10)


def build_rug_woven(coll, c):
    """An oval kilim with zigzag bands and a fringe at both ends."""
    kilim = cylinder("rug.kilim", coll, RUG_R, 0.02, (c[0], c[1], 0.01), MATS["kilim"], segments=48)
    kilim.scale = (1.15, 0.78, 1.0)
    for end in (-1, 1):
        for i in range(11):
            y = c[1] + (i - 5) * 0.055
            x = c[0] + end * RUG_R * 1.15 * math.sqrt(max(0.0, 1 - ((y - c[1]) / (RUG_R * 0.78)) ** 2))
            stick(f"rug.fringe{end}{i}", coll, (x - end * 0.01, y, 0.012), (x + end * 0.07, y, 0.005), 0.007, 0.005, MATS["cream"], segments=6)


def build_rug_moss(coll, c):
    """A soft cushion of moss with a wavy edge, a few tiny flowers and
    mushrooms in it."""
    segments = 64
    verts, faces = [(c[0], c[1], 0.03)], []
    rng = random.Random(4)
    wobble = [rng.uniform(-0.05, 0.05) for _ in range(8)]
    for i in range(segments):
        a = 2 * math.pi * i / segments
        r = RUG_R * (1.0 + sum(w * math.sin((k + 2) * a + k) for k, w in enumerate(wobble)) * 0.6)
        verts.append((c[0] + r * math.cos(a) * 1.05, c[1] + r * math.sin(a) * 0.85, 0.0))
        verts.append((c[0] + r * 0.93 * math.cos(a) * 1.05, c[1] + r * 0.93 * math.sin(a) * 0.85, 0.028))
    for i in range(segments):
        o0, i0 = 1 + 2 * i, 2 + 2 * i
        o1, i1 = 1 + 2 * ((i + 1) % segments), 2 + 2 * ((i + 1) % segments)
        faces += [(o0, o1, i1, i0), (i0, i1, 0)]
    me = finish_mesh("rug.moss", verts, faces, smooth=True)
    moss = make_object("rug.moss", me, coll, (0, 0, 0), (0, 0, 0), MATS["moss"])
    sub = moss.modifiers.new("Subdivision", "SUBSURF")
    sub.levels = sub.render_levels = 2
    for k in range(7):
        a = 2 * math.pi * k / 7 + 0.4
        r = RUG_R * 0.86
        p = (c[0] + r * math.cos(a) * 1.05, c[1] + r * math.sin(a) * 0.85, 0.03)
        if k % 3 == 0:
            cylinder(f"rug.shroom{k}.stem", coll, 0.012, 0.05, (p[0], p[1], p[2] + 0.025), MATS["cream"], segments=8)
            sphere(f"rug.shroom{k}.cap", coll, 0.03, (p[0], p[1], p[2] + 0.055), MATS["mushroom"], scale=(1, 1, 0.55), segments=12)
        else:
            sphere(f"rug.flower{k}", coll, 0.018, (p[0], p[1], p[2] + 0.012), MATS["cream"], scale=(1, 1, 0.5), segments=10)


def build_bed_nest(coll):
    """A round nest of twigs on the floor, a blanket of moss and a pillow in it."""
    cx, cy = -1.05, 1.18
    torus("bed.nest", coll, 0.36, 0.11, (cx, cy, 0.11), MATS["straw"], scale=(1, 0.8, 0.9), segments=40, rings=14)
    rng = random.Random(8)
    for i in range(26):
        a = 2 * math.pi * i / 26 + rng.uniform(-0.1, 0.1)
        r0, r1 = 0.36 + rng.uniform(-0.08, 0.04), 0.36 + rng.uniform(-0.04, 0.1)
        z0, z1 = rng.uniform(0.04, 0.2), rng.uniform(0.04, 0.2)
        a1 = a + rng.uniform(0.35, 0.6)
        stick(f"bed.twig{i}", coll, (cx + r0 * math.cos(a), cy + r0 * math.sin(a) * 0.8, z0),
              (cx + r1 * math.cos(a1), cy + r1 * math.sin(a1) * 0.8, z1), 0.009, 0.006, MATS["bark"], segments=6)
    sphere("bed.nest.moss", coll, 0.3, (cx, cy, 0.1), MATS["moss"], scale=(1, 0.78, 0.35), segments=24)
    sphere("bed.nest.pillow", coll, 0.11, (cx - 0.12, cy + 0.08, 0.2), MATS["pillow"], scale=(1.2, 0.8, 0.5), segments=16)
    contact_shadow(coll, (cx, cy, 0), 0.55, 0.45)


def build_picture_map(coll):
    """An old map of the forest in a frame: a dotted path between trees to
    a cross."""
    x, z = 0.15, 1.72
    w, h = 0.36, 0.26
    t = 0.025
    fr = MATS["trim"]
    box_bounds("picture.frame.l", coll, x - w / 2, x - w / 2 + t, WALL_Y - 0.03, WALL_Y, z - h / 2, z + h / 2, fr)
    box_bounds("picture.frame.r", coll, x + w / 2 - t, x + w / 2, WALL_Y - 0.03, WALL_Y, z - h / 2, z + h / 2, fr)
    box_bounds("picture.frame.b", coll, x - w / 2, x + w / 2, WALL_Y - 0.03, WALL_Y, z - h / 2, z - h / 2 + t, fr)
    box_bounds("picture.frame.t", coll, x - w / 2, x + w / 2, WALL_Y - 0.03, WALL_Y, z + h / 2 - t, z + h / 2, fr)
    box("picture.parchment", coll, (w - 2 * t, 0.01, h - 2 * t), (x, WALL_Y - 0.012, z), MATS["parchment"])
    yy = WALL_Y - 0.019
    pts = [(-0.12, -0.07), (-0.07, -0.02), (-0.02, -0.05), (0.03, 0.0), (0.07, 0.04), (0.11, 0.06)]
    for i, (px_, pz) in enumerate(pts):
        box(f"picture.step{i}", coll, (0.012, 0.004, 0.012), (x + px_, yy, z + pz), MATS["ink"])
    for i in (-1, 1):
        stick(f"picture.cross{i}", coll, (x + 0.115 - 0.015 * i, yy, z + 0.045), (x + 0.115 + 0.015 * i, yy, z + 0.075), 0.004, 0.004, MATS["red"], segments=6)
    for i, (tx, tz) in enumerate(((-0.1, 0.05), (-0.05, 0.07), (0.0, -0.06), (0.09, -0.04))):
        cylinder(f"picture.tree{i}", coll, 0.018, 0.04, (x + tx, yy, z + tz), MATS["fern"], rotation=(math.pi / 2, 0, 0), radius2=0.0, segments=3)


def build_picture_antlers(coll):
    """A pair of small antlers on a carved wooden shield."""
    x, z = 0.15, 1.72
    sphere("picture.shield", coll, 0.11, (x, WALL_Y - 0.02, z - 0.02), MATS["wood_light"], scale=(0.8, 0.25, 1.0), segments=20)
    bone = MATS["antler"]
    for side in (-1, 1):
        base = Vector((x + side * 0.03, WALL_Y - 0.05, z + 0.03))
        p1 = base + Vector((side * 0.07, -0.02, 0.08))
        p2 = p1 + Vector((side * 0.06, 0.0, 0.1))
        p3 = p2 + Vector((side * 0.01, 0.01, 0.08))
        stick(f"picture.beam{side}a", coll, base, p1, 0.016, 0.013, bone, segments=8)
        stick(f"picture.beam{side}b", coll, p1, p2, 0.013, 0.01, bone, segments=8)
        stick(f"picture.beam{side}c", coll, p2, p3, 0.01, 0.004, bone, segments=8)
        stick(f"picture.tine{side}a", coll, p1, p1 + Vector((-side * 0.03, -0.01, 0.07)), 0.009, 0.003, bone, segments=8)
        stick(f"picture.tine{side}b", coll, p2, p2 + Vector((side * 0.06, -0.01, 0.03)), 0.008, 0.003, bone, segments=8)


def build_herbs_garlic(coll):
    """Two braids of garlic bulbs hanging from the beam."""
    y = WALL_Y - 0.2
    for b, x in enumerate((-0.12, 0.14)):
        top = TOP_BEAM_Z
        length = 0.42 if b == 0 else 0.36
        stick(f"herbs.braid{b}", coll, (x, y, top), (x, y, top - length), 0.012, 0.008, MATS["straw"], segments=8)
        for k in range(8):
            zz = top - 0.06 - k * (length - 0.06) / 8
            side = 1 if k % 2 else -1
            p = (x + side * 0.03, y - 0.02, zz)
            lathe(f"herbs.bulb{b}{k}", coll, [(0.0, -0.04), (0.035, -0.032), (0.048, -0.005), (0.042, 0.02), (0.014, 0.045), (0.004, 0.065), (0.0, 0.066)],
                  p, MATS["garlic"], segments=14, rotation=(0, side * 0.5, 0))


def build_herbs_dreamcatcher(coll):
    """A dreamcatcher hanging from the beam: a ring with a web, beads and feathers."""
    x, y = 0.0, WALL_Y - 0.2
    cz = TOP_BEAM_Z - 0.22
    stick("herbs.string", coll, (x, y, TOP_BEAM_Z), (x, y, cz + 0.12), 0.004, 0.004, MATS["twine"], segments=6)
    torus("herbs.ring", coll, 0.12, 0.01, (x, y, cz), MATS["wood_light"], rotation=(math.pi / 2, 0, 0), segments=32, rings=8)
    for i in range(6):
        a0, a1 = 2 * math.pi * i / 6, 2 * math.pi * (i + 2) / 6
        stick(f"herbs.web{i}", coll, (x + 0.12 * math.cos(a0), y, cz + 0.12 * math.sin(a0)),
              (x + 0.12 * math.cos(a1), y, cz + 0.12 * math.sin(a1)), 0.002, 0.002, MATS["cream"], segments=4)
    sphere("herbs.bead", coll, 0.015, (x, y - 0.005, cz), MATS["potion"], segments=10)
    for i, dx in enumerate((-0.08, 0.0, 0.08)):
        top = Vector((x + dx, y, cz - 0.12 + abs(dx) * 0.5))
        stick(f"herbs.thread{i}", coll, top, top + Vector((0, 0, -0.06)), 0.002, 0.002, MATS["twine"], segments=4)
        sphere(f"herbs.feather{i}", coll, 0.06, top + Vector((0, 0, -0.12)), MATS["feather" if i != 1 else "feather_dark"], scale=(0.35, 0.1, 1.0), segments=12)


def lantern_chain(coll, x, y, links=9):
    hook_z = TOP_BEAM_Z - 0.02
    for i in range(links):
        torus(f"lantern.chain{i}", coll, 0.018, 0.005, (x, y, hook_z - 0.03 - i * 0.034), MATS["iron"], rotation=(0, math.pi / 2 * (i % 2), 0), segments=12, rings=6)
    return hook_z - 0.03 - links * 0.034


def build_lantern_paper(coll):
    """A round paper lantern, glowing warm, with ribs and red caps."""
    x, y = FIRE_CX + 0.03, WALL_Y - 0.5
    lz = lantern_chain(coll, x, y, links=6)
    cz = lz - 0.17
    sphere("lantern.paper", coll, 0.15, (x, y, cz), MATS["paper_glow"], scale=(1, 1, 1.1), segments=28)
    for k in range(5):
        zz = cz + (k - 2) * 0.05
        r = 0.15 * math.sqrt(max(0.0, 1 - ((zz - cz) / 0.165) ** 2))
        torus(f"lantern.rib{k}", coll, r, 0.004, (x, y, zz), MATS["beam"], segments=28, rings=6)
    cylinder("lantern.cap.top", coll, 0.06, 0.03, (x, y, cz + 0.165), MATS["red"], segments=16)
    cylinder("lantern.cap.bottom", coll, 0.06, 0.03, (x, y, cz - 0.165), MATS["red"], segments=16)
    stick("lantern.tassel", coll, (x, y, cz - 0.18), (x, y, cz - 0.28), 0.01, 0.003, MATS["red"], segments=8)
    return _light("lantern.light", "POINT", (x, y, cz), PAL["ember_light"], 12.0, coll, radius=0.08)


def build_lantern_bell(coll):
    """A brass bell lamp on a chain with a glowing bulb under its rim."""
    x, y = FIRE_CX + 0.03, WALL_Y - 0.5
    lz = lantern_chain(coll, x, y, links=7)
    lathe("lantern.bell", coll, [(0.0, 0.0), (0.035, -0.005), (0.06, -0.06), (0.075, -0.13), (0.11, -0.17), (0.105, -0.18), (0.0, -0.175)],
          (x, y, lz), MATS["gold"], segments=28)
    flame = sphere("lantern.flame", coll, 0.045, (x, y, lz - 0.17), MATS["lantern_glow"], segments=14)
    no_ink(no_shadow(flame))
    sphere("lantern.knob", coll, 0.02, (x, y, lz + 0.01), MATS["gold"], segments=12)
    return _light("lantern.light", "POINT", (x, y, lz - 0.2), PAL["ember_light"], 10.0, coll, radius=0.05)


def build_shelf_jars(coll):
    """The shelf with jars of preserves under cloth lids."""
    x0, x1, z = SHELF
    shelf_board(coll, x0, x1, z)
    fills = (("jam", 0.14), ("honey", 0.12), ("pickles", 0.15), ("jam", 0.1))
    x = x0 + 0.06
    for i, (fill, h) in enumerate(fills):
        r = 0.04 if h > 0.11 else 0.035
        lathe(f"shelf.jar{i}", coll, [(0.0, 0.0), (r, 0.0), (r, h * 0.9), (r * 0.75, h), (0.0, h)], (x, WALL_Y - 0.1, z + 0.035), MATS[fill], segments=20)
        cylinder(f"shelf.lid{i}", coll, r + 0.012, 0.02, (x, WALL_Y - 0.1, z + 0.035 + h + 0.008), MATS["quilt"], segments=20)
        x += 2 * r + 0.015


def build_shelf_seedlings(coll):
    """The shelf with seedlings in little pots and a watering can."""
    x0, x1, z = SHELF
    shelf_board(coll, x0, x1, z)
    rng = random.Random(13)
    for i in range(3):
        px_ = x0 + 0.07 + i * 0.1
        lathe(f"shelf.pot{i}", coll, [(0.0, 0.0), (0.03, 0.0), (0.04, 0.07), (0.045, 0.075), (0.0, 0.075)], (px_, WALL_Y - 0.1, z + 0.035), MATS["terracotta"], segments=16)
        for k in range(3):
            a = 2 * math.pi * k / 3 + rng.uniform(0, 1)
            base = Vector((px_, WALL_Y - 0.1, z + 0.105))
            tip = base + Vector((0.035 * math.cos(a), 0.035 * math.sin(a), 0.05 + 0.02 * k))
            stick(f"shelf.sprout{i}{k}", coll, base, tip, 0.004, 0.003, MATS["fern"], segments=6)
            sphere(f"shelf.leaf{i}{k}", coll, 0.018, tip, MATS["fern"], scale=(1, 0.5, 0.35), segments=10)
    cx = x1 - 0.06
    cylinder("shelf.can", coll, 0.045, 0.08, (cx, WALL_Y - 0.1, z + 0.075), MATS["iron_light"], segments=18)
    stick("shelf.spout", coll, (cx - 0.04, WALL_Y - 0.1, z + 0.06), (cx - 0.1, WALL_Y - 0.1, z + 0.12), 0.01, 0.006, MATS["iron_light"], segments=8)
    torus("shelf.handle", coll, 0.035, 0.007, (cx + 0.01, WALL_Y - 0.1, z + 0.125), MATS["iron_light"], rotation=(math.pi / 2, 0, 0), segments=20, rings=6)


def build_basket_firewood(coll):
    """A low wicker carrier with split logs stacked in it."""
    cx, cy, k = FIRE_X0 + 0.02, WALL_Y - FIRE_D - 0.4, 0.8
    prof = [(r * k, z * k) for r, z in ((0.0, 0.0), (0.15, 0.0), (0.18, 0.06), (0.185, 0.12), (0.17, 0.13), (0.16, 0.08), (0.13, 0.04))]
    lathe("basket.body", coll, prof, (cx, cy, 0.0), MATS["wicker"], segments=24, scale_xy=(1.2, 0.9))
    contact_shadow(coll, (cx, cy, 0), 0.28, 0.22)
    for i, (dx, dz, rot) in enumerate(((-0.06, 0.1, 0.1), (0.05, 0.1, -0.15), (0.0, 0.16, 0.05), (-0.08, 0.17, -0.2), (0.07, 0.17, 0.2))):
        cylinder(f"basket.log{i}", coll, 0.035, 0.3, (cx + dx, cy, dz), MATS["bark"], rotation=(0, math.pi / 2, rot), segments=12)
        for end in (-1, 1):
            d = Vector((math.cos(rot), math.sin(rot), 0)) * 0.15 * end
            cylinder(f"basket.end{i}{end}", coll, 0.033, 0.004, (cx + dx + d.x, cy + d.y, dz), MATS["log_end"], rotation=(0, math.pi / 2, rot), segments=12)


def build_basket_pumpkins(coll):
    """Three pumpkins of the harvest on the floor by the hearth."""
    cx, cy = FIRE_X0 + 0.02, WALL_Y - FIRE_D - 0.4
    for i, (dx, dy, r) in enumerate(((-0.06, 0.03, 0.11), (0.09, -0.02, 0.085), (0.0, -0.1, 0.07))):
        c = Vector((cx + dx, cy + dy, r * 0.75))
        for k in range(8):
            a = 2 * math.pi * k / 8
            sphere(f"basket.pumpkin{i}.{k}", coll, r * 0.55, c + Vector((math.cos(a), math.sin(a), 0)) * r * 0.45, MATS["pumpkin"], scale=(1, 1, 1.25), segments=14)
        stick(f"basket.stem{i}", coll, c + Vector((0, 0, r * 0.6)), c + Vector((0.02, 0, r * 0.95)), 0.014, 0.009, MATS["fern"], segments=8)
        contact_shadow(coll, (c.x, c.y, 0), r * 1.6, r * 1.3)


def build_fern_mushroom(coll, rug_center):
    """A big toadstool, red with white dots, little ones at its foot."""
    cx, cy = FERN_X, rug_center[1] - 0.5
    lathe("fern.stem", coll, [(0.0, 0.0), (0.09, 0.0), (0.07, 0.05), (0.06, 0.3), (0.07, 0.42), (0.0, 0.42)], (cx, cy, 0.0), MATS["cream"], segments=20)
    lathe("fern.cap", coll, [(0.0, 0.0), (0.26, 0.0), (0.27, 0.03), (0.22, 0.12), (0.12, 0.19), (0.0, 0.21)], (cx, cy, 0.4), MATS["mushroom"], segments=28)
    rng = random.Random(17)
    for i in range(8):
        a, el = rng.uniform(0, 2 * math.pi), rng.uniform(0.15, 0.85)
        r = 0.24 * (1 - el * 0.6)
        sphere(f"fern.dot{i}", coll, 0.03, (cx + r * math.cos(a), cy + r * math.sin(a), 0.42 + 0.17 * el), MATS["cream"], scale=(1, 1, 0.35), segments=10)
    for i, (dx, dy, s) in enumerate(((0.16, -0.08, 0.5), (-0.14, -0.1, 0.4))):
        lathe(f"fern.small{i}.stem", coll, [(0.0, 0.0), (0.03 * s, 0.0), (0.025 * s, 0.2 * s), (0.0, 0.2 * s)], (cx + dx, cy + dy, 0.0), MATS["cream"], segments=12)
        lathe(f"fern.small{i}.cap", coll, [(0.0, 0.0), (0.11 * s, 0.0), (0.09 * s, 0.05 * s), (0.0, 0.09 * s)], (cx + dx, cy + dy, 0.19 * s), MATS["mushroom"], segments=16)
    contact_shadow(coll, (cx, cy, 0), 0.3, 0.25)


def build_fern_stump(coll, rug_center):
    """A tree stump with its rings on top, moss on one side and a sprout."""
    cx, cy = FERN_X, rug_center[1] - 0.5
    lathe("fern.stump", coll, [(0.0, 0.0), (0.24, 0.0), (0.19, 0.04), (0.16, 0.1), (0.155, 0.3), (0.0, 0.3)], (cx, cy, 0.0), MATS["bark"], segments=24)
    cylinder("fern.rings", coll, 0.148, 0.01, (cx, cy, 0.302), MATS["stump_rings"], segments=28)
    sphere("fern.moss", coll, 0.12, (cx - 0.1, cy - 0.05, 0.08), MATS["moss"], scale=(1, 0.8, 0.6), segments=16)
    stick("fern.sprout", coll, (cx + 0.05, cy, 0.3), (cx + 0.07, cy - 0.02, 0.4), 0.006, 0.004, MATS["fern"], segments=6)
    for k, a in enumerate((0.6, 2.4)):
        sphere(f"fern.sproutleaf{k}", coll, 0.028, (cx + 0.07 + 0.03 * math.cos(a), cy - 0.02 + 0.03 * math.sin(a), 0.41), MATS["fern"], scale=(1, 0.5, 0.35), segments=10)
    contact_shadow(coll, (cx, cy, 0), 0.32, 0.27)


def build_candle_cauldron(coll, rug_center):
    """A black cauldron on three legs with a green brew and a ladle."""
    cx, cy = CANDLE_X, rug_center[1] - 0.55
    lathe("candle.cauldron", coll, [(0.0, 0.06), (0.1, 0.07), (0.17, 0.14), (0.18, 0.22), (0.15, 0.3), (0.16, 0.31), (0.15, 0.32), (0.13, 0.3), (0.0, 0.29)],
          (cx, cy, 0.0), MATS["iron"], segments=28)
    cylinder("candle.brew", coll, 0.135, 0.01, (cx, cy, 0.29), MATS["brew"], segments=24)
    for i in range(3):
        a = 2 * math.pi * i / 3 + 0.5
        stick(f"candle.leg{i}", coll, (cx + 0.1 * math.cos(a), cy + 0.1 * math.sin(a), 0.08), (cx + 0.13 * math.cos(a), cy + 0.13 * math.sin(a), 0.0), 0.016, 0.012, MATS["iron"], segments=8)
    for i, (dx, dy) in enumerate(((0.03, 0.02), (-0.05, -0.03))):
        sphere(f"candle.bubble{i}", coll, 0.02, (cx + dx, cy + dy, 0.3), MATS["brew"], scale=(1, 1, 0.6), segments=10)
    stick("candle.ladle", coll, (cx - 0.03, cy, 0.25), (cx + 0.12, cy + 0.06, 0.48), 0.009, 0.007, MATS["wood_light"], segments=8)
    contact_shadow(coll, (cx, cy, 0), 0.28, 0.23)


def build_candle_toychest(coll, rug_center):
    """A wooden chest with iron bands, its lid open on a ball and a toy sword."""
    cx, cy = CANDLE_X, rug_center[1] - 0.55
    w, d, h = 0.36, 0.24, 0.2
    box("candle.chest", coll, (w, d, h), (cx, cy, h / 2), MATS["wood_light"])
    for i, dx in enumerate((-w / 2 + 0.05, w / 2 - 0.05)):
        box(f"candle.band{i}", coll, (0.025, d + 0.01, h + 0.005), (cx + dx, cy, h / 2), MATS["iron"])
    lid = box("candle.lid", coll, (w, d, 0.04), (cx, cy, h + 0.02), MATS["wood_light"])
    pivot = Vector((cx, cy + d / 2, h))
    lid.matrix_basis = Matrix.Translation(pivot) @ Matrix.Rotation(math.radians(-65), 4, "X") @ Matrix.Translation(-pivot) @ lid.matrix_basis
    sphere("candle.ball", coll, 0.07, (cx - 0.06, cy - 0.02, h + 0.02), MATS["ball"], segments=18)
    stick("candle.sword", coll, (cx + 0.07, cy, h - 0.05), (cx + 0.12, cy - 0.04, h + 0.2), 0.012, 0.01, MATS["wood_pale"], segments=8)
    box("candle.hilt", coll, (0.08, 0.02, 0.015), (cx + 0.085, cy - 0.012, h + 0.03), MATS["wood_light"])
    contact_shadow(coll, (cx, cy, 0), 0.3, 0.22)


# ----------------------------------------------------------------------------
# What the days bring: the plant on the sill, the things found, a letter
# ----------------------------------------------------------------------------

PLANT_STAGES = ("stage0", "stage1", "stage2", "stage3", "stage4")


def build_plant(coll, stage):
    """The plant in its pot at the sill's left end, by its stage: a seedling,
    a sprout, a small plant, a bush, a bush in flower."""
    x, y, z = SILL_POT_X, SILL_Y, SILL_Z
    lathe("plant.pot", coll, [(0.0, 0.0), (0.032, 0.0), (0.042, 0.06), (0.048, 0.065), (0.048, 0.08), (0.0, 0.08)],
          (x, y, z), MATS["terracotta"], segments=20)
    cylinder("plant.soil", coll, 0.04, 0.006, (x, y, z + 0.075), MATS["soil"], segments=20)
    top = z + 0.078
    rng = random.Random(30 + stage)
    stems = (1, 1, 2, 4, 4)[stage]
    height = (0.025, 0.06, 0.1, 0.15, 0.16)[stage]
    leaves = (2, 4, 6, 12, 12)[stage]
    tips = []
    for i in range(stems):
        a = 2 * math.pi * i / max(1, stems) + rng.uniform(-0.3, 0.3)
        lean = 0.0 if stems == 1 else 0.025
        tip = Vector((x + lean * math.cos(a), y + lean * math.sin(a), top + height * rng.uniform(0.85, 1.0)))
        stick(f"plant.stem{i}", coll, (x, y, top), tip, 0.004, 0.003, MATS["fern"], segments=6)
        tips.append(tip)
    size = (0.014, 0.02, 0.026, 0.03, 0.03)[stage]
    for k in range(leaves):
        tip = tips[k % len(tips)]
        t = 0.35 + 0.65 * (k // len(tips)) / max(1, leaves // len(tips))
        base = Vector((x, y, top)).lerp(tip, min(1.0, t))
        a = 2 * math.pi * k / leaves + rng.uniform(-0.4, 0.4)
        p = base + Vector((math.cos(a), math.sin(a), 0.4)) * size
        sphere(f"plant.leaf{k}", coll, size, p, MATS["fern"], scale=(1.0, 0.5, 0.3), segments=10)
    if stage == 4:
        for i, tip in enumerate(tips[:3]):
            for j in range(5):
                b = 2 * math.pi * j / 5
                sphere(f"plant.petal{i}{j}", coll, 0.012, tip + Vector((math.cos(b) * 0.014, -0.01, math.sin(b) * 0.014)), MATS["flower_pink"],
                       scale=(1, 0.4, 1), segments=8)
            sphere(f"plant.heart{i}", coll, 0.008, tip + Vector((0, -0.015, 0)), MATS["flower_yellow"], segments=8)


SILL_ITEMS = ("pinecone", "feather", "pebble", "acorn", "mushroom", "leaf", "berries", "fossil")


def almond(length, width, skew=0.0, steps=10):
    """The outline of a leaf or a feather standing on its foot at the
    origin, for prism_xz: pointed at both ends, widest in the middle (or,
    with skew, nearer the top), counter-clockwise so its face looks at the
    camera."""
    def half(t):
        return 0.5 * width * math.sin(math.pi * t) ** 0.8 * (1 + skew * (t - 0.5))
    right = [(half(i / steps), length * i / steps) for i in range(steps + 1)]
    left = [(-half(i / steps), length * i / steps) for i in range(steps - 1, 0, -1)]
    return right + left


def leant(obj, rotation, base):
    """A flat piece built at the origin, turned and set down at base."""
    obj.rotation_euler = rotation
    obj.location = base
    return obj


def build_sill_item(coll, item):
    """One of the things the elf finds, on the sill's first place for finds
    (the app moves it to the others)."""
    x, y, z = SILL_ITEM_X[0], SILL_Y, SILL_Z
    if item == "pinecone":
        sphere("sill.cone", coll, 1.0, (x, y, z + 0.035), MATS["bark"], scale=(0.026, 0.026, 0.036), segments=16)
        for k in range(4):
            torus(f"sill.scale{k}", coll, 0.024 - 0.004 * abs(k - 1.5), 0.005, (x, y, z + 0.014 + k * 0.014), MATS["acorn_cap"], segments=16, rings=6)
    elif item == "feather":
        # a flat quill feather leant against the glass, its tip dark; lying
        # flat it would be a line from the camera
        turn = (math.radians(-20), math.radians(22), 0)
        base = Vector((x - 0.012, y, z + 0.004))
        leant(prism_xz("sill.vane", coll, almond(0.1, 0.024, skew=0.4), -0.0015, 0.0015, MATS["feather"]), turn, base)
        leant(prism_xz("sill.tip", coll, [(px, pz + 0.072) for px, pz in almond(0.028, 0.017)], -0.0025, -0.0015, MATS["feather_dark"]), turn, base)
        rotate = Euler(turn).to_matrix()
        stick("sill.quill", coll, base + rotate @ Vector((0, -0.002, -0.004)), base + rotate @ Vector((0, -0.002, 0.098)), 0.0022, 0.0008, MATS["feather_dark"], segments=6)
    elif item == "pebble":
        sphere("sill.pebble", coll, 1.0, (x, y, z + 0.012), MATS["pebble"], scale=(0.03, 0.024, 0.013), segments=16)
    elif item == "acorn":
        sphere("sill.acorn", coll, 0.02, (x, y, z + 0.022), MATS["acorn"], scale=(1, 1, 1.3), segments=14)
        cylinder("sill.cap", coll, 0.022, 0.014, (x, y, z + 0.044), MATS["acorn_cap"], radius2=0.015, segments=14)
        stick("sill.stalk", coll, (x, y, z + 0.05), (x + 0.004, y, z + 0.062), 0.003, 0.002, MATS["acorn_cap"], segments=6)
    elif item == "mushroom":
        cylinder("sill.stem", coll, 0.008, 0.035, (x, y, z + 0.0175), MATS["cream"], segments=10)
        sphere("sill.cap", coll, 0.024, (x, y, z + 0.036), MATS["mushroom"], scale=(1, 1, 0.55), segments=14)
        for k in range(3):
            a = 2 * math.pi * k / 3 + 0.4
            sphere(f"sill.dot{k}", coll, 0.005, (x + 0.014 * math.cos(a), y + 0.014 * math.sin(a) - 0.004, z + 0.044), MATS["cream"], segments=6)
    elif item == "leaf":
        # leant against the glass like the feather, on its stalk
        turn = (math.radians(-24), math.radians(-14), 0)
        base = Vector((x + 0.004, y, z + 0.008))
        leant(prism_xz("sill.leaf", coll, almond(0.072, 0.05), -0.0015, 0.0015, MATS["autumn_leaf"]), turn, base)
        rotate = Euler(turn).to_matrix()
        stick("sill.vein", coll, base + rotate @ Vector((0, -0.002, 0.004)), base + rotate @ Vector((0, -0.002, 0.064)), 0.0014, 0.0006, MATS["acorn_cap"], segments=4)
        stick("sill.stalk", coll, base + rotate @ Vector((0, -0.002, 0.006)), base + rotate @ Vector((0.006, -0.002, -0.01)), 0.0016, 0.0012, MATS["acorn_cap"], segments=4)
    elif item == "berries":
        for k, (dx, dy) in enumerate(((0.0, 0.0), (0.014, 0.006), (-0.012, 0.008), (0.004, -0.012))):
            sphere(f"sill.berry{k}", coll, 0.009, (x + dx, y + dy, z + 0.009), MATS["berry"], segments=10)
        sphere("sill.berryleaf", coll, 1.0, (x - 0.02, y + 0.012, z + 0.004), MATS["fern"], scale=(0.02, 0.011, 0.003), segments=10)
    elif item == "fossil":
        cylinder("sill.fossil", coll, 0.032, 0.012, (x, y, z + 0.016), MATS["pebble"], rotation=(math.pi / 2, 0, 0), segments=24)
        for k, r in enumerate((0.026, 0.018, 0.011, 0.005)):
            torus(f"sill.coil{k}", coll, r, 0.0025, (x + 0.003 * k, y - 0.007, z + 0.016), MATS["fossil_line"], rotation=(math.pi / 2, 0, 0), segments=24, rings=6)


def build_letter(coll, rug_center):
    """A letter on the floor in front of the rug, sealed in red."""
    x, y = -0.28, rug_center[1] - 0.66
    env = box("letter.envelope", coll, (0.17, 0.11, 0.006), (x, y, 0.004), MATS["paper"])
    env.rotation_euler = (0, 0, math.radians(-12))
    # the flap folded down over the front, its tip under the seal; turned
    # with the envelope about the envelope's centre
    turn = math.radians(-12)
    flap = prism_xz("letter.flap", coll, [(-0.085, 0.0), (0.0, 0.052), (0.085, 0.0)], -0.002, 0.002, MATS["paper_shade"])
    flap.rotation_euler = (math.radians(90), 0, turn)
    flap.location = (x - 0.054 * math.sin(turn), y + 0.054 * math.cos(turn), 0.008)
    cylinder("letter.seal", coll, 0.016, 0.005, (x + 0.003, y + 0.002, 0.009), MATS["seal"], segments=16)
    contact_shadow(coll, (x, y, 0), 0.12, 0.08, strength=0.4)


# ----------------------------------------------------------------------------
# The egg in its nest, on the rug where the elf will stand
# ----------------------------------------------------------------------------
#
# Stills, not frames: the app rocks the egg about its base, cracks it by
# swapping the shell for its cracked renders and hatches it by flying the
# cap off and fading the rest, so each piece is rendered once (by night and
# by day) like the furniture. The nest comes in two halves, the back drawn
# before the egg and the front after it, so the egg sits in the bowl and can
# rock inside it; the shell breaks along one zigzag (split_u) into the cap
# and the base, which the crack lines follow too.

EGG_PIECES = ("nestBack", "nestFront", "shell", "crack1", "crack2", "cap", "base", "glow")
EGG_W, EGG_H, EGG_TAPER = 0.2, 0.265, 0.12   # half-width, half-height, the narrower top
NEST_Z = 0.045                                # the floor of the bowl, on the rug
NEST_R = 0.27                                 # the rim's radius


def egg_centre(rug_center):
    return Vector((rug_center[0], rug_center[1], NEST_Z + EGG_H * 0.75))


def egg_base(rug_center):
    """Where the egg rests in the bowl: the point it rocks about."""
    c = egg_centre(rug_center)
    return Vector((c.x, c.y, c.z - EGG_H))


def egg_point(c, u, theta, lift=0.0):
    """A point of the shell at height u (-1 the bottom .. 1 the top) and
    angle theta from the front (towards the camera), positive to the right."""
    r = EGG_W * (1 - EGG_TAPER * u) * math.sqrt(max(0.0, 1 - u * u)) + lift
    return Vector((c.x + r * math.sin(theta), c.y - r * math.cos(theta), c.z + u * EGG_H))


def split_u(theta, teeth=9, depth=0.09, at=0.2):
    """The zigzag the shell breaks along, as a height u at an angle."""
    t = (theta / (2 * math.pi)) * teeth
    return at + depth * (abs((t % 1.0) * 2 - 1) * 2 - 1)


def egg_shell(name, coll, c, part=None, thickness=0.0, mat=None):
    """The shell, whole, or the cap or the base of it broken exactly along
    the zigzag (a grid in angle and height whose edge row lies on split_u),
    a broken part with a thickness and a paler inside."""
    around, rows = 180, 28
    verts, faces = [], []
    for i in range(around):
        theta = 2 * math.pi * i / around - math.pi
        cut = split_u(theta) if part else 1.0
        low, high = (cut, 1.0) if part == "cap" else (-1.0, cut)
        for j in range(rows + 1):
            verts.append(tuple(egg_point(c, low + (high - low) * j / rows, theta)))
    for i in range(around):
        for j in range(rows):
            a, b = i * (rows + 1) + j, ((i + 1) % around) * (rows + 1) + j
            faces.append((a, b, b + 1, a + 1))
    me = finish_mesh(name, verts, faces, smooth=True)
    obj = make_object(name, me, coll, mat=mat or MATS["egg_shell"])
    if thickness:
        me.materials.append(MATS["egg_inside"])
        solid = obj.modifiers.new("shell", "SOLIDIFY")
        solid.thickness = thickness
        solid.offset = -1.0
        solid.material_offset = 1
        solid.material_offset_rim = 1
    return obj


def egg_trim(coll, c, part=None):
    """The egg's band of gold and its green specks; with part ('cap' or
    'base') only the ones on that side of the break."""
    def side(u, theta):
        return "cap" if u > split_u(theta) else "base"
    if part in (None, "base"):
        torus("egg.band", coll, EGG_W * (1 + EGG_TAPER * 0.05) * 0.997, 0.011, (c.x, c.y, c.z - 0.05 * EGG_H), MATS["egg_band"],
              scale=(1, 1, 0.8), segments=64, rings=10)
    rng = random.Random(21)
    for k in range(14):
        u = rng.uniform(-0.55, 0.75)
        theta = rng.uniform(-1.4, 1.4) + (math.pi if k % 3 == 0 else 0.0)
        if abs(u + 0.05) < 0.12 or (part is not None and side(u, theta) != part):
            continue
        # a dab of paint, flat against the shell
        p = egg_point(c, u, theta, lift=-0.001)
        dot = sphere(f"egg.speck{k}", coll, 1.0, p, MATS["egg_speck" if k % 4 else "egg_band"], scale=(0.017, 0.004, 0.013), segments=12)
        dot.rotation_euler = (0, 0, theta + math.pi)


def egg_crack_line(coll, c, reach):
    """A crack along the break, across the front by reach radians each way."""
    steps = 40
    points = [egg_point(c, split_u(-reach + 2 * reach * i / steps), -reach + 2 * reach * i / steps, lift=0.003)
              for i in range(steps + 1)]
    for i in range(steps):
        stick(f"egg.crack{i}", coll, points[i], points[i + 1], 0.0035, 0.0035, MATS["egg_crack"], segments=5)


def build_nest(coll, rug_center, front):
    """One half of the nest: a ring of straw with twigs woven round it, and
    in the back half the dark bowl the egg sits in."""
    cx, cy = rug_center[0], rug_center[1]
    ring = torus("nest.ring", coll, NEST_R, 0.09, (cx, cy, NEST_Z + 0.075), MATS["straw"], scale=(1, 0.85, 0.85),
                 segments=48, rings=14)
    bm = bmesh.new()
    bm.from_mesh(ring.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if (f.calc_center_median().y < 0) != front], context="FACES")
    bm.to_mesh(ring.data)
    bm.free()
    if not front:
        sphere("nest.bowl", coll, 1.0, (cx, cy, NEST_Z + 0.01), MATS["nest_floor"], scale=(NEST_R * 0.95, NEST_R * 0.8, 0.04), segments=28)
        contact_shadow(coll, (cx, cy, 0), NEST_R + 0.14, NEST_R * 0.8 + 0.1, strength=0.55)
    # twigs woven round the outside of the ring, some ends poking out
    rng = random.Random(13)
    for i in range(56):
        a = 2 * math.pi * i / 56 + rng.uniform(-0.06, 0.06)
        a1 = a + rng.uniform(0.3, 0.7) * (1 if i % 2 else -1)
        r0, r1 = NEST_R + rng.uniform(0.03, 0.1), NEST_R + rng.uniform(0.02, 0.12)
        z0, z1 = NEST_Z + rng.uniform(0.01, 0.15), NEST_Z + rng.uniform(0.01, 0.17)
        p0 = (cx + r0 * math.cos(a), cy + r0 * math.sin(a) * 0.85, z0)
        p1 = (cx + r1 * math.cos(a1), cy + r1 * math.sin(a1) * 0.85, z1)
        if ((p0[1] + p1[1]) / 2 < cy) != front:
            continue
        stick(f"nest.twig{i}", coll, p0, p1, rng.uniform(0.008, 0.012), 0.005, MATS["bark" if i % 3 else "twig_light"], segments=6)


def build_egg_piece(coll, piece, rug_center):
    """One of EGG_PIECES."""
    c = egg_centre(rug_center)
    if piece in ("nestBack", "nestFront"):
        build_nest(coll, rug_center, front=piece == "nestFront")
    elif piece in ("shell", "crack1", "crack2"):
        egg_shell("egg.shell", coll, c)
        egg_trim(coll, c)
        if piece != "shell":
            egg_crack_line(coll, c, 0.5 if piece == "crack1" else 1.35)
    elif piece == "cap":
        egg_shell("egg.cap", coll, c, part="cap", thickness=0.008)
        egg_trim(coll, c, "cap")
    elif piece == "base":
        egg_shell("egg.base", coll, c, part="base", thickness=0.008)
        egg_trim(coll, c, "base")
    elif piece == "glow":
        # the shell lit from within, a little larger than the egg, drawn by
        # the app in screen blending at the egg's warmth; no ink
        glow = no_ink(no_shadow(egg_shell("egg.glow", coll, c, mat=MATS["egg_glow"])))
        glow.scale = (1.04, 1.04, 1.03)


# ----------------------------------------------------------------------------
# Scene assembly and renders
# ----------------------------------------------------------------------------

SLOTS = [
    # (slot, variant, default?): the ids of cottage/catalogue.ts
    ("rug", "braided", True), ("rug", "woven", False), ("rug", "moss", False),
    ("bed", "oak", True), ("bed", "hammock", False), ("bed", "nest", False),
    ("window", "arched", True), ("window", "round", False), ("window", "shuttered", False),
    ("shelf", "books", True), ("shelf", "jars", False), ("shelf", "seedlings", False),
    ("lantern", "iron", True), ("lantern", "paper", False), ("lantern", "bell", False),
    ("picture", "cottage", True), ("picture", "map", False), ("picture", "antlers", False),
    ("basket", "acorns", True), ("basket", "firewood", False), ("basket", "pumpkins", False),
    ("fern", "fern", True), ("fern", "mushroom", False), ("fern", "stump", False),
    ("candle", "candle", True), ("candle", "cauldron", False), ("candle", "toyChest", False),
    ("herbs", "herbs", True), ("herbs", "garlic", False), ("herbs", "dreamcatcher", False),
    # what the days bring: not chosen but shown as the rules say
    ("plant", "stage0", True), ("plant", "stage1", False), ("plant", "stage2", False), ("plant", "stage3", False),
    ("plant", "stage4", False),
    ("sill", "pinecone", True), ("sill", "feather", False), ("sill", "pebble", False), ("sill", "acorn", False),
    ("sill", "mushroom", False), ("sill", "leaf", False), ("sill", "berries", False), ("sill", "fossil", False),
    ("letter", "envelope", True),
    # the egg before the hatch, in its pieces
    *(("egg", piece, piece == "nestBack") for piece in EGG_PIECES),
]

# The walls and the floors on offer, the first of each the default: they
# are not pieces but the room's own surfaces, so the plate is rendered for
# every pair (plate_<wall>_<floor>.png) and the app draws the pair the
# decor names.
# The pieces the days bring rather than the player: in the manifest like
# the furniture, but not in the review plate with the defaults.
EXTRA_SLOTS = ("plant", "sill", "letter", "egg")
# The pieces with no catalogue picture: nobody chooses them.
NO_THUMB_SLOTS = ("egg",)

WALL_IDS = ("plaster", "boards", "logs")
FLOOR_IDS = ("planks", "flagstones", "terracotta")
WALL_OBJECTS = []
FLOOR_OBJECTS = []


def set_surfaces(wall, floor):
    """Dress the room's walls and floor in a variant's material."""
    wall_mat = MATS["plaster"] if wall == "plaster" else MATS[f"wall.{wall}"]
    floor_mat = MATS["planks"] if floor == "planks" else MATS[f"floor.{floor}"]
    for obj in WALL_OBJECTS:
        obj.data.materials[0] = wall_mat
    for obj in FLOOR_OBJECTS:
        obj.data.materials[0] = floor_mat


def build_everything(scene, quality=True):
    """The whole room in the scene: materials, shell, camera, lights, every
    slot variant in its own collection, the ink. Returns the camera, its
    tilt, the rug centre, the window plug, the slot collections and the
    lights (for set_daylight)."""
    build_materials()
    shell_coll = _collection("shell")
    plug = build_shell(shell_coll)
    WALL_OBJECTS[:] = [bpy.data.objects[name] for name in ("wall.left", "wall.right", "wall.below", "wall.above", "wall.plug", "side.left", "side.right")]
    FLOOR_OBJECTS[:] = [bpy.data.objects["floor"]]
    cam, tilt, rug_y = add_room_camera(scene)
    rug_center = (0.0, rug_y, 0.0)
    lights = add_room_lights(rug_center)
    if LOOK["ink"]:
        _common.add_line_art(scene, radius=LOOK["ink_radius"])
    if quality:
        _common.enable_quality(scene)
    builders = {
        ("rug", "braided"): lambda c: build_rug_braided(c, rug_center),
        ("rug", "woven"): lambda c: build_rug_woven(c, rug_center),
        ("rug", "moss"): lambda c: build_rug_moss(c, rug_center),
        ("fern", "fern"): lambda c: build_fern_fern(c, rug_center),
        ("fern", "mushroom"): lambda c: build_fern_mushroom(c, rug_center),
        ("fern", "stump"): lambda c: build_fern_stump(c, rug_center),
        ("candle", "candle"): lambda c: build_candle_candle(c, rug_center),
        ("candle", "cauldron"): lambda c: build_candle_cauldron(c, rug_center),
        ("candle", "toyChest"): lambda c: build_candle_toychest(c, rug_center),
        ("letter", "envelope"): lambda c: build_letter(c, rug_center),
    }
    for index, stage in enumerate(PLANT_STAGES):
        builders[("plant", stage)] = lambda c, index=index: build_plant(c, index)
    for item in SILL_ITEMS:
        builders[("sill", item)] = lambda c, item=item: build_sill_item(c, item)
    for piece in EGG_PIECES:
        builders[("egg", piece)] = lambda c, piece=piece: build_egg_piece(c, piece, rug_center)
    for slot, variant, _default in SLOTS:
        if (slot, variant) not in builders:
            builders[(slot, variant)] = globals()[f"build_{slot}_{variant.lower()}"]
    slot_colls = {}
    for slot, variant, _default in SLOTS:
        coll = _collection(f"slot.{slot}.{variant}")
        builders[(slot, variant)](coll)
        slot_colls[(slot, variant)] = coll
    return cam, tilt, rug_center, plug, slot_colls, lights


def show_slots(slot_colls, visible):
    for key, coll in slot_colls.items():
        coll.hide_render = key not in visible


def set_shell_hidden_from_camera(flag):
    """In sprite renders the shell keeps bouncing light and casting shadows
    exactly as in the plate, but camera rays pass through it and the ink
    leaves it out altogether (an occlusion-only shell still drew the room's
    corners and the floor line across every sprite; the furniture stands
    in front of the shell, so nothing needs hiding behind it)."""
    for obj in SHELL:
        obj.visible_camera = not flag
        obj.lineart.usage = "EXCLUDE" if flag else "INHERIT"


def camera_report(scene, cam, tilt, rug_center, out_dir):
    w, h = scene.render.resolution_x, scene.render.resolution_y

    def px(point):
        v = world_to_camera_view(scene, cam, Vector(point))
        return [round(v.x * w, 1), round((1 - v.y) * h, 1)]

    def box_px(lo, hi):
        """The screen box of a world box: its eight corners projected."""
        corners = [px((x, y, z)) for x in (lo[0], hi[0]) for y in (lo[1], hi[1]) for z in (lo[2], hi[2])]
        x0, y0 = min(c[0] for c in corners), min(c[1] for c in corners)
        x1, y1 = max(c[0] for c in corners), max(c[1] for c in corners)
        return {"x": round(x0), "y": round(y0), "width": round(x1 - x0), "height": round(y1 - y0)}

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
        # the fireplace baked into the plate: its box from the hearth slab to
        # the mantel (the app's tap target) and the fire's centre (its glow)
        "fireplace_px": box_px((FIRE_X0 - 0.03, WALL_Y - FIRE_D - 0.22, 0.0), (FIRE_X1 + 0.03, WALL_Y, FIRE_H + 0.08)),
        "hearth_px": px((FIRE_CX, WALL_Y - FIRE_D, 0.3)),
        # the room's surfaces, the app's tap targets for the wall and the floor
        "wall_px": box_px((-ROOM_W / 2, WALL_Y, 0.0), (ROOM_W / 2, WALL_Y, CEIL_Z)),
        # the sill's places for the finds, as offsets in plate pixels from the
        # first, where every find is rendered
        "egg_base_px": px(tuple(egg_base(rug_center))),
        "sill_offsets_px": [round(px((sx, SILL_Y, SILL_Z))[0] - px((SILL_ITEM_X[0], SILL_Y, SILL_Z))[0], 1) for sx in SILL_ITEM_X],
        "floor_px": {"x": 0, "y": round((1 - fl.y) * h), "width": w, "height": h - round((1 - fl.y) * h)},
        # the catalogue as rendered: the pieces in slot order with their
        # defaults, and the walls and floors, the default first
        "variants": [[slot, variant, default] for slot, variant, default in SLOTS],
        "walls": list(WALL_IDS),
        "floors": list(FLOOR_IDS),
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


# The catalogue's pictures: every piece once more, by day and close up (the
# render cropped to the piece and scaled so its longer side comes out at
# about THUMB_PX pixels), and a patch of every wall and floor.
THUMB_PX = 360


def collection_box_px(scene, cam, coll):
    """The screen box, in the plate's pixels, of a collection's meshes."""
    deps = bpy.context.evaluated_depsgraph_get()
    w, h = scene.render.resolution_x, scene.render.resolution_y
    xs, ys = [], []
    for obj in coll.all_objects:
        if obj.type != "MESH":
            continue
        evaluated = obj.evaluated_get(deps)
        for corner in evaluated.bound_box:
            v = world_to_camera_view(scene, cam, evaluated.matrix_world @ Vector(corner))
            xs.append(v.x * w)
            ys.append((1 - v.y) * h)
    return min(xs), min(ys), max(xs), max(ys)


def patch_box_px(scene, cam, centre, half, plane):
    """The screen box of a square patch of a wall ('xz') or the floor ('xy')."""
    w, h = scene.render.resolution_x, scene.render.resolution_y
    cx, cy, cz = centre
    corners = [(cx + dx, cy, cz + dz) for dx in (-half, half) for dz in (-half, half)] if plane == "xz" else \
        [(cx + dx, cy + dy, cz) for dx in (-half, half) for dy in (-half, half)]
    views = [world_to_camera_view(scene, cam, Vector(c)) for c in corners]
    xs, ys = [v.x * w for v in views], [(1 - v.y) * h for v in views]
    return min(xs), min(ys), max(xs), max(ys)


def render_thumb(scene, box, path, transparent):
    """Render the camera's view cropped to a box (plate pixels), scaled so
    the box's longer side is about THUMB_PX."""
    w, h = scene.render.resolution_x, scene.render.resolution_y
    x0, y0, x1, y1 = box
    pad = 0.06 * max(x1 - x0, y1 - y0)
    x0, y0, x1, y1 = max(0, x0 - pad), max(0, y0 - pad), min(w, x1 + pad), min(h, y1 + pad)
    k = max(0.35, min(4.0, THUMB_PX / max(1.0, x1 - x0, y1 - y0)))
    render = scene.render
    render.resolution_percentage = int(round(100 * k))
    render.use_border = True
    render.use_crop_to_border = True
    render.border_min_x, render.border_max_x = x0 / w, x1 / w
    render.border_min_y, render.border_max_y = 1 - y1 / h, 1 - y0 / h
    render.film_transparent = transparent
    try:
        return render_still(scene, path)
    finally:
        render.use_border = False
        render.resolution_percentage = 100



def read_flags(argv):
    """The look flags into LOOK (shared with elf.py's)."""
    if "--ramp" in argv:
        LOOK["ramp"] = float(argv[argv.index("--ramp") + 1])
    if "--no-ink" in argv:
        LOOK["ink"] = False
    if "--hull" in argv:
        LOOK["hull"] = True


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if not argv:
        print("usage: blender --background --python room.py -- OUT_DIR [options]")
        sys.exit(1)
    out_dir = os.path.abspath(argv[0])
    os.makedirs(out_dir, exist_ok=True)
    opts = {"scale": 1.0, "samples": 64, "sprite_samples": 32, "only": None, "sheet": True,
            "save_blend": False, "times": ("night", "day")}
    i = 1
    while i < len(argv):
        a = argv[i]
        if a == "--scale":
            opts["scale"] = float(argv[i + 1]); i += 1
        elif a == "--samples":
            opts["samples"] = int(argv[i + 1]); i += 1
        elif a == "--sprite-samples":
            opts["sprite_samples"] = int(argv[i + 1]); i += 1
        elif a == "--only":
            opts["only"] = set(argv[i + 1].split(",")); i += 1
        elif a == "--night-only":
            opts["times"] = ("night",)
        elif a == "--no-sheet":
            opts["sheet"] = False
        elif a == "--save-blend":
            opts["save_blend"] = True
        i += 1
    read_flags(argv)

    width, height = int(round(PLATE_W * opts["scale"])), int(round(PLATE_H * opts["scale"]))
    scene = setup_scene(width, height, samples=opts["samples"], transparent=False)
    cam, tilt, rug_center, plug, slot_colls, lights = build_everything(scene)
    camera_report(scene, cam, tilt, rug_center, out_dir)

    def wanted(name):
        return opts["only"] is None or name in opts["only"]

    def suffix(time):
        return "" if time == "night" else "_day"

    defaults = {(s, v) for s, v, d in SLOTS if d and s not in EXTRA_SLOTS}
    rendered = []
    sprite_files = []

    if opts["save_blend"]:
        show_slots(slot_colls, defaults)
        plug.hide_render = True
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, "room.blend"))

    for time in opts["times"]:
        set_daylight(lights, time == "day")
        set_surfaces(WALL_IDS[0], FLOOR_IDS[0])
        # (a) the full plate with the default furniture, for review
        if wanted("plate"):
            set_shell_hidden_from_camera(False)
            show_slots(slot_colls, defaults)
            plug.hide_render = True
            scene.render.film_transparent = False
            scene.eevee.taa_render_samples = opts["samples"]
            rendered.append(render_still(scene, os.path.join(out_dir, f"plate{suffix(time)}.png")))

        # (b) the empty room for every pair of wall and floor: no furniture,
        # the window hole plugged
        if wanted("plate_empty"):
            set_shell_hidden_from_camera(False)
            show_slots(slot_colls, set())
            plug.hide_render = False
            scene.render.film_transparent = False
            scene.eevee.taa_render_samples = opts["samples"]
            for wall in WALL_IDS:
                for floor in FLOOR_IDS:
                    set_surfaces(wall, floor)
                    rendered.append(render_still(scene, os.path.join(out_dir, f"plate_{wall}_{floor}{suffix(time)}.png")))
            set_surfaces(WALL_IDS[0], FLOOR_IDS[0])

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
            scene.eevee.taa_render_samples = opts["sprite_samples"]
            file = f"{name}{'.day' if time == 'day' else ''}.png"
            rendered.append(render_still(scene, os.path.join(out_dir, file)))
            if time == "night":
                sprite_files.append(file)
        set_shell_hidden_from_camera(False)

    # (c') the catalogue's pictures, by day: every piece close up, and a
    # patch of every wall and floor in the empty room
    if wanted("thumbs"):
        set_daylight(lights, True)
        scene.eevee.taa_render_samples = opts["sprite_samples"]
        set_shell_hidden_from_camera(True)
        plug.hide_render = True
        for slot, variant, _default in SLOTS:
            if slot in NO_THUMB_SLOTS:
                continue
            show_slots(slot_colls, {(slot, variant)})
            box = collection_box_px(scene, cam, slot_colls[(slot, variant)])
            rendered.append(render_thumb(scene, box, os.path.join(out_dir, f"{slot}_{variant}.thumb.png"), True))
        set_shell_hidden_from_camera(False)
        show_slots(slot_colls, set())
        plug.hide_render = False
        wall_patch = patch_box_px(scene, cam, (0.05, WALL_Y, 1.3), 0.32, "xz")
        floor_patch = patch_box_px(scene, cam, (0.0, rug_center[1] - 0.3, 0.0), 0.45, "xy")
        for wall in WALL_IDS:
            set_surfaces(wall, FLOOR_IDS[0])
            rendered.append(render_thumb(scene, wall_patch, os.path.join(out_dir, f"wall_{wall}.thumb.png"), False))
        for floor in FLOOR_IDS:
            set_surfaces(WALL_IDS[0], floor)
            rendered.append(render_thumb(scene, floor_patch, os.path.join(out_dir, f"floor_{floor}.thumb.png"), False))
        set_surfaces(WALL_IDS[0], FLOOR_IDS[0])

    # (d) bounding boxes and the contact sheet, with the system python and Pillow
    if opts["sheet"]:
        sheet = os.path.join(HERE, "room_sheet.py")
        subprocess.run(["/usr/bin/python3", sheet, out_dir, *sprite_files], check=True)
    print("[room] done:", ", ".join(os.path.basename(p) for p in rendered))


if __name__ == "__main__":
    main()
