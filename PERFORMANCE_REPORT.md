# Mensura Performance Report

## Overview
This report analyzes the current state of the Mensura library and provides performance insights along with optimization recommendations.

## Current State Analysis

### Project Structure
- Core mathematical types: `vec3`, `vec4`, `mat3`, `mat4`, quaternions
- Geometry primitives: `ray`, `plane`, `aabb`, `sphere`, `frustum`
- GPU interface: `Float32Array` and `DataView` adapters
- Export structure: modular design with core, geometry, and gpu components

### Library Characteristics
- Immutable-by-default API with `Into` variants for performance
- Strict right-handed coordinate system (+X right, +Y up, -Z forward)
- Column-major matrices with column-vector multiplication (`p' = M * p`)
- WebGPU-style NDC depth range (Z ∈ [0, 1])

## Performance Benchmarks

### Key Findings
Based on the benchmark results from the built-in Mensura benchmark:

#### Vector Operations
- `add3` performs 1.06x faster than naive object creation
- `normalize3Into` significantly outperforms `normalize3` (1.28x faster) due to in-place operations
- In-place operations consistently perform better than immutable ones

#### Matrix Operations
- `mat4MultiplyInto` significantly outperforms `mat4Multiply` (1.70x faster)
- `mat4TransformPoint3Into` performs 1.40x faster than the immutable version
- Matrix operations benefit substantially from in-place updates

#### Memory Efficiency
- The `Into` pattern demonstrates significant performance benefits
- GPU-oriented functions show excellent performance (e.g., `vec3WriteFloat32` at 69.6M ops/s)

## Optimization Recommendations

### 1. API Usage Patterns
- Encourage use of `Into` variants in performance-critical loops
- Provide guidance for object pooling in hot paths
- Implement examples showing optimal usage patterns

### 2. Hot Path Optimizations
- The benchmarks confirm that in-place operations are significantly faster
- Consider adding more `Into` variants for commonly used functions
- Implement SIMD optimizations where applicable

### 3. Experimental Physics Module
- The physics module (gjk.ts, bvh.ts, etc.) currently has compilation issues
- These modules need to follow the immutable-by-default pattern with `Into` variants
- Consider moving experimental modules to a separate package or development branch

### 4. Type Safety vs Performance
- The `exactOptionalPropertyTypes: true` setting caught a legitimate issue in `triangle-mesh.ts`
- This strictness improves code quality at the cost of some API convenience
- The fix maintains type safety while preserving the intended functionality

## Compilation Issues Resolved

### Fixed `triangle-mesh.ts`
- Corrected type definition to satisfy `exactOptionalPropertyTypes`
- Maintained the same functionality with proper TypeScript compliance

### Removed Physics from Main Export
- Physics modules were causing compilation errors
- Removed from main export to maintain stable build
- Physics modules can be developed separately and integrated when ready

## Performance Best Practices

Based on the benchmark results, the following best practices emerge:

1. **Use Into Variants**: When performing many calculations in loops, use `Into` variants for significant performance gains
2. **Object Pooling**: For frequently allocated temporary objects, consider reusing instances
3. **Batch Operations**: Group similar operations to maximize cache efficiency
4. **Minimize Allocation**: Reduce garbage collection pressure by reusing objects where possible

## Conclusion

Mensura is well-designed for performance with its dual approach of immutable defaults and mutable `Into` variants. The benchmarks confirm that the `Into` variants offer substantial performance improvements in performance-sensitive contexts. The library's strict type safety catches real issues while maintaining high performance.

The main recommendation is to continue emphasizing the `Into` pattern for hot paths while keeping the immutable API for general use cases. The modular architecture allows for targeted optimizations without affecting the overall stability of the library.