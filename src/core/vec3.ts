export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface MutableVec3 {
  x: number;
  y: number;
  z: number;
}

export const VEC3_ZERO: Vec3 = Object.freeze({ x: 0, y: 0, z: 0 });
export const VEC3_ONE: Vec3 = Object.freeze({ x: 1, y: 1, z: 1 });
export const VEC3_UP: Vec3 = Object.freeze({ x: 0, y: 1, z: 0 });
export const VEC3_FORWARD: Vec3 = Object.freeze({ x: 0, y: 0, z: -1 });
export const VEC3_RIGHT: Vec3 = Object.freeze({ x: 1, y: 0, z: 0 });

export function vec3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

export function mutableVec3(x: number = 0, y: number = 0, z: number = 0): MutableVec3 {
  return { x, y, z };
}

export function set3(out: MutableVec3, x: number, y: number, z: number): MutableVec3 {
  out.x = x;
  out.y = y;
  out.z = z;
  return out;
}

export function copy3(value: Vec3): Vec3 {
  return {
    x: value.x,
    y: value.y,
    z: value.z
  };
}

export function copy3Into(value: Vec3, out: MutableVec3): MutableVec3 {
  out.x = value.x;
  out.y = value.y;
  out.z = value.z;
  return out;
}

export function add3(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z
  };
}

export function add3Into(a: Vec3, b: Vec3, out: MutableVec3): MutableVec3 {
  out.x = a.x + b.x;
  out.y = a.y + b.y;
  out.z = a.z + b.z;
  return out;
}

export function sub3(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z
  };
}

export function sub3Into(a: Vec3, b: Vec3, out: MutableVec3): MutableVec3 {
  out.x = a.x - b.x;
  out.y = a.y - b.y;
  out.z = a.z - b.z;
  return out;
}

export function scale3(value: Vec3, scale: number): Vec3 {
  return {
    x: value.x * scale,
    y: value.y * scale,
    z: value.z * scale
  };
}

export function scale3Into(value: Vec3, scale: number, out: MutableVec3): MutableVec3 {
  out.x = value.x * scale;
  out.y = value.y * scale;
  out.z = value.z * scale;
  return out;
}

export function scaleAndAdd3(a: Vec3, b: Vec3, scale: number): Vec3 {
  return {
    x: a.x + b.x * scale,
    y: a.y + b.y * scale,
    z: a.z + b.z * scale
  };
}

export function scaleAndAdd3Into(a: Vec3, b: Vec3, scale: number, out: MutableVec3): MutableVec3 {
  out.x = a.x + b.x * scale;
  out.y = a.y + b.y * scale;
  out.z = a.z + b.z * scale;
  return out;
}

export function dot3(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross3(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

export function cross3Into(a: Vec3, b: Vec3, out: MutableVec3): MutableVec3 {
  const ax = a.x;
  const ay = a.y;
  const az = a.z;
  const bx = b.x;
  const by = b.y;
  const bz = b.z;

  out.x = ay * bz - az * by;
  out.y = az * bx - ax * bz;
  out.z = ax * by - ay * bx;
  return out;
}

export function lengthSq3(value: Vec3): number {
  return dot3(value, value);
}

export function length3(value: Vec3): number {
  return Math.sqrt(lengthSq3(value));
}

export function distanceSq3(a: Vec3, b: Vec3): number {
  const x = b.x - a.x;
  const y = b.y - a.y;
  const z = b.z - a.z;

  return x * x + y * y + z * z;
}

export function distance3(a: Vec3, b: Vec3): number {
  return Math.sqrt(distanceSq3(a, b));
}

export function normalize3(value: Vec3): Vec3 {
  return normalize3Into(value, mutableVec3());
}

export function normalize3Into(value: Vec3, out: MutableVec3): MutableVec3 {
  const lenSq = lengthSq3(value);

  if (lenSq > 0) {
    const invLen = 1 / Math.sqrt(lenSq);
    out.x = value.x * invLen;
    out.y = value.y * invLen;
    out.z = value.z * invLen;
    return out;
  }

  out.x = 0;
  out.y = 0;
  out.z = 0;
  return out;
}

export function min3(a: Vec3, b: Vec3): Vec3 {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    z: Math.min(a.z, b.z)
  };
}

export function min3Into(a: Vec3, b: Vec3, out: MutableVec3): MutableVec3 {
  out.x = Math.min(a.x, b.x);
  out.y = Math.min(a.y, b.y);
  out.z = Math.min(a.z, b.z);
  return out;
}

export function max3(a: Vec3, b: Vec3): Vec3 {
  return {
    x: Math.max(a.x, b.x),
    y: Math.max(a.y, b.y),
    z: Math.max(a.z, b.z)
  };
}

export function max3Into(a: Vec3, b: Vec3, out: MutableVec3): MutableVec3 {
  out.x = Math.max(a.x, b.x);
  out.y = Math.max(a.y, b.y);
  out.z = Math.max(a.z, b.z);
  return out;
}

export function clamp3(value: Vec3, min: Vec3, max: Vec3): Vec3 {
  return clamp3Into(value, min, max, mutableVec3());
}

export function clamp3Into(value: Vec3, min: Vec3, max: Vec3, out: MutableVec3): MutableVec3 {
  out.x = Math.min(Math.max(value.x, min.x), max.x);
  out.y = Math.min(Math.max(value.y, min.y), max.y);
  out.z = Math.min(Math.max(value.z, min.z), max.z);
  return out;
}
