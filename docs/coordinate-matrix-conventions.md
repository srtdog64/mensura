# Coordinate And Matrix Policy

## Core Policy

Mensura uses this default policy:

```txt
coordinate system : right-handed world, +Y up, -Z forward
matrix convention  : column-major storage, column-vector math, post-multiply
clip depth target  : WebGPU/DirectX style NDC Z = 0..1
numeric standard   : number for public API, Float32Array for packed GPU/API bridge, DataView adapter optional
mutation policy    : immutable/pure default, out-parameter API for hot loops
hit distance       : negative hit distance is invalid by default
AABB boundary      : inclusive
grid rounding      : floor for worldToGrid
```

This policy is chosen because it keeps Mensura friendly to WebGPU/WGSL, has low
conceptual friction with Three.js, can still export to OpenGL/WebGL conventions,
and can later bridge to Zeno/DataView-backed binary projections.

## Coordinate System

Mensura's internal world is right-handed:

```txt
+X = right
+Y = up
-Z = forward
+Z = backward / toward the default camera
```

Default axis constants should follow this shape:

```ts
export const WorldAxis = Object.freeze({
  right: { x: 1, y: 0, z: 0 },
  up: { x: 0, y: 1, z: 0 },
  forward: { x: 0, y: 0, z: -1 },
  backward: { x: 0, y: 0, z: 1 }
});
```

World handedness and clip-depth range are separate decisions. Mensura can use a
right-handed world and still provide WebGPU/DirectX-style projection helpers
with depth `0..1`.

## Matrix Policy

Mensura uses column-vector math:

```txt
p' = M * p
M_world = T * R * S
M_viewProjection = P * V
M_modelViewProjection = P * V * M
```

Matrix documentation may display elements in normal row/column notation:

```txt
m00 m01 m02 m03
m10 m11 m12 m13
m20 m21 m22 m23
m30 m31 m32 m33
```

Flat storage is column-major:

```txt
[
  m00, m10, m20, m30,
  m01, m11, m21, m31,
  m02, m12, m22, m32,
  m03, m13, m23, m33
]
```

Indexing rule:

```ts
export const mat4Index = (row: number, column: number): number => {
  return column * 4 + row;
};
```

Do not conflate memory layout with multiplication convention:

```txt
row-major / column-major = storage layout
row-vector / column-vector = math convention
```

## Numeric Representation

Mensura separates semantic values from packed transport:

```txt
number object = semantic public API
Float32Array  = packed GPU/API bridge
DataView      = binary projection adapter
```

Public values should be easy to inspect and test:

```ts
export type Vec3 = Readonly<{
  x: number;
  y: number;
  z: number;
}>;
```

Packed GPU bridge APIs write into caller-owned arrays:

```ts
export const vec3WriteFloat32 = (
  value: Vec3,
  buffer: Float32Array,
  offset: number
): void => {
  buffer[offset + 0] = value.x;
  buffer[offset + 1] = value.y;
  buffer[offset + 2] = value.z;
};
```

DataView APIs are adapters, not the default value model:

```ts
export const vec3ReadDataView = (
  view: DataView,
  byteOffset: number,
  littleEndian: boolean
): Vec3 => {
  return {
    x: view.getFloat32(byteOffset + 0, littleEndian),
    y: view.getFloat32(byteOffset + 4, littleEndian),
    z: view.getFloat32(byteOffset + 8, littleEndian)
  };
};
```

## Mutation Policy

Mensura's default API is immutable and pure:

```ts
vec3Add(left, right)
mat4Multiply(left, right)
```

Hot-loop APIs write into caller-owned output objects and use the `Into` suffix:

```ts
vec3AddInto(left, right, out)
mat4MultiplyInto(left, right, out)
```

This gives editor/debug code safe defaults while still allowing allocation-free
paths for culling, bounds updates, picking, and transform-heavy loops.

## Hit Distance Policy

Ray intersections only return hits with `distance >= 0`.

```txt
t < 0    = behind ray origin, miss
t === 0 = valid contact at origin
t > 0   = valid forward hit
```

Line, ray, and segment functions must be separate:

```txt
Line    = origin + direction * t, any t
Ray     = origin + direction * t, t >= 0
Segment = a + (b - a) * t, 0 <= t <= 1
```

Do not hide these differences behind one intersection function.

## AABB Boundary Policy

AABB point containment is inclusive:

```txt
min.x <= point.x <= max.x
min.y <= point.y <= max.y
min.z <= point.z <= max.z
```

This is better for editor picking, bounds display, grid placement, and culling:
objects exactly on a boundary should not flicker between included and excluded
states.

## Grid Rounding Policy

`worldToGrid` uses `Math.floor`:

```ts
export const worldToGrid = (point: Vec3, grid: GridSpec): GridCell => {
  return {
    x: Math.floor((point.x - grid.origin.x) / grid.cellSize),
    y: Math.floor((point.y - grid.origin.y) / grid.cellSize),
    z: Math.floor((point.z - grid.origin.z) / grid.cellSize)
  };
};
```

`floor` is consistent for negative coordinates:

```txt
world x =  0.2 -> cell  0
world x =  0.9 -> cell  0
world x = -0.1 -> cell -1
world x = -0.9 -> cell -1
world x = -1.0 -> cell -1
```

Snapping is a different operation and should have a different name:

```txt
worldToGridFloor(...)
snapWorldToGridNearest(...)
```

## Projection Helpers

Projection helpers should name their target:

```ts
createPerspectiveWebGpuRh(...)
createPerspectiveOpenGlRh(...)
createPerspectiveDirectXLh(...)
```

Default projection helpers target:

```txt
NDC X: -1..1
NDC Y: -1..1
NDC Z:  0..1
```

This matches WebGPU/DirectX-style clip depth. OpenGL/WebGL `-1..1` depth should
be explicit in function names.

## Adapter Layers

External differences belong in adapters:

```txt
mensura/webgpu
mensura/webgl
mensura/three
mensura/directx-style
```

Examples:

```ts
toThreeMatrix4(mat)
fromThreeMatrix4(elements)
toWgslMat4Array(mat)
toDirectXRowMajor(mat)
toLeftHandedZForward(mat)
toUnityLikeTransform(mat)
```

Adapters may transpose, flip handedness, or change clip-depth conventions.
Mensura's internal convention must stay stable.

## Reference Notes

- WGSL treats matrices as column vectors and supports matrix-column-vector
  multiplication.
- WebGPU's graphics pipeline uses DirectX-style NDC depth `0..1`.
- Three.js displays matrix documentation in a row-major-friendly way but stores
  and calculates matrices using column-major ordering.
- DirectXMath is historically row-major, row-vector, pre-multiply, and often
  left-handed in examples.
- Unity is left-handed.
- Godot is right-handed.

These differences are exactly why Mensura keeps one internal policy and pushes
external differences into named adapters.
