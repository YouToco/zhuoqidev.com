"""A clay diorama of one real Argus run, for the Argus page on zhuoqidev.com.

The story follows one real run (DeepSeek, 2026-10-08; the trace is argus-story-run.json next to
this file) on the 3-minute sample video that ships with Argus. The reader asks "When does something
red show up?". The agent skims one frame every 10 seconds; the small frames go up the wire to the
reader's own model, which replies with the next tool call. Red shows at 10s and 20s, so it samples
both edges of the red span every 1 s, then 0.5 s, then 0.1 s; a sub-agent checks 30-180 s on its own
and reports one sentence; the main agent's context keeps the last three batches of frames (the
skim becomes a line of text). It writes a note and answers 10.0s - 25.0s with the evidence frames.
The sample video's timeline: a red circle at 10-25s, the word HELLO around 60s, a blue square at
100-120s, a green triangle from 2m30s.

Running it:
- Over Blender MCP (watch it in the UI): in execute_blender_code,
  `exec(open(PATH).read(), ns)`, then call ns["build"]().
- Headless: blender -b -P argus-story.py -- <out dir>   -> builds, exports the GLB, renders the
  poster and writes the label coordinates.

The page brings in the groups step0..step5 one by one; the pin_* empties anchor its HTML labels.
Some pieces exist only for the page to animate: the frames and the tool call riding the wire
(s1_pkt*), and the skim batch that the tray swaps for a slip of text (s3_tray_old*, not rendered).
"""

import json
import math
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.geometry import interpolate_bezier

SCENE = "ArgusStory"
STEPS = ["step0_video", "step1_scan", "step2_refine", "step3_helpers", "step4_answer", "step5_browser"]
PATHS = {}  # sampled curves the page moves things along (world space), filled by Builder.tube(record=True)

SW, SD, STH = 10.6, 6.6, 0.3  # the browser window (the stage): width, depth, thickness; top face at z = 0
STRIP_Y = -1.3
FRAME_PITCH = 0.72
T0_X = -3.91  # where t = 0 sits on the film strip; 15 seconds per frame


def tx(t):
    """Video time (seconds) -> x on the film strip."""
    return T0_X + t / 15 * FRAME_PITCH


CAM_DIR = Vector((0.42, -1.3, 1.15)).normalized()
YAW = math.atan2(CAM_DIR.y, CAM_DIR.x) + math.pi / 2  # turns faces that point along -y towards the camera
TILT = math.radians(-24)


def face_cam(extra_x=0.0):
    return (TILT + extra_x, 0.0, YAW)


HEX = {
    "stage": "#efe8d8",
    "ink": "#1c2230",
    "screen": "#263048",
    "seal": "#d24a30",
    "blue": "#4f74d9",
    "blue_dark": "#3a5bb8",
    "yellow": "#f6d453",
    "note": "#ffe27a",
    "green": "#4f9a6c",
    "cream": "#fbf6ea",
    "white": "#ffffff",
    "grey": "#a3a8b4",
    "glass": "#dfeaff",
    "cloud": "#dfe6f3",
    "lavender": "#b9aee6",
}


# ---------------------------------------------------------------------------
# Building blocks
# ---------------------------------------------------------------------------

def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(srgb_to_linear(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4))


def material(key, rough=0.72):
    name = f"clay_{key}"
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    if m.node_tree is None:
        m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    rgb = hex_rgb(HEX[key])
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = 0.0
    m.diffuse_color = (*rgb, 1.0)
    return m


class Builder:
    def __init__(self, coll):
        self.coll = coll

    def _obj(self, name, me, loc, rot, mat, parent, smooth=True):
        if smooth:
            for p in me.polygons:
                p.use_smooth = True
        if mat is not None:
            me.materials.append(material(mat))
        ob = bpy.data.objects.new(name, me)
        self.coll.objects.link(ob)
        ob.parent = parent
        ob.location = loc
        ob.rotation_euler = rot
        return ob

    def mesh(self, name, build, loc=(0, 0, 0), rot=(0, 0, 0), mat=None, parent=None, smooth=True):
        me = bpy.data.meshes.new(name)
        bm = bmesh.new()
        build(bm)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        bm.to_mesh(me)
        bm.free()
        return self._obj(name, me, loc, rot, mat, parent, smooth)

    def bevel(self, ob, width, seg=4, angle=False):
        mod = ob.modifiers.new("Bevel", "BEVEL")
        mod.width = width
        mod.segments = seg
        mod.limit_method = "ANGLE" if angle else "NONE"
        mod.harden_normals = True
        return ob

    def box(self, name, size, loc, mat, parent, bevel=0.05, seg=4, taper=1.0, rot=(0, 0, 0)):
        sx, sy, sz = size

        def build(bm):
            bmesh.ops.create_cube(bm, size=1.0)
            for v in bm.verts:
                k = taper if v.co.z > 0 else 1.0
                v.co.x *= sx * k
                v.co.y *= sy * k
                v.co.z *= sz

        ob = self.mesh(name, build, loc, rot, mat, parent)
        bevel = min(bevel, 0.45 * min(size))
        if bevel > 0.002:
            self.bevel(ob, bevel, seg)
        return ob

    def cyl(self, name, r, h, loc, mat, parent, seg=32, r2=None, rot=(0, 0, 0), bevel=0.0):
        def build(bm):
            bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg,
                                  radius1=r, radius2=r if r2 is None else r2, depth=h)

        ob = self.mesh(name, build, loc, rot, mat, parent)
        if bevel > 0:
            self.bevel(ob, bevel, 3, angle=True)
        return ob

    def sphere(self, name, r, loc, mat, parent, u=24, v=14, scale=(1, 1, 1), cut_below=None):
        def build(bm):
            bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=v, radius=r)
            if cut_below is not None:
                bmesh.ops.delete(bm, geom=[x for x in bm.verts if x.co.z < cut_below * r - 1e-4], context="VERTS")
                edges = [e for e in bm.edges if e.is_boundary]
                if edges:
                    bmesh.ops.edgeloop_fill(bm, edges=edges)
            for x in bm.verts:
                x.co.x *= scale[0]
                x.co.y *= scale[1]
                x.co.z *= scale[2]

        return self.mesh(name, build, loc, (0, 0, 0), mat, parent)

    def torus(self, name, R, r, loc, mat, parent, maj=48, mnr=12, arc=2 * math.pi, start=0.0, rot=(0, 0, 0)):
        closed = arc >= 2 * math.pi - 1e-6

        def build(bm):
            rings = []
            n = maj if closed else maj + 1
            for i in range(n):
                u = start + arc * i / maj
                ring = []
                for j in range(mnr):
                    a = 2 * math.pi * j / mnr
                    rr = R + r * math.cos(a)
                    ring.append(bm.verts.new((rr * math.cos(u), rr * math.sin(u), r * math.sin(a))))
                rings.append(ring)
            for i in range(maj):
                a, b = rings[i], rings[(i + 1) % n]
                for j in range(mnr):
                    bm.faces.new((a[j], b[j], b[(j + 1) % mnr], a[(j + 1) % mnr]))
            if not closed:
                bm.faces.new(rings[0][::-1])
                bm.faces.new(rings[-1])

        return self.mesh(name, build, loc, rot, mat, parent)

    def prism(self, name, pts, h, loc, mat, parent, rot=(0, 0, 0), bevel=0.0):
        def build(bm):
            bottom = [bm.verts.new((x, y, 0)) for x, y in pts]
            top = [bm.verts.new((x, y, h)) for x, y in pts]
            bm.faces.new(bottom[::-1])
            bm.faces.new(top)
            k = len(pts)
            for i in range(k):
                bm.faces.new((bottom[i], bottom[(i + 1) % k], top[(i + 1) % k], top[i]))

        ob = self.mesh(name, build, loc, rot, mat, parent, smooth=False)
        if bevel > 0:
            self.bevel(ob, bevel, 2, angle=True)
        return ob

    def tube(self, name, points, r, mat, parent, res=16, record=False):
        cu = bpy.data.curves.new(name + "_curve", "CURVE")
        cu.dimensions = "3D"
        cu.bevel_depth = r
        cu.bevel_resolution = 3
        cu.resolution_u = res
        cu.use_fill_caps = True
        sp = cu.splines.new("BEZIER")
        sp.bezier_points.add(len(points) - 1)
        # Catmull-Rom handles, set explicitly so the path the page samples is the one drawn
        pts = [Vector(p) for p in points]
        tan = [(pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]) / 6 for i in range(len(pts))]
        for bp, p, t in zip(sp.bezier_points, pts, tan):
            bp.handle_left_type = bp.handle_right_type = "FREE"
            bp.co = p
            bp.handle_left = p - t
            bp.handle_right = p + t
        if record:
            samples = [pts[0]]
            for i in range(len(pts) - 1):
                samples += interpolate_bezier(pts[i], pts[i] + tan[i], pts[i + 1] - tan[i + 1], pts[i + 1], res + 1)[1:]
            PATHS[name] = samples
        ob = self._from_curve(name, cu, parent, mat)
        start = Vector(points[0])  # origin at the start, so the page can grow it from there
        ob.data.transform(Matrix.Translation(-start))
        ob.location = start
        return ob

    def text(self, name, body, size, loc, mat, parent, rot=(0, 0, 0), depth=0.03, align="CENTER"):
        cu = bpy.data.curves.new(name + "_curve", "FONT")
        cu.body = body
        cu.size = size
        cu.extrude = depth
        cu.resolution_u = 3  # coarse glyph curves are enough; a bevel would multiply the triangles tenfold
        cu.align_x = align
        cu.align_y = "CENTER"
        ob = self._from_curve(name, cu, parent, mat, smooth=False)
        ob.location = loc
        ob.rotation_euler = rot
        return ob

    def _from_curve(self, name, cu, parent, mat, smooth=True):
        tmp = bpy.data.objects.new(name + "_tmp", cu)
        self.coll.objects.link(tmp)
        dg = bpy.context.evaluated_depsgraph_get()
        dg.update()
        me = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
        bpy.data.objects.remove(tmp, do_unlink=True)
        if cu.users == 0:
            bpy.data.curves.remove(cu)
        return self._obj(name, me, (0, 0, 0), (0, 0, 0), mat, parent, smooth)

    def dots(self, name, a, c, n, mat, parent, r=0.028):
        a, c = Vector(a), Vector(c)
        for k in range(n):
            self.sphere(f"{name}{k}", r, a.lerp(c, (k + 0.5) / n), mat, parent, u=10, v=6)

    def empty(self, name, loc, parent=None, size=0.25):
        ob = bpy.data.objects.new(name, None)
        ob.empty_display_type = "PLAIN_AXES"
        ob.empty_display_size = size
        self.coll.objects.link(ob)
        ob.parent = parent
        ob.location = loc
        return ob


# ---------------------------------------------------------------------------
# Characters and props
# ---------------------------------------------------------------------------

def argus(b, name, loc, parent, scale=1.0, eyes=13, color="blue"):
    """Argus the hundred-eyed: a gumdrop covered in eyes on the side facing the camera."""
    x, y, z = loc
    r = 0.6 * scale
    body = b.sphere(f"{name}_body", r, (x, y, z + r * 1.2), color, parent, u=32, v=18, scale=(1, 1, 1.25),
                    cut_below=-0.82)
    face = math.atan2(CAM_DIR.y, CAM_DIR.x)
    rows = [(-0.05, 5), (0.32, 4), (0.62, 3), (0.9, 1)] if eyes >= 13 else [(0.15, 2), (0.55, 1)]
    k = 0
    for el, count in rows:
        span = math.radians(110) * (count - 1) / 4 if count > 1 else 0
        for i in range(count):
            az = face - span / 2 + (span * i / (count - 1) if count > 1 else 0)
            n = Vector((math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el)))
            pos = Vector((x, y, z + r * 1.2)) + Vector((n.x * r, n.y * r, n.z * r * 1.25)) * 0.96
            er = r * (0.16 if el < 0.7 else 0.13)
            b.sphere(f"{name}_eye{k}", er, pos, "white", parent, u=14, v=8)
            b.sphere(f"{name}_pupil{k}", er * 0.55, pos + n * er * 0.62, "ink", parent, u=12, v=8)
            k += 1
    for s in (-1, 1):
        fx = x + s * r * 0.45 * math.cos(face + math.pi / 2)
        fy = y + s * r * 0.45 * math.sin(face + math.pi / 2)
        b.sphere(f"{name}_foot{'ab'[s > 0]}", r * 0.28, (fx, fy, z + 0.03), "blue_dark", parent, u=16, v=8,
                 scale=(1.3, 1.3, 0.55))
    return body


def frame_card(b, name, w, h, kind, loc, parent, rot=None, thick=0.04):
    """A standing frame: white border, dark screen, and the sample video's shape at that time."""
    card = b.box(name, (w, thick, h), loc, "white", parent, bevel=0.018, rot=rot or face_cam())
    b.box(f"{name}_scr", (w - 0.08, 0.01, h - 0.08), (0, -thick / 2 - 0.004, 0), "screen", card, bevel=0)
    fy = -thick / 2 - 0.012
    s = min(w, h)
    if kind == "red":
        b.cyl(f"{name}_red", 0.2 * s, 0.012, (0.08 * w, fy, 0), "seal", card, seg=24, rot=(math.pi / 2, 0, 0))
    elif kind == "blue":
        b.box(f"{name}_blue", (0.3 * s, 0.012, 0.3 * s), (0.2 * w, fy, 0), "blue", card, bevel=0)
    elif kind == "green":
        tri = [(-0.16 * s, -0.13 * s), (0.16 * s, -0.13 * s), (0, 0.17 * s)]
        b.prism(f"{name}_green", tri, 0.012, (0, fy + 0.006, 0), "green", card, rot=(math.pi / 2, 0, 0))
    elif kind == "hello":
        b.box(f"{name}_hello", (0.5 * w, 0.012, 0.1 * h), (0, fy, 0), "white", card, bevel=0)
    # the small white timecode bar in the corner (every frame of the sample video has one)
    b.box(f"{name}_tc", (0.22 * w, 0.012, 0.07 * h), (-0.3 * w, fy, 0.33 * h), "grey", card, bevel=0)
    return card


FRAME_KINDS = {1: "red", 4: "hello", 7: "blue", 10: "green", 11: "green"}


# ---------------------------------------------------------------------------
# The six steps
# ---------------------------------------------------------------------------

def step0_video(b, g):
    """A 3-minute video (a film reel) and the reader's question."""
    # the browser window's floor; its title bar and address bar arrive in the last step
    b.box("s0_stage", (SW, SD, STH), (0, 0, -STH / 2), "stage", g, bevel=0.12, seg=5)
    # the reel
    rx, ry = -4.62, STRIP_Y + 0.1
    b.cyl("s0_reel", 0.62, 0.2, (rx, ry, 0.1), "ink", g, seg=40, bevel=0.03)
    b.cyl("s0_reel_hub", 0.15, 0.24, (rx, ry, 0.12), "grey", g, seg=24, bevel=0.02)
    for k in range(5):
        a = 2 * math.pi * k / 5 + 0.3
        b.cyl(f"s0_reel_hole{k}", 0.11, 0.02, (rx + 0.38 * math.cos(a), ry + 0.38 * math.sin(a), 0.205), "cream", g,
              seg=18)
    # the strip: 12 frames x 15 seconds
    length = 12 * FRAME_PITCH + 0.5
    b.box("s0_strip", (length, 0.95, 0.05), (T0_X - 0.25 + length / 2, STRIP_Y, 0.025), "ink", g, bevel=0.015)
    for i in range(12):
        x = T0_X + FRAME_PITCH * (i + 0.5)
        b.box(f"s0_f{i}", (0.6, 0.6, 0.012), (x, STRIP_Y, 0.056), "screen", g, bevel=0)
        for s in (-1, 1):
            for d in (-1, 1):
                b.box(f"s0_f{i}_h{'ab'[s > 0]}{'ab'[d > 0]}", (0.1, 0.07, 0.012), (x + d * 0.17, STRIP_Y + s * 0.4,
                                                                                       0.056), "cream", g, bevel=0)
        kind = FRAME_KINDS.get(i)
        z = 0.068
        if kind == "red":
            b.cyl(f"s0_f{i}_red", 0.11, 0.016, (x + 0.06, STRIP_Y, z), "seal", g, seg=24)
        elif kind == "hello":
            b.box(f"s0_f{i}_hello", (0.32, 0.07, 0.016), (x, STRIP_Y, z), "white", g, bevel=0)
        elif kind == "blue":
            b.box(f"s0_f{i}_blue", (0.17, 0.17, 0.016), (x + 0.12, STRIP_Y, z), "blue", g, bevel=0)
        elif kind == "green":
            tri = [(-0.1, -0.08), (0.1, -0.08), (0, 0.11)]
            b.prism(f"s0_f{i}_green", tri, 0.016, (x, STRIP_Y, 0.06), "green", g)
    # the question: a speech bubble (the page's label carries the wording)
    bx, by, bz = -4.75, -1.0, 1.55
    bub = b.box("s0_bubble", (1.25, 0.12, 0.78), (bx, by, bz), "white", g, bevel=0.1, seg=5, rot=face_cam())
    b.prism("s0_bubble_tail", [(-0.08, 0), (0.14, 0), (-0.14, -0.3)], 0.1, (-0.2, 0.05, -0.36), "white", bub,
            rot=(math.pi / 2, 0, 0))
    b.text("s0_bubble_q", "?", 0.62, (0, -0.07, -0.02), "seal", bub, rot=(math.pi / 2, 0, 0), depth=0.03)
    for t, key in ((0, "t0"), (60, "t60"), (120, "t120"), (180, "t180")):
        b.empty(f"pin_s0_{key}", (tx(t), STRIP_Y - 0.62, 0.05), g)
    b.empty("pin_s0_question", (bx, by, bz + 0.5), g)
    b.empty("pin_s0_video", (rx, ry, 0.35), g)


ARGUS_POS = (-3.05, 0.75, 0.0)
CLOUD = Vector((2.6, SD / 2 + 1.6, 3.3))


def along(points, u):
    """The point a share u (0-1) of the way along a sampled path."""
    seg = [(a - b).length for a, b in zip(points[1:], points[:-1])]
    left = u * sum(seg)
    for a, b, d in zip(points[:-1], points[1:], seg):
        if left <= d:
            return a.lerp(b, left / d if d else 0)
        left -= d
    return points[-1].copy()


def packet_frame(b, name, loc, parent):
    """A downscaled frame on its way up the wire to the model."""
    card = b.box(name, (0.4, 0.04, 0.3), loc, "white", parent, bevel=0.02, rot=face_cam())
    b.box(f"{name}_scr", (0.33, 0.01, 0.23), (0, -0.024, 0), "screen", card, bevel=0)
    b.cyl(f"{name}_red", 0.05, 0.012, (0.03, -0.031, 0), "seal", card, seg=18, rot=(math.pi / 2, 0, 0))
    return card


def packet_call(b, name, loc, parent):
    """The model's reply on its way down: the next tool call."""
    tag = b.box(name, (0.48, 0.05, 0.24), loc, "yellow", parent, bevel=0.05, rot=face_cam())
    for j, w in enumerate((0.28, 0.17)):
        b.box(f"{name}_l{j}", (w, 0.01, 0.034), (-0.13 + w / 2, -0.028, 0.04 - j * 0.08), "ink", tag, bevel=0)
    return tag


def step1_scan(b, g):
    """Argus skims one frame every 10 seconds. The frames go up the wire to the reader's own model
    (the cloud), which replies with the next tool call; red shows in the frames at 10s and 20s."""
    argus(b, "s1_argus", ARGUS_POS, g)
    for i in (1, 4, 7, 10):
        x = T0_X + FRAME_PITCH * (i + 0.5)
        top = Vector((x, STRIP_Y + 0.25, 1.62))
        frame_card(b, f"s1_card{i}", 0.62, 0.5, FRAME_KINDS.get(i, "empty"), top, g)
        b.dots(f"s1_thread{i}_", (x, STRIP_Y, 0.12), top - Vector((0, 0, 0.3)), 6, "ink", g, r=0.022)
    for k, (dx, dy, dz, r) in enumerate([(0, 0, 0, 0.62), (-0.6, 0.05, -0.15, 0.46), (0.6, 0.02, -0.12, 0.5),
                                         (-0.2, 0.1, 0.42, 0.46), (0.3, -0.05, 0.36, 0.42),
                                         (0.0, -0.25, -0.22, 0.44)]):
        b.sphere(f"s1_cloud{k}", r, CLOUD + Vector((dx, dy, dz)), "cloud", g, u=24, v=14)
    head = Vector((ARGUS_POS[0], ARGUS_POS[1], 1.62))
    b.tube("s1_cable", [head, head + Vector((0.3, 0.6, 0.9)), Vector((0.0, SD / 2 + 0.2, 2.6)),
                        CLOUD - Vector((0.7, 0.2, 0.25))], 0.04, "ink", g, record=True)
    wire = PATHS["s1_cable"]
    packet_frame(b, "s1_pktA", along(wire, 0.2), g)
    packet_frame(b, "s1_pktB", along(wire, 0.66), g)
    packet_call(b, "s1_pktC", along(wire, 0.84), g)
    b.empty("pin_s1_argus", (ARGUS_POS[0], ARGUS_POS[1], 1.75), g)
    b.empty("pin_s1_scan", (T0_X + FRAME_PITCH * 7.5, STRIP_Y + 0.25, 1.95), g)
    b.empty("pin_s1_model", CLOUD + Vector((0, 0, 1.0)), g)


# the two edges of the red span (first and last frame with red) and the three passes over each:
# card width, spacing, height for every 1 s, every 0.5 s, every 0.1 s. The rows hang in front of
# the strip, nudged apart so the two sets do not touch.
EDGES = ((10.0, "in", -0.07), (24.9, "out", 0.07))
ROWS = ((0.25, 0.27, 1.12), (0.19, 0.205, 0.86), (0.145, 0.16, 0.63))
FUNNEL_Y = STRIP_Y - 0.66


def step2_refine(b, g):
    """Around each edge of the red span it samples every 1 s, then every 0.5 s, then every 0.1 s."""
    for t, side, nudge in EDGES:
        x = tx(t) + nudge
        for r, (w, dx, z) in enumerate(ROWS):
            for k in (-1, 0, 1):
                red = k >= 0 if side == "in" else k <= 0
                frame_card(b, f"s2_row{r}{side}_c{k + 1}", w, w * 0.78, "red" if red else "empty",
                           (x + k * dx, FUNNEL_Y, z), g, thick=0.025)
        b.dots(f"s2_thread{side}_", (tx(t), STRIP_Y - 0.3, 0.1), (x, FUNNEL_Y, ROWS[-1][2] - 0.1), 5, "ink", g,
               r=0.018)
    b.empty("pin_s2_in", (tx(EDGES[0][0]) + EDGES[0][2], FUNNEL_Y, 1.38), g)
    b.empty("pin_s2_out", (tx(EDGES[1][0]) + EDGES[1][2], FUNNEL_Y, 1.38), g)


TRAY = Vector((-1.4, 1.6, 0.0))  # back far enough that the skim cards do not hide it


def tray_stack(b, name, loc, n, parent, hide=False):
    """A pile of n small frames lying in the tray."""
    for k in range(n):
        ang = math.radians((-6, 5, -2, 7, -4)[k % 5])
        tile = b.box(f"{name}{k}", (0.32, 0.24, 0.018), loc + Vector((0.012 * (k % 2), 0, 0.022 * k)), "white",
                     parent, bevel=0.006, rot=(0, 0, ang))
        scr = b.box(f"{name}{k}_scr", (0.27, 0.19, 0.004), (0, 0, 0.01), "screen", tile, bevel=0)
        tile.hide_render = scr.hide_render = hide


def step3_helpers(b, g):
    """A sub-agent checks 30-180 s on its own and hands back one sentence; the main agent's context
    (the tray) keeps the last three batches of frames, the first batch (the skim) now a slip of text."""
    sx, sy = 0.35, -2.5
    argus(b, "s3_sub", (sx, sy, 0.0), g, scale=0.62, eyes=3, color="lavender")
    for j, t in enumerate((63, 109, 156)):
        x = tx(t)
        frame_card(b, f"s3_card{j}", 0.36, 0.3, FRAME_KINDS.get(int(t // 15), "empty"),
                   (x, STRIP_Y + 0.1, 1.0 + (j % 2) * 0.08), g, thick=0.03)
        b.dots(f"s3_thread{j}_", (x, STRIP_Y, 0.12), (x, STRIP_Y + 0.1, 0.8), 4, "lavender", g, r=0.02)
    # what it hands back: one slip of text
    slip = b.box("s3_report", (0.46, 0.03, 0.3), (sx - 0.95, sy + 0.2, 0.85), "white", g, bevel=0.025,
                 rot=face_cam())
    for j, w in enumerate((0.32, 0.22)):
        b.box(f"s3_report_l{j}", (w, 0.01, 0.035), (-0.12 + w / 2, -0.018, 0.055 - j * 0.09), "grey", slip,
              bevel=0)
    # the main agent's context: a tray with four slots
    base = b.box("s3_tray", (1.7, 0.8, 0.06), (TRAY.x, TRAY.y, 0.03), "cream", g, bevel=0.03)
    for k, (w, d, x, y) in enumerate(((1.7, 0.06, 0, 0.37), (1.7, 0.06, 0, -0.37), (0.06, 0.8, 0.82, 0),
                                      (0.06, 0.8, -0.82, 0))):
        b.box(f"s3_tray_rim{k}", (w, d, 0.1), (x, y, 0.06), "cream", base, bevel=0.02)
    slots = [TRAY + Vector((x, 0, 0.075)) for x in (-0.58, -0.2, 0.2, 0.58)]
    # slot 0: the skim's 18 frames, swapped for a line of text once the fourth batch came in
    note = b.box("s3_tray_slip", (0.3, 0.36, 0.012), slots[0], "white", g, bevel=0.004,
                 rot=(0, 0, math.radians(-8)))
    for j, w in enumerate((0.2, 0.15, 0.18)):
        b.box(f"s3_tray_slip_l{j}", (w, 0.03, 0.004), (-0.02, 0.1 - j * 0.085, 0.008), "grey", note, bevel=0)
    tray_stack(b, "s3_tray_old", slots[0], 3, g, hide=True)
    # the 28, 8 and 11 frames of the three passes
    for k, n in enumerate((5, 2, 3)):
        tray_stack(b, f"s3_tray_b{k}_", slots[k + 1], n, g)
    b.empty("pin_s3_sub", (sx, sy, 1.3), g)
    b.empty("pin_s3_tray", (TRAY.x, TRAY.y, 0.45), g)


ANSWER = Vector((-0.2, 1.75, 2.85))


def step4_answer(b, g):
    """It writes a note, then answers 10.0s - 25.0s with threads back to the evidence frames."""
    card = b.box("s4_answer", (2.5, 0.08, 1.15), ANSWER, "white", g, bevel=0.08, seg=5, rot=face_cam())
    b.cyl("s4_answer_red", 0.17, 0.03, (-0.9, -0.05, 0.12), "seal", card, seg=28, rot=(math.pi / 2, 0, 0))
    chips = ((-0.22, "10.0s"), (0.78, "25.0s"))
    for k, (x, body) in enumerate(chips):
        b.box(f"s4_chip{k}", (0.8, 0.03, 0.3), (x, -0.05, 0.12), "yellow", card, bevel=0.06)
        b.text(f"s4_t{k}", body, 0.2, (x, -0.075, 0.12), "ink", card, rot=(math.pi / 2, 0, 0), depth=0.015)
    b.text("s4_dash", "-", 0.2, (0.28, -0.075, 0.12), "ink", card, rot=(math.pi / 2, 0, 0), depth=0.015)
    for j, wdt in enumerate((1.9, 1.4)):
        b.box(f"s4_line{j}", (wdt, 0.02, 0.07), (-1.0 + wdt / 2, -0.05, -0.2 - j * 0.17), "grey", card, bevel=0.02)
    bpy.context.view_layer.update()
    mw = card.matrix_world
    # threads to the first frame with red (10.0s) and the last (24.9s)
    for k, (t, chip_x) in enumerate(((10.0, chips[0][0]), (24.9, chips[1][0]))):
        head = Vector((tx(t), STRIP_Y - 0.05, 0.42))
        b.cyl(f"s4_pin{k}_needle", 0.018, 0.34, head - Vector((0, 0, 0.2)), "grey", g, seg=10)
        b.sphere(f"s4_pin{k}_head", 0.11, head, "seal", g, u=18, v=12)
        start = mw @ Vector((chip_x, 0.04, -0.15))
        mid = start.lerp(head, 0.5) + Vector((0, 0, -0.25))
        b.tube(f"s4_thread{k}", [start, mid, head], 0.016, "seal", g)
    # the note it wrote before answering (remember), on the desk beside the tray
    note = b.box("s4_note", (0.66, 0.6, 0.02), (TRAY.x - 0.05, -0.12, 0.012), "note", g, bevel=0.01,
                 rot=(0, 0, math.radians(5)))
    for j, wdt in enumerate((0.44, 0.32, 0.38)):
        b.box(f"s4_note_l{j}", (wdt, 0.04, 0.008), (-0.08 + wdt / 2 - 0.12, 0.15 - j * 0.14, 0.014), "ink", note,
              bevel=0)
    b.empty("pin_s4_answer", ANSWER + Vector((0, 0, 0.72)), g)
    b.empty("pin_s4_pins", (tx(17.4), STRIP_Y - 0.05, 0.6), g)
    b.empty("pin_s4_note", (TRAY.x - 0.05, -0.12, 0.15), g)


def step5_browser(b, g):
    """The whole view: all of it inside the browser window; the one wire out goes to your own model."""
    by = SD / 2 - 0.42
    b.box("s5_titlebar", (SW - 0.3, 0.55, 0.08), (0, by, 0.04), "ink", g, bevel=0.03)
    for k, (key, x) in enumerate((("seal", -4.8), ("yellow", -4.52), ("green", -4.24))):
        b.sphere(f"s5_dot{k}", 0.085, (x, by, 0.1), key, g, u=16, v=10)
    b.box("s5_address", (4.6, 0.3, 0.03), (0.3, by, 0.095), "cream", g, bevel=0.015)
    # the padlock left of the address bar
    lx = -1.75
    b.box("s5_lock", (0.16, 0.05, 0.13), (lx, by, 0.2), "green", g, bevel=0.02)
    b.torus("s5_lock_shackle", 0.055, 0.016, (lx, by, 0.27), "green", g, maj=20, mnr=6, arc=math.pi,
            rot=(math.pi / 2, 0, 0))
    b.empty("pin_s5_browser", (SW / 2 - 0.9, by, 0.12), g)  # the right end, clear of the wire's label
    b.empty("pin_s5_cloud", CLOUD + Vector((0, 0, 1.0)), g)
    b.empty("pin_s5_wire", along(PATHS["s1_cable"], 0.76) + Vector((0, 0, 0.25)), g)


# ---------------------------------------------------------------------------
# Scene, export, poster
# ---------------------------------------------------------------------------

def fresh_scene():
    sc = bpy.data.scenes.get(SCENE)
    if sc is None:
        sc = bpy.data.scenes.new(SCENE)
    for ob in list(sc.collection.all_objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for c in list(sc.collection.children_recursive):
        bpy.data.collections.remove(c)
    for coll in (bpy.data.meshes, bpy.data.curves, bpy.data.lights, bpy.data.cameras):
        for d in [d for d in coll if d.users == 0]:
            coll.remove(d)
    if bpy.context.window is not None:
        bpy.context.window.scene = sc
    return sc


def fit_camera(sc, cam, target, margin=0.04, d=18.0):
    """Place the camera along CAM_DIR so the bounding box of every mesh just fits (plus the margin)."""
    from bpy_extras.object_utils import world_to_camera_view
    pts = [ob.matrix_world @ Vector(c) for ob in bpy.data.collections["ArgusStory"].all_objects
           if ob.type == "MESH" for c in ob.bound_box]

    def place(t, dist):
        cam.location = t + CAM_DIR * dist
        cam.rotation_euler = (t - cam.location).to_track_quat("-Z", "Y").to_euler()
        bpy.context.view_layer.update()
        co = [world_to_camera_view(sc, cam, p) for p in pts]
        return min(c.x for c in co), max(c.x for c in co), min(c.y for c in co), max(c.y for c in co)

    aspect = sc.render.resolution_y / sc.render.resolution_x
    for _ in range(6):
        x0, x1, y0, y1 = place(target, d)
        w = 2 * d * math.tan(cam.data.angle_x / 2)
        right = cam.matrix_world.to_3x3() @ Vector((1, 0, 0))
        up = cam.matrix_world.to_3x3() @ Vector((0, 1, 0))
        target = target + right * ((x0 + x1) / 2 - 0.5) * w + up * ((y0 + y1) / 2 - 0.5) * w * aspect
        x0, x1, y0, y1 = place(target, d)
        d *= max((x1 - x0), (y1 - y0)) / (1 - 2 * margin)
    place(target, d)
    sc["fit_target"] = list(target)
    sc["fit_distance"] = d
    return target, d


def studio(sc, coll):
    target = Vector((0.15, 0.55, 0.95))
    cam_data = bpy.data.cameras.new("StoryCam")
    cam_data.lens = 50
    cam_data.sensor_fit = "HORIZONTAL"
    cam = bpy.data.objects.new("StoryCam", cam_data)
    coll.objects.link(cam)
    sc.camera = cam

    def area(name, loc, energy, size, color=(1, 1, 1)):
        ld = bpy.data.lights.new(name, "AREA")
        ld.energy = energy
        ld.size = size
        ld.color = color
        lo = bpy.data.objects.new(name, ld)
        coll.objects.link(lo)
        lo.location = loc
        lo.rotation_euler = (target - Vector(loc)).to_track_quat("-Z", "Y").to_euler()

    area("Key", (-3, -4, 16), 900, 10, (1.0, 0.96, 0.9))
    area("Fill", (12, -6, 6), 220, 8, (0.9, 0.94, 1.0))
    area("Rim", (2, 11, 9), 320, 7)

    world = bpy.data.worlds.get("StoryWorld") or bpy.data.worlds.new("StoryWorld")
    sc.world = world
    if world.node_tree is None:
        world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs["Color"].default_value = (*hex_rgb("#fbf8f1"), 1)
    bg.inputs["Strength"].default_value = 0.35

    r = sc.render
    r.engine = "CYCLES"
    r.film_transparent = True
    r.resolution_x, r.resolution_y = 1800, 1150
    r.resolution_percentage = 100
    fit_camera(sc, cam, target, margin=0.035)
    sc.cycles.samples = 160
    sc.cycles.use_denoising = True
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "OPTIX"
        prefs.get_devices()
        for dev in prefs.devices:
            dev.use = True
        sc.cycles.device = "GPU"
    except Exception:
        sc.cycles.device = "CPU"


def build():
    sc = fresh_scene()
    coll = bpy.data.collections.new("ArgusStory")
    sc.collection.children.link(coll)
    studio_coll = bpy.data.collections.new("StoryStudio")
    sc.collection.children.link(studio_coll)
    b = Builder(coll)
    root = b.empty("ArgusStory", (0, 0, 0), size=0.6)
    PATHS.clear()
    fns = (step0_video, step1_scan, step2_refine, step3_helpers, step4_answer, step5_browser)
    for name, fn in zip(STEPS, fns):
        fn(b, b.empty(name, (0, 0, 0), root, size=0.4))
    focus = [(tx(45) - 0.6, STRIP_Y + 0.3, 0.75), (-0.6, 1.2, 1.7), (tx(17.5), FUNNEL_Y + 0.25, 0.8),
             (-0.65, -0.3, 0.6), (-1.5, 0.35, 1.45)]
    for i, loc in enumerate(focus):
        b.empty(f"focus_step{i}", loc, root)
    studio(sc, studio_coll)
    b.empty("focus_step5", tuple(sc["fit_target"]), root)
    tris = 0
    dg = bpy.context.evaluated_depsgraph_get()
    for ob in coll.all_objects:
        if ob.type == "MESH":
            ev = ob.evaluated_get(dg)
            m = ev.to_mesh()
            m.calc_loop_triangles()
            tris += len(m.loop_triangles)
            ev.to_mesh_clear()
    return {"objects": len(coll.all_objects), "triangles": tris}


def export_glb(path):
    sc = bpy.data.scenes[SCENE]
    keep = set(bpy.data.collections["ArgusStory"].all_objects)
    for ob in sc.objects:
        ob.select_set(ob in keep)
    if bpy.context.window is not None:
        bpy.context.window.scene = sc
    import contextlib
    import io
    with contextlib.redirect_stdout(io.StringIO()):
        bpy.ops.export_scene.gltf(
            filepath=path, export_format="GLB", use_selection=True, use_active_scene=True, export_apply=True,
            export_cameras=False, export_lights=False, export_yup=True, export_extras=False,
            export_texcoords=False,
            export_materials="EXPORT", export_animations=False,
        )


def camera_info(path):
    """The poster camera in glTF axes (y up), so the page opens on the same view and distance."""
    sc = bpy.data.scenes[SCENE]
    cam = sc.camera
    t = Vector(sc["fit_target"])
    to_gl = lambda v: [round(v.x, 4), round(v.z, 4), round(-v.y, 4)]
    aspect = sc.render.resolution_x / sc.render.resolution_y
    fov_y = 2 * math.atan(math.tan(cam.data.angle_x / 2) / aspect)
    info = {"dir": to_gl(CAM_DIR), "target": to_gl(t), "distance": round(sc["fit_distance"], 3),
            "fovY": round(math.degrees(fov_y), 3), "aspect": round(aspect, 4)}
    with open(path, "w") as f:
        json.dump(info, f, indent=1)
    return info


def paths_info(path):
    """The sampled wire in glTF axes, for the page to move the frames and the tool call along it."""
    to_gl = lambda v: [round(v.x, 4), round(v.z, 4), round(-v.y, 4)]
    with open(path, "w") as f:
        json.dump({k: [to_gl(p) for p in v] for k, v in PATHS.items() if k == "s1_cable"}, f)


def pin_screen_coords(path):
    """Each pin's spot on the poster (0-1 from the top left), so the page can label the poster too."""
    from bpy_extras.object_utils import world_to_camera_view
    sc = bpy.data.scenes[SCENE]
    bpy.context.view_layer.update()
    out = {}
    for ob in bpy.data.collections["ArgusStory"].all_objects:
        if ob.name.startswith("pin_"):
            co = world_to_camera_view(sc, sc.camera, ob.matrix_world.translation)
            out[ob.name[4:]] = [round(co.x, 4), round(1 - co.y, 4)]
    with open(path, "w") as f:
        json.dump(dict(sorted(out.items())), f, indent=1)
    return out


if __name__ == "__main__" and bpy.app.background:
    out = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "."
    print("built", build())
    export_glb(f"{out}/argus-story.glb")
    pin_screen_coords(f"{out}/argus-story-pins.json")
    camera_info(f"{out}/argus-story-camera.json")
    paths_info(f"{out}/argus-story-paths.json")
    bpy.context.scene.render.filepath = f"{out}/argus-story-poster.png"
    bpy.ops.render.render(write_still=True)
