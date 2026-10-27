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
        [--clips wave,feed] [--form young|baby] [--ramp 0.4] [--no-ink] [--hull] [--no-quality] [--quick]

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
    "cheek": "#e8a49a",
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
}

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
    # The hatchling: a bigger head on a shorter body, shorter ears and arms.
    "baby": Form(head_c=1.12, head_r=0.36, shoulder_z=0.78, hem_z=0.40, chest_r=0.21, hem_r=0.27,
                 hip_z=0.44, knee_z=0.26, ear=0.8, arm=0.85),
}

F = FORMS["young"]
HEAD_SCALE = (1.0, 0.95, 1.08)
# The face sits on the -Y side of the head, tilted a little down.
FACE_AXIS = Vector((0.0, -1.0, -0.12)).normalized()
OUTLINE = 0.011


def set_form(name):
    """Select the form every builder reads; call before build_model."""
    global F, BONES
    F = FORMS[name]
    BONES = bones_for(F)


def head_c():
    return Vector((0.0, 0.0, F.head_c))


def hp(x, y, z):
    """A point on the head, given relative to a 0.36 m head and scaled to this form's."""
    k = F.head_r / 0.36
    return head_c() + Vector((x * k, y * k, z * k))


def arm_points(s):
    """Shoulder, elbow, hand centre of one arm (s = +1 left, -1 right); the
    arm hangs close to the body with a slight bend forward at the elbow."""
    shoulder = Vector((0.215 * s, -0.01, F.shoulder_z - 0.04))
    elbow = shoulder + Vector((0.07 * s, -0.03, -0.24)) * F.arm
    hand = elbow + Vector((0.035 * s, -0.09, -0.20)) * F.arm
    return shoulder, elbow, hand


def leg_points(s):
    hip = Vector((0.12 * s, 0.0, F.hip_z))
    knee = Vector((0.12 * s, -0.02, F.knee_z))
    ankle = Vector((0.125 * s, -0.01, 0.12))
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
        "cheek": material("Cheek", "cheek", roughness=0.7, grain=0.0),
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
    }
    objs = {}
    hc = head_c()
    k = F.head_r / 0.36

    # --- Head: an egg fuller above the eyes and tapering to the chin, the
    # neck, the nose and the ears fused into one skin.
    head = sphere("Head", hc, F.head_r, "Body", mats["skin"], scale=HEAD_SCALE, segments=48, rings=32, subsurf=1)
    half = F.head_r * HEAD_SCALE[2]
    for v in head.data.vertices:
        rel = v.co - hc
        if rel.z < 0:
            t = min(1.0, -rel.z / half)
            taper = 1.0 - 0.26 * t ** 1.6
            v.co = hc + Vector((rel.x * taper, rel.y * taper, rel.z))
    neck = tube("Neck", [(0, 0.01, F.shoulder_z - 0.08), (0, 0.01, F.shoulder_z + 0.10)], [0.08, 0.075], "Body",
                mats["skin"], segments=24, subsurf=1)
    nose = tube("Nose", [hp(0, -0.338, 0.03), hp(0, -0.362, -0.03), hp(0, -0.37, -0.06)],
                [0.009 * k, 0.016 * k, 0.021 * k], "Body", mats["skin"], segments=12, samples=8, subsurf=1)
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
    waist_z = F.hem_z + (F.shoulder_z - F.hem_z) * 0.35
    torso = tube("Body", [(0, 0.0, F.shoulder_z), (0, 0.0, waist_z), (0, 0.0, F.hem_z)],
                 [F.chest_r, F.chest_r * 0.93, F.hem_r], "Body", mats["tunic"], segments=32, samples=12,
                 flatten=(1.0, 0.8), subsurf=1)
    pieces = [torso]
    for side, suffix in ((1, "L"), (-1, "R")):
        s = side
        shoulder, elbow, hand = arm_points(s)
        pieces.append(sphere(f"Shoulder.{suffix}", shoulder + Vector((-0.02 * s, 0, 0.01)), 0.085, "Body",
                             mats["tunic"], scale=(1.0, 0.9, 1.0), subsurf=1))
        pieces.append(tube(f"Arm.{suffix}", [shoulder, elbow, hand - (hand - elbow) * 0.2],
                           [0.072, 0.062, 0.056], "Body", mats["tunic"], ref=(0, 1, 0), segments=20, subsurf=1))
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
    objs["Hem"] = torus("Hem", (0, 0, F.hem_z + 0.015), (hem_x - 0.012, hem_y - 0.012), 0.024, "Body",
                        mats["tunic_dark"], subsurf=1)
    belt_z = waist_z_belt
    objs["Belt"] = torus("Belt", (0, 0, belt_z), (belt_x - 0.008, belt_y - 0.008), 0.022, "Body",
                         mats["belt"], subsurf=1)
    objs["Buckle"] = rounded_box("Buckle", (0, -(belt_y + 0.012), belt_z), (0.09, 0.03, 0.08), "Body",
                                 mats["acorn"], subsurf=2)
    objs["BucklePin"] = rounded_box("BucklePin", (0, -(belt_y + 0.03), belt_z), (0.014, 0.014, 0.05),
                                    "Body", mats["acorn_dark"], subsurf=2)
    for i in range(7):
        a = math.radians(-120 + 40 * i)
        base = Vector((math.sin(a) * F.chest_r * 0.72, -math.cos(a) * F.chest_r * 0.6, F.shoulder_z + 0.015))
        direction = Vector((math.sin(a), -math.cos(a) * 0.8, -0.55))
        objs[f"Collar{i}"] = leaf(f"Collar{i}", base, direction, 0.16, 0.08, "Body", mats["leaf"])

    for side, suffix in ((1, "L"), (-1, "R")):
        s = side
        shoulder, elbow, hand = arm_points(s)
        along = (hand - elbow).normalized()
        objs[f"Cuff.{suffix}"] = torus(f"Cuff.{suffix}", hand - along * 0.1, 0.06, 0.017, "Body",
                                       mats["tunic_dark"], axis=along, subsurf=1)
        # Hands: a mitten with a thumb and three fingers fused into one.
        palm = sphere(f"Hand.{suffix}", hand, 0.062, "Body", mats["skin"], scale=(1.0, 0.7, 1.15), subsurf=1)
        fingers = [palm, sphere(f"Thumb.{suffix}", hand + Vector((-0.045 * s, -0.03, 0.02)), 0.026, "Body",
                                mats["skin"], scale=(1.0, 0.9, 1.3), segments=16, rings=8, subsurf=1)]
        for j, (dx, dz) in enumerate(((0.03, -0.055), (0.0, -0.062), (-0.03, -0.055))):
            fingers.append(sphere(f"Finger{j}.{suffix}", hand + Vector((dx * s, -0.01, dz)), 0.022, "Body",
                                  mats["skin"], scale=(1.0, 0.9, 1.5), segments=16, rings=8, subsurf=1))
        objs[f"Hand.{suffix}"] = fuse(f"Hand.{suffix}", fingers, mats["skin"], voxel=0.0045, smooth=3)
        hip, knee, ankle = leg_points(s)
        objs[f"Leg.{suffix}"] = tube(f"Leg.{suffix}", [hip, knee, ankle], [0.08, 0.064, 0.056], "Body",
                                     mats["legging"], ref=(0, 1, 0), segments=20, subsurf=1)
        boot = sphere(f"Boot.{suffix}", (0.125 * s, -0.05, 0.085), 1.0, "Body", mats["boot"],
                      scale=(0.1, 0.155, 0.085), subsurf=1)
        shaft = tube(f"BootShaft.{suffix}", [(0.125 * s, -0.015, 0.06), (0.125 * s, -0.012, 0.19)], [0.075, 0.07],
                     "Body", mats["boot"], segments=20, subsurf=1)
        toe = tube(f"BootToe.{suffix}", [(0.125 * s, -0.16, 0.06), (0.125 * s, -0.24, 0.07), (0.125 * s, -0.27, 0.13)],
                   [0.058, 0.038, 0.012], "Body", mats["boot"], ref=(1, 0, 0), subsurf=1)
        objs[f"Boot.{suffix}"] = fuse(f"Boot.{suffix}", [boot, shaft, toe], mats["boot"], voxel=0.006, smooth=3)
        objs[f"BootCuff.{suffix}"] = torus(f"BootCuff.{suffix}", (0.125 * s, -0.012, 0.19), (0.078, 0.078), 0.018,
                                           "Body", mats["sole"], subsurf=1)
        objs[f"Sole.{suffix}"] = sphere(f"Sole.{suffix}", (0.125 * s, -0.07, 0.026), 1.0, "Body", mats["sole"],
                                        scale=(0.105, 0.18, 0.028), subsurf=1)

    # --- Face --------------------------------------------------------------
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
        objs[f"Cheek.{suffix}"] = sphere(f"Cheek.{suffix}", hp(0.21 * s, -0.25, -0.1), 0.05 * k, "Face",
                                         mats["cheek"], scale=(1.0, 0.35, 0.6), subsurf=1)
        brow = tube(f"Brow.{suffix}", [hp(0.05 * s, -0.342, 0.12), hp(0.14 * s, -0.33, 0.15), hp(0.23 * s, -0.292, 0.125)],
                    [0.009 * k, 0.014 * k, 0.006 * k], "Face", mats["hair_dark"], ref=(0, 1, 0), segments=8,
                    samples=8, subsurf=1)
        add_shape_key(brow, "sad", lambda p, s=s: Vector((p.x, p.y, p.z + 0.035 * k * (1 - abs(p.x) / (0.235 * k)) - 0.015 * k)))
        objs[f"Brow.{suffix}"] = brow
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
    cap = sphere("Hair", hc + Vector((0, 0.012, 0.015)), F.head_r + 0.035, "Hair", mats["hair"], scale=HEAD_SCALE,
                 segments=48, rings=32, subsurf=1,
                 keep=lambda p: p.z > 0.17 or (p.y > 0.04 and p.z > -0.20) or (abs(p.x) > 0.27 and p.y > -0.12 and p.z > -0.02))
    # The cut sphere is an open surface; the remesh needs a closed volume,
    # so the cap gets a thickness, grown inwards into the skull.
    shell = cap.modifiers.new("Shell", "SOLIDIFY")
    shell.thickness = 0.06
    shell.offset = -1.0
    strands = [cap]
    fringe = [(-0.26, -0.20, -0.09, 0.04, 0.07), (-0.12, -0.02, 0.06, 0.01, 0.078), (0.02, 0.14, 0.24, 0.0, 0.08),
              (0.14, 0.26, 0.33, -0.02, 0.068), (-0.30, -0.33, -0.31, 0.02, 0.05)]
    for i, (x0, x1, x2, dz, r) in enumerate(fringe):
        pts = [hp(x0, -0.19, 0.38), hp(x1, -0.315, 0.29), hp(x2, -0.34, 0.195 + dz)]
        strands.append(tube(f"Fringe{i}", pts, [r * k, r * k * 0.75, 0.01], "Hair", mats["hair"],
                            flatten=(1.0, 0.6), ref=(0, 1, 0), samples=8, segments=16, subsurf=1))
    for side, suffix in ((1, "L"), (-1, "R")):
        s = side
        pts = [hp(0.29 * s, -0.12, 0.22), hp(0.355 * s, -0.17, 0.02), hp(0.365 * s, -0.19, -0.16)]
        strands.append(tube(f"Lock.{suffix}", pts, [0.075 * k, 0.055 * k, 0.01], "Hair", mats["hair"],
                            flatten=(0.7, 1.0), ref=(0, 1, 0), samples=8, segments=16, subsurf=1))
    strands.append(tube("Tuft", [hp(0.0, 0.10, 0.34), hp(0.05, 0.16, 0.52), hp(0.15, 0.19, 0.60)],
                        [0.1 * k, 0.065 * k, 0.01], "Hair", mats["hair"], ref=(0, 1, 0), samples=8, segments=16,
                        subsurf=1))
    strands.append(tube("Tuft2", [hp(-0.06, 0.08, 0.34), hp(-0.12, 0.12, 0.49), hp(-0.20, 0.13, 0.52)],
                        [0.08 * k, 0.05 * k, 0.01], "Hair", mats["hair"], ref=(0, 1, 0), samples=8, segments=16,
                        subsurf=1))
    objs["Hair"] = fuse("Hair", strands, mats["hair"], voxel=0.008, smooth=4)
    # A leaf tucked into the hair above the right ear: the forest elf's mark.
    objs["HairLeaf"] = leaf("HairLeaf", hp(-0.27, -0.14, 0.22), (-0.55, -0.45, 0.7), 0.19, 0.085, "Hair", mats["leaf"])
    objs["HairLeafStem"] = tube("HairLeafStem", [hp(-0.24, -0.11, 0.17), hp(-0.30, -0.16, 0.25)], [0.008, 0.006],
                                "Hair", mats["tunic_dark"], segments=8, samples=4, subsurf=0)

    # --- Hats (cosmetics, rendered as their own layers later) --------------
    acorn = sphere("AcornCap", hc + Vector((0, 0.02, 0.17)), F.head_r + 0.07, "Hat/Acorn", mats["acorn"],
                   scale=(1.0, 1.0, 0.78), segments=40, rings=20, subsurf=1, outline=OUTLINE,
                   keep=lambda p: p.z > -0.02)
    objs["AcornCap"] = acorn
    objs["AcornRim"] = torus("AcornRim", hc + Vector((0, 0.02, 0.155)), F.head_r + 0.07, 0.03, "Hat/Acorn",
                             mats["acorn_dark"], subsurf=1, outline=OUTLINE)
    objs["AcornStalk"] = tube("AcornStalk", [hc + Vector((0, 0.02, 0.50)), hc + Vector((0.04, 0.03, 0.64)),
                                             hc + Vector((0.11, 0.05, 0.72))],
                              [0.045, 0.035, 0.03], "Hat/Acorn", mats["acorn_dark"], ref=(0, 1, 0), samples=8,
                              subsurf=1, outline=OUTLINE)
    mush = sphere("MushroomCap", hc + Vector((0, 0.03, 0.15)), F.head_r + 0.18, "Hat/Mushroom", mats["mushroom"],
                  scale=(1.0, 1.0, 0.62), segments=48, rings=24, subsurf=1, outline=OUTLINE,
                  keep=lambda p: p.z > -0.04)
    objs["MushroomCap"] = mush
    objs["MushroomRim"] = torus("MushroomRim", hc + Vector((0, 0.03, 0.135)), F.head_r + 0.175, 0.035,
                                "Hat/Mushroom", mats["cream"], subsurf=1, outline=OUTLINE)
    for i, (az, el, size) in enumerate(((-100, 50, 0.085), (-45, 70, 0.065), (20, 55, 0.075), (-150, 35, 0.06),
                                        (110, 45, 0.07), (-70, 25, 0.05), (60, 20, 0.055), (170, 65, 0.06))):
        d = Vector((math.cos(math.radians(el)) * math.sin(math.radians(az)),
                    -math.cos(math.radians(el)) * math.cos(math.radians(az)), math.sin(math.radians(el))))
        r = F.head_r + 0.18
        center = hc + Vector((0, 0.03, 0.15)) + Vector((d.x * r, d.y * r, d.z * r * 0.62))
        rot = d.to_track_quat("Z", "Y").to_matrix()
        objs[f"Dot{i}"] = sphere(f"Dot{i}", center, size, "Hat/Mushroom", mats["cream"], scale=(1.0, 1.0, 0.3),
                                 segments=16, rings=8, subsurf=1, rotation=rot)
    for path in ("Hat/Acorn", "Hat/Mushroom"):
        collection(path).hide_render = True

    # Body shape keys: squash and stretch about the hem.
    pivot = F.hem_z - 0.1
    add_shape_key(body, "squash", lambda p: Vector((p.x * 1.15, p.y * 1.15, pivot + (p.z - pivot) * 0.82)))
    add_shape_key(body, "stretch", lambda p: Vector((p.x * 0.9, p.y * 0.9, pivot + (p.z - pivot) * 1.18)))

    # The ink skips the parts that are painted on, and the eyelids hide
    # without drawing (the lash line draws the closed eye).
    for name, obj in objs.items():
        base = name.partition(".")[0]
        if base in ("Highlight", "HighlightSmall", "Cheek", "Iris", "Pupil", "LashTop") or base.startswith("Dot"):
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
    crown = F.head_c + F.head_r * HEAD_SCALE[2]
    bones = [
        ("root", (0, 0, 0), (0, 0, 0.25), None, False),
        ("hips", (0, 0, F.hem_z), (0, 0, F.hem_z + 0.13), "root", True),
        ("spine", (0, 0, F.hem_z + 0.13), (0, 0, F.hem_z + 0.28), "hips", True),
        ("chest", (0, 0, F.hem_z + 0.28), (0, 0, F.shoulder_z - 0.05), "spine", True),
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
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm


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
    """The hair rides the head, and the tufts at the crown blend over to the
    hood_tip bone with their height, so the clips' tuft keys still move them
    (heat weights fail on the fused hair mass, so the weights are set by region)."""
    bind_rigid(arm, obj, "head")
    head_group = obj.vertex_groups["head"]
    tip_group = obj.vertex_groups.new(name="hood_tip")
    base = hp(0.0, 0.09, 0.30)
    for v in obj.data.vertices:
        rel = v.co - base
        if rel.y < 0 or rel.z < 0:
            continue
        w = min(1.0, rel.z / (0.22 * F.head_r / 0.36))
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
        elif base in ("Hand", "Cuff"):
            bind_rigid(arm, obj, f"hand.{side}")
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
        """Swing the upper arm up sideways by raise_deg (the rest arm hangs about 55 degrees below
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
    """Author every clip. Frame 1 is the first frame; clips loop back to frame 1.
    The hood_tip bone now carries the hair tuft at the crown."""
    # idle: 48 frames, breath, bob, lagging ears and tuft, blink at 30.
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
# Watts that put the lit front of the figure at the palette colours (the skin
# is bright and clips first).
LIGHT_WATTS = {"key": 540.0, "fill": 190.0, "top": 130.0}


def contact_sheet(out_path, columns, scale, items):
    args = ["/usr/bin/python3", os.path.join(HERE, "contact_sheet.py"), out_path, str(columns), str(scale)]
    args += [f"{label}:{path}" for label, path in items]
    subprocess.run(args, check=True)


def set_hat(name):
    """Show one hat collection ('none' for bare hair)."""
    for hat in ("Acorn", "Mushroom"):
        collection(f"Hat/{hat}").hide_render = True
    if name != "none":
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


MOOD_POSES = (("ok", "idle", 1), ("happy", "happy", 5), ("sad", "sad", 24), ("sleep", "sleep", 25))


def stage_moods(scene, rig, out):
    items = []
    for mood, clip, frame in MOOD_POSES:
        pose(rig, clip, frame)
        items.append((mood, render_still(scene, os.path.join(out, "moods", f"{mood}.png"))))
    contact_sheet(os.path.join(out, "moods.png"), 4, 0.5, items)


def stage_hats(scene, rig, out):
    pose(rig, "idle", 1)
    items = []
    for hat in ("none", "acorn", "mushroom"):
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
    pose(rig, "wave", 11)
    render_still(scene, os.path.join(folder, "wave.png"))
    for mood, clip, frame in MOOD_POSES:
        pose(rig, clip, frame)
        render_still(scene, os.path.join(folder, f"{mood}.png"))


def stage_anims(scene, rig, out, clips):
    layer_dir = os.path.join(out, "layers", "body")
    # The feet, the world origin, in frame pixels: the packer carries the
    # point through the trim and the scale, and the app places the sprite by it.
    _common.write_anchor(scene, scene.camera, layer_dir)
    for clip in clips:
        rig.apply(clip)
        start, end = rig.clips[clip]
        paths = render_frames(scene, layer_dir, clip, start, end)
        items = [(f"f{start + i}", p) for i, p in enumerate(paths) if i % 6 == 0]
        contact_sheet(os.path.join(out, f"{clip}_sheet.png"), 8, 0.4, items)


def stage_hero(scene, rig, out):
    """A double-size still of the wave pose (Eevee: the painterly ramp reads
    the light through Shader to RGB, which Cycles cannot)."""
    pose(rig, "wave", 11)
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
    info = {
        "script": "elf.py",
        "args": argv[1:],
        "width": FRAME_W,
        "height": FRAME_H,
        "orthoScale": round(ORTHO_SCALE, 6),
        "pixelsPerMetre": PX_PER_M,
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

    scene = setup_scene(FRAME_W, FRAME_H, samples=16 if quick else 32)
    objs, mats = build_model()
    arm = build_armature()
    bind_all(arm, objs)
    rig = Rig(arm, objs)
    clips = build_clips(rig)
    add_light_rig(target=CAMERA_CENTER, key_strength=LIGHT_WATTS["key"], fill_strength=LIGHT_WATTS["fill"],
                  top_strength=LIGHT_WATTS["top"])
    add_ortho_camera(CAMERA_CENTER, ORTHO_SCALE)
    if LOOK["ink"]:
        _common.add_line_art(scene, radius=LOOK["ink_radius"])
    if LOOK["quality"] and not quick:
        _common.enable_quality(scene)
    _, top = report_dimensions(objs)
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
        stage_anims(scene, rig, out, list(clips))
    if "--clips" in argv:
        stage_anims(scene, rig, out, argv[argv.index("--clips") + 1].split(","))
    if "hero" in stages:
        stage_hero(scene, rig, out)
    pose(rig, "idle", 1)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, "elf.blend"))


if __name__ == "__main__":
    main()
