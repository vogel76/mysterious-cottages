"""
Elf character for the Chatynkowo "Elf" tab, built entirely by script in Blender.

Why: the app shows a Pou-style virtual pet rendered to 2D sprite frames. This
script rebuilds the young forest elf from primitives (no saved .blend needed):
an egg-shaped head with iris eyes under a swept fringe, long elven ears, a
leaf-collared tunic, leggings and curled boots; painterly materials with a
thin Line Art ink (see common.py); a small armature with automatic weights;
shape keys for squash/stretch and the face; a set of short 24 fps animation
clips stored as actions; and renders review material plus the sprite frame
sequences with an orthographic front camera.

Run:
    blender --background --python elf.py -- <out_dir> [--stages still,turntable,moods,hats,anims,allanims,hero,lookdev]
        [--clips wave,feed] [--form young|baby] [--studio] [--ramp 0.4] [--no-ink] [--hull] [--no-quality] [--quick]

By default the elf stands on the rug of the cottage of room.py, lit by
its fire and moon, drawn by its ink, and the frames are the room's camera
cropped to the figure; --studio renders it alone in the shared light rig
with the orthographic camera instead (the look-dev sheets of the
character were made that way).

The look is set by LOOK below (the ramp of the painterly shading, the ink,
the inverted hull) and overridden by the flags, which the lookdev stage
uses to render its A/B columns.

Conventions: the character faces -Y, Z is up, feet at z = 0, the camera sits
on -Y and looks at +Y tilted down. Bone names use Blender's .L/.R suffixes
with .L on +X (the character's own left).
"""

import json
import math
import os
import subprocess
import sys
from dataclasses import dataclass

import bmesh
import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import common as _common  # noqa: E402

setup_scene = _common.setup_scene
add_light_rig = _common.add_light_rig
add_ortho_camera = _common.add_ortho_camera
render_still = _common.render_still
render_frames = _common.render_frames

FPS = 24

# ---------------------------------------------------------------------------
# Palette (binding art direction)
# ---------------------------------------------------------------------------

PALETTE = {
    "skin": "#f3d7ba",
    "eye_white": "#fbf5e8",
    "iris": "#4f8a45",
    "pupil": "#201812",
    "tunic": "#5a8f4e",
    "tunic_dark": "#3f6b3a",
    "leaf": "#8dbd62",
    "trim": "#c79a4b",
    "belt": "#4a2f1a",
    "legging": "#5a4632",
    "boot": "#3a2616",
    "sole": "#2a1a10",
    "hair": "#a1562a",
    "hair_dark": "#7a3f1e",
    "acorn": "#8a5a2b",
    "acorn_dark": "#5a3b22",
    "mushroom": "#c0392b",
    "cream": "#f3e4c0",
    "ear_inner": "#e9a69a",
    "white": "#ffffff",
    "crown_pink": "#e98aa6",
    "crown_yellow": "#f2c641",
    "crown_heart": "#c7861f",
    "nightcap": "#3e5a8c",
    "wand_crystal": "#3fb6f2",
    "cape": "#5b6b34",
}

# The hats of the wardrobe, the catalogue's ids (cottage/catalogue.ts,
# WEARABLE_IDS.hat); 'none' is the bare hair, the rest are collections
# Hat/<id> rendered as layers of their own over the body.
HAT_IDS = ("none", "acornCap", "mushroomCap", "flowerCrown", "nightcap")
# The room's lights while the elf stands in the room (room_scene), for the
# daylit thumbnails.
ROOM_LIGHTS = {}

# The look: the painterly ramp (0 plain Principled, 1 pure bands), the Line
# Art ink, the inverted-hull outline and Eevee's quality options (ray
# tracing, Fast GI, shadow jitter). The flags override these per run.
LOOK = {"ramp": 0.4, "ink": True, "hull": False, "grain": 0.06, "ink_radius": 0.0045, "quality": True}


def material(name, color, roughness=0.6, subsurface=0.0, emission=None, emission_strength=1.0, grain=None,
             shadow_tint=_common.SHADOW_TINT):
    """A palette material in the current look."""
    return _common.painterly_material(name, PALETTE[color], ramp=LOOK["ramp"], roughness=roughness,
                                      subsurface=subsurface, emission=emission, emission_strength=emission_strength,
                                      grain=LOOK["grain"] if grain is None else grain, shadow_tint=shadow_tint)


# ---------------------------------------------------------------------------
# Mesh helpers
# ---------------------------------------------------------------------------

COLLECTIONS = {}


def collection(path):
    """Nested collections by 'A/B' path, created on demand."""
    if path in COLLECTIONS:
        return COLLECTIONS[path]
    parent = bpy.context.scene.collection if "/" not in path else collection(path.rsplit("/", 1)[0])
    coll = bpy.data.collections.new(path.rsplit("/", 1)[-1])
    parent.children.link(coll)
    COLLECTIONS[path] = coll
    return coll


def finish_mesh(name, bm, coll, mat, smooth=True, subsurf=1, outline=0.0):
    """Turn a bmesh into an object in a collection with material and modifiers."""
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    if smooth:
        mesh.shade_smooth()
    obj = bpy.data.objects.new(name, mesh)
    collection(coll).objects.link(obj)
    if mat is not None:
        mesh.materials.append(mat)
    if subsurf:
        mod = obj.modifiers.new("Subdivision", "SUBSURF")
        mod.levels = subsurf
        mod.render_levels = subsurf
    if outline and LOOK["hull"]:
        _common.outline_modifier(obj, outline)
    return obj


def transform_bmesh(bm, center=(0, 0, 0), scale=(1, 1, 1), rotation=None):
    """Scale about the origin, rotate, then translate every vertex."""
    rot = rotation if rotation is not None else Matrix.Identity(3)
    for v in bm.verts:
        p = Vector((v.co.x * scale[0], v.co.y * scale[1], v.co.z * scale[2]))
        v.co = rot @ p + Vector(center)


def sphere(name, center, radius, coll, mat, scale=(1, 1, 1), segments=32, rings=16,
           subsurf=1, outline=0.0, keep=None, rotation=None):
    """UV sphere; 'keep' is a predicate on the local (unscaled) offset to cut caps."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings, radius=radius)
    if keep is not None:
        doomed = [f for f in bm.faces if not keep(f.calc_center_median())]
        bmesh.ops.delete(bm, geom=doomed, context="FACES")
    transform_bmesh(bm, center, scale, rotation)
    return finish_mesh(name, bm, coll, mat, subsurf=subsurf, outline=outline)


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


def tube(name, points, radii, coll, mat, segments=16, samples=12, flatten=(1.0, 1.0),
         ref=(0, 1, 0), subsurf=1, outline=0.0, cap_start=True, cap_end=True):
    """A capsule-like tube along a spline with a radius profile and oval section."""
    path = catmull_rom(points, samples)
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
    return finish_mesh(name, bm, coll, mat, subsurf=subsurf, outline=outline)


def torus(name, center, major, minor, coll, mat, axis=(0, 0, 1), seg_major=48, seg_minor=12,
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
    return finish_mesh(name, bm, coll, mat, subsurf=subsurf, outline=outline)


def rounded_box(name, center, size, coll, mat, subsurf=2, outline=0.0, rotation=None):
    """A cube with Subdivision Surface, which rounds it into a soft pillow shape."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    transform_bmesh(bm, center, size, rotation)
    return finish_mesh(name, bm, coll, mat, subsurf=subsurf, outline=outline)


def leaf(name, base, direction, length, width, coll, mat, thickness=0.18):
    """A flat leaf: an ellipsoid pointing along `direction` from `base`."""
    d = Vector(direction).normalized()
    rot = d.to_track_quat("Z", "Y").to_matrix()
    return sphere(name, Vector(base) + d * length * 0.5, 1.0, coll, mat,
                  scale=(width * 0.5, width * thickness, length * 0.5), segments=20, rings=10, subsurf=1,
                  rotation=rot)


def add_shape_key(obj, name, func):
    """Add a shape key whose vertex positions come from func(basis_co) -> co."""
    if obj.data.shape_keys is None:
        obj.shape_key_add(name="Basis", from_mix=False)
    key = obj.shape_key_add(name=name, from_mix=False)
    key.value = 0.0
    for i, v in enumerate(obj.data.vertices):
        key.data[i].co = func(Vector(v.co))
    return key


def mirror(p):
    return (-p[0], p[1], p[2])


# ---------------------------------------------------------------------------
# The forms: the proportions of the figure, feet at z = 0
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Form:
    """One form's proportions in metres; every mesh and bone derives from them.

    The head keeps its features in proportion to head_r, the torso runs
    from shoulder_z to hem_z, the legs from hip_z over knee_z to the feet,
    ear and arm scale their lengths."""
    head_c: float
    head_r: float
    shoulder_z: float
    hem_z: float
    chest_r: float
    hem_r: float
    hip_z: float
    knee_z: float
    ear: float
    arm: float


FORMS = {
    # The young elf: about three and a half heads tall, the form of the first months.
    "young": Form(head_c=1.36, head_r=0.33, shoulder_z=1.03, hem_z=0.52, chest_r=0.20, hem_r=0.255,
                  hip_z=0.58, knee_z=0.34, ear=1.0, arm=1.0),
    # The hatchling: about two thirds of the young elf, a big head on a
    # small round body, short ears and arms, small boots.
    "baby": Form(head_c=0.77, head_r=0.33, shoulder_z=0.42, hem_z=0.22, chest_r=0.18, hem_r=0.22,
                 hip_z=0.27, knee_z=0.15, ear=0.62, arm=0.62),
    # The grown elf: a head taller, a smaller head on long limbs, long ears.
    "adult": Form(head_c=1.74, head_r=0.30, shoulder_z=1.38, hem_z=0.67, chest_r=0.215, hem_r=0.27,
                  hip_z=0.75, knee_z=0.44, ear=1.25, arm=1.24),
    # The elder: the grown elf's frame in a robe down to the boots.
    "elder": Form(head_c=1.74, head_r=0.30, shoulder_z=1.38, hem_z=0.2, chest_r=0.23, hem_r=0.4,
                  hip_z=0.75, knee_z=0.44, ear=1.3, arm=1.24),
}

# What a form wears or carries beyond its proportions, so the four read
# apart at a glance (the young elf has none of it):
#   head_scale, chin, eyes, brows: the head's shape and how much it narrows
#     to the chin, the eyes' and brows' size;
#   body: the size of everything on the body (shoulders, sleeves, hands,
#     legs, collar, belt), so a small form is small all over; boots: the
#     boots' size;
#   hair: the colours (hair, dark); sprout: a sprout of two leaves at the
#     crown instead of the leaf above the ear; hair_back: long hair down
#     the back;
#   tunic, trim: the cloth's colours, gold for the hem and the cuffs;
#   wand: "twig" (a seed of light) or "staff" (taller than the elf, a
#     crystal at the top); cape and pouch; beard: "long"; stars on the robe.
FORM_LOOK = {
    "baby": {"head_scale": (1.04, 1.0, 1.0), "chin": 0.12, "eyes": 1.18, "body": 0.78, "boots": 0.62, "sprout": True},
    "adult": {"head_scale": (0.98, 0.95, 1.15), "eyes": 0.9, "wand": "twig", "cape": True, "pouch": True},
    "elder": {"head_scale": (0.98, 0.95, 1.12), "eyes": 0.88, "brows": 2.2, "wand": "staff", "beard": "long",
              "hair": ("#dcd7cc", "#a9a296"), "hair_back": True, "tunic": ("#3f5687", "#2c3d66"), "trim": True,
              "stars": True},
}
FORM_NAME = "young"

F = FORMS["young"]
HEAD_SCALE = (1.0, 0.95, 1.08)
# The face sits on the -Y side of the head, tilted a little down.
FACE_AXIS = Vector((0.0, -1.0, -0.12)).normalized()
OUTLINE = 0.011


def set_form(name):
    """Select the form every builder reads; call before build_model. A
    form's hair colours replace the palette's."""
    global F, BONES, FORM_NAME
    F = FORMS[name]
    FORM_NAME = name
    BONES = bones_for(F)
    look = FORM_LOOK.get(name, {})
    if isinstance(look.get("hair"), tuple):
        PALETTE["hair"], PALETTE["hair_dark"] = look["hair"]
    if look.get("tunic"):
        PALETTE["tunic"], PALETTE["tunic_dark"] = look["tunic"]


def head_c():
    return Vector((0.0, 0.0, F.head_c))


def form_look():
    return FORM_LOOK.get(FORM_NAME, {})


def head_scale():
    return form_look().get("head_scale", HEAD_SCALE)


def pelvis_z():
    """Where the hips are: the tunic's hem, or above a robe's."""
    return max(F.hem_z, F.hip_z - 0.06)


def hp(x, y, z):
    """A point on the head, given relative to a 0.36 m head and scaled to this form's."""
    k = F.head_r / 0.36
    return head_c() + Vector((x * k, y * k, z * k))


def arm_points(s):
    """Shoulder, elbow, hand centre of one arm (s = +1 left, -1 right); the
    arm hangs close to the body with a slight bend forward at the elbow."""
    b = form_look().get("body", 1.0)
    shoulder = Vector((0.215 * b * s, -0.01, F.shoulder_z - 0.04 * b))
    elbow = shoulder + Vector((0.06 * s, 0.0, -0.23)) * F.arm
    hand = elbow + Vector((0.03 * s, -0.08, -0.19)) * F.arm
    return shoulder, elbow, hand


def leg_points(s):
    b = form_look().get("body", 1.0)
    hip = Vector((0.12 * b * s, 0.0, F.hip_z))
    knee = Vector((0.12 * b * s, -0.02, F.knee_z))
    ankle = Vector((0.125 * b * s, -0.01, 0.12 * form_look().get("boots", 1.0)))
    return hip, knee, ankle


def ear_points(s):
    base = hp(0.30 * s, 0.02, 0.0)
    reach = Vector((0.28 * s, -0.04, 0.26)) * F.ear
    return [base, base + reach * 0.37, base + reach * 0.72, base + reach]


EYE_C = (0.14, -0.30, 0.0)


def fuse(name, pieces, mat, voxel=0.01, smooth=6):
    """Join the pieces into one organic mesh: their modifiers applied, the
    union remeshed on a voxel grid and smoothed, so a sleeve grows out of a
    shoulder and a nose out of a face instead of one primitive sitting in
    another. The first piece's collection keeps the result; the pieces are
    gone. `voxel` is the grid step in metres: finer keeps smaller features."""
    deps = bpy.context.evaluated_depsgraph_get()
    for piece in pieces:
        mesh = bpy.data.meshes.new_from_object(piece.evaluated_get(deps))
        old = piece.data
        piece.modifiers.clear()
        piece.data = mesh
        bpy.data.meshes.remove(old)
    target = pieces[0]
    with bpy.context.temp_override(active_object=target, selected_objects=list(pieces),
                                   selected_editable_objects=list(pieces), view_layer=bpy.context.view_layer):
        bpy.ops.object.join()
    target.name = name
    target.data.name = name
    target.data.remesh_voxel_size = voxel
    target.data.remesh_voxel_adaptivity = 0.0
    target.data.use_remesh_fix_poles = True
    target.data.use_remesh_preserve_volume = True
    with bpy.context.temp_override(object=target, active_object=target, selected_objects=[target],
                                   selected_editable_objects=[target], view_layer=bpy.context.view_layer):
        bpy.ops.object.voxel_remesh()
    target.data.materials.clear()
    target.data.materials.append(mat)
    target.data.shade_smooth()
    mod = target.modifiers.new("Smooth", "SMOOTH")
    mod.factor = 0.6
    mod.iterations = smooth
    sub = target.modifiers.new("Subdivision", "SUBSURF")
    sub.levels = sub.render_levels = 1
    return target


def build_model():
    """Build every mesh of the elf and return a dict of the objects by name."""
    mats = {
        # Skin shades warm, towards a rosy brown, not the cloth's forest green.
        "skin": material("Skin", "skin", roughness=0.65, subsurface=0.06, grain=0.0, shadow_tint="#9c5f55"),
        "eye_white": material("EyeWhite", "eye_white", roughness=0.3, grain=0.0),
        "iris": material("Iris", "iris", roughness=0.3, grain=0.0),
        "pupil": material("Pupil", "pupil", roughness=0.25, grain=0.0),
        "highlight": material("Highlight", "white", roughness=0.4, emission=PALETTE["white"],
                              emission_strength=0.6, grain=0.0),
        "tunic": material("Tunic", "tunic", roughness=0.8),
        "tunic_dark": material("TunicDark", "tunic_dark", roughness=0.8),
        "leaf": material("Leaf", "leaf", roughness=0.6, grain=0.0),
        "trim": material("Trim", "trim", roughness=0.5),
        "belt": material("Belt", "belt", roughness=0.6),
        "legging": material("Legging", "legging", roughness=0.85),
        "boot": material("Boot", "boot", roughness=0.6),
        "sole": material("Sole", "sole", roughness=0.8),
        "hair": material("Hair", "hair", roughness=0.55, grain=0.0),
        "hair_dark": material("HairDark", "hair_dark", roughness=0.55, grain=0.0),
        "acorn": material("Acorn", "acorn", roughness=0.55),
        "acorn_dark": material("AcornDark", "acorn_dark", roughness=0.6),
        "mushroom": material("Mushroom", "mushroom", roughness=0.5),
        "cream": material("Cream", "cream", roughness=0.7),
        "ear_inner": material("EarInner", "ear_inner", roughness=0.7, grain=0.0),
        "crown_twig": material("CrownTwig", "tunic_dark", roughness=0.8, grain=0.0),
        "crown_pink": material("CrownPink", "crown_pink", roughness=0.7, grain=0.0),
        "crown_white": material("CrownWhite", "cream", roughness=0.7, grain=0.0),
        "crown_yellow": material("CrownYellow", "crown_yellow", roughness=0.7, grain=0.0),
        "crown_heart": material("CrownHeart", "crown_heart", roughness=0.6, grain=0.0),
        "nightcap": material("Nightcap", "nightcap", roughness=0.85),
        "cape": material("Cape", "cape", roughness=0.85),
        # the wand's tip: a seed of warm light, the elder's crystal of cool light
        "wand_seed": material("WandSeed", "crown_yellow", roughness=0.4, emission=PALETTE["crown_yellow"],
                              emission_strength=4.0, grain=0.0),
        "wand_crystal": material("WandCrystal", "wand_crystal", roughness=0.25, emission=PALETTE["wand_crystal"],
                                 emission_strength=1.6, grain=0.0),
    }
    objs = {}
    hc = head_c()
    k = F.head_r / 0.36

    # --- Head: an egg fuller above the eyes and tapering to the chin, the
    # neck, the nose and the ears fused into one skin.
    head = sphere("Head", hc, F.head_r, "Body", mats["skin"], scale=head_scale(), segments=48, rings=32, subsurf=1)
    half = F.head_r * head_scale()[2]
    # The lower half tapers gently towards a rounded chin.
    for v in head.data.vertices:
        rel = v.co - hc
        if rel.z < 0:
            t = min(1.0, -rel.z / half)
            taper = 1.0 - form_look().get("chin", 0.26) * t ** 1.6
            v.co = hc + Vector((rel.x * taper, rel.y * taper, rel.z))
    b = form_look().get("body", 1.0)
    neck = tube("Neck", [(0, 0.01, F.shoulder_z - 0.08), (0, 0.01, F.shoulder_z + 0.10)], [0.08 * b, 0.075 * b], "Body",
                mats["skin"], segments=24, subsurf=1)
    nose = tube("Nose", [hp(0, -0.34, 0.01), hp(0, -0.362, -0.035), hp(0, -0.368, -0.06)],
                [0.01 * k, 0.016 * k, 0.021 * k], "Body", mats["skin"], segments=12, samples=8, subsurf=1)
    ears = []
    for side, suffix in ((1, "L"), (-1, "R")):
        ears.append(tube(f"Ear.{suffix}", ear_points(side), [0.1 * k, 0.085 * k, 0.05 * k, 0.006], "Body",
                         mats["skin"], flatten=(1.0, 0.55), ref=(0, 1, 0), segments=20, subsurf=1))
    objs["Head"] = fuse("Head", [head, neck, nose] + ears, mats["skin"], voxel=0.008)
    for side, suffix in ((1, "L"), (-1, "R")):
        s = side
        ear_pts = ear_points(s)
        inner_pts = [p + Vector((0, -0.04 * k, 0)) for p in ear_pts]
        inner_pts[0] = inner_pts[0] + Vector((0.05 * k * s, 0, 0))
        objs[f"EarInner.{suffix}"] = tube(f"EarInner.{suffix}", inner_pts, [0.055 * k, 0.046 * k, 0.027 * k, 0.003],
                                          "Body", mats["ear_inner"], flatten=(1.0, 0.45), ref=(0, 1, 0), subsurf=1)

    # --- Torso: an A-line tunic with a waist, round shoulders and sleeves,
    # fused into one cloth; the belt and the hem band ride on it.
    look = form_look()
    pelvis = pelvis_z()
    waist_z = pelvis + (F.shoulder_z - pelvis) * 0.35
    line = [(0, 0.0, F.shoulder_z), (0, 0.0, waist_z), (0, 0.0, F.hem_z)]
    girths = [F.chest_r, F.chest_r * 0.93, F.hem_r]
    if F.hem_z < pelvis - 0.05:
        # a robe: down the hips first, then flaring to the boots
        line.insert(2, (0, 0.0, pelvis - 0.05))
        girths.insert(2, F.chest_r * 1.02)
    torso = tube("Body", line, girths, "Body", mats["tunic"], segments=32, samples=12, flatten=(1.0, 0.8), subsurf=1)
    pieces = [torso]
    for side, suffix in ((1, "L"), (-1, "R")):
        s = side
        shoulder, elbow, hand = arm_points(s)
        pieces.append(sphere(f"Shoulder.{suffix}", shoulder + Vector((-0.02 * s, 0, 0.01)) * b, 0.08 * b, "Body",
                             mats["tunic"], scale=(1.0, 0.9, 1.0), subsurf=1))
        # Fitted sleeves, tapering to the wrist.
        pieces.append(tube(f"Arm.{suffix}", [shoulder, elbow, hand - (hand - elbow) * 0.2],
                           [0.066 * b, 0.054 * b, 0.046 * b], "Body", mats["tunic"], ref=(0, 1, 0), segments=20, subsurf=1))
    def girth(z):
        """The tunic's half-widths (x, y) at height z, read off the torso
        tube before the sleeves join it (they hang at belt height) and the
        smoothing of the fuse shrinks it a little."""
        ring = [v.co for v in torso.data.vertices if abs(v.co.z - z) < 0.03]
        return max(abs(v.x) for v in ring) - 0.008, max(abs(v.y) for v in ring) - 0.008

    waist_z_belt = waist_z - 0.02
    hem_x, hem_y = girth(F.hem_z + 0.015)
    belt_x, belt_y = girth(waist_z_belt)
    body = fuse("Body", pieces, mats["tunic"], voxel=0.01)
    objs["Body"] = body
    trim = mats["trim"] if look.get("trim") else mats["tunic_dark"]
    objs["Hem"] = torus("Hem", (0, 0, F.hem_z + 0.015), (hem_x - 0.012, hem_y - 0.012), (0.024 if not look.get("trim") else 0.03) * b,
                        "Body", trim, subsurf=1)
    belt_z = waist_z_belt
    if look.get("belt", True):
        objs["Belt"] = torus("Belt", (0, 0, belt_z), (belt_x - 0.008, belt_y - 0.008), 0.022 * b, "Body",
                             mats["belt"], subsurf=1)
        objs["Buckle"] = rounded_box("Buckle", (0, -(belt_y + 0.012 * b), belt_z), (0.09 * b, 0.03 * b, 0.08 * b), "Body",
                                     mats["acorn"], subsurf=2)
        objs["BucklePin"] = rounded_box("BucklePin", (0, -(belt_y + 0.03 * b), belt_z), (0.014 * b, 0.014 * b, 0.05 * b),
                                        "Body", mats["acorn_dark"], subsurf=2)
    if look.get("pouch"):
        objs["Pouch"] = rounded_box("Pouch", (-(belt_x - 0.01) * 0.78, -(belt_y - 0.01) * 0.62, belt_z - 0.07),
                                    (0.11, 0.06, 0.12), "Body", mats["acorn"], subsurf=2)
        objs["PouchFlap"] = rounded_box("PouchFlap", (-(belt_x - 0.01) * 0.78, -(belt_y - 0.01) * 0.62 - 0.02, belt_z - 0.035),
                                        (0.115, 0.03, 0.05), "Body", mats["acorn_dark"], subsurf=2)
    if look.get("stars"):
        for i, (x, z) in enumerate(((-0.12, 0.62), (0.1, 0.48), (-0.05, 0.36), (0.16, 0.3), (-0.2, 0.24), (0.03, 0.56))):
            hx, hy = girth(z)
            t = max(-0.9, min(0.9, x / hx))
            objs[f"Star{i}"] = sphere(f"Star{i}", (x, -hy * math.sqrt(1 - t * t) - 0.004, z), 1.0, "Body", mats["trim"],
                                      scale=(0.03, 0.006, 0.03), segments=8, rings=4, subsurf=0)
    for i in range(7):
        a = math.radians(-120 + 40 * i)
        base = Vector((math.sin(a) * F.chest_r * 0.72, -math.cos(a) * F.chest_r * 0.6, F.shoulder_z + 0.015))
        direction = Vector((math.sin(a), -math.cos(a) * 0.8, -0.55))
        objs[f"Collar{i}"] = leaf(f"Collar{i}", base, direction, 0.16 * b, 0.08 * b, "Body", mats["leaf"])

    for side, suffix in ((1, "L"), (-1, "R")):
        s = side
        shoulder, elbow, hand = arm_points(s)
        along = (hand - elbow).normalized()
        objs[f"Cuff.{suffix}"] = torus(f"Cuff.{suffix}", hand - along * 0.1 * b, 0.048 * b, 0.014 * b, "Body",
                                       mats["trim"] if form_look().get("trim") else mats["tunic_dark"], axis=along, subsurf=1)
        # Hands: a mitten, a flattened palm with a thumb on the inner side,
        # fused into one (fingers do not read at sprite size).
        palm = sphere(f"Hand.{suffix}", hand + Vector((0, 0, -0.01 * b)), 1.0, "Body", mats["skin"],
                      scale=(0.05 * b, 0.034 * b, 0.062 * b), subsurf=1)
        thumb = sphere(f"Thumb.{suffix}", hand + Vector((-0.042 * s, -0.02, 0.012)) * b, 0.026 * b, "Body", mats["skin"],
                       scale=(1.0, 0.9, 1.3), segments=16, rings=8, subsurf=1)
        objs[f"Hand.{suffix}"] = fuse(f"Hand.{suffix}", [palm, thumb], mats["skin"], voxel=0.0045, smooth=3)
        hip, knee, ankle = leg_points(s)
        objs[f"Leg.{suffix}"] = tube(f"Leg.{suffix}", [hip, knee, ankle], [0.08 * b, 0.064 * b, 0.056 * b], "Body",
                                     mats["legging"], ref=(0, 1, 0), segments=20, subsurf=1)
        bs = form_look().get("boots", 1.0)

        def bp(x, y, z):
            return (x * b, y * bs, z * bs)

        boot = sphere(f"Boot.{suffix}", bp(0.125 * s, -0.05, 0.085), 1.0, "Body", mats["boot"],
                      scale=(0.1 * bs, 0.155 * bs, 0.085 * bs), subsurf=1)
        shaft = tube(f"BootShaft.{suffix}", [bp(0.125 * s, -0.015, 0.06), bp(0.125 * s, -0.012, 0.19)], [0.075 * bs, 0.07 * bs],
                     "Body", mats["boot"], segments=20, subsurf=1)
        toe = tube(f"BootToe.{suffix}", [bp(0.125 * s, -0.16, 0.06), bp(0.125 * s, -0.24, 0.07), bp(0.125 * s, -0.27, 0.13)],
                   [0.058 * bs, 0.038 * bs, 0.012 * bs], "Body", mats["boot"], ref=(1, 0, 0), subsurf=1)
        objs[f"Boot.{suffix}"] = fuse(f"Boot.{suffix}", [boot, shaft, toe], mats["boot"], voxel=0.006, smooth=3)
        objs[f"BootCuff.{suffix}"] = torus(f"BootCuff.{suffix}", bp(0.125 * s, -0.012, 0.19), (0.078 * bs, 0.078 * bs), 0.018 * bs,
                                           "Body", mats["sole"], subsurf=1)
        objs[f"Sole.{suffix}"] = sphere(f"Sole.{suffix}", bp(0.125 * s, -0.07, 0.026), 1.0, "Body", mats["sole"],
                                        scale=(0.105 * bs, 0.18 * bs, 0.028 * bs), subsurf=1)

    # --- What a grown form carries and wears: the wand in the left hand
    # (the right one waves), the staff, the cape with its clasp, the
    # elder's long beard and hair -------------------------------------------
    look = form_look()
    if look.get("wand"):
        _, _, hand = arm_points(1)
        staff = look["wand"] == "staff"
        if staff:
            grip = Vector((hand.x + 0.03, hand.y - 0.02, 0.03))
            tip = Vector((hand.x - 0.02, hand.y - 0.03, F.head_c + F.head_r * 1.5))
            mid = grip.lerp(tip, 0.5) + Vector((0.02, 0.0, 0.0))
            radii = [0.024, 0.028, 0.03]
        else:
            grip = hand + Vector((0.0, -0.005, -0.11))
            tip = hand + Vector((0.09, -0.06, 0.44))
            mid = grip.lerp(tip, 0.55)
            radii = [0.026, 0.02, 0.015]
        objs["Wand.L"] = tube("Wand.L", [grip, mid, tip], radii, "Body", mats["acorn_dark"], ref=(0, 1, 0), segments=10,
                              samples=10, subsurf=1)
        glow = mats["wand_crystal"] if staff else mats["wand_seed"]
        top = tip + Vector((0, 0, 0.08 if staff else 0.045))
        objs["WandTip.L"] = sphere("WandTip.L", top, 0.07 if staff else 0.042, "Body", glow,
                                   scale=(0.75, 0.75, 1.5) if staff else (1, 1, 1.1), segments=16, rings=10, subsurf=1)
        if staff:
            # three prongs of the root hold the crystal
            for i in range(3):
                a = 2 * math.pi * i / 3 + 0.4
                arc = [tip + Vector((0, 0, -0.02)), tip + Vector((0.07 * math.cos(a), 0.07 * math.sin(a), 0.07)),
                       top + Vector((0.035 * math.cos(a), 0.035 * math.sin(a), 0.07))]
                objs[f"WandProng{i}.L"] = tube(f"WandProng{i}.L", arc, [0.016, 0.012, 0.006], "Body", mats["acorn_dark"],
                                               ref=(0, 1, 0), segments=8, samples=8, subsurf=1)
        objs["WandLeaf.L"] = leaf("WandLeaf.L", tip + Vector((-0.008, 0, -0.04 if not staff else -0.06)), (-0.6, -0.4, 0.5),
                                  0.1 if not staff else 0.13, 0.05 if not staff else 0.065, "Body", mats["leaf"])
    if look.get("cape"):
        # a forest cape from the shoulders to the knees, round the back and
        # the sides, open in front, its hood lying folded on the shoulders
        around, rows = 40, 14
        top_z, low_z = F.shoulder_z + 0.03, F.knee_z + 0.04
        verts, faces = [], []
        for i in range(around + 1):
            theta = math.pi * (0.56 + 0.88 * i / around)
            for j in range(rows + 1):
                t = j / rows
                z = top_z + (low_z - top_z) * t
                r = (F.chest_r + 0.075) + (F.hem_r + 0.2 - F.chest_r - 0.075) * t ** 1.3
                verts.append((r * math.sin(theta), -r * math.cos(theta) * 0.88, z))
        for i in range(around):
            for j in range(rows):
                v0, v1 = i * (rows + 1) + j, (i + 1) * (rows + 1) + j
                faces.append((v0, v1, v1 + 1, v0 + 1))
        me = bpy.data.meshes.new("Cape")
        me.from_pydata(verts, [], faces)
        cape = bpy.data.objects.new("Cape", me)
        collection("Body").objects.link(cape)
        me.materials.append(mats["cape"])
        for poly in me.polygons:
            poly.use_smooth = True
        thick = cape.modifiers.new("Cloth", "SOLIDIFY")
        thick.thickness = 0.014
        cape.modifiers.new("Smooth", "SUBSURF").levels = 1
        objs["Cape"] = cape
        objs["CapeHood"] = torus("CapeHood", (0, 0.03, F.shoulder_z + 0.04), (F.chest_r + 0.06, F.chest_r * 0.8 + 0.05), 0.055,
                                 "Body", mats["cape"], subsurf=1, arc=(-0.3, math.pi + 0.3))
        for side in (1, -1):
            objs[f"CapeClasp{'L' if side > 0 else 'R'}"] = sphere(f"CapeClasp{'L' if side > 0 else 'R'}",
                                                                   (0.14 * side, -(F.chest_r * 0.72), F.shoulder_z - 0.02), 0.03,
                                                                   "Body", mats["trim"], segments=16, rings=8, subsurf=1)
    if look.get("beard") == "long":
        chest_y = -(F.chest_r * 0.8 + 0.05)
        tufts = [
            sphere("Beard0", hp(0.0, -0.25, -0.33), 1.0, "Hair", mats["hair"], scale=(0.18 * k, 0.12 * k, 0.12 * k)),
            sphere("Beard1", hp(0.2, -0.16, -0.24), 1.0, "Hair", mats["hair"], scale=(0.08 * k, 0.08 * k, 0.11 * k)),
            sphere("Beard2", hp(-0.2, -0.16, -0.24), 1.0, "Hair", mats["hair"], scale=(0.08 * k, 0.08 * k, 0.11 * k)),
            sphere("Beard3", (0.0, chest_y, F.shoulder_z - 0.02), 1.0, "Hair", mats["hair"], scale=(0.15, 0.08, 0.12)),
            sphere("Beard4", (0.0, chest_y + 0.005, F.shoulder_z - 0.2), 1.0, "Hair", mats["hair"], scale=(0.12, 0.07, 0.12)),
            sphere("Beard5", (0.0, chest_y + 0.01, F.shoulder_z - 0.36), 1.0, "Hair", mats["hair"], scale=(0.07, 0.05, 0.09)),
        ]
        objs["Beard"] = fuse("Beard", tufts, mats["hair"], voxel=0.008, smooth=3)
    if look.get("hair_back"):
        objs["HairBack"] = tube("HairBack", [hp(0.0, 0.2, 0.1), hp(0.0, 0.3, -0.25), (0.0, 0.15, F.shoulder_z - 0.18)],
                                [0.25 * k, 0.24 * k, 0.17 * k], "Hair", mats["hair"], flatten=(1.0, 0.45), ref=(1, 0, 0),
                                segments=20, samples=10, subsurf=1)

    # --- Face --------------------------------------------------------------
    # The eyes' size and the brows' weight by form: k scales the eye and
    # everything that sits on it, the head's own scale stays in hp().
    head_k = k
    k = head_k * form_look().get("eyes", 1.0)
    brow_w = form_look().get("brows", 1.0)
    for side, suffix in ((1, "L"), (-1, "R")):
        s = side
        c = hp(EYE_C[0] * s, EYE_C[1], EYE_C[2])
        tilt = Matrix.Rotation(math.radians(-8 * s), 3, "Y")
        objs[f"EyeWhite.{suffix}"] = sphere(f"EyeWhite.{suffix}", c, 0.074 * k, "Face", mats["eye_white"],
                                            scale=(1.0, 0.55, 1.12), subsurf=1, rotation=tilt)
        objs[f"Iris.{suffix}"] = sphere(f"Iris.{suffix}", c + Vector((0.003 * s, -0.036, -0.004)) * k, 0.047 * k,
                                        "Face", mats["iris"], scale=(1.0, 0.4, 1.08), subsurf=1)
        objs[f"Pupil.{suffix}"] = sphere(f"Pupil.{suffix}", c + Vector((0.003 * s, -0.05, -0.004)) * k, 0.025 * k,
                                         "Face", mats["pupil"], scale=(1.0, 0.4, 1.12), subsurf=1)
        objs[f"Highlight.{suffix}"] = sphere(f"Highlight.{suffix}", c + Vector((0.022, -0.064, 0.03)) * k, 0.02 * k,
                                             "Face", mats["highlight"], scale=(1.0, 0.5, 1.0), segments=16,
                                             rings=8, subsurf=0)
        objs[f"HighlightSmall.{suffix}"] = sphere(f"HighlightSmall.{suffix}", c + Vector((-0.02, -0.062, -0.03)) * k,
                                                  0.01 * k, "Face", mats["highlight"], scale=(1.0, 0.5, 1.0),
                                                  segments=12, rings=6, subsurf=0)
        # Eyelid: the back hemisphere of a slightly larger sphere; a bone rotates it over the eye.
        objs[f"Eyelid.{suffix}"] = sphere(f"Eyelid.{suffix}", c, 0.08 * k, "Face", mats["skin"],
                                          scale=(1.0, 0.6, 1.16), subsurf=1, keep=lambda p: p.y > -0.005,
                                          rotation=tilt)
        # Lash line for the closed eye: rides on the eyelid bone, hidden inside the head at rest.
        objs[f"Lash.{suffix}"] = tube(f"Lash.{suffix}", [c + Vector((-0.056, 0.05, 0.026)) * k, c + Vector((0, 0.058, -0.002)) * k,
                                                          c + Vector((0.056, 0.05, 0.026)) * k],
                                      [0.008 * k, 0.011 * k, 0.008 * k], "Face", mats["pupil"], ref=(0, 1, 0),
                                      segments=8, samples=8, subsurf=1)
        # The upper lash: a thin dark arc along the top of the open eye, heavier at the outer corner.
        top = [c + Vector((-0.07 * s, -0.052, 0.045)) * k, c + Vector((0.0, -0.066, 0.075)) * k,
               c + Vector((0.07 * s, -0.056, 0.058)) * k]
        objs[f"LashTop.{suffix}"] = tube(f"LashTop.{suffix}", top, [0.004 * k, 0.009 * k, 0.012 * k], "Face",
                                         mats["pupil"], ref=(0, 1, 0), segments=8, samples=10, subsurf=1)
        brow = tube(f"Brow.{suffix}", [hp(0.05 * s, -0.342, 0.12), hp(0.14 * s, -0.33, 0.15), hp(0.23 * s, -0.292, 0.125)],
                    [0.009 * head_k * brow_w, 0.014 * head_k * brow_w, 0.006 * head_k * brow_w], "Face", mats["hair_dark"],
                    ref=(0, 1, 0), segments=8, samples=8, subsurf=1)
        add_shape_key(brow, "sad", lambda p, s=s: Vector((p.x, p.y, p.z + 0.035 * head_k * (1 - abs(p.x) / (0.235 * head_k)) - 0.015 * head_k)))
        objs[f"Brow.{suffix}"] = brow
    k = head_k
    mc = hp(0, -0.322, -0.145)
    mouth = sphere("Mouth", (0, 0, 0), 1.0, "Face", mats["pupil"], scale=(0.058 * k, 0.014 * k, 0.016 * k),
                   segments=24, rings=12, subsurf=1)
    # Rest shape: a thin gentle smile line sitting on the face surface.
    for v in mouth.data.vertices:
        t = v.co.x / (0.052 * k)
        v.co.z += 0.012 * k * (t * t - 0.5)
        v.co += mc
    add_shape_key(mouth, "open", lambda p: mc + Vector(((p.x - mc.x) * 0.85, (p.y - mc.y) * 1.2 + 0.012 * k,
                                                        (p.z - mc.z) * 3.4 - 0.018 * k)))
    add_shape_key(mouth, "smile", lambda p: mc + Vector(((p.x - mc.x) * 1.25, p.y - mc.y,
                                                         (p.z - mc.z) + 0.03 * k * (((p.x - mc.x) / (0.052 * k)) ** 2 - 0.5))))
    add_shape_key(mouth, "frown", lambda p: mc + Vector(((p.x - mc.x) * 0.8, p.y - mc.y,
                                                         (p.z - mc.z) - 0.032 * k * (((p.x - mc.x) / (0.052 * k)) ** 2 - 0.5))))
    objs["Mouth"] = mouth

    # --- Hair: a cap over the skull, a fringe swept to the character's left,
    # locks in front of the ears and tufts at the crown, fused into one mass
    # (the tufts follow the hood_tip bone through automatic weights).
    # The cap is a sphere shell cut to the hairstyle: a side-swept fringe
    # lying flat on the forehead, its edge cut into pointed strands, the
    # sides lower in front of the ears and tucked behind them, the back to
    # the nape; sideburns and two flat mounds of volume on top. All of it
    # fuses into one mass.
    cap_r = F.head_r + 0.035
    sprout = form_look().get("sprout", False)

    def hair_keep(p):
        n = p / cap_r
        if n.z > 0.55:
            return True
        if n.y > 0.1:
            return n.z > -0.55
        if abs(n.x) > 0.62:
            return n.y > -0.45 and n.z > -0.05 + 0.3 * (n.y + 0.2)
        strand = abs(((n.x * 2.4 + 0.3) % 2.0) - 1.0)
        edge = 0.47 - 0.12 * n.x - 0.11 * (1.0 - strand)
        return n.z > edge

    cap = sphere("Hair", hc + Vector((0, 0.012, 0.015)), cap_r, "Hair", mats["hair"], scale=head_scale(),
                 segments=64, rings=40, subsurf=1, keep=hair_keep)
    # The cut sphere is an open surface; the remesh needs a closed volume,
    # so the cap gets a thickness, grown inwards into the skull.
    shell = cap.modifiers.new("Shell", "SOLIDIFY")
    shell.thickness = 0.06
    shell.offset = -1.0
    strands = [cap]
    for side, suffix in ((1, "L"), (-1, "R")):
        s = side
        pts = [hp(0.31 * s, -0.14, 0.10), hp(0.335 * s, -0.19, -0.02), hp(0.34 * s, -0.21, -0.12)]
        strands.append(tube(f"Sideburn.{suffix}", pts, [0.04 * k, 0.03 * k, 0.006], "Hair", mats["hair"],
                            flatten=(0.45, 1.0), ref=(0, 1, 0), samples=8, segments=16, subsurf=1))
    for i, (x, y, z, r) in enumerate(((-0.08, 0.0, 0.43, 0.12), (0.14, 0.08, 0.41, 0.09))):
        strands.append(sphere(f"Mound{i}", hp(x, y, z), r * k, "Hair", mats["hair"], scale=(1.5, 1.3, 0.55), subsurf=1))
    objs["Hair"] = fuse("Hair", strands, mats["hair"], voxel=0.007, smooth=2)
    if sprout:
        # The hatchling's mark: a sprout of two leaves at the crown (it
        # rides the hood_tip bone, so it bobs with the tufts).
        stem = [hp(0.0, 0.03, 0.46), hp(0.02, 0.03, 0.56), hp(0.0, 0.02, 0.64)]
        objs["SproutStem"] = tube("SproutStem", stem, [0.02 * k, 0.017 * k, 0.013 * k], "Hair", mats["tunic_dark"],
                                  ref=(0, 1, 0), segments=8, samples=8, subsurf=1)
        objs["SproutLeaf.L"] = leaf("SproutLeaf.L", stem[-1], (0.7, -0.2, 0.55), 0.2 * k, 0.11 * k, "Hair", mats["leaf"])
        objs["SproutLeaf.R"] = leaf("SproutLeaf.R", stem[-1], (-0.7, -0.15, 0.6), 0.17 * k, 0.1 * k, "Hair", mats["leaf"])
    else:
        # A leaf tucked into the hair above the right ear: the forest elf's mark.
        objs["HairLeaf"] = leaf("HairLeaf", hp(-0.27, -0.14, 0.22), (-0.55, -0.45, 0.7), 0.19, 0.085, "Hair", mats["leaf"])
        objs["HairLeafStem"] = tube("HairLeafStem", [hp(-0.24, -0.11, 0.17), hp(-0.30, -0.16, 0.25)], [0.008, 0.006],
                                    "Hair", mats["tunic_dark"], segments=8, samples=4, subsurf=0)

    # --- Hats (cosmetics, rendered as their own layers later) --------------
    acorn = sphere("AcornCap", hc + Vector((0, 0.02, 0.17)), F.head_r + 0.07, "Hat/acornCap", mats["acorn"],
                   scale=(1.0, 1.0, 0.78), segments=40, rings=20, subsurf=1, outline=OUTLINE,
                   keep=lambda p: p.z > -0.02)
    objs["AcornCap"] = acorn
    objs["AcornRim"] = torus("AcornRim", hc + Vector((0, 0.02, 0.155)), F.head_r + 0.07, 0.03, "Hat/acornCap",
                             mats["acorn_dark"], subsurf=1, outline=OUTLINE)
    objs["AcornStalk"] = tube("AcornStalk", [hc + Vector((0, 0.02, 0.50)), hc + Vector((0.04, 0.03, 0.64)),
                                             hc + Vector((0.11, 0.05, 0.72))],
                              [0.045, 0.035, 0.03], "Hat/acornCap", mats["acorn_dark"], ref=(0, 1, 0), samples=8,
                              subsurf=1, outline=OUTLINE)
    mush = sphere("MushroomCap", hc + Vector((0, 0.03, 0.15)), F.head_r + 0.18, "Hat/mushroomCap", mats["mushroom"],
                  scale=(1.0, 1.0, 0.62), segments=48, rings=24, subsurf=1, outline=OUTLINE,
                  keep=lambda p: p.z > -0.04)
    objs["MushroomCap"] = mush
    objs["MushroomRim"] = torus("MushroomRim", hc + Vector((0, 0.03, 0.135)), F.head_r + 0.175, 0.035,
                                "Hat/mushroomCap", mats["cream"], subsurf=1, outline=OUTLINE)
    for i, (az, el, size) in enumerate(((-100, 50, 0.085), (-45, 70, 0.065), (20, 55, 0.075), (-150, 35, 0.06),
                                        (110, 45, 0.07), (-70, 25, 0.05), (60, 20, 0.055), (170, 65, 0.06))):
        d = Vector((math.cos(math.radians(el)) * math.sin(math.radians(az)),
                    -math.cos(math.radians(el)) * math.cos(math.radians(az)), math.sin(math.radians(el))))
        r = F.head_r + 0.18
        center = hc + Vector((0, 0.03, 0.15)) + Vector((d.x * r, d.y * r, d.z * r * 0.62))
        rot = d.to_track_quat("Z", "Y").to_matrix()
        objs[f"Dot{i}"] = sphere(f"Dot{i}", center, size, "Hat/mushroomCap", mats["cream"], scale=(1.0, 1.0, 0.3),
                                 segments=16, rings=8, subsurf=1, rotation=rot)
    # A crown of flowers: a ring of twigs round the hair, tilted back a
    # little, with flowers and leaves on its front half.
    crown_c = hc + Vector((0, 0.01, 0.2 * k))
    tilt = Matrix.Rotation(math.radians(-14), 3, "X")
    objs["CrownRing"] = torus("CrownRing", crown_c, (F.head_r + 0.035, (F.head_r + 0.035) * 0.95), 0.016, "Hat/flowerCrown",
                              mats["crown_twig"], axis=tilt @ Vector((0, 0, 1)), subsurf=1, outline=OUTLINE)
    petals = ("crown_pink", "crown_white", "crown_yellow")
    for i in range(9):
        a = math.radians(-160 + 140 * i / 8 - 10)
        r = F.head_r + 0.045
        p = crown_c + tilt @ Vector((math.cos(a) * r, math.sin(a) * r * 0.95, 0.0))
        face = (p - hc).normalized()
        rot = face.to_track_quat("Z", "Y").to_matrix()
        mat = mats[petals[i % 3]]
        for j in range(5):
            b = 2 * math.pi * j / 5
            offset = rot @ Vector((math.cos(b) * 0.03, math.sin(b) * 0.03, 0.0))
            objs[f"Petal{i}_{j}"] = sphere(f"Petal{i}_{j}", p + offset, 0.024, "Hat/flowerCrown", mat,
                                           scale=(1.0, 1.0, 0.35), segments=12, rings=6, subsurf=0, rotation=rot)
        objs[f"FlowerHeart{i}"] = sphere(f"FlowerHeart{i}", p + rot @ Vector((0, 0, 0.012)), 0.016, "Hat/flowerCrown",
                                         mats["crown_heart"], segments=10, rings=6, subsurf=0)
        if i % 2 == 0:
            a2 = a + math.radians(9)
            q = crown_c + tilt @ Vector((math.cos(a2) * r, math.sin(a2) * r * 0.95, -0.02))
            objs[f"CrownLeaf{i}"] = leaf(f"CrownLeaf{i}", q, (q - hc).normalized() + Vector((0, 0, -0.6)), 0.09, 0.045,
                                         "Hat/flowerCrown", mats["leaf"])
    # A nightcap: a soft cone flopping over to the elf's left, a cream brim
    # and a pompom at the tip.
    cap = [hc + Vector((0, 0.02, 0.15 * k)), hc + Vector((0.02, 0.03, 0.4 * k)), hc + Vector((0.12, 0.05, 0.6 * k)),
           hc + Vector((0.3, 0.06, 0.64 * k)), hc + Vector((0.44, 0.05, 0.52 * k))]
    objs["Nightcap"] = tube("Nightcap", cap, [F.head_r + 0.045, 0.26 * k, 0.14 * k, 0.06 * k, 0.02], "Hat/nightcap",
                            mats["nightcap"], ref=(0, 1, 0), samples=16, subsurf=1, outline=OUTLINE, cap_start=False)
    objs["NightcapBrim"] = torus("NightcapBrim", hc + Vector((0, 0.02, 0.16 * k)), F.head_r + 0.05, 0.04, "Hat/nightcap",
                                 mats["cream"], subsurf=1, outline=OUTLINE)
    objs["NightcapPompom"] = sphere("NightcapPompom", cap[-1] + Vector((0.01, 0, -0.04)), 0.06, "Hat/nightcap",
                                    mats["cream"], subsurf=1, outline=OUTLINE)
    for hat in HAT_IDS[1:]:
        collection(f"Hat/{hat}").hide_render = True

    # Body shape keys: squash and stretch about the hem.
    pivot = F.hem_z - 0.1
    add_shape_key(body, "squash", lambda p: Vector((p.x * 1.15, p.y * 1.15, pivot + (p.z - pivot) * 0.82)))
    add_shape_key(body, "stretch", lambda p: Vector((p.x * 0.9, p.y * 0.9, pivot + (p.z - pivot) * 1.18)))

    # The ink skips the parts that are painted on, and the eyelids hide
    # without drawing (the lash line draws the closed eye).
    for name, obj in objs.items():
        base = name.partition(".")[0]
        if base in ("Highlight", "HighlightSmall", "Iris", "Pupil", "LashTop") or base.startswith("Dot"):
            obj.lineart.usage = "EXCLUDE"
        elif base == "Eyelid":
            obj.lineart.usage = "OCCLUSION_ONLY"
    return objs, mats


# ---------------------------------------------------------------------------
# Armature and binding
# ---------------------------------------------------------------------------

def bones_for(form):
    """The bone table (name, head, tail, parent, deform) for a form."""
    global F
    previous, F = F, form
    crown = F.head_c + F.head_r * head_scale()[2]
    pelvis = pelvis_z()
    bones = [
        ("root", (0, 0, 0), (0, 0, 0.25), None, False),
        ("hips", (0, 0, pelvis), (0, 0, pelvis + 0.13), "root", True),
        ("spine", (0, 0, pelvis + 0.13), (0, 0, pelvis + 0.28), "hips", True),
        ("chest", (0, 0, pelvis + 0.28), (0, 0, F.shoulder_z - 0.05), "spine", True),
        ("neck", (0, 0, F.shoulder_z - 0.05), (0, 0, F.shoulder_z + 0.10), "chest", True),
        ("head", (0, 0, F.shoulder_z + 0.10), (0, 0, crown), "neck", True),
        ("hood_tip", tuple(hp(0.0, 0.10, 0.36)), tuple(hp(0.15, 0.19, 0.60)), "head", True),
    ]
    for s, sfx in ((1, "L"), (-1, "R")):
        ear = ear_points(s)
        eye = hp(EYE_C[0] * s, EYE_C[1], EYE_C[2])
        shoulder, elbow, hand = arm_points(s)
        hip, knee, ankle = leg_points(s)
        bones += [
            (f"ear.{sfx}", tuple(ear[0]), tuple(ear[3]), "head", True),
            (f"eyelid.{sfx}", tuple(eye), tuple(eye + Vector((0.1, 0, 0))), "head", True),
            (f"upper_arm.{sfx}", tuple(shoulder), tuple(elbow), "chest", True),
            (f"forearm.{sfx}", tuple(elbow), tuple(hand), f"upper_arm.{sfx}", True),
            (f"hand.{sfx}", tuple(hand), tuple(hand + Vector((0.02 * s, -0.06, -0.12))), f"forearm.{sfx}", True),
            (f"thigh.{sfx}", tuple(hip), tuple(knee), "hips", True),
            (f"shin.{sfx}", tuple(knee), tuple(ankle), f"thigh.{sfx}", True),
            (f"foot.{sfx}", tuple(ankle), (0.13 * s, -0.22, 0.05), f"shin.{sfx}", True),
            # The arm's IK: the target the hand reaches for and the pole the elbow points at.
            (f"hand_ik.{sfx}", tuple(hand), tuple(hand + Vector((0, 0, -0.1))), "root", False),
            (f"elbow_pole.{sfx}", tuple(elbow + Vector((0.3 * s, 0.4, 0))), tuple(elbow + Vector((0.3 * s, 0.5, 0))), "root", False),
        ]
    F = previous
    return bones


BONES = bones_for(F)
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
    for side in ("L", "R"):
        ik = arm.pose.bones[f"forearm.{side}"].constraints.new("IK")
        ik.target = arm
        ik.subtarget = f"hand_ik.{side}"
        ik.pole_target = arm
        ik.pole_subtarget = f"elbow_pole.{side}"
        ik.chain_count = 2
        ik.use_stretch = False
        calibrate_pole(arm, side, ik)
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm


def calibrate_pole(arm, side, ik):
    """Find the pole angle at which the IK, with its target at rest, leaves
    the elbow where the rest pose has it (the elbow bends the way it was
    modelled); a coarse then a fine search over the angle."""
    rest = Vector(arm.data.bones[f"forearm.{side}"].head_local)
    forearm = arm.pose.bones[f"forearm.{side}"]

    def error(deg):
        ik.pole_angle = math.radians(deg)
        bpy.context.view_layer.update()
        return (forearm.head - rest).length

    coarse = min(range(-180, 180, 5), key=error)
    best = min(range(coarse - 5, coarse + 6), key=error)
    print(f"[elf] pole angle {side}: {best} deg, elbow off by {error(best) * 1000:.1f} mm")


def bind_auto(arm, obj, bones, corrective=False):
    """Parent with automatic weights, limited to the given bones; a fused
    mesh also gets a Corrective Smooth after the armature against pinching."""
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
    if corrective:
        mod = obj.modifiers.new("Corrective", "CORRECTIVE_SMOOTH")
        mod.iterations = 5
        obj.modifiers.move(len(obj.modifiers) - 1, 1)


def keep_arms_off_torso(obj):
    """Automatic weights spread the arm bones into the fused torso, which
    then narrows at the waist when an arm rises; inside the torso column
    the arm weights go to the chest instead."""
    arm_groups = {g.index: g for g in obj.vertex_groups if g.name.startswith(("upper_arm", "forearm"))}
    chest = obj.vertex_groups["chest"]
    moved_total = 0.0
    for v in obj.data.vertices:
        if abs(v.co.x) > F.chest_r + 0.03 or v.co.z > F.shoulder_z - 0.02:
            continue
        weights = {e.group: e.weight for e in v.groups}
        moved = sum(w for g, w in weights.items() if g in arm_groups)
        if moved <= 0:
            continue
        for g in arm_groups:
            if g in weights:
                arm_groups[g].add([v.index], 0.0, "REPLACE")
        chest.add([v.index], min(1.0, weights.get(chest.index, 0.0) + moved), "REPLACE")
        moved_total += moved
    print(f"[elf] arm weight moved off the torso: {moved_total:.1f}")


def bind_tuft(arm, obj):
    """The hair rides the head, and the crown blends over to the hood_tip
    bone with its height, so the clips' tuft keys still give the hair a
    little bounce (heat weights fail on the fused hair mass, so the weights
    are set by region)."""
    bind_rigid(arm, obj, "head")
    head_group = obj.vertex_groups["head"]
    tip_group = obj.vertex_groups.new(name="hood_tip")
    base = hp(0.0, 0.0, 0.40)
    for v in obj.data.vertices:
        rel = v.co - base
        if rel.z < 0:
            continue
        w = min(0.7, rel.z / (0.12 * F.head_r / 0.36))
        if w > 0:
            tip_group.add([v.index], w, "REPLACE")
            head_group.add([v.index], 1.0 - w, "REPLACE")


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


# Parts that ride one bone; everything on the head not listed here rides "head".
RIGID_BINDS = {
    "Hem": "hips", "Belt": "hips", "Buckle": "hips", "BucklePin": "hips",
}


def bind_all(arm, objs):
    for name, obj in objs.items():
        base, _, side = name.partition(".")
        if name in RIGID_BINDS:
            bind_rigid(arm, obj, RIGID_BINDS[name])
        elif base.startswith("Collar"):
            bind_rigid(arm, obj, "chest")
        elif base in ("Eyelid", "Lash"):
            bind_rigid(arm, obj, f"eyelid.{side}")
        elif base in ("Hand", "Cuff", "Wand", "WandTip", "WandLeaf") or base.startswith("WandProng"):
            bind_rigid(arm, obj, f"hand.{side}")
        elif base.startswith("Cape"):
            bind_rigid(arm, obj, "chest")
        elif base.startswith(("Pouch", "Star")):
            bind_rigid(arm, obj, "hips")
        elif base in ("SproutStem", "SproutLeaf"):
            bind_rigid(arm, obj, "hood_tip")
        elif base in ("Boot", "BootCuff", "Sole"):
            bind_rigid(arm, obj, f"foot.{side}")
        elif base == "Body":
            bind_auto(arm, obj, ["hips", "spine", "chest", "upper_arm.L", "forearm.L", "upper_arm.R", "forearm.R"],
                      corrective=True)
            keep_arms_off_torso(obj)
        elif base == "Head":
            bind_auto(arm, obj, ["head", "neck", "ear.L", "ear.R"], corrective=True)
        elif base == "Hair":
            bind_tuft(arm, obj)
        elif base == "Leg":
            bind_auto(arm, obj, [f"thigh.{side}", f"shin.{side}"])
        elif base == "EarInner":
            bind_auto(arm, obj, [f"ear.{side}", "head"])
        else:
            bind_rigid(arm, obj, "head")


# ---------------------------------------------------------------------------
# Animation
# ---------------------------------------------------------------------------

class Rig:
    """Keyframing helper that talks in world axes and manages one action per clip.

    Poses are given as world things: a bone's offset or rotation, a hand's
    position (the IK targets move the arms), a point the head looks at.
    Every key may carry its own easing. When a clip is finished, the ears
    and the crown of the hair get their lag from the motion itself: they
    swing against the head's and the body's recent velocity (follow-through),
    on top of a resting angle the clip may set for its mood."""

    def __init__(self, arm, objs):
        self.arm = arm
        self.objs = objs
        self.rest = {b.name: b.matrix_local.to_3x3() for b in arm.data.bones}
        self.rest_head = {b.name: Vector(b.head_local) for b in arm.data.bones}
        self.keys = {
            "squash": objs["Body"], "stretch": objs["Body"],
            "open": objs["Mouth"], "smile": objs["Mouth"], "frown": objs["Mouth"],
            "sad.L": objs["Brow.L"], "sad.R": objs["Brow.R"],
        }
        self.clips = {}
        self.actions = {}
        self.loops = {}
        self.eases = {}
        self.mood = {}

    # -- clip management --------------------------------------------------
    def begin(self, name, length, loop=True):
        """Start a clip of `length` frames; frame length + 1 equals frame 1 for
        a loop and is the rest pose a one-shot settles into."""
        self.current = name
        self.clips[name] = (1, length)
        self.loops[name] = loop
        self.eases = {}
        self.mood = {"ear": 0.0, "crown": 0.0}
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
        """Close the clip: the followers get their lag, then every key its easing."""
        self.follow_through()
        for act in self.actions[self.current].values():
            for layer in act.layers:
                for strip in layer.strips:
                    for bag in strip.channelbags:
                        for fc in bag.fcurves:
                            for kp in fc.keyframe_points:
                                interp, easing = self.eases.get((fc.data_path, round(kp.co.x)), ("BEZIER", "EASE_IN_OUT"))
                                kp.interpolation = interp
                                kp.easing = easing
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

    def _ease(self, data_path, frame, ease):
        if ease is not None:
            interp, easing = ease if isinstance(ease, tuple) else ("BEZIER", ease)
            self.eases[(data_path, frame)] = (interp, easing)

    def bone(self, name, frame, move=None, rot=None, scale=None, ease=None):
        """Key a bone: move is a world offset, rot is (world_axis, degrees) or a
        list of them, scale is (xy, z) world. `ease` is an easing name
        ('EASE_OUT', 'EASE_IN', 'EASE_IN_OUT') or (interpolation, easing),
        such as ('BACK', 'EASE_OUT') for an overshoot."""
        pb = self.arm.pose.bones[name]
        rest = self.rest[name]
        path = f'pose.bones["{name}"].'
        if move is not None:
            pb.location = rest.inverted() @ Vector(move)
            pb.keyframe_insert("location", frame=frame)
            self._ease(path + "location", frame, ease)
        if rot is not None:
            rots = [rot] if isinstance(rot[1], (int, float)) else rot
            world = Matrix.Identity(3)
            for axis, deg in rots:
                world = Matrix.Rotation(math.radians(deg), 3, Vector(axis).normalized()) @ world
            pb.rotation_euler = (rest.inverted() @ world @ rest).to_euler("XYZ")
            pb.keyframe_insert("rotation_euler", frame=frame)
            self._ease(path + "rotation_euler", frame, ease)
        if scale is not None:
            sx, sy, sz = scale
            # World-space (xy, z) scale expressed in the bone's local frame (bones here point up).
            pb.scale = (sx, sz, sy) if abs(rest.col[1].z) > 0.7 else (sx, sy, sz)
            pb.keyframe_insert("scale", frame=frame)
            self._ease(path + "scale", frame, ease)

    def shape(self, key, frame, value, ease=None):
        obj = self.keys[key]
        name = key.split(".")[0]
        kb = obj.data.shape_keys.key_blocks[name]
        kb.value = value
        kb.keyframe_insert("value", frame=frame)
        self._ease(f'key_blocks["{name}"].value', frame, ease)

    # -- compound helpers -----------------------------------------------
    def squash(self, frame, amount, ease=None):
        """amount > 0 squashes (wider, shorter), amount < 0 stretches."""
        self.bone("root", frame, scale=(1 + 0.5 * amount, 1 + 0.5 * amount, 1 - amount), ease=ease)
        self.shape("squash", frame, max(0.0, amount) * 1.5, ease=ease)
        self.shape("stretch", frame, max(0.0, -amount) * 1.5, ease=ease)

    def hand(self, side, frame, point, ease=None):
        """Put a hand at a world point; the IK solves the arm."""
        self.bone(f"hand_ik.{side}", frame, move=Vector(point) - self.rest_head[f"hand.{side}"], ease=ease)

    def hands(self, frame, left, right=None, ease=None):
        """Both hands, the right mirrored from the left unless given."""
        self.hand("L", frame, left, ease)
        self.hand("R", frame, right if right is not None else (-left[0], left[1], left[2]), ease)

    def look(self, frame, point, amount=1.0, roll=0.0, ease=None):
        """Turn the head towards a world point (the face looks down -Y at rest),
        within a comfortable range, with an optional roll for charm."""
        centre = self.rest_head["head"] + Vector((0, 0, F.head_r * 0.7))
        d = Vector(point) - centre
        yaw = max(-35.0, min(35.0, math.degrees(math.atan2(d.x, -d.y)))) * amount
        pitch = max(-25.0, min(25.0, -math.degrees(math.atan2(d.z, math.hypot(d.x, d.y))))) * amount
        self.bone("head", frame, rot=[((1, 0, 0), pitch), ((0, 0, 1), yaw), ((0, 1, 0), roll)], ease=ease)

    def blink(self, frame, amount, ease=None):
        for side in ("L", "R"):
            self.bone(f"eyelid.{side}", frame, rot=((1, 0, 0), 180.0 * amount), ease=ease)

    def brows_sad(self, frame, value, ease=None):
        self.shape("sad.L", frame, value, ease)
        self.shape("sad.R", frame, value, ease)

    def breath(self, length, depth=0.025, lift=0.012, phase=0.0):
        """A breathing cycle over the whole clip: the chest swells, the hips lift."""
        for f in range(1, length + 2, 4):
            ph = 2 * math.pi * (f - 1) / length + phase
            s = math.sin(ph)
            self.bone("chest", f, scale=(1 + depth * s, 1 + depth * s, 1 + depth * 1.6 * s))
            self.bone("hips", f, move=(0, 0, lift * s))

    # -- follow-through ---------------------------------------------------
    EAR_PER_LIFT = -420.0   # degrees of ear flap per metre/frame of the body rising
    EAR_PER_ROLL = 5.0      # degrees of ear swing per degree/frame of head roll
    CROWN_PER_LIFT = -300.0
    CROWN_PER_PITCH = 4.0
    LAG = 2                 # frames the followers trail the motion by

    def follow_through(self):
        """Key the ears and the crown of the hair against the head's and the
        body's velocity a couple of frames earlier, so they trail and flap
        instead of moving as one block with the head. A loop samples around
        its end; a one-shot is at rest before its first frame."""
        name = self.current
        start, length = self.clips[name]
        loop = self.loops[name]
        self.apply(name)
        scene = bpy.context.scene
        head, root = self.arm.pose.bones["head"], self.arm.pose.bones["root"]
        samples = []
        for f in range(1, length + 2):
            scene.frame_set(f)
            axis = head.matrix.to_3x3().col[1]
            pitch = math.degrees(math.atan2(-axis.y, axis.z))
            roll = math.degrees(math.atan2(axis.x, axis.z))
            samples.append((pitch, roll, root.matrix.translation.z))

        def at(f):
            if loop:
                return samples[(f - 1) % length]
            return samples[max(0, min(length, f - 1))] if f >= 1 else samples[0]

        ear_mood, crown_mood = self.mood["ear"], self.mood["crown"]
        for f in range(1, length + 2):
            a, b = at(f - self.LAG - 1), at(f - self.LAG)
            dpitch, droll, dz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
            flap = max(-30.0, min(30.0, self.EAR_PER_LIFT * dz))
            swing = max(-15.0, min(15.0, self.EAR_PER_ROLL * droll))
            for side, s in (("L", 1), ("R", -1)):
                up = ear_mood + flap - swing * s
                self.bone(f"ear.{side}", f, rot=((0, 1, 0), -up * s))
            nod = max(-20.0, min(20.0, self.CROWN_PER_PITCH * dpitch + self.CROWN_PER_LIFT * dz))
            self.bone("hood_tip", f, rot=[((1, 0, 0), -nod), ((0, 1, 0), crown_mood)])


def build_clips(rig):
    """Author every clip. Frame 1 is the first frame; a loop returns to it at
    length + 1, a one-shot settles into the rest pose there (so the switch
    back to idle is not a cut). The hands are placed, the arms follow."""
    L = {s: rig.rest_head[f"hand.{s}"].copy() for s in ("L", "R")}
    camera = (0.0, -6.0, 1.45)

    # idle: 48 frames, breath, a weight shift, a glance aside and back, a blink.
    rig.begin("idle", 48, loop=True)
    rig.breath(48)
    for f in range(1, 50, 4):
        ph = 2 * math.pi * (f - 1) / 48
        rig.bone("hips", f, move=(0.01 * math.sin(ph), 0, 0.012 * math.sin(ph)))
        rig.bone("root", f, rot=((0, 1, 0), 1.2 * math.sin(ph)))
    rig.look(1, camera)
    rig.look(14, camera, ease="EASE_IN_OUT")
    rig.look(22, (1.6, -5.0, 1.5), roll=3, ease="EASE_IN_OUT")
    rig.look(34, (1.6, -5.0, 1.5), roll=3)
    rig.look(42, camera, ease="EASE_IN_OUT")
    rig.look(49, camera)
    rig.shape("smile", 1, 0.25)
    rig.shape("smile", 49, 0.25)
    rig.blink(27, 0.0)
    rig.blink(29, 1.0, ease="EASE_OUT")
    rig.blink(30, 1.0)
    rig.blink(33, 0.0, ease="EASE_IN")
    rig.finish()

    # happy: 36 frames, a crouch, two hops with the arms thrown up, a settle.
    rig.begin("happy", 36, loop=False)
    up = (0.62, -0.2, 1.42)
    rig.squash(1, 0.0)
    rig.squash(4, 0.16, ease="EASE_OUT")
    rig.bone("root", 4, move=(0, 0, 0))
    rig.bone("root", 6, move=(0, 0, 0.09), ease="EASE_OUT")
    rig.squash(6, -0.12)
    rig.bone("root", 10, move=(0, 0, 0.21), ease="EASE_OUT")
    rig.squash(10, -0.03)
    rig.bone("root", 14, move=(0, 0, 0.0), ease="EASE_IN")
    rig.squash(14, 0.17, ease="EASE_OUT")
    rig.squash(16, -0.06)
    rig.bone("root", 18, move=(0, 0, 0.07), ease="EASE_OUT")
    rig.squash(18, -0.1)
    rig.bone("root", 22, move=(0, 0, 0.19), ease="EASE_OUT")
    rig.squash(22, -0.03)
    rig.bone("root", 26, move=(0, 0, 0.0), ease="EASE_IN")
    rig.squash(26, 0.15, ease="EASE_OUT")
    rig.squash(29, -0.05)
    rig.squash(32, 0.02)
    rig.squash(37, 0.0)
    rig.hands(1, L["L"])
    rig.hands(4, (L["L"].x + 0.02, L["L"].y + 0.06, L["L"].z - 0.04), ease="EASE_OUT")
    rig.hands(10, up, ease=("BACK", "EASE_OUT"))
    rig.hands(14, (up[0] - 0.02, up[1], up[2] - 0.04))
    rig.hands(22, (up[0] + 0.03, up[1] - 0.02, up[2] + 0.02))
    rig.hands(27, (up[0] - 0.02, up[1], up[2] - 0.08))
    rig.hands(32, (0.36, -0.16, 1.1), ease="EASE_IN_OUT")
    rig.hands(37, L["L"], ease="EASE_OUT")
    rig.look(1, camera)
    rig.look(10, (0, -6, 3.0), ease="EASE_OUT")
    rig.look(14, camera)
    rig.look(22, (0, -6, 2.8), ease="EASE_OUT")
    rig.look(26, camera)
    rig.look(37, camera)
    rig.shape("smile", 1, 0.25)
    rig.shape("smile", 4, 1.0)
    rig.shape("open", 6, 0.6)
    rig.shape("open", 14, 0.1)
    rig.shape("open", 18, 0.6)
    rig.shape("open", 26, 0.0)
    rig.shape("smile", 30, 1.0)
    rig.shape("smile", 37, 0.25)
    rig.finish()

    # sad: 24-frame loop, slumped, swaying slowly, a sigh in the middle.
    rig.begin("sad", 24, loop=True)
    rig.mood.update(ear=-26.0, crown=16.0)
    for f in range(1, 26, 4):
        ph = 2 * math.pi * (f - 1) / 24
        rig.bone("hips", f, move=(0.008 * math.sin(ph), 0, -0.045))
        rig.bone("root", f, rot=((0, 1, 0), 2.0 * math.sin(ph)))
        rig.bone("chest", f, rot=((1, 0, 0), 10.0))
    rig.bone("chest", 9, scale=(1.0, 1.0, 1.0))
    rig.bone("chest", 13, scale=(1.03, 1.03, 1.04), ease="EASE_OUT")
    rig.bone("chest", 21, scale=(1.0, 1.0, 1.0), ease="EASE_IN")
    for f in (1, 9, 13, 21, 25):
        rig.bone("head", f, rot=((1, 0, 0), 16.0 if f in (1, 9, 25) else 13.0))
    rig.hands(1, (L["L"].x - 0.02, L["L"].y + 0.03, L["L"].z - 0.03))
    rig.hands(25, (L["L"].x - 0.02, L["L"].y + 0.03, L["L"].z - 0.03))
    rig.brows_sad(1, 1.0)
    rig.brows_sad(25, 1.0)
    rig.shape("frown", 1, 1.0)
    rig.shape("frown", 25, 1.0)
    rig.blink(1, 0.3)
    rig.blink(25, 0.3)
    rig.finish()

    # sleep: 48-frame loop, eyes closed, deep breath, the head nodding off.
    rig.begin("sleep", 48, loop=True)
    rig.mood.update(ear=-18.0, crown=12.0)
    rig.breath(48, depth=0.04, lift=0.0)
    for f in range(1, 50, 4):
        ph = 2 * math.pi * (f - 1) / 48
        rig.bone("hips", f, move=(0, 0, -0.03 + 0.01 * math.sin(ph)))
        rig.bone("root", f, rot=((0, 1, 0), 1.5 * math.sin(ph)))
        rig.bone("head", f, rot=[((1, 0, 0), 12 + 2.0 * math.sin(ph)), ((0, 1, 0), 6)])
    rig.blink(1, 1.0)
    rig.blink(49, 1.0)
    rig.shape("open", 1, 0.2)
    rig.shape("open", 49, 0.2)
    rig.finish()

    # pet: 24 frames, leans into the hand, squints and smiles, springs back.
    rig.begin("pet", 24, loop=False)
    rig.mood.update(ear=8.0)
    rig.squash(1, 0.0)
    rig.squash(4, 0.14, ease="EASE_OUT")
    rig.squash(9, -0.1, ease=("BACK", "EASE_OUT"))
    rig.squash(14, 0.04)
    rig.squash(19, -0.02)
    rig.squash(25, 0.0)
    rig.look(1, camera)
    rig.look(7, camera, roll=14, ease="EASE_OUT")
    rig.look(17, camera, roll=10)
    rig.look(25, camera, ease="EASE_IN_OUT")
    rig.bone("root", 1, rot=((0, 1, 0), 0))
    rig.bone("root", 8, rot=((0, 1, 0), 4), ease="EASE_OUT")
    rig.bone("root", 18, rot=((0, 1, 0), 3))
    rig.bone("root", 25, rot=((0, 1, 0), 0))
    rig.shape("smile", 4, 1.0, ease="EASE_OUT")
    rig.shape("smile", 19, 1.0)
    rig.shape("smile", 25, 0.0)
    rig.blink(3, 0.0)
    rig.blink(7, 0.6, ease="EASE_OUT")
    rig.blink(18, 0.6)
    rig.blink(23, 0.0)
    rig.finish()

    # feed: 36 frames, the hands bring the food to the mouth, two bites, a happy settle.
    rig.begin("feed", 36, loop=False)
    mouth = (0.07, -0.36, 1.12)
    rig.hands(1, L["L"])
    rig.hands(6, mouth, ease=("BACK", "EASE_OUT"))
    rig.hands(18, (mouth[0], mouth[1] + 0.01, mouth[2] - 0.01))
    rig.hands(24, (L["L"].x, L["L"].y - 0.02, L["L"].z + 0.03), ease="EASE_IN_OUT")
    rig.hands(37, L["L"])
    rig.look(1, camera)
    rig.look(6, (0, -6, 0.6), ease="EASE_OUT")
    rig.look(18, (0, -6, 0.6))
    rig.look(24, camera, ease="EASE_IN_OUT")
    rig.look(37, camera)
    for s in (6, 13):
        rig.shape("open", s, 0.0)
        rig.shape("open", s + 3, 0.9, ease="EASE_OUT")
        rig.shape("open", s + 6, 0.0, ease="EASE_IN")
    rig.squash(22, 0.0)
    rig.squash(26, 0.11, ease="EASE_OUT")
    rig.squash(30, -0.04)
    rig.squash(37, 0.0)
    rig.shape("smile", 22, 0.0)
    rig.shape("smile", 26, 1.0)
    rig.shape("smile", 33, 1.0)
    rig.shape("smile", 37, 0.0)
    rig.blink(24, 0.0)
    rig.blink(27, 0.5)
    rig.blink(31, 0.0)
    rig.finish()

    # wave: 36 frames, the right arm up beside the head, three waves from the
    # elbow, a head tilt, the arm down and a settle.
    rig.begin("wave", 36, loop=False)
    high = Vector((-0.47, -0.24, 1.2))
    rig.hand("R", 1, L["R"])
    rig.hand("R", 6, high, ease=("BACK", "EASE_OUT"))
    for i, dx in enumerate((-0.09, 0.08, -0.09, 0.08, -0.04)):
        rig.hand("R", 9 + 3 * i, high + Vector((dx, 0.0, 0.03 if dx < 0 else -0.02)), ease="EASE_IN_OUT")
    rig.hand("R", 30, (L["R"].x - 0.06, L["R"].y - 0.05, L["R"].z + 0.12), ease="EASE_IN_OUT")
    rig.hand("R", 37, L["R"], ease="EASE_OUT")
    rig.bone("hand.R", 1, rot=((0, 1, 0), 0))
    for i, deg in enumerate((18, -18, 18, -18, 8)):
        rig.bone("hand.R", 9 + 3 * i, rot=((0, 1, 0), deg), ease="EASE_IN_OUT")
    rig.bone("hand.R", 30, rot=((0, 1, 0), 0))
    rig.look(1, camera)
    rig.look(7, camera, roll=-7, ease="EASE_OUT")
    rig.look(24, camera, roll=-7)
    rig.look(32, camera, ease="EASE_IN_OUT")
    rig.look(37, camera)
    rig.shape("smile", 4, 0.0)
    rig.shape("smile", 8, 0.9, ease="EASE_OUT")
    rig.shape("smile", 26, 0.9)
    rig.shape("smile", 37, 0.0)
    rig.finish()
    return rig.clips


# ---------------------------------------------------------------------------
# Review renders
# ---------------------------------------------------------------------------

# The frame and the camera: 300 pixels to the metre, the feet (the world
# origin) FEET_MARGIN_PX above the bottom edge, headroom above the crown
# (about 1.9 m with the tuft) for the hops of the happy clip, which lift
# the figure by 0.19 m and stretch it on the way up, and room at the sides
# for the lean of the pet clip. The packer trims the frame to the figure,
# so the margins cost render time only; check.py refuses a frame the
# figure touches the edge of.
PX_PER_M = 300
FRAME_W, FRAME_H = 640, 832
FEET_MARGIN_PX = 30
ORTHO_SCALE = FRAME_H / PX_PER_M
CAMERA_CENTER = (0.0, 0.0, (FRAME_H / 2 - FEET_MARGIN_PX) / PX_PER_M)
# The frame as rendered: where its top-left corner lies in the camera's
# full image (a render border crops the room's frame to the figure) and
# the world point of the feet; stage_anims writes the anchor from them.
FRAME = {"origin": (0.0, 0.0), "feet": (0.0, 0.0, 0.0), "pixels_per_metre": float(PX_PER_M)}
# The figure's height in plate pixels when it stands at the rug of the
# room: the app's ELF_HEIGHT_UNITS, so the room render shows the elf
# exactly as the app does.
ROOM_FIGURE_PX = 460
# The young form's height (its manifest's modelHeight): ROOM_FIGURE_PX is
# its figure, and every form is scaled the same, so each keeps its size.
FIGURE_REFERENCE_M = 1.8144
# Watts that put the lit front of the figure at the palette colours (the skin
# is bright and clips first).
LIGHT_WATTS = {"key": 540.0, "fill": 190.0, "top": 130.0}


def contact_sheet(out_path, columns, scale, items):
    args = ["/usr/bin/python3", os.path.join(HERE, "contact_sheet.py"), out_path, str(columns), str(scale)]
    args += [f"{label}:{path}" for label, path in items]
    subprocess.run(args, check=True)


def set_hat(name):
    """Show one hat collection ('none' for bare hair)."""
    for hat in HAT_IDS[1:]:
        collection(f"Hat/{hat}").hide_render = hat != name


def body_objects():
    """The figure without its hats: the meshes on the rig outside Hat/."""
    return [obj for obj in bpy.data.objects if obj.type == "MESH" and obj.parent is not None
            and obj.users_collection and obj.users_collection[0].name not in HAT_IDS[1:]]


INK_USAGE = {}


def set_hat_pass(name):
    """A hat's layer pass: the hat alone in the frame, the body still in the
    scene as a holdout (it cuts the hat where it stands in front of it, an
    ear over a brim) and drawing no ink of its own; None restores the body
    pass, the hats hidden."""
    for obj in body_objects():
        INK_USAGE.setdefault(obj.name, obj.lineart.usage)
        obj.is_holdout = name is not None
        obj.lineart.usage = "OCCLUSION_ONLY" if name is not None else INK_USAGE[obj.name]
    set_hat(name or "none")


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


MOOD_POSES = (("ok", "idle", 1), ("happy", "happy", 10), ("sad", "sad", 13), ("sleep", "sleep", 25))


def stage_moods(scene, rig, out):
    items = []
    for mood, clip, frame in MOOD_POSES:
        pose(rig, clip, frame)
        items.append((mood, render_still(scene, os.path.join(out, "moods", f"{mood}.png"))))
    contact_sheet(os.path.join(out, "moods.png"), 4, 0.5, items)


def stage_hats(scene, rig, out):
    pose(rig, "idle", 1)
    items = []
    for hat in HAT_IDS:
        set_hat(hat)
        items.append((hat, render_still(scene, os.path.join(out, "hats", f"{hat}.png"))))
    set_hat("none")
    contact_sheet(os.path.join(out, "hats.png"), 3, 0.5, items)


def stage_lookdev(scene, rig, out):
    """The look-dev stills: the wave pose and the four moods in the current
    look, into <out>/lookdev/<look>/, where <look> names the flags (the
    A/B sheet is composed from several runs with different flags)."""
    name = f"ramp{LOOK['ramp']:.2f}" + ("-ink" if LOOK["ink"] else "") + ("-hull" if LOOK["hull"] else "")
    folder = os.path.join(out, "lookdev", name)
    pose(rig, "wave", 12)
    render_still(scene, os.path.join(folder, "wave.png"))
    for mood, clip, frame in MOOD_POSES:
        pose(rig, clip, frame)
        render_still(scene, os.path.join(folder, f"{mood}.png"))


def stage_anims(scene, rig, out, clips, hats=False):
    """The body layer's frames of the clips and, with hats, every hat's
    layer of the same frames."""
    set_hat_pass(None)
    layer_dir = os.path.join(out, "layers", "body")
    # The feet, the world origin, in frame pixels: the packer carries the
    # point through the trim and the scale, and the app places the sprite by it.
    os.makedirs(layer_dir, exist_ok=True)
    x, y = _common.project_to_pixels(scene, scene.camera, FRAME["feet"])
    with open(os.path.join(layer_dir, "anchor.json"), "w", encoding="utf-8") as handle:
        json.dump({"x": round(x - FRAME["origin"][0], 2), "y": round(y - FRAME["origin"][1], 2)}, handle)
    for clip in clips:
        rig.apply(clip)
        start, end = rig.clips[clip]
        paths = render_frames(scene, layer_dir, clip, start, end)
        items = [(f"f{start + i}", p) for i, p in enumerate(paths) if i % 6 == 0]
        contact_sheet(os.path.join(out, f"{clip}_sheet.png"), 8, 0.4, items)
    if hats:
        for hat in HAT_IDS[1:]:
            set_hat_pass(hat)
            hat_dir = os.path.join(out, "layers", f"hat_{hat}")
            for clip in clips:
                rig.apply(clip)
                start, end = rig.clips[clip]
                render_frames(scene, hat_dir, clip, start, end)
        set_hat_pass(None)


def stage_thumbs(scene, rig, out):
    """The wardrobe catalogue's pictures: the head close up in each hat,
    the idle pose's first frame, by day, cropped by a border and scaled so
    the longer side comes out at about 360 pixels (room.render_thumb)."""
    import room
    lights = ROOM_LIGHTS.get("lights")
    if lights:
        room.set_daylight(lights, True)
    pose(rig, "idle", 1)
    render = scene.render
    saved = (render.use_border, render.use_crop_to_border, render.border_min_x, render.border_max_x,
             render.border_min_y, render.border_max_y, render.film_transparent)
    hc = head_c()
    corners = [rig.arm.matrix_world @ Vector((x, 0.0, z)) for x in (-(F.head_r + 0.32), F.head_r + 0.32)
               for z in (hc.z - F.head_r * 0.95, hc.z + F.head_r + 0.55)]
    pixels = [_common.project_to_pixels(scene, scene.camera, c) for c in corners]
    box = (min(p[0] for p in pixels), min(p[1] for p in pixels), max(p[0] for p in pixels), max(p[1] for p in pixels))
    render.use_border = False
    for hat in HAT_IDS:
        set_hat(hat)
        room.render_thumb(scene, box, os.path.join(out, "thumbs", f"hat_{hat}.thumb.png"), True)
    set_hat("none")
    (render.use_border, render.use_crop_to_border, render.border_min_x, render.border_max_x,
     render.border_min_y, render.border_max_y, render.film_transparent) = saved
    if lights:
        room.set_daylight(lights, False)

def stage_hero(scene, rig, out):
    """A double-size still of the wave pose (Eevee: the painterly ramp reads
    the light through Shader to RGB, which Cycles cannot)."""
    pose(rig, "wave", 12)
    scene.render.resolution_x, scene.render.resolution_y = FRAME_W * 2, FRAME_H * 2
    render_still(scene, os.path.join(out, "hero.png"))
    scene.render.resolution_x, scene.render.resolution_y = FRAME_W, FRAME_H


def write_render_info(out, argv, model_height):
    """Writes <out>/layers/render.json: the frame, the camera's scale, the pixels
    to the metre and the model's height, which the packer carries into the
    manifest (so the app sizes the figure from the atlas, not from a constant,
    and the atlas records how it was made)."""
    layers = os.path.join(out, "layers")
    os.makedirs(layers, exist_ok=True)
    scene = bpy.context.scene
    info = {
        "script": "elf.py",
        "args": argv[1:],
        "width": scene.render.resolution_x,
        "height": scene.render.resolution_y,
        "pixelsPerMetre": round(FRAME["pixels_per_metre"], 3),
        "modelHeight": round(model_height, 4),
    }
    with open(os.path.join(layers, "render.json"), "w", encoding="utf-8") as handle:
        json.dump(info, handle, indent=2)
        handle.write("\n")


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


def room_scene(samples, quality=True):
    """The cottage of room.py as the elf's scene: its camera, lights, ink
    and look, the furniture hidden, the shell lighting and shadowing but
    invisible to the camera and drawing no ink of its own, by night."""
    import room
    room.LOOK.update(ramp=LOOK["ramp"], ink=LOOK["ink"], hull=LOOK["hull"])
    scene = room.setup_scene(room.PLATE_W, room.PLATE_H, samples=samples, transparent=True)
    cam, _tilt, rug_center, plug, slot_colls, lights = room.build_everything(scene, quality=quality)
    room.show_slots(slot_colls, set())
    plug.hide_render = True
    room.set_shell_hidden_from_camera(True)
    room.set_daylight(lights, False)
    ROOM_LIGHTS["lights"] = lights
    return scene, {"camera": cam, "rug": Vector(rug_center)}


def place_in_room(scene, arm, room_rig, model_height):
    """Stand the elf on the rug, sized so it is ROOM_FIGURE_PX tall in the
    plate's pixels, and crop the render to the figure (with room for the
    hops and the arms) so the frames hold the figure alone."""
    cam, rug = room_rig["camera"], room_rig["rug"]
    foot = _common.project_to_pixels(scene, cam, rug)
    head = _common.project_to_pixels(scene, cam, rug + Vector((0, 0, 1.0)))
    pixels_per_metre = foot[1] - head[1]
    # one scale for every form, the young one's: a form's own height then
    # makes it smaller or taller in the room
    k = ROOM_FIGURE_PX / (pixels_per_metre * FIGURE_REFERENCE_M)
    arm.location = rug
    arm.scale = (k, k, k)
    FRAME["feet"] = tuple(rug)
    FRAME["pixels_per_metre"] = pixels_per_metre * k
    # the border: the figure's reach, in the room, projected and padded
    corners = [rug + Vector((sx * 0.8 * k, -0.35 * k, z * k)) for sx in (-1, 1) for z in (-0.05, max(2.75, model_height + 0.95))]
    pts = [_common.project_to_pixels(scene, cam, c) for c in corners]
    width, height = scene.render.resolution_x, scene.render.resolution_y
    pad = 24
    x0 = max(0, int(min(p[0] for p in pts)) - pad)
    x1 = min(width, int(max(p[0] for p in pts)) + pad)
    y0 = max(0, int(min(p[1] for p in pts)) - pad)
    y1 = min(height, int(max(p[1] for p in pts)) + pad)
    render = scene.render
    render.use_border = True
    render.use_crop_to_border = True
    render.border_min_x, render.border_max_x = x0 / width, x1 / width
    render.border_min_y, render.border_max_y = 1.0 - y1 / height, 1.0 - y0 / height
    FRAME["origin"] = (float(x0), float(y0))
    print(f"[elf] in the room: {pixels_per_metre:.1f} px/m at the rug, figure scale {k:.3f}, "
          f"frame {x1 - x0}x{y1 - y0} at ({x0}, {y0})")


def read_flags(argv):
    """The look and form flags into LOOK and the selected form."""
    if "--ramp" in argv:
        LOOK["ramp"] = float(argv[argv.index("--ramp") + 1])
    if "--no-ink" in argv:
        LOOK["ink"] = False
    if "--hull" in argv:
        LOOK["hull"] = True
    if "--no-quality" in argv:
        LOOK["quality"] = False
    set_form(argv[argv.index("--form") + 1] if "--form" in argv else "young")


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = argv[0] if argv else os.path.join(os.path.expanduser("~"), "elf-renders")
    stages = ["still"]
    quick = "--quick" in argv
    if "--stages" in argv:
        stages = argv[argv.index("--stages") + 1].split(",")
    os.makedirs(out, exist_ok=True)
    read_flags(argv)

    studio = "--studio" in argv
    samples = 16 if quick else 32
    if studio:
        scene = setup_scene(FRAME_W, FRAME_H, samples=samples)
    else:
        scene, room_rig = room_scene(samples, quality=LOOK["quality"] and not quick)
    objs, mats = build_model()
    arm = build_armature()
    bind_all(arm, objs)
    rig = Rig(arm, objs)
    clips = build_clips(rig)
    _, top = report_dimensions(objs)
    if studio:
        add_light_rig(target=CAMERA_CENTER, key_strength=LIGHT_WATTS["key"], fill_strength=LIGHT_WATTS["fill"],
                      top_strength=LIGHT_WATTS["top"])
        add_ortho_camera(CAMERA_CENTER, ORTHO_SCALE)
        if LOOK["ink"]:
            _common.add_line_art(scene, radius=LOOK["ink_radius"])
        if LOOK["quality"] and not quick:
            _common.enable_quality(scene)
    else:
        place_in_room(scene, arm, room_rig, top.z)
    write_render_info(out, argv, top.z)
    print(f"[elf] form {F} look {LOOK}")
    for name, (start, end) in clips.items():
        print(f"[elf] clip {name}: frames {start}-{end} ({end - start + 1} frames)")

    if "still" in stages:
        stage_still(scene, rig, out)
    if "turntable" in stages:
        stage_turntable(scene, rig, out)
    if "moods" in stages:
        stage_moods(scene, rig, out)
    if "hats" in stages:
        stage_hats(scene, rig, out)
    if "lookdev" in stages:
        stage_lookdev(scene, rig, out)
    if "anims" in stages:
        stage_anims(scene, rig, out, ["idle", "pet"])
    if "allanims" in stages:
        stage_anims(scene, rig, out, list(clips), hats="hats" in stages)
    if "thumbs" in stages:
        stage_thumbs(scene, rig, out)
    if "--clips" in argv:
        stage_anims(scene, rig, out, argv[argv.index("--clips") + 1].split(","), hats="hats" in stages)
    if "hero" in stages:
        stage_hero(scene, rig, out)
    pose(rig, "idle", 1)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, "elf.blend"))


if __name__ == "__main__":
    main()
