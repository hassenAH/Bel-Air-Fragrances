"""Chanel-style bottle .blend -> small web GLB (Draco).
Usage: blender -b "file.blend" --python convert_blend.py -- <out.glb> [height_units]
Materials are replaced by simple named ones; the website recreates the look from the
values in the original Cycles node trees (see src/components/motion/bottle-scene.tsx).
"""
import sys, os, math
import bpy
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index("--") + 1:]
out = argv[0]
HEIGHT = float(argv[1]) if len(argv) > 1 else 2.6
sc = bpy.context.scene

def sel_only(objs):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    if objs:
        bpy.context.view_layer.objects.active = objs[0]

# 1) Flatten the empty hierarchy (keep world transforms), drop the empties.
meshes = [o for o in sc.objects if o.type == "MESH"]
sel_only(meshes)
bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
for o in list(sc.objects):
    if o.type != "MESH":
        bpy.data.objects.remove(o, do_unlink=True)

# 2) Report what the cap's 4th slot ("label 2") covers.
cap = bpy.data.objects["Cap"]
for si, slot in enumerate(cap.material_slots):
    faces = [p for p in cap.data.polygons if p.material_index == si]
    if faces:
        pts = [cap.matrix_world @ cap.data.vertices[v].co for p in faces for v in p.vertices]
        mn = [round(min(p[i] for p in pts), 2) for i in range(3)]
        mx = [round(max(p[i] for p in pts), 2) for i in range(3)]
        print(f"CAP slot {si} {slot.material.name if slot.material else None}: faces={len(faces)} bbox={mn}..{mx}")

# 3) Bake modifiers (subsurf), then decimate heavy parts.
targets = {"Cap": 22000, "Spring Pipe": 4000, "Spray Tip": 7000, "Sprayer": 9000, "Spray Body": 9000, "Bottle": 8500, "Liquid": 2100}
for o in [o for o in sc.objects if o.type == "MESH"]:
    sel_only([o])
    for m in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)
    o.data.calc_loop_triangles()
    cur = len(o.data.loop_triangles)
    want = targets.get(o.name)
    if want and cur > want * 1.15:
        d = o.modifiers.new("dec", "DECIMATE")
        d.decimate_type = "COLLAPSE"
        d.ratio = want / cur
        bpy.ops.object.modifier_apply(modifier=d.name)
    if o.name != "label":
        bpy.ops.object.shade_smooth()

# 4) Normalise: centre, label toward +Z camera (rotate 180 about Z), total height = HEIGHT.
objs = [o for o in sc.objects if o.type == "MESH"]
def bbox(os_):
    pts = [o.matrix_world @ Vector(c) for o in os_ for c in o.bound_box]
    return (Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))),
            Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts))))
mn, mx = bbox(objs)
ctr = (mn + mx) / 2
scale = HEIGHT / (mx.z - mn.z)
M = Matrix.Scale(scale, 4) @ Matrix.Rotation(math.pi, 4, "Z") @ Matrix.Translation(-ctr)
for o in objs:
    o.matrix_world = M @ o.matrix_world
sel_only(objs)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
print("SCALE FACTOR (blender units -> scene units):", round(scale, 5))

# 5) Simple named materials (cap slots: 0 glass, 1-2 gold, 3 'label 2' -> gold; see website code).
def mat(name, color, metallic=0.0, rough=0.5):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = color
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Roughness"].default_value = rough
    return m
M_ = {
    "glass": mat("glass", (1, 1, 1, 1)),
    "liquid": mat("liquid", (1.0, 0.533, 0.0, 1)),
    "gold": mat("gold", (0.824, 0.275, 0.003, 1), 0.9, 0.18),
    "plastic": mat("plastic", (0.005, 0.005, 0.005, 1), 0.0, 0.4),
    "tube": mat("tube", (0.9, 0.9, 0.9, 1)),
    "label": mat("label", (0.96, 0.94, 0.89, 1)),
}
def set_mats(o, names):
    me = o.data
    for i in range(len(me.materials)):
        me.materials[i] = M_[names[min(i, len(names) - 1)]]
    if not len(me.materials):
        me.materials.append(M_[names[0]])
set_mats(bpy.data.objects["Bottle"], ["glass"])
set_mats(bpy.data.objects["Liquid"], ["liquid"])
set_mats(bpy.data.objects["Spray Body"], ["gold"])
set_mats(bpy.data.objects["Sprayer"], ["gold"])
set_mats(bpy.data.objects["Spray Tip"], ["plastic"])
set_mats(bpy.data.objects["Spring Pipe"], ["tube"])
set_mats(bpy.data.objects["Cap"], ["glass", "gold", "gold", "gold"])
set_mats(bpy.data.objects["label"], ["label"])
for m in list(bpy.data.materials):
    if m.users == 0:
        bpy.data.materials.remove(m)

# 6) Report + export.
mn, mx = bbox(objs)
print("FINAL BBOX:", tuple(round(v, 3) for v in mn), tuple(round(v, 3) for v in mx))
tot = 0
for o in objs:
    o.data.calc_loop_triangles()
    t = len(o.data.loop_triangles); tot += t
    print(f"  {o.name:12} tris={t}")
print("TOTAL TRIS:", tot)
os.makedirs(os.path.dirname(out), exist_ok=True)
sel_only(objs)
bpy.ops.export_scene.gltf(
    filepath=out, export_format="GLB", use_selection=True, export_yup=True, export_apply=True,
    export_cameras=False, export_lights=False, export_image_format="NONE",
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
    export_draco_position_quantization=14, export_draco_normal_quantization=10,
)
print("EXPORTED:", out, os.path.getsize(out), "bytes")
