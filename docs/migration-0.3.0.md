# Migration To 0.3.0

Mensura `0.3.0` is a pre-1.0 package release that intentionally tightens
public API meaning while the only production dogfood consumer is Geukbit.

## Collision Support Maps

Collision support-mapped APIs now use one canonical support-map contract:

```ts
type SupportFunctionInto =
  (direction: Vec3, out: MutableVec3) => MutableVec3;
```

The old allocating support shape is not part of the public API:

```ts
// Removed from the public API.
type SupportFunction = (direction: Vec3) => Vec3;
```

Before:

```ts
const support = (direction: Vec3) => vec3(...);
const result = gjk(supportA, supportB, ctx);
```

After:

```ts
const supportInto = (direction: Vec3, out: MutableVec3) => {
  out.x = ...;
  out.y = ...;
  out.z = ...;
  return out;
};

const result = gjk(supportAInto, supportBInto, ctx);
```

For MPR shapes, use `{ center, supportInto }`:

```ts
const shape = {
  center,
  supportInto
};

const result = mprIntersect(shapeA, shapeB, ctx);
```

Removed wrapper names:

- `gjkWithSupportInto`
- `mprIntersectWithSupportInto`
- `epaWithSupportInto`
- `supportFunctionToInto`
- `MprShapeInto`
- `SupportFunction`

The canonical names are now:

- `gjk`
- `mprIntersect`
- `epa`
- `MprShape`
- `SupportFunctionInto`

## Observation Gate

`@exornea/mensura/validation` now includes the measurement pipeline boundary:

```txt
ObservationSet -> checkObservationSetSuitability -> measureObservationSet
  -> analyzeMeasurement / anchorMeasurement / compareMeasurementToAnchor
```

Use this in benchmark, fuzz, imported asset, and Geukbit dogfood harnesses
before treating a sample set as meaningful. It is not wired into math hot paths.

## Release Commands

Before publishing:

```sh
npm run check:release
```

Publish:

```sh
npm publish --access public
```

Geukbit should consume the published package rather than a local link:

```sh
npm install @exornea/mensura@^0.3.0
```
