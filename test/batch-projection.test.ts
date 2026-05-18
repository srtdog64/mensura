import { describe, expect, it } from "vitest";
import { mat4Identity, mutableQuat, mutableVec3, quat, vec3 } from "../src/core/index.js";
import {
  mat4ArrayReadFloat32,
  mat4ArrayWriteFloat32,
  quatArrayReadFloat32,
  quatArrayWriteFloat32,
  vec3ArrayReadFloat32,
  vec3ArrayWriteFloat32
} from "../src/batch/index.js";

describe("batch projection bridges", () => {
  it("packs and unpacks Vec3 arrays with stride 3", () => {
    const values = [vec3(1, 2, 3), vec3(4, 5, 6), vec3(100, 100, 100)];
    const packed = new Float32Array(9).fill(-1);
    const out = [mutableVec3(), mutableVec3(), mutableVec3(-1, -1, -1)];

    expect(vec3ArrayWriteFloat32(values, packed, 2)).toBe(packed);
    expect([...packed]).toEqual([1, 2, 3, 4, 5, 6, -1, -1, -1]);

    expect(vec3ArrayReadFloat32(packed, out, 2)).toBe(out);
    expect(out[0]).toEqual(vec3(1, 2, 3));
    expect(out[1]).toEqual(vec3(4, 5, 6));
    expect(out[2]).toEqual(vec3(-1, -1, -1));
  });

  it("packs and unpacks quaternion arrays with stride 4", () => {
    const values = [quat(1, 2, 3, 4), quat(5, 6, 7, 8)];
    const packed = new Float32Array(8);
    const out = [mutableQuat(), mutableQuat()];

    expect(quatArrayWriteFloat32(values, packed, 2)).toBe(packed);
    expect([...packed]).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

    expect(quatArrayReadFloat32(packed, out, 2)).toBe(out);
    expect(out[0]).toEqual(values[0]);
    expect(out[1]).toEqual(values[1]);
  });

  it("packs and unpacks Mat4 arrays with stride 16", () => {
    const first = mat4Identity();
    const second = mat4Identity();
    second[12] = 10;
    second[13] = 20;
    second[14] = 30;
    const packed = new Float32Array(32);
    const out = [mat4Identity(), mat4Identity()];

    expect(mat4ArrayWriteFloat32([first, second], packed, 2)).toBe(packed);
    expect([...packed.slice(0, 16)]).toEqual(first);
    expect([...packed.slice(16, 32)]).toEqual(second);

    out[0][0] = 99;
    out[1][0] = 99;
    expect(mat4ArrayReadFloat32(packed, out, 2)).toBe(out);
    expect(out[0]).toEqual(first);
    expect(out[1]).toEqual(second);
  });
});
