import type { MutableQuat, Quat } from "../core/quat.js";

export function quatMultiplyIntoMany(
  a: ArrayLike<Quat>,
  b: ArrayLike<Quat>,
  out: ArrayLike<MutableQuat>,
  count: number
): ArrayLike<MutableQuat> {
  for (let i = 0; i < count; i++) {
    const qa = a[i];
    const qb = b[i];
    const ax = qa.x;
    const ay = qa.y;
    const az = qa.z;
    const aw = qa.w;
    const bx = qb.x;
    const by = qb.y;
    const bz = qb.z;
    const bw = qb.w;
    const qo = out[i];
    qo.x = ax * bw + aw * bx + ay * bz - az * by;
    qo.y = ay * bw + aw * by + az * bx - ax * bz;
    qo.z = az * bw + aw * bz + ax * by - ay * bx;
    qo.w = aw * bw - ax * bx - ay * by - az * bz;
  }
  return out;
}
