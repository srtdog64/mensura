import type { Quat } from "./quat.js";

export type EulerOrder = "XYZ" | "YXZ" | "ZXY" | "ZYX" | "YZX" | "XZY";

export interface Euler {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly order: EulerOrder;
}

export interface MutableEuler {
  x: number;
  y: number;
  z: number;
  order: EulerOrder;
}

export const EULER_ZERO: Euler = Object.freeze({ x: 0, y: 0, z: 0, order: "XYZ" });

export function euler(x: number, y: number, z: number, order: EulerOrder = "XYZ"): Euler {
  return { x, y, z, order };
}

export function mutableEuler(x: number = 0, y: number = 0, z: number = 0, order: EulerOrder = "XYZ"): MutableEuler {
  return { x, y, z, order };
}

export function copyEuler(value: Euler): Euler {
  return {
    x: value.x,
    y: value.y,
    z: value.z,
    order: value.order
  };
}

export function copyEulerInto(value: Euler, out: MutableEuler): MutableEuler {
  out.x = value.x;
  out.y = value.y;
  out.z = value.z;
  out.order = value.order;
  return out;
}

export function eulerFromQuat(q: Quat, order: EulerOrder = "XYZ"): Euler {
  return eulerFromQuatInto(q, order, mutableEuler());
}

export function eulerFromQuatInto(q: Quat, order: EulerOrder, out: MutableEuler): MutableEuler {
  const sqx = q.x * q.x;
  const sqy = q.y * q.y;
  const sqz = q.z * q.z;
  const sqw = q.w * q.w;

  out.order = order;

  if (order === "XYZ") {
    out.x = Math.atan2(2 * (q.x * q.w - q.y * q.z), (sqw - sqx - sqy + sqz));
    out.y = Math.asin(Math.max(-1, Math.min(1, 2 * (q.x * q.z + q.y * q.w))));
    out.z = Math.atan2(2 * (q.z * q.w - q.x * q.y), (sqw + sqx - sqy - sqz));
  } else if (order === "YXZ") {
    out.x = Math.asin(Math.max(-1, Math.min(1, 2 * (q.x * q.w - q.y * q.z))));
    out.y = Math.atan2(2 * (q.x * q.z + q.y * q.w), (sqw - sqx - sqy + sqz));
    out.z = Math.atan2(2 * (q.x * q.y + q.z * q.w), (sqw - sqx + sqy - sqz));
  } else if (order === "ZXY") {
    out.x = Math.asin(Math.max(-1, Math.min(1, 2 * (q.x * q.w + q.y * q.z))));
    out.y = Math.atan2(2 * (q.y * q.w - q.z * q.x), (sqw - sqx - sqy + sqz));
    out.z = Math.atan2(2 * (q.z * q.w - q.x * q.y), (sqw - sqx + sqy - sqz));
  } else if (order === "ZYX") {
    out.x = Math.atan2(2 * (q.x * q.w + q.y * q.z), (sqw - sqx - sqy + sqz));
    out.y = Math.asin(Math.max(-1, Math.min(1, 2 * (q.y * q.w - q.x * q.z))));
    out.z = Math.atan2(2 * (q.x * q.y + q.z * q.w), (sqw + sqx - sqy - sqz));
  } else if (order === "YZX") {
    out.x = Math.atan2(2 * (q.x * q.w - q.z * q.y), (sqw - sqx + sqy - sqz));
    out.y = Math.atan2(2 * (q.y * q.w - q.x * q.z), (sqw + sqx - sqy - sqz));
    out.z = Math.asin(Math.max(-1, Math.min(1, 2 * (q.x * q.y + q.z * q.w))));
  } else if (order === "XZY") {
    out.x = Math.atan2(2 * (q.x * q.w + q.y * q.z), (sqw - sqx + sqy - sqz));
    out.y = Math.atan2(2 * (q.x * q.z + q.y * q.w), (sqw + sqx - sqy - sqz));
    out.z = Math.asin(Math.max(-1, Math.min(1, 2 * (q.z * q.w - q.x * q.y))));
  }

  return out;
}
