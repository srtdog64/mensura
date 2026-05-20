import type { MutableVec3, Vec3 } from "../core/vec3.js";
import type { Aabb } from "./aabb.js";

export interface GridSpec {
  readonly origin: Vec3;
  readonly cellSize: number;
}

export interface GridCell {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface MutableGridCell {
  x: number;
  y: number;
  z: number;
}

export interface GridCellRange {
  readonly min: GridCell;
  readonly max: GridCell;
}

export interface MutableGridCellRange {
  min: MutableGridCell;
  max: MutableGridCell;
}

export type GridCellVisitor = (cell: GridCell) => void;

export function gridSpec(origin: Vec3, cellSize: number): GridSpec {
  return {
    origin: { x: origin.x, y: origin.y, z: origin.z },
    cellSize
  };
}

export function gridCell(x: number = 0, y: number = 0, z: number = 0): MutableGridCell {
  return { x, y, z };
}

export function gridCellRange(min: GridCell = gridCell(), max: GridCell = gridCell()): MutableGridCellRange {
  return {
    min: gridCell(min.x, min.y, min.z),
    max: gridCell(max.x, max.y, max.z)
  };
}

export function worldToGrid(value: Vec3, grid: GridSpec): MutableGridCell {
  return worldToGridInto(value, grid, gridCell());
}

export function worldToGridInto(value: Vec3, grid: GridSpec, out: MutableGridCell): MutableGridCell {
  const invCellSize = 1 / grid.cellSize;
  out.x = Math.floor((value.x - grid.origin.x) * invCellSize);
  out.y = Math.floor((value.y - grid.origin.y) * invCellSize);
  out.z = Math.floor((value.z - grid.origin.z) * invCellSize);
  return out;
}

export function gridToWorld(value: GridCell, grid: GridSpec): MutableVec3 {
  return gridToWorldInto(value, grid, { x: 0, y: 0, z: 0 });
}

export function gridToWorldInto(value: GridCell, grid: GridSpec, out: MutableVec3): MutableVec3 {
  const size = grid.cellSize;
  out.x = grid.origin.x + value.x * size;
  out.y = grid.origin.y + value.y * size;
  out.z = grid.origin.z + value.z * size;
  return out;
}

/**
 * Inclusive grid-cell range touched by an AABB.
 *
 * The maximum corner is nudged by one Number.EPSILON-scaled unit so an AABB
 * whose max lies exactly on a cell boundary does not spill into the next cell.
 */
export function aabbToGridRange(value: Aabb, grid: GridSpec): MutableGridCellRange {
  return aabbToGridRangeInto(value, grid, gridCellRange());
}

export function aabbToGridRangeInto(value: Aabb, grid: GridSpec, out: MutableGridCellRange): MutableGridCellRange {
  worldToGridInto(value.min, grid, out.min);
  worldToGridInto({
    x: previousBoundaryValue(value.max.x),
    y: previousBoundaryValue(value.max.y),
    z: previousBoundaryValue(value.max.z)
  }, grid, out.max);
  return out;
}

export function visitGridCellsForAabb(value: Aabb, grid: GridSpec, visitor: GridCellVisitor): void {
  const range = aabbToGridRange(value, grid);
  const cell = gridCell();
  for (let z = range.min.z; z <= range.max.z; z++) {
    cell.z = z;
    for (let y = range.min.y; y <= range.max.y; y++) {
      cell.y = y;
      for (let x = range.min.x; x <= range.max.x; x++) {
        cell.x = x;
        visitor(cell);
      }
    }
  }
}

export function hashGridCell(value: GridCell): string {
  return `${value.x},${value.y},${value.z}`;
}

function previousBoundaryValue(value: number): number {
  if (value === Number.NEGATIVE_INFINITY || value === Number.POSITIVE_INFINITY) {
    return value;
  }
  const step = Math.max(1, Math.abs(value)) * Number.EPSILON;
  return value - step;
}
