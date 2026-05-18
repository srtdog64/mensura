export interface Vec4 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
}

export interface MutableVec4 {
  x: number;
  y: number;
  z: number;
  w: number;
}

export const VEC4_ZERO: Vec4 = Object.freeze({ x: 0, y: 0, z: 0, w: 0 });
export const VEC4_ONE: Vec4 = Object.freeze({ x: 1, y: 1, z: 1, w: 1 });

export function vec4(x: number, y: number, z: number, w: number): Vec4 {
  return { x, y, z, w };
}

export function mutableVec4(x: number = 0, y: number = 0, z: number = 0, w: number = 0): MutableVec4 {
  return { x, y, z, w };
}

export function set4(out: MutableVec4, x: number, y: number, z: number, w: number): MutableVec4 {
  out.x = x;
  out.y = y;
  out.z = z;
  out.w = w;
  return out;
}

export function copy4(value: Vec4): Vec4 {
  return {
    x: value.x,
    y: value.y,
    z: value.z,
    w: value.w
  };
}

export function copy4Into(value: Vec4, out: MutableVec4): MutableVec4 {
  out.x = value.x;
  out.y = value.y;
  out.z = value.z;
  out.w = value.w;
  return out;
}

export function add4(a: Vec4, b: Vec4): Vec4 {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z,
    w: a.w + b.w
  };
}

export function add4Into(a: Vec4, b: Vec4, out: MutableVec4): MutableVec4 {
  out.x = a.x + b.x;
  out.y = a.y + b.y;
  out.z = a.z + b.z;
  out.w = a.w + b.w;
  return out;
}

export function sub4(a: Vec4, b: Vec4): Vec4 {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z,
    w: a.w - b.w
  };
}

export function sub4Into(a: Vec4, b: Vec4, out: MutableVec4): MutableVec4 {
  out.x = a.x - b.x;
  out.y = a.y - b.y;
  out.z = a.z - b.z;
  out.w = a.w - b.w;
  return out;
}

export function scale4(value: Vec4, scale: number): Vec4 {
  return {
    x: value.x * scale,
    y: value.y * scale,
    z: value.z * scale,
    w: value.w * scale
  };
}

export function scale4Into(value: Vec4, scale: number, out: MutableVec4): MutableVec4 {
  out.x = value.x * scale;
  out.y = value.y * scale;
  out.z = value.z * scale;
  out.w = value.w * scale;
  return out;
}

export function dot4(a: Vec4, b: Vec4): number {
  return a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
}

export function lengthSq4(value: Vec4): number {
  return dot4(value, value);
}

export function length4(value: Vec4): number {
  return Math.sqrt(lengthSq4(value));
}

export function normalize4(value: Vec4): Vec4 {
  return normalize4Into(value, mutableVec4());
}

export function normalize4Into(value: Vec4, out: MutableVec4): MutableVec4 {
  const lenSq = lengthSq4(value);

  if (lenSq > 0) {
    const invLen = 1 / Math.sqrt(lenSq);
    out.x = value.x * invLen;
    out.y = value.y * invLen;
    out.z = value.z * invLen;
    out.w = value.w * invLen;
    return out;
  }

  out.x = 0;
  out.y = 0;
  out.z = 0;
  out.w = 0;
  return out;
}
