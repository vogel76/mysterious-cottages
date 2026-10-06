"""
Elf character for the Chatynkowo "Elf" tab, built entirely by script in Blender.

Why: the app shows a Pou-style virtual pet rendered to 2D sprite frames. This
script rebuilds the chibi forest elf from primitives (no saved .blend needed),
gives it toon materials with an inverted-hull outline, a small armature with
automatic weights, shape keys for squash/stretch and the face, a set of short
24 fps animation clips stored as actions, and renders review material plus the
sprite frame sequences with an orthographic front camera.

Run:
    /snap/bin/blender --background --python elf.py -- <out_dir> [--stages still,turntable,moods,hats,anims,allanims,hero] [--clips wave,feed] [--quick]

Conventions: the character faces -Y, Z is up, feet at z = 0, the camera sits
on -Y and looks at +Y tilted down. Bone names use Blender's .L/.R suffixes
with .L on +X (the character's own left).

The render helpers at the top mirror the contract of common.py (the shared
pipeline module); once that module exists, swap them for a single import.
"""

import math
import os
import subprocess
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
FPS = 24

# ---------------------------------------------------------------------------
# Palette (binding art direction)
# ---------------------------------------------------------------------------

PALETTE = {
    "skin": "#f1d2b0",
    "cheek": "#e8a090",
    "eye": "#2b2118",
    "tunic": "#4e8a54",
    "tunic_dark": "#3c6b42",
    "trim": "#c79a4b",
    "boot": "#3a2616",
    "sole": "#2a1a10",
    "hair": "#6b3a1e",
    "acorn": "#8a5a2b",
    "acorn_dark": "#5a3b22",
    "mushroom": "#c0392b",
    "cream": "#f3e4c0",
    "ear_inner": "#e9a69a",
    "sick_skin": "#b9c98f",
    "white": "#ffffff",
}


def hex_to_rgb(value):
    """Convert '#rrggbb' (sRGB) to linear RGB floats as Blender expects."""
    value = value.lstrip("#")
    srgb = [int(value[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
    return tuple((c / 12.92) if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb)


# ---------------------------------------------------------------------------
# Pipeline helpers (same API as common.py)
# ---------------------------------------------------------------------------

def setup_scene(width, height, engine="BLENDER_EEVEE", samples=32, transparent=True):
    """Reset to an empty scene with sprite-friendly render and colour settings."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = engine
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.fps = FPS
    scene.render.film_transparent = transparent
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 50
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0
    scene.display_settings.display_device = "sRGB"
    scene.eevee.taa_render_samples = samples
    scene.eevee.use_shadows = True
    scene.eevee.shadow_ray_count = 2
    scene.eevee.shadow_step_count = 4
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.cycles.device = "CPU"
    world = bpy.data.worlds.new("World")
    world.use_nodes = True
    background = world.node_tree.nodes["Background"]
    background.inputs["Color"].default_value = (0.32, 0.36, 0.45, 1.0)
    background.inputs["Strength"].default_value = 0.18
    scene.world = world
    return scene


def add_light_rig(target=(0, 0, 0.8), key_strength=300.0, fill_strength=120.0, top_strength=70.0):
    """Warm key upper right (fireplace side), cool fill left (moonlight), soft top."""
    target = Vector(target)
    specs = {
        "Key": ((2.6, -2.6, 3.4), "#ffb66b", key_strength, 1.8),
        "Fill": ((-3.4, -2.2, 1.6), "#9fc4ff", fill_strength, 3.0),
        "Top": ((0.3, -0.8, 5.0), "#fff4e6", top_strength, 3.5),
    }
    lights = {}
    for name, (position, color, energy, size) in specs.items():
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.color = hex_to_rgb(color)
        data.size = size
        data.shape = "DISK"
        data.use_shadow = True
        data.shadow_soft_size = size * 0.6
        obj = bpy.data.objects.new(name, data)
        obj.location = position
        direction = target - Vector(position)
        obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        bpy.context.scene.collection.objects.link(obj)
        lights[name] = obj
    lights["Fill"].data.use_shadow = False
    return lights


def add_ortho_camera(center, ortho_scale, distance=10.0, tilt_deg=8.0, aspect=None):
    """Orthographic camera on -Y looking towards +Y, tilted down by tilt_deg."""
    data = bpy.data.cameras.new("Camera")
    data.type = "ORTHO"
    data.ortho_scale = ortho_scale
    data.clip_start = 0.1
    data.clip_end = distance * 3
    cam = bpy.data.objects.new("Camera", data)
    tilt = math.radians(tilt_deg)
    cam.location = (center[0], center[1] - distance * math.cos(tilt), center[2] + distance * math.sin(tilt))
    cam.rotation_euler = (math.pi / 2 - tilt, 0.0, 0.0)
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    return cam


def render_still(scene, path):
    """Render the current frame to one PNG."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return path


def render_frames(scene, out_dir, name, frame_start, frame_end):
    """Render frame_start..frame_end (inclusive) to out_dir/name_####.png."""
    paths = []
    for frame in range(frame_start, frame_end + 1):
        scene.frame_set(frame)
        paths.append(render_still(scene, os.path.join(out_dir, f"{name}_{frame:04d}.png")))
    return paths


def toon_material(name, base_color, roughness=0.6, subsurface=0.0, emission=None, emission_strength=1.0):
    """Soft matte Principled material; emission is an optional '#rrggbb' glow colour."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    rgb = hex_to_rgb(base_color) if isinstance(base_color, str) else base_color
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Specular IOR Level"].default_value = 0.18
    if subsurface > 0:
        bsdf.inputs["Subsurface Weight"].default_value = subsurface
        bsdf.inputs["Subsurface Radius"].default_value = (1.0, 0.4, 0.25)
        bsdf.inputs["Subsurface Scale"].default_value = 0.08
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*hex_to_rgb(emission), 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    mat.diffuse_color = (*rgb, 1.0)
    return mat


def outline_material():
    """Pure black emission for the inverted hull; back faces are made transparent in
    the node tree so the hull works in Cycles too (backface culling is Eevee only)."""
    if "Outline" in bpy.data.materials:
        return bpy.data.materials["Outline"]
    mat = bpy.data.materials.new("Outline")
    mat.use_nodes = True
    tree = mat.node_tree
    for node in list(tree.nodes):
        tree.nodes.remove(node)
    emission = tree.nodes.new("ShaderNodeEmission")
    emission.inputs["Color"].default_value = (0.0, 0.0, 0.0, 1.0)
    emission.inputs["Strength"].default_value = 1.0
    transparent = tree.nodes.new("ShaderNodeBsdfTransparent")
    geometry = tree.nodes.new("ShaderNodeNewGeometry")
    light_path = tree.nodes.new("ShaderNodeLightPath")
    mix = tree.nodes.new("ShaderNodeMixShader")
    output = tree.nodes.new("ShaderNodeOutputMaterial")
    # Black only for camera rays hitting a front face; shadow and bounce rays pass through,
    # otherwise the hull would shade the whole figure from inside in Cycles.
    front = tree.nodes.new("ShaderNodeMath")
    front.operation = "SUBTRACT"
    front.inputs[0].default_value = 1.0
    tree.links.new(geometry.outputs["Backfacing"], front.inputs[1])
    camera_front = tree.nodes.new("ShaderNodeMath")
    camera_front.operation = "MULTIPLY"
    tree.links.new(light_path.outputs["Is Camera Ray"], camera_front.inputs[0])
    tree.links.new(front.outputs["Value"], camera_front.inputs[1])
    fac = tree.nodes.new("ShaderNodeMath")
    fac.operation = "SUBTRACT"
    fac.inputs[0].default_value = 1.0
    tree.links.new(camera_front.outputs["Value"], fac.inputs[1])
    tree.links.new(fac.outputs["Value"], mix.inputs["Fac"])
    tree.links.new(emission.outputs["Emission"], mix.inputs[1])
    tree.links.new(transparent.outputs["BSDF"], mix.inputs[2])
    tree.links.new(mix.outputs["Shader"], output.inputs["Surface"])
    mat.use_backface_culling = True
    mat.use_backface_culling_shadow = True
    mat.diffuse_color = (0, 0, 0, 1)
    return mat


def outline_modifier(obj, thickness=0.01):
    """Inverted-hull outline: a flipped Solidify shell with the black material."""
    obj.data.materials.append(outline_material())
    mod = obj.modifiers.new("Outline", "SOLIDIFY")
    mod.thickness = thickness
    mod.offset = 1.0
    mod.use_flip_normals = True
    mod.use_rim = False
    mod.material_offset = len(obj.data.materials) - 1
    mod.use_quality_normals = True
    return mod


# When the shared pipeline module is present, its scene, light rig, camera,
# materials and render calls replace the local copies above so the elf and the
# room share one look. The outline material stays local: the shared one relies
# on backface culling, which Cycles ignores, and the hero still uses Cycles.
try:
    sys.path.insert(0, HERE)
    import common as _common
    setup_scene = _common.setup_scene
    add_light_rig = _common.add_light_rig
    add_ortho_camera = _common.add_ortho_camera
    toon_material = _common.toon_material
    render_still = _common.render_still
    render_frames = _common.render_frames
    USING_COMMON = True
except ImportError:
    USING_COMMON = False


# ---------------------------------------------------------------------------
# Mesh building blocks
# ---------------------------------------------------------------------------

COLLECTIONS = {}


def collection(path):
    """Get or create a nested collection by 'Parent/Child' path."""
    if path in COLLECTIONS:
        return COLLECTIONS[path]
    parts = path.split("/")
    parent = bpy.context.scene.collection if len(parts) == 1 else collection("/".join(parts[:-1]))
    coll = bpy.data.collections.new(parts[-1])
    parent.children.link(coll)
    COLLECTIONS[path] = coll
    return coll


def finish_mesh(name, bm, coll, material, smooth=True, subsurf=1, outline=0.0):
    """Turn a bmesh into an object in a collection with material and modifiers."""
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    if smooth:
        mesh.shade_smooth()
    obj = bpy.data.objects.new(name, mesh)
    collection(coll).objects.link(obj)
    if material is not None:
        mesh.materials.append(material)
    if subsurf:
        mod = obj.modifiers.new("Subdivision", "SUBSURF")
        mod.levels = subsurf
        mod.render_levels = subsurf
    if outline:
        outline_modifier(obj, outline)
    return obj


def transform_bmesh(bm, center=(0, 0, 0), scale=(1, 1, 1), rotation=None):
    """Scale about the origin, rotate, then translate every vertex."""
    rot = rotation if rotation is not None else Matrix.Identity(3)
    for v in bm.verts:
        p = Vector((v.co.x * scale[0], v.co.y * scale[1], v.co.z * scale[2]))
        v.co = rot @ p + Vector(center)


def sphere(name, center, radius, coll, material, scale=(1, 1, 1), segments=32, rings=16,
           subsurf=1, outline=0.0, keep=None, rotation=None):
    """UV sphere; 'keep' is a predicate on the local (unscaled) offset to cut caps."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings, radius=radius)
    if keep is not None:
        doomed = [f for f in bm.faces if not keep(f.calc_center_median())]
        bmesh.ops.delete(bm, geom=doomed, context="FACES")
    transform_bmesh(bm, center, scale, rotation)
    return finish_mesh(name, bm, coll, material, subsurf=subsurf, outline=outline)


def catmull_rom(points, samples):
    """Sample a Catmull-Rom spline through the control points (endpoints included)."""
    pts = [Vector(p) for p in points]
    pts = [pts[0] + (pts[0] - pts[1])] + pts + [pts[-1] + (pts[-1] - pts[-2])]
    out = []
    spans = len(pts) - 3
    for i in range(samples + 1):
        t = i / samples * spans
        span = min(int(t), spans - 1)
        u = t - span
        p0, p1, p2, p3 = pts[span:span + 4]
        out.append(0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u
                          + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u))
    return out


def tube(name, points, radii, coll, material, segments=16, samples=12, flatten=(1.0, 1.0),
         ref=(0, 1, 0), subsurf=1, outline=0.0, cap_start=True, cap_end=True):
    """A capsule-like tube along a spline with a radius profile and oval section."""
    path = catmull_rom(points, samples)
    prof = [Vector((0, 0, 0)) for _ in path]
    # Interpolate the radius profile along the sampled path.
    rs = []
    for i in range(len(path)):
        t = i / (len(path) - 1) * (len(radii) - 1)
        k = min(int(t), len(radii) - 2)
        rs.append(radii[k] + (radii[k + 1] - radii[k]) * (t - k))
    bm = bmesh.new()
    rings = []
    ref = Vector(ref)
    for i, p in enumerate(path):
        tangent = (path[min(i + 1, len(path) - 1)] - path[max(i - 1, 0)]).normalized()
        e2 = tangent.cross(ref)
        if e2.length < 1e-4:
            e2 = tangent.cross(Vector((1, 0, 0)))
        e2.normalize()
        e1 = e2.cross(tangent).normalized()
        ring = []
        for s in range(segments):
            a = 2 * math.pi * s / segments
            ring.append(bm.verts.new(p + rs[i] * (math.cos(a) * e1 * flatten[0] + math.sin(a) * e2 * flatten[1])))
        rings.append(ring)
    for a, b in zip(rings, rings[1:]):
        for s in range(segments):
            bm.faces.new((a[s], a[(s + 1) % segments], b[(s + 1) % segments], b[s]))
    if cap_start:
        bm.faces.new(list(reversed(rings[0])))
    if cap_end:
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish_mesh(name, bm, coll, material, subsurf=subsurf, outline=outline)


def torus(name, center, major, minor, coll, material, axis=(0, 0, 1), seg_major=48, seg_minor=12,
          subsurf=1, outline=0.0, arc=(0.0, 2 * math.pi)):
    """Torus with elliptical major radii (rx, ry) lying in the plane normal to axis."""
    rx, ry = major if isinstance(major, (tuple, list)) else (major, major)
    axis = Vector(axis).normalized()
    e1 = axis.cross(Vector((0, 0, 1)))
    if e1.length < 1e-4:
        e1 = Vector((1, 0, 0))
    e1.normalize()
    e2 = axis.cross(e1).normalized()
    closed = abs((arc[1] - arc[0]) - 2 * math.pi) < 1e-6
    count = seg_major if closed else seg_major + 1
    bm = bmesh.new()
    rings = []
    for i in range(count):
        u = arc[0] + (arc[1] - arc[0]) * i / seg_major
        radial = math.cos(u) * e1 + math.sin(u) * e2
        c = Vector(center) + rx * math.cos(u) * e1 + ry * math.sin(u) * e2
        ring = [bm.verts.new(c + minor * (math.cos(v) * radial + math.sin(v) * axis))
                for v in (2 * math.pi * j / seg_minor for j in range(seg_minor))]
        rings.append(ring)
    pairs = list(zip(rings, rings[1:] + ([rings[0]] if closed else [])))
    for a, b in pairs:
        for j in range(seg_minor):
            bm.faces.new((a[j], b[j], b[(j + 1) % seg_minor], a[(j + 1) % seg_minor]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish_mesh(name, bm, coll, material, subsurf=subsurf, outline=outline)


def rounded_box(name, center, size, coll, material, subsurf=2, outline=0.0, rotation=None):
    """A cube with Subdivision Surface, which rounds it into a soft pillow shape."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    transform_bmesh(bm, center, size, rotation)
    return finish_mesh(name, bm, coll, material, subsurf=subsurf, outline=outline)


def add_shape_key(obj, name, func):
    """Add a shape key whose vertex positions come from func(basis_co) -> co."""
    if obj.data.shape_keys is None:
        obj.shape_key_add(name="Basis", from_mix=False)
    key = obj.shape_key_add(name=name, from_mix=False)
    key.value = 0.0
    for i, v in enumerate(obj.data.vertices):
        key.data[i].co = func(Vector(v.co))
    return key


# ---------------------------------------------------------------------------
# The elf: dimensions (feet at z = 0, total height about 1.7 with the hood)
# ---------------------------------------------------------------------------

HEAD_C = Vector((0.0, 0.0, 1.25))
HEAD_R = 0.40
HEAD_SCALE = (1.0, 0.97, 0.93)
BODY_C = Vector((0.0, 0.0, 0.62))
BODY_SCALE = (0.30, 0.27, 0.32)
EYE_X, EYE_Y, EYE_Z = 0.15, -0.335, 1.26
HOOD_R = 0.435
HOOD_C = Vector((0.0, 0.03, 1.27))
FACE_AXIS = Vector((0.0, -1.0, -0.12)).normalized()
FACE_HOLE_DEG = 64.0
OUTLINE = 0.011


def mirror(p):
    return (-p[0], p[1], p[2])


def build_model():
    """Build every mesh of the elf and return a dict of the objects by name."""
    mats = {
        "skin": toon_material("Skin", PALETTE["skin"], roughness=0.65, subsurface=0.06),
        "cheek": toon_material("Cheek", PALETTE["cheek"], roughness=0.7),
        "eye": toon_material("Eye", PALETTE["eye"], roughness=0.25),
        "highlight": toon_material("Highlight", PALETTE["white"], roughness=0.4, emission=PALETTE["white"],
                                    emission_strength=0.6),
        "tunic": toon_material("Tunic", PALETTE["tunic"], roughness=0.75),
        "tunic_dark": toon_material("TunicDark", PALETTE["tunic_dark"], roughness=0.75),
        "trim": toon_material("Trim", PALETTE["trim"], roughness=0.5),
        "boot": toon_material("Boot", PALETTE["boot"], roughness=0.6),
        "sole": toon_material("Sole", PALETTE["sole"], roughness=0.8),
        "hair": toon_material("Hair", PALETTE["hair"], roughness=0.6),
        "acorn": toon_material("Acorn", PALETTE["acorn"], roughness=0.55),
        "acorn_dark": toon_material("AcornDark", PALETTE["acorn_dark"], roughness=0.6),
        "mushroom": toon_material("Mushroom", PALETTE["mushroom"], roughness=0.5),
        "cream": toon_material("Cream", PALETTE["cream"], roughness=0.7),
        "ear_inner": toon_material("EarInner", PALETTE["ear_inner"], roughness=0.7),
    }
    objs = {}

    # --- Body -------------------------------------------------------------
    objs["Head"] = sphere("Head", HEAD_C, HEAD_R, "Body", mats["skin"], scale=HEAD_SCALE,
                          segments=40, rings=24, subsurf=1, outline=OUTLINE)
    objs["Body"] = sphere("Body", BODY_C, 1.0, "Body", mats["tunic"], scale=BODY_SCALE,
                          segments=32, rings=20, subsurf=1, outline=OUTLINE)
    # Skirt hem of the tunic: a flattened torus at the bottom so the body reads as clothing.
    objs["Hem"] = torus("Hem", (0, 0, 0.36), (0.235, 0.21), 0.035, "Body", mats["tunic_dark"],
                        subsurf=1, outline=OUTLINE)
    objs["Belt"] = torus("Belt", (0, 0, 0.50), (0.282, 0.253), 0.03, "Body", mats["boot"],
                         subsurf=1, outline=0.0)
    objs["Buckle"] = rounded_box("Buckle", (0, -0.268, 0.50), (0.09, 0.03, 0.08), "Body", mats["trim"], subsurf=2)
    for side, suffix in ((1, "L"), (-1, "R")):
        s = side
        objs[f"Arm.{suffix}"] = tube(f"Arm.{suffix}",
                                     [(0.22 * s, -0.02, 0.80), (0.36 * s, -0.08, 0.66), (0.42 * s, -0.17, 0.54)],
                                     [0.07, 0.065, 0.058], "Body", mats["tunic"], ref=(0, 1, 0),
                                     subsurf=1, outline=OUTLINE)
        objs[f"Hand.{suffix}"] = sphere(f"Hand.{suffix}", (0.44 * s, -0.22, 0.47), 0.085, "Body", mats["skin"],
                                        scale=(1.0, 0.85, 1.1), subsurf=1, outline=OUTLINE)
        objs[f"Leg.{suffix}"] = tube(f"Leg.{suffix}",
                                     [(0.125 * s, 0.0, 0.42), (0.125 * s, -0.01, 0.26), (0.125 * s, -0.01, 0.11)],
                                     [0.075, 0.07, 0.07], "Body", mats["tunic_dark"], ref=(0, 1, 0),
                                     subsurf=1, outline=OUTLINE)
        objs[f"Boot.{suffix}"] = sphere(f"Boot.{suffix}", (0.13 * s, -0.045, 0.095), 1.0, "Body", mats["boot"],
                                        scale=(0.125, 0.17, 0.095), subsurf=1, outline=OUTLINE)
        objs[f"Sole.{suffix}"] = sphere(f"Sole.{suffix}", (0.13 * s, -0.045, 0.03), 1.0, "Body", mats["sole"],
                                        scale=(0.13, 0.176, 0.035), subsurf=1, outline=0.0)
        # Ears: flattened cones from the side of the head, pointing out and up, drooping outward.
        base = Vector((0.355 * s, 0.03, 1.28))
        ear_pts = [base, base + Vector((0.13 * s, -0.01, 0.075)), base + Vector((0.26 * s, -0.03, 0.13)),
                   base + Vector((0.37 * s, -0.06, 0.15))]
        objs[f"Ear.{suffix}"] = tube(f"Ear.{suffix}", ear_pts, [0.095, 0.08, 0.05, 0.004], "Body", mats["skin"],
                                     flatten=(1.0, 0.5), ref=(0, 1, 0), subsurf=1, outline=OUTLINE)
        inner_pts = [p + Vector((0, -0.036, 0)) for p in ear_pts[0:4]]
        inner_pts[0] = inner_pts[0] + Vector((0.05 * s, 0, 0))
        objs[f"EarInner.{suffix}"] = tube(f"EarInner.{suffix}", inner_pts, [0.055, 0.045, 0.028, 0.003], "Body",
                                          mats["ear_inner"], flatten=(1.0, 0.45), ref=(0, 1, 0), subsurf=1)

    # --- Face -------------------------------------------------------------
    for side, suffix in ((1, "L"), (-1, "R")):
        s = side
        c = Vector((EYE_X * s, EYE_Y, EYE_Z))
        objs[f"Eye.{suffix}"] = sphere(f"Eye.{suffix}", c, 0.085, "Face", mats["eye"], scale=(1.0, 0.6, 1.2),
                                       subsurf=1)
        objs[f"Highlight.{suffix}"] = sphere(f"Highlight.{suffix}", c + Vector((0.028, -0.046, 0.045)), 0.027,
                                             "Face", mats["highlight"], scale=(1.0, 0.5, 1.0), segments=16,
                                             rings=8, subsurf=0)
        objs[f"HighlightSmall.{suffix}"] = sphere(f"HighlightSmall.{suffix}", c + Vector((-0.03, -0.044, -0.05)),
                                                  0.013, "Face", mats["highlight"], scale=(1.0, 0.5, 1.0),
                                                  segments=12, rings=6, subsurf=0)
        # Eyelid: the back hemisphere of a slightly larger sphere; a bone rotates it over the eye.
        objs[f"Eyelid.{suffix}"] = sphere(f"Eyelid.{suffix}", c, 0.097, "Face", mats["skin"],
                                          scale=(1.0, 0.66, 1.25), subsurf=1, keep=lambda p: p.y > -0.005)
        # Lash line for the closed eye: rides on the eyelid bone, hidden inside the head at rest.
        objs[f"Lash.{suffix}"] = tube(f"Lash.{suffix}", [c + Vector((-0.062, 0.058, 0.03)), c + Vector((0, 0.066, -0.002)),
                                                          c + Vector((0.062, 0.058, 0.03))],
                                      [0.009, 0.012, 0.009], "Face", mats["eye"], ref=(0, 1, 0), segments=8,
                                      samples=8, subsurf=1)
        objs[f"Cheek.{suffix}"] = sphere(f"Cheek.{suffix}", (0.25 * s, -0.272, 1.14), 0.065, "Face", mats["cheek"],
                                         scale=(1.0, 0.4, 0.75), subsurf=1)
        brow = tube(f"Brow.{suffix}", [(0.07 * s, -0.378, 1.365), (0.15 * s, -0.355, 1.392), (0.235 * s, -0.318, 1.372)],
                    [0.012, 0.015, 0.009], "Face", mats["hair"], ref=(0, 1, 0), segments=8, samples=8, subsurf=1)
        add_shape_key(brow, "sad", lambda p, s=s: Vector((p.x, p.y, p.z + 0.035 * (1 - abs(p.x) / 0.235) - 0.015)))
        objs[f"Brow.{suffix}"] = brow
    objs["Nose"] = sphere("Nose", (0, -0.392, 1.195), 0.022, "Face", mats["skin"], scale=(1.0, 0.8, 0.85),
                          segments=16, rings=8, subsurf=0)
    mouth = sphere("Mouth", (0, 0, 0), 1.0, "Face", mats["eye"], scale=(0.064, 0.014, 0.018), segments=24,
                   rings=12, subsurf=1)
    # Rest shape: a thin gentle smile line sitting on the face surface.
    for v in mouth.data.vertices:
        t = v.co.x / 0.058
        v.co.z += 0.012 * (t * t - 0.5)
        v.co += Vector((0, -0.372, 1.105))
    mc = Vector((0, -0.372, 1.105))
    add_shape_key(mouth, "open", lambda p: mc + Vector(((p.x - mc.x) * 0.85, (p.y - mc.y) * 1.2 + 0.012,
                                                        (p.z - mc.z) * 3.4 - 0.018)))
    add_shape_key(mouth, "smile", lambda p: mc + Vector(((p.x - mc.x) * 1.25, p.y - mc.y,
                                                         (p.z - mc.z) + 0.03 * (((p.x - mc.x) / 0.058) ** 2 - 0.5))))
    add_shape_key(mouth, "frown", lambda p: mc + Vector(((p.x - mc.x) * 0.8, p.y - mc.y,
                                                         (p.z - mc.z) - 0.032 * (((p.x - mc.x) / 0.058) ** 2 - 0.5))))
    objs["Mouth"] = mouth
    # Sick face: crossed sticks over each eye, hidden unless the mood asks for them.
    for side, suffix in ((1, "L"), (-1, "R")):
        c = Vector((EYE_X * side, EYE_Y - 0.075, EYE_Z))
        for k, angle in enumerate((45, -45)):
            rot = Matrix.Rotation(math.radians(angle), 3, "Y")
            objs[f"CrossEye{k}.{suffix}"] = rounded_box(f"CrossEye{k}.{suffix}", c, (0.19, 0.022, 0.042),
                                                        "Face/Sick", mats["eye"], subsurf=1, rotation=rot)
    collection("Face/Sick").hide_render = True

    # --- Hats -------------------------------------------------------------
    cos_hole = math.cos(math.radians(FACE_HOLE_DEG))

    def hood_keep(p):
        d = p.normalized()
        below_chin = p.z < -0.16 and p.y < 0.02 - 0.8 * (-0.16 - p.z)
        return d.dot(FACE_AXIS) < cos_hole and p.z > -0.36 and not below_chin

    hood = sphere("Hood", HOOD_C, HOOD_R, "Hat/Hood", mats["tunic"], segments=48, rings=28, subsurf=1,
                  keep=hood_keep)
    # Drape the lower part of the hood down onto the shoulders like a short cape.
    for v in hood.data.vertices:
        rel = v.co - HOOD_C
        if rel.z < -0.05:
            t = min(1.0, (-0.05 - rel.z) / 0.32)
            t = t * t * (3 - 2 * t)
            v.co = HOOD_C + Vector((rel.x * (1 + 0.07 * t), rel.y * (1 + 0.07 * t), rel.z - 0.09 * t))
    shell = hood.modifiers.new("Shell", "SOLIDIFY")
    shell.thickness = 0.03
    shell.offset = 1.0
    shell.use_rim = True
    outline_modifier(hood, OUTLINE)
    objs["Hood"] = hood
    rim_center = HOOD_C + FACE_AXIS * HOOD_R * cos_hole
    # The trim is an arch over the face (an arc of torus); the hood is open under the chin.
    objs["HoodTrim"] = torus("HoodTrim", rim_center, HOOD_R * math.sin(math.radians(FACE_HOLE_DEG)) + 0.012, 0.034,
                             "Hat/Hood", mats["trim"], axis=FACE_AXIS, subsurf=1, outline=OUTLINE,
                             arc=(math.radians(150), math.radians(390)))
    # The tip droops to the character's left so the pompom is visible from the front.
    tip_pts = [(0.0, 0.10, 1.64), (0.14, 0.22, 1.84), (0.38, 0.30, 1.80), (0.54, 0.30, 1.62)]
    objs["HoodTip"] = tube("HoodTip", tip_pts, [0.19, 0.13, 0.07, 0.035], "Hat/Hood", mats["tunic"], ref=(0, 1, 0),
                           samples=14, subsurf=1, outline=OUTLINE, cap_start=True)
    objs["Pompom"] = sphere("Pompom", (0.57, 0.30, 1.54), 0.095, "Hat/Hood", mats["trim"], subsurf=1,
                            outline=OUTLINE)

    hair = sphere("Hair", HEAD_C + Vector((0, 0.005, 0.01)), HEAD_R + 0.025, "Hat/Hair", mats["hair"],
                  scale=HEAD_SCALE, segments=40, rings=24, subsurf=1, outline=OUTLINE,
                  keep=lambda p: p.z > 0.09 or (p.y > 0.05 and p.z > -0.12))
    # A few bangs: short tubes hanging over the forehead.
    for i, x in enumerate((-0.2, -0.07, 0.08, 0.2)):
        objs[f"Bang{i}"] = tube(f"Bang{i}", [(x, -0.30, 1.52), (x * 1.1, -0.36, 1.45), (x * 1.15, -0.37, 1.40)],
                                [0.05, 0.035, 0.004], "Hat/Hair", mats["hair"], flatten=(1.0, 0.6), ref=(0, 1, 0),
                                samples=6, subsurf=1, outline=OUTLINE)
    objs["Hair"] = hair
    acorn = sphere("AcornCap", HEAD_C + Vector((0, 0.02, 0.19)), HEAD_R + 0.06, "Hat/Acorn", mats["acorn"],
                   scale=(1.0, 1.0, 0.78), segments=40, rings=20, subsurf=1, outline=OUTLINE,
                   keep=lambda p: p.z > -0.02)
    objs["AcornCap"] = acorn
    objs["AcornRim"] = torus("AcornRim", HEAD_C + Vector((0, 0.02, 0.175)), HEAD_R + 0.06, 0.03, "Hat/Acorn",
                             mats["acorn_dark"], subsurf=1, outline=OUTLINE)
    objs["AcornStalk"] = tube("AcornStalk", [(0, 0.02, 1.76), (0.04, 0.03, 1.90), (0.11, 0.05, 1.98)],
                              [0.045, 0.035, 0.03], "Hat/Acorn", mats["acorn_dark"], ref=(0, 1, 0), samples=8,
                              subsurf=1, outline=OUTLINE)
    mush = sphere("MushroomCap", HEAD_C + Vector((0, 0.03, 0.17)), HEAD_R + 0.17, "Hat/Mushroom", mats["mushroom"],
                  scale=(1.0, 1.0, 0.62), segments=48, rings=24, subsurf=1, outline=OUTLINE,
                  keep=lambda p: p.z > -0.04)
    objs["MushroomCap"] = mush
    objs["MushroomRim"] = torus("MushroomRim", HEAD_C + Vector((0, 0.03, 0.155)), HEAD_R + 0.165, 0.035,
                                "Hat/Mushroom", mats["cream"], subsurf=1, outline=OUTLINE)
    for i, (az, el, size) in enumerate(((-100, 50, 0.085), (-45, 70, 0.065), (20, 55, 0.075), (-150, 35, 0.06),
                                        (110, 45, 0.07), (-70, 25, 0.05), (60, 20, 0.055), (170, 65, 0.06))):
        d = Vector((math.cos(math.radians(el)) * math.sin(math.radians(az)),
                    -math.cos(math.radians(el)) * math.cos(math.radians(az)), math.sin(math.radians(el))))
        center = HEAD_C + Vector((0, 0.03, 0.17)) + Vector((d.x * (HEAD_R + 0.17), d.y * (HEAD_R + 0.17),
                                                             d.z * (HEAD_R + 0.17) * 0.62))
        rot = d.to_track_quat("Z", "Y").to_matrix()
        objs[f"Dot{i}"] = sphere(f"Dot{i}", center, size, "Hat/Mushroom", mats["cream"], scale=(1.0, 1.0, 0.3),
                                 segments=16, rings=8, subsurf=1, rotation=rot)
    for path in ("Hat/Hair", "Hat/Acorn", "Hat/Mushroom"):
        collection(path).hide_render = True

    # Body shape keys: squash and stretch about the feet.
    body = objs["Body"]
    add_shape_key(body, "squash", lambda p: Vector((p.x * 1.15, p.y * 1.15, 0.30 + (p.z - 0.30) * 0.82)))
    add_shape_key(body, "stretch", lambda p: Vector((p.x * 0.9, p.y * 0.9, 0.30 + (p.z - 0.30) * 1.18)))
    return objs, mats


# ---------------------------------------------------------------------------
# Armature and binding
# ---------------------------------------------------------------------------

BONES = [
    # name, head, tail, parent, deform
    ("root", (0, 0, 0), (0, 0, 0.25), None, False),
    ("hips", (0, 0, 0.42), (0, 0, 0.55), "root", True),
    ("spine", (0, 0, 0.55), (0, 0, 0.70), "hips", True),
    ("chest", (0, 0, 0.70), (0, 0, 0.88), "spine", True),
    ("neck", (0, 0, 0.88), (0, 0, 0.96), "chest", True),
    ("head", (0, 0, 0.96), (0, 0, 1.62), "neck", True),
    ("hood_tip", (0.02, 0.14, 1.70), (0.52, 0.30, 1.64), "head", True),
]
for _side, _sfx in ((1, "L"), (-1, "R")):
    BONES += [
        (f"ear.{_sfx}", (0.355 * _side, 0.03, 1.28), (0.72 * _side, -0.03, 1.43), "head", True),
        (f"eyelid.{_sfx}", (EYE_X * _side, EYE_Y, EYE_Z), (EYE_X * _side + 0.1, EYE_Y, EYE_Z), "head", True),
        (f"upper_arm.{_sfx}", (0.22 * _side, -0.02, 0.80), (0.36 * _side, -0.08, 0.66), "chest", True),
        (f"forearm.{_sfx}", (0.36 * _side, -0.08, 0.66), (0.42 * _side, -0.17, 0.54), f"upper_arm.{_sfx}", True),
        (f"hand.{_sfx}", (0.42 * _side, -0.17, 0.54), (0.46 * _side, -0.25, 0.42), f"forearm.{_sfx}", True),
        (f"thigh.{_sfx}", (0.125 * _side, 0, 0.44), (0.125 * _side, -0.005, 0.26), "hips", True),
        (f"shin.{_sfx}", (0.125 * _side, -0.005, 0.26), (0.125 * _side, -0.01, 0.11), f"thigh.{_sfx}", True),
        (f"foot.{_sfx}", (0.125 * _side, -0.01, 0.11), (0.13 * _side, -0.20, 0.05), f"shin.{_sfx}", True),
    ]
NO_INHERIT_SCALE = {"neck", "upper_arm.L", "upper_arm.R", "ear.L", "ear.R", "hood_tip", "eyelid.L", "eyelid.R"}


def build_armature():
    arm_data = bpy.data.armatures.new("ElfRig")
    arm = bpy.data.objects.new("Elf", arm_data)
    collection("Rig").objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    for name, head, tail, parent, deform in BONES:
        b = arm_data.edit_bones.new(name)
        b.head, b.tail = head, tail
        b.use_deform = deform
        if parent:
            b.parent = arm_data.edit_bones[parent]
        if name in NO_INHERIT_SCALE:
            b.inherit_scale = "NONE"
    bpy.ops.object.mode_set(mode="POSE")
    for pb in arm.pose.bones:
        pb.rotation_mode = "XYZ"
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm


def bind_auto(arm, obj, bones):
    """Parent with automatic weights, limited to the given bones."""
    for b in arm.data.bones:
        b.use_deform = b.name in bones
    with bpy.context.temp_override(object=arm, active_object=arm, selected_objects=[obj, arm],
                                   selected_editable_objects=[obj, arm], view_layer=bpy.context.view_layer):
        bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    for name, _h, _t, _p, deform in BONES:
        arm.data.bones[name].use_deform = deform
    if not obj.vertex_groups:
        print(f"[elf] automatic weights failed for {obj.name}, falling back to rigid bind")
        bind_rigid(arm, obj, bones[0])
    _armature_modifier_first(obj)


def bind_rigid(arm, obj, bone):
    """Bind every vertex of obj fully to one bone."""
    group = obj.vertex_groups.get(bone) or obj.vertex_groups.new(name=bone)
    group.add(list(range(len(obj.data.vertices))), 1.0, "REPLACE")
    obj.parent = arm
    if not any(m.type == "ARMATURE" for m in obj.modifiers):
        mod = obj.modifiers.new("Armature", "ARMATURE")
        mod.object = arm
    _armature_modifier_first(obj)


def _armature_modifier_first(obj):
    for i, mod in enumerate(obj.modifiers):
        if mod.type == "ARMATURE":
            obj.modifiers.move(i, 0)
            mod.use_deform_preserve_volume = True
            return


RIGID_BINDS = {
    "Head": "head", "Nose": "head", "Mouth": "head", "Hem": "hips", "Belt": "hips", "Buckle": "hips",
    "Pompom": "hood_tip", "Hair": "head", "AcornCap": "head", "AcornRim": "head", "AcornStalk": "head",
    "MushroomCap": "head", "MushroomRim": "head",
}


def bind_all(arm, objs):
    for name, obj in objs.items():
        base, _, side = name.partition(".")
        if name in RIGID_BINDS:
            bind_rigid(arm, obj, RIGID_BINDS[name])
        elif base in ("Eye", "Highlight", "HighlightSmall", "Cheek", "Brow", "CrossEye0", "CrossEye1") or base.startswith("Bang") or base.startswith("Dot"):
            bind_rigid(arm, obj, "head")
        elif base in ("Eyelid", "Lash"):
            bind_rigid(arm, obj, f"eyelid.{side}")
        elif base == "Hand":
            bind_rigid(arm, obj, f"hand.{side}")
        elif base in ("Boot", "Sole"):
            bind_rigid(arm, obj, f"foot.{side}")
        elif base == "Body":
            bind_auto(arm, obj, ["hips", "spine", "chest"])
        elif base == "Arm":
            bind_auto(arm, obj, [f"upper_arm.{side}", f"forearm.{side}", f"hand.{side}"])
        elif base == "Leg":
            bind_auto(arm, obj, [f"thigh.{side}", f"shin.{side}"])
        elif base in ("Ear", "EarInner"):
            bind_auto(arm, obj, [f"ear.{side}", "head"])
        elif base in ("Hood", "HoodTrim"):
            bind_auto(arm, obj, ["head", "hood_tip"])
        elif base == "HoodTip":
            bind_auto(arm, obj, ["hood_tip", "head"])
        else:
            bind_rigid(arm, obj, "head")


# ---------------------------------------------------------------------------
# Animation
# ---------------------------------------------------------------------------

class Rig:
    """Keyframing helper that talks in world axes and manages one action per clip."""

    def __init__(self, arm, objs):
        self.arm = arm
        self.objs = objs
        self.rest = {b.name: b.matrix_local.to_3x3() for b in arm.data.bones}
        self.keys = {
            "squash": objs["Body"], "stretch": objs["Body"],
            "open": objs["Mouth"], "smile": objs["Mouth"], "frown": objs["Mouth"],
            "sad.L": objs["Brow.L"], "sad.R": objs["Brow.R"],
        }
        self.clips = {}
        self.actions = {}

    # -- clip management --------------------------------------------------
    def begin(self, name, length):
        self.current = name
        self.clips[name] = (1, length)
        acts = {}
        ad = self.arm.animation_data or self.arm.animation_data_create()
        acts[self.arm] = ad.action = bpy.data.actions.new(f"{name}")
        for obj in {self.objs["Body"], self.objs["Mouth"], self.objs["Brow.L"], self.objs["Brow.R"]}:
            key = obj.data.shape_keys
            kad = key.animation_data or key.animation_data_create()
            acts[key] = kad.action = bpy.data.actions.new(f"{name}.{obj.name}")
        self.actions[name] = acts
        for f in (1, length + 1):
            self.rest_pose(f)

    def finish(self):
        for act in self.actions[self.current].values():
            for layer in act.layers:
                for strip in layer.strips:
                    for bag in strip.channelbags:
                        for fc in bag.fcurves:
                            for kp in fc.keyframe_points:
                                kp.interpolation = "BEZIER"
                                kp.easing = "EASE_IN_OUT"
                            fc.update()

    def apply(self, name):
        """Assign the clip's actions and set the scene frame range."""
        for owner, act in self.actions[name].items():
            owner.animation_data.action = act
            if act.slots:
                owner.animation_data.action_slot = act.slots[0]
        scene = bpy.context.scene
        scene.frame_start, scene.frame_end = self.clips[name]

    # -- keying -----------------------------------------------------------
    def rest_pose(self, frame):
        for pb in self.arm.pose.bones:
            pb.location = (0, 0, 0)
            pb.rotation_euler = (0, 0, 0)
            pb.scale = (1, 1, 1)
            pb.keyframe_insert("location", frame=frame)
            pb.keyframe_insert("rotation_euler", frame=frame)
            pb.keyframe_insert("scale", frame=frame)
        for key in self.keys:
            self.shape(key, frame, 0.0)

    def bone(self, name, frame, move=None, rot=None, scale=None):
        """Key a bone: move is a world offset, rot is (world_axis, degrees) or a list of them."""
        pb = self.arm.pose.bones[name]
        rest = self.rest[name]
        if move is not None:
            pb.location = rest.inverted() @ Vector(move)
            pb.keyframe_insert("location", frame=frame)
        if rot is not None:
            rots = [rot] if isinstance(rot[1], (int, float)) else rot
            world = Matrix.Identity(3)
            for axis, deg in rots:
                world = Matrix.Rotation(math.radians(deg), 3, Vector(axis).normalized()) @ world
            pb.rotation_euler = (rest.inverted() @ world @ rest).to_euler("XYZ")
            pb.keyframe_insert("rotation_euler", frame=frame)
        if scale is not None:
            sx, sy, sz = scale
            # World-space (xy, z) scale expressed in the bone's local frame (bones here point up).
            pb.scale = (sx, sz, sy) if abs(rest.col[1].z) > 0.7 else (sx, sy, sz)
            pb.keyframe_insert("scale", frame=frame)

    def shape(self, key, frame, value):
        obj = self.keys[key]
        kb = obj.data.shape_keys.key_blocks[key.split(".")[0]]
        kb.value = value
        kb.keyframe_insert("value", frame=frame)

    # -- compound helpers -----------------------------------------------
    def squash(self, frame, amount):
        """amount > 0 squashes (wider, shorter), amount < 0 stretches."""
        self.bone("root", frame, scale=(1 + 0.5 * amount, 1 + 0.5 * amount, 1 - amount))
        self.shape("squash", frame, max(0.0, amount) * 1.5)
        self.shape("stretch", frame, max(0.0, -amount) * 1.5)

    def ears(self, frame, up_deg, swing_deg=0.0):
        for side, s in (("L", 1), ("R", -1)):
            self.bone(f"ear.{side}", frame, rot=[((0, 1, 0), -up_deg * s), ((0, 0, 1), swing_deg * s)])

    def raise_arm(self, side, frame, raise_deg, fore_deg=0.0, forward_deg=0.0):
        """Swing the upper arm up sideways by raise_deg (the rest arm hangs 48 degrees below
        horizontal), bend the forearm, then tilt the raised arm towards the camera."""
        s = 1 if side == "L" else -1
        self.bone(f"upper_arm.{side}", frame, rot=[((0, 1, 0), -raise_deg * s), ((1, 0, 0), forward_deg)])
        self.bone(f"forearm.{side}", frame, rot=((0, 1, 0), -fore_deg * s))

    def blink(self, frame, amount):
        for side in ("L", "R"):
            self.bone(f"eyelid.{side}", frame, rot=((1, 0, 0), 180.0 * amount))

    def brows_sad(self, frame, value):
        self.shape("sad.L", frame, value)
        self.shape("sad.R", frame, value)


def build_clips(rig):
    """Author every clip. Frame 1 is the first frame; clips loop back to frame 1."""
    # idle: 48 frames, breath, bob, lagging ears and hood tip, blink at 30.
    rig.begin("idle", 48)
    for f in range(1, 50, 4):
        ph = 2 * math.pi * (f - 1) / 48
        rig.bone("chest", f, scale=(1 + 0.025 * math.sin(ph), 1 + 0.025 * math.sin(ph), 1 + 0.04 * math.sin(ph)))
        rig.bone("hips", f, move=(0, 0, 0.012 * math.sin(ph)))
        rig.bone("head", f, rot=((1, 0, 0), 1.5 * math.sin(ph)))
        lag = 2 * math.pi * (f - 1 - 2.5) / 48
        rig.ears(f, 3.0 * math.sin(lag))
        rig.bone("hood_tip", f, rot=((0, 1, 0), -3.0 * math.sin(lag)))
    rig.blink(28, 0.0)
    rig.blink(30, 1.0)
    rig.blink(31, 1.0)
    rig.blink(34, 0.0)
    rig.finish()

    # happy: two hops with squash on landing and stretch at the top, arms up.
    rig.begin("happy", 24)
    for hop in range(2):
        s = 1 + 12 * hop
        rig.bone("root", s, move=(0, 0, 0))
        rig.squash(s, 0.0)
        rig.squash(s + 1, 0.14)
        rig.bone("root", s + 1, move=(0, 0, 0))
        rig.bone("root", s + 3, move=(0, 0, 0.14))
        rig.squash(s + 3, -0.12)
        rig.bone("root", s + 5, move=(0, 0, 0.19))
        rig.squash(s + 5, -0.02)
        rig.bone("root", s + 8, move=(0, 0, 0))
        rig.squash(s + 8, 0.18)
        rig.squash(s + 10, -0.04)
        rig.squash(s + 12, 0.0)
        rig.ears(s + 1, -8)
        rig.ears(s + 5, 22)
        rig.ears(s + 9, -10)
        rig.ears(s + 12, 0)
        rig.bone("hood_tip", s + 1, rot=((0, 1, 0), 10))
        rig.bone("hood_tip", s + 5, rot=((0, 1, 0), -20))
        rig.bone("hood_tip", s + 9, rot=((0, 1, 0), 8))
    for side in ("L", "R"):
        rig.raise_arm(side, 1, 0)
        rig.raise_arm(side, 4, 108, 15, 40)
        rig.raise_arm(side, 13, 96, 8, 35)
        rig.raise_arm(side, 16, 108, 15, 40)
        rig.raise_arm(side, 22, 20, 0, 10)
        rig.raise_arm(side, 25, 0)
    rig.shape("smile", 1, 0.3)
    rig.shape("smile", 4, 1.0)
    rig.shape("open", 5, 0.5)
    rig.shape("open", 9, 0.0)
    rig.shape("open", 17, 0.5)
    rig.shape("open", 21, 0.0)
    rig.shape("smile", 22, 1.0)
    rig.shape("smile", 25, 0.3)
    rig.finish()

    # sad: slump, head down, slow breath, frown, drooping ears.
    rig.begin("sad", 24)
    rig.bone("hips", 10, move=(0, 0, -0.05))
    rig.bone("hips", 24, move=(0, 0, -0.045))
    rig.bone("chest", 10, rot=((1, 0, 0), 10))
    rig.bone("chest", 24, rot=((1, 0, 0), 11))
    rig.bone("head", 10, rot=((1, 0, 0), 16))
    rig.bone("head", 24, rot=((1, 0, 0), 15))
    rig.bone("chest", 17, scale=(1.02, 1.02, 1.03))
    rig.ears(10, -28, 10)
    rig.ears(24, -26, 10)
    rig.bone("hood_tip", 10, rot=((0, 1, 0), 22))
    rig.bone("hood_tip", 24, rot=((0, 1, 0), 20))
    for side in ("L", "R"):
        rig.raise_arm(side, 10, -8, 0)
        rig.raise_arm(side, 24, -8, 0)
    rig.brows_sad(8, 1.0)
    rig.brows_sad(24, 1.0)
    rig.shape("frown", 8, 1.0)
    rig.shape("frown", 24, 1.0)
    rig.blink(8, 0.25)
    rig.blink(24, 0.25)
    rig.finish()

    # sleep: eyes closed, deep slow breath, head drooped.
    rig.begin("sleep", 48)
    rig.blink(1, 1.0)
    rig.blink(49, 1.0)
    for f in range(1, 50, 4):
        ph = 2 * math.pi * (f - 1) / 48
        rig.bone("chest", f, scale=(1 + 0.04 * math.sin(ph), 1 + 0.04 * math.sin(ph), 1 + 0.06 * math.sin(ph)))
        rig.bone("hips", f, move=(0, 0, -0.03 + 0.01 * math.sin(ph)))
        rig.bone("head", f, rot=[((1, 0, 0), 12 + 1.5 * math.sin(ph)), ((0, 1, 0), 6)])
        rig.ears(f, -18 + 2 * math.sin(ph - 0.3))
        rig.bone("hood_tip", f, rot=((0, 1, 0), 14 - 2 * math.sin(ph - 0.3)))
    rig.shape("open", 1, 0.2)
    rig.shape("open", 49, 0.2)
    rig.finish()

    # pet: squash then stretch spring, head tilt, ears flap, happy squint.
    rig.begin("pet", 24)
    rig.squash(1, 0.0)
    rig.squash(4, 0.18)
    rig.squash(9, -0.14)
    rig.squash(13, 0.06)
    rig.squash(17, -0.03)
    rig.squash(21, 0.01)
    rig.squash(25, 0.0)
    rig.bone("head", 1, rot=((0, 1, 0), 0))
    rig.bone("head", 8, rot=((0, 1, 0), 14))
    rig.bone("head", 16, rot=((0, 1, 0), -5))
    rig.bone("head", 25, rot=((0, 1, 0), 0))
    rig.ears(3, -10)
    rig.ears(7, 28)
    rig.ears(12, -16)
    rig.ears(17, 12)
    rig.ears(21, -4)
    rig.ears(25, 0)
    rig.bone("hood_tip", 4, rot=((0, 1, 0), 15))
    rig.bone("hood_tip", 10, rot=((0, 1, 0), -18))
    rig.bone("hood_tip", 16, rot=((0, 1, 0), 6))
    rig.shape("smile", 5, 1.0)
    rig.shape("smile", 20, 1.0)
    rig.blink(4, 0.0)
    rig.blink(8, 0.55)
    rig.blink(18, 0.55)
    rig.blink(23, 0.0)
    rig.finish()

    # feed: mouth opens and closes three times, then a satisfied squash.
    rig.begin("feed", 24)
    for k in range(3):
        s = 1 + 6 * k
        rig.shape("open", s, 0.0)
        rig.shape("open", s + 3, 0.9)
        rig.shape("open", s + 6, 0.0)
        rig.bone("head", s, rot=((1, 0, 0), 0))
        rig.bone("head", s + 3, rot=((1, 0, 0), -4))
    rig.squash(19, 0.0)
    rig.squash(21, 0.12)
    rig.squash(23, -0.03)
    rig.shape("smile", 19, 0.0)
    rig.shape("smile", 22, 1.0)
    rig.shape("smile", 25, 0.0)
    rig.blink(20, 0.0)
    rig.blink(22, 0.5)
    rig.blink(25, 0.0)
    rig.finish()

    # wave: the right arm waves twice.
    rig.begin("wave", 24)
    rig.raise_arm("R", 1, 0, 0)
    rig.raise_arm("R", 5, 78, 10, 35)
    rig.raise_arm("R", 8, 78, -35, 35)
    rig.raise_arm("R", 11, 78, 40, 35)
    rig.raise_arm("R", 14, 78, -35, 35)
    rig.raise_arm("R", 17, 78, 30, 35)
    rig.raise_arm("R", 21, 45, 10, 20)
    rig.raise_arm("R", 25, 0, 0)
    rig.bone("head", 6, rot=((0, 1, 0), -6))
    rig.bone("head", 18, rot=((0, 1, 0), -6))
    rig.shape("smile", 5, 0.8)
    rig.shape("smile", 20, 0.8)
    rig.ears(6, 10)
    rig.ears(14, 10)
    rig.finish()
    return rig.clips


# ---------------------------------------------------------------------------
# Review renders
# ---------------------------------------------------------------------------

FRAME_W, FRAME_H = 512, 768
CAMERA_CENTER = (0.0, 0.0, 1.0)
ORTHO_SCALE = 2.56
# Watts that put the lit front of the figure at the palette colours (the skin
# #f1d2b0 is bright and clips first). The shared rig keeps its lights farther
# away than the local one, hence the two sets.
LIGHT_WATTS = {"key": 540.0, "fill": 190.0, "top": 130.0} if USING_COMMON else {"key": 300.0, "fill": 120.0, "top": 70.0}


def contact_sheet(out_path, columns, scale, items):
    args = ["/usr/bin/python3", os.path.join(HERE, "contact_sheet.py"), out_path, str(columns), str(scale)]
    args += [f"{label}:{path}" for label, path in items]
    subprocess.run(args, check=True)


def set_hat(name):
    for hat in ("Hood", "Hair", "Acorn", "Mushroom"):
        collection(f"Hat/{hat}").hide_render = True
    if name == "hood":
        collection("Hat/Hood").hide_render = False
    else:
        collection("Hat/Hair").hide_render = False
        collection(f"Hat/{name.capitalize()}").hide_render = False


def pose(rig, clip, frame):
    rig.apply(clip)
    bpy.context.scene.frame_set(frame)


def stage_still(scene, rig, out):
    pose(rig, "idle", 1)
    render_still(scene, os.path.join(out, "still.png"))


def stage_turntable(scene, rig, out):
    pose(rig, "idle", 1)
    items = []
    for i in range(8):
        rig.arm.rotation_euler = (0, 0, math.radians(45 * i))
        items.append((f"{45 * i} deg", render_still(scene, os.path.join(out, "turntable", f"turn_{i}.png"))))
    rig.arm.rotation_euler = (0, 0, 0)
    contact_sheet(os.path.join(out, "turntable.png"), 4, 0.5, items)


def stage_moods(scene, rig, objs, mats, out):
    items = []
    for mood, clip, frame in (("ok", "idle", 1), ("happy", "happy", 5), ("sad", "sad", 24), ("sleep", "sleep", 25)):
        pose(rig, clip, frame)
        items.append((mood, render_still(scene, os.path.join(out, "moods", f"{mood}.png"))))
    # sick: crossed eyes, greenish skin.
    pose(rig, "sad", 24)
    skin = mats["skin"].node_tree.nodes["Principled BSDF"].inputs["Base Color"]
    original = tuple(skin.default_value)
    skin.default_value = (*hex_to_rgb(PALETTE["sick_skin"]), 1.0)
    collection("Face/Sick").hide_render = False
    for name in ("Eye", "Highlight", "HighlightSmall", "Eyelid"):
        for side in ("L", "R"):
            objs[f"{name}.{side}"].hide_render = True
    items.insert(3, ("sick", render_still(scene, os.path.join(out, "moods", "sick.png"))))
    for name in ("Eye", "Highlight", "HighlightSmall", "Eyelid"):
        for side in ("L", "R"):
            objs[f"{name}.{side}"].hide_render = False
    collection("Face/Sick").hide_render = True
    skin.default_value = original
    contact_sheet(os.path.join(out, "moods.png"), 5, 0.5, items)


def stage_hats(scene, rig, out):
    pose(rig, "idle", 1)
    items = []
    for hat in ("hood", "acorn", "mushroom"):
        set_hat(hat)
        items.append((hat, render_still(scene, os.path.join(out, "hats", f"{hat}.png"))))
    set_hat("hood")
    contact_sheet(os.path.join(out, "hats.png"), 3, 0.5, items)


def stage_anims(scene, rig, out, clips):
    for clip in clips:
        rig.apply(clip)
        start, end = rig.clips[clip]
        paths = render_frames(scene, os.path.join(out, "frames", clip), clip, start, end)
        items = [(f"f{start + i}", p) for i, p in enumerate(paths) if i % 6 == 0]
        contact_sheet(os.path.join(out, f"{clip}_sheet.png"), 8, 0.4, items)


def stage_hero(scene, rig, out, cycles=True):
    pose(rig, "wave", 11)
    scene.render.resolution_x, scene.render.resolution_y = FRAME_W * 2, FRAME_H * 2
    if cycles:
        scene.render.engine = "CYCLES"
        scene.cycles.samples = 64
        scene.cycles.use_denoising = True
    render_still(scene, os.path.join(out, "hero.png"))
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x, scene.render.resolution_y = FRAME_W, FRAME_H


def report_dimensions(objs):
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for name, obj in objs.items():
        if obj.users_collection[0].hide_render:
            continue
        for v in obj.data.vertices:
            p = obj.matrix_world @ v.co
            lo = Vector(map(min, lo, p))
            hi = Vector(map(max, hi, p))
    print(f"[elf] bounds min={tuple(round(c, 3) for c in lo)} max={tuple(round(c, 3) for c in hi)} "
          f"size={tuple(round(c, 3) for c in (hi - lo))}")
    return lo, hi


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = argv[0] if argv else os.path.join(os.path.expanduser("~"), "elf-renders")
    stages = ["still"]
    quick = "--quick" in argv
    if "--stages" in argv:
        stages = argv[argv.index("--stages") + 1].split(",")
    os.makedirs(out, exist_ok=True)

    scene = setup_scene(FRAME_W, FRAME_H, samples=16 if quick else 32)
    objs, mats = build_model()
    arm = build_armature()
    bind_all(arm, objs)
    rig = Rig(arm, objs)
    clips = build_clips(rig)
    add_light_rig(target=CAMERA_CENTER, key_strength=LIGHT_WATTS["key"], fill_strength=LIGHT_WATTS["fill"],
                  top_strength=LIGHT_WATTS["top"])
    add_ortho_camera(CAMERA_CENTER, ORTHO_SCALE)
    report_dimensions(objs)
    print(f"[elf] shared common.py in use: {USING_COMMON}")
    for name, (start, end) in clips.items():
        print(f"[elf] clip {name}: frames {start}-{end} ({end - start + 1} frames)")

    if "still" in stages:
        stage_still(scene, rig, out)
    if "turntable" in stages:
        stage_turntable(scene, rig, out)
    if "moods" in stages:
        stage_moods(scene, rig, objs, mats, out)
    if "hats" in stages:
        stage_hats(scene, rig, out)
    if "anims" in stages:
        stage_anims(scene, rig, out, ["idle", "pet"])
    if "allanims" in stages:
        stage_anims(scene, rig, out, list(clips))
    if "--clips" in argv:
        stage_anims(scene, rig, out, argv[argv.index("--clips") + 1].split(","))
    if "hero" in stages:
        stage_hero(scene, rig, out, cycles=not quick)
    pose(rig, "idle", 1)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, "elf.blend"))


if __name__ == "__main__":
    main()
