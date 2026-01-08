import {
  Fn,
  vec2,
  vec4,
  fract,
  sin,
  mul,
  dot,
  mix,
  instancedArray,
  instanceIndex,
  uniform,
  sqrt,
  length,
  atan,
  cos,
  If,
  Loop,
  float,
  clamp,
  floor,
  uint,
  oneMinus,
  select,
  mx_fractal_noise_float,
  remapClamp,
  atomicAdd,
  atomicStore,
} from "three/tsl";
import * as THREE from "three";
import type { LODBufferConfig } from "./types";

/**
 * Creates a grass compute function that calculates blade parameters based on position
 * Matches the logic from grassComputeShader.glsl
 * Returns the compute function and uniform nodes for updating values
 */
export function createGrassCompute(
  grassData: ReturnType<typeof instancedArray>,
  positions: ReturnType<typeof instancedArray>,
  lodConfigs: LODBufferConfig[],
  initialValues?: {
    // Shape Parameters
    bladeHeightMin?: number;
    bladeHeightMax?: number;
    bladeWidthMin?: number;
    bladeWidthMax?: number;
    bendAmountMin?: number;
    bendAmountMax?: number;
    bladeRandomness?: { x: number; y: number; z: number };
    // Clump Parameters
    clumpSize?: number;
    clumpRadius?: number;
    centerYaw?: number;
    bladeYaw?: number;
    clumpYaw?: number;
    typeTrendScale?: number;
    // Wind Parameters
    windTime?: number;
    windScale?: number;
    windSpeed?: number;
    windStrength?: number;
    windDir?: { x: number; y: number };
    windFacing?: number;
    // Culling Parameters
    cullOffset?: number; // Offset to account for blade height/width in frustum culling
  }
) {
  // Shape Parameters
  const uBladeHeightMin = uniform(initialValues?.bladeHeightMin ?? 0.4);
  const uBladeHeightMax = uniform(initialValues?.bladeHeightMax ?? 0.8);
  const uBladeWidthMin = uniform(initialValues?.bladeWidthMin ?? 0.01);
  const uBladeWidthMax = uniform(initialValues?.bladeWidthMax ?? 0.05);
  const uBendAmountMin = uniform(initialValues?.bendAmountMin ?? 0.2);
  const uBendAmountMax = uniform(initialValues?.bendAmountMax ?? 0.6);

  const bladeRandomness = initialValues?.bladeRandomness ?? {
    x: 0.3,
    y: 0.3,
    z: 0.2,
  };
  const uBladeRandomness = uniform(
    new THREE.Vector3(bladeRandomness.x, bladeRandomness.y, bladeRandomness.z)
  );

  // Clump Parameters
  const uClumpSize = uniform(initialValues?.clumpSize ?? 0.8);
  const uClumpRadius = uniform(initialValues?.clumpRadius ?? 1.5);
  const uCenterYaw = uniform(initialValues?.centerYaw ?? 1.0);
  const uBladeYaw = uniform(initialValues?.bladeYaw ?? 1.2);
  const uClumpYaw = uniform(initialValues?.clumpYaw ?? 0.5);
  const uTypeTrendScale = uniform(initialValues?.typeTrendScale ?? 0.1);

  // Wind Parameters
  const uTime = uniform(initialValues?.windTime ?? 0.0);
  const uWindScale = uniform(initialValues?.windScale ?? 0.25);
  const uWindSpeed = uniform(initialValues?.windSpeed ?? 0.6);
  const uWindStrength = uniform(initialValues?.windStrength ?? 0.35);
  const windDir = initialValues?.windDir ?? { x: 1, y: 0 };
  const uWindDir = uniform(new THREE.Vector2(windDir.x, windDir.y));
  const uWindFacing = uniform(initialValues?.windFacing ?? 0.6);

  const uCullOffset = uniform(initialValues?.cullOffset ?? 0.8); // Default to max blade height
  
  const uViewMatrix = uniform(new THREE.Matrix4());
  const uProjectionMatrix = uniform(new THREE.Matrix4());
  const uCameraPosition = uniform(new THREE.Vector3());
  const uModelMatrix = uniform(new THREE.Matrix4());

  // Build LOD routing chain factory function
  // This creates a function that builds the If-Else chain when called with TSL variables
  const createLODRoutingChainBuilder = (configs: LODBufferConfig[]) => {
    return (distToCamera: any, instanceIndex: any) => {
      if (configs.length === 0) return;
      if (configs.length === 1) {
        // Single LOD - no condition needed, just add to it
        const config = configs[0];
        const lodIndex = atomicAdd(config.drawStorage.get("instanceCount"), uint(1));
        config.indices.element(lodIndex).assign(uint(instanceIndex));
        return;
      }

      // Build chain forwards: If(condition1, block1).Else(If(condition2, block2).Else(...))
      const buildChain = (index: number): any => {
        if (index >= configs.length) return;
        
        const config = configs[index];
        const isLast = index === configs.length - 1;
        
        // Check if distance falls within this LOD's range
        const minDist = float(config.minDistance);
        const maxDist = config.maxDistance === Infinity 
          ? float(1e9) // Use a very large number for Infinity
          : float(config.maxDistance);
        
        const inRange = distToCamera.greaterThanEqual(minDist).and(
          isLast || config.maxDistance === Infinity
            ? distToCamera.lessThanEqual(maxDist)
            : distToCamera.lessThan(maxDist)
        );

        const lodBlock = () => {
          const lodIndex = atomicAdd(config.drawStorage.get("instanceCount"), uint(1));
          config.indices.element(lodIndex).assign(uint(instanceIndex));
        };

        if (isLast) {
          return If(inRange, lodBlock);
        } else {
          const nextChain = buildChain(index + 1);
          return If(inRange, lodBlock).Else(() => {
            if (nextChain) nextChain;
          });
        }
      };

      const chain = buildChain(0);
      if (chain) chain;
    };
  };

  // Create the routing chain builder at JavaScript time
  const buildLODRouting = createLODRoutingChainBuilder(lodConfigs);

  // Helper function to calculate distance to camera (reused in culling and LOD)
  const calculateDistance = Fn(([instancePos]: [any]) => {
    const worldPosBottom = uModelMatrix.mul(vec4(instancePos.x, instancePos.y, instancePos.z, float(1.0))).xyz;
    const camPos = uCameraPosition;
    return length(worldPosBottom.sub(camPos));
  });
  
  // Culling function: Performs frustum and distance culling with offset support
  // Returns visibility (boolean) - reuses calculateDistance for distance calculation
  const performCulling = Fn(([instancePos]: [any]) => {
    const worldPosBottom = uModelMatrix.mul(vec4(instancePos.x, instancePos.y, instancePos.z, float(1.0))).xyz;
    const worldPosTop = vec4(worldPosBottom.x, worldPosBottom.y.add(uCullOffset), worldPosBottom.z, float(1.0));
    
    // Get camera matrices from uniforms (manually updated each frame)
    const viewMatrix = uViewMatrix;
    const projMatrix = uProjectionMatrix;
    const viewProjMatrix = projMatrix.mul(viewMatrix);
    
    // Transform bottom position to clip space
    const clipPosBottom = viewProjMatrix.mul(vec4(worldPosBottom.x, worldPosBottom.y, worldPosBottom.z, float(1.0)));
    const ndcBottom = clipPosBottom.xyz.div(clipPosBottom.w);
    
    // Transform top position to clip space
    const clipPosTop = viewProjMatrix.mul(worldPosTop);
    const ndcTop = clipPosTop.xyz.div(clipPosTop.w);
    
    // Check if either bottom or top position is within frustum bounds
    // Use a margin to account for blade width
    const margin = float(0.1); // Margin for blade width
    
    // Check if bottom position is in frustum
    const bottomInFrustum = ndcBottom.x.greaterThan(float(-1.0).sub(margin))
      .and(ndcBottom.x.lessThan(float(1.0).add(margin)))
      .and(ndcBottom.y.greaterThan(float(-1.0).sub(margin)))
      .and(ndcBottom.y.lessThan(float(1.0).add(margin)))
      .and(ndcBottom.z.greaterThan(float(-1.0).sub(margin)))
      .and(ndcBottom.z.lessThan(float(1.0).add(margin)));
    
    // Check if top position is in frustum
    const topInFrustum = ndcTop.x.greaterThan(float(-1.0).sub(margin))
      .and(ndcTop.x.lessThan(float(1.0).add(margin)))
      .and(ndcTop.y.greaterThan(float(-1.0).sub(margin)))
      .and(ndcTop.y.lessThan(float(1.0).add(margin)))
      .and(ndcTop.z.greaterThan(float(-1.0).sub(margin)))
      .and(ndcTop.z.lessThan(float(1.0).add(margin)));
    
    // Blade is in frustum if either bottom or top is visible
    const inFrustum = bottomInFrustum.or(topInFrustum);
    return inFrustum;
  });

  const computeFn = Fn(() => {
    // Constants
    const PI = float(3.14159265359);
    const TWO_PI = float(6.28318530718);

    // Extract vector components early to avoid circular references
    const bladeRandX = uBladeRandomness.x;
    const bladeRandY = uBladeRandomness.y;
    const bladeRandZ = uBladeRandomness.z;

    // Hash functions - matching compute shader
    const hash11 = (x: any) => fract(mul(sin(mul(x, 37.0)), 43758.5453123));

    const hash21 = (p: any) => {
      const h1 = hash11(dot(p, vec2(127.1, 311.7)));
      const h2 = hash11(dot(p, vec2(269.5, 183.3)));
      return vec2(h1, h2);
    };

    const hash2 = (p: any) => {
      const x = dot(p, vec2(127.1, 311.7));
      const y = dot(p, vec2(269.5, 183.3));
      return fract(sin(vec2(x, y)).mul(43758.5453));
    };

    const safeNormalize = (v: any) => {
      const m2 = dot(v, v);
      const normalized = v.mul(float(1.0).div(sqrt(m2)));
      const fallback = vec2(1.0, 0.0);
      return select(m2.greaterThan(float(1e-6)), normalized, fallback);
    };

    const normalizeAngle = (angle: any) => {
      return atan(sin(angle), cos(angle));
    };

    // Voronoi clump calculation - getClumpInfo
    const getClumpInfo = (worldXZ: any) => {
      const cell = worldXZ.div(uClumpSize);
      const baseCellX = floor(cell.x);
      const baseCellY = floor(cell.y);
      const baseCell = vec2(baseCellX, baseCellY);

      const minDist = float(1e9).toVar();
      const bestCellId = vec2(0.0, 0.0).toVar();

      // Check 3x3 neighborhood to find closest Voronoi cell
      Loop(
        { start: uint(0), end: uint(3), type: "uint", condition: "<" },
        ({ i: j }) => {
          Loop(
            { start: uint(0), end: uint(3), type: "uint", condition: "<" },
            ({ i }) => {
              const jVal = float(j).sub(1.0);
              const iVal = float(i).sub(1.0);
              const neighborCell = baseCell.add(vec2(iVal, jVal));
              const seed = hash2(neighborCell);
              const seedCoord = neighborCell.add(seed);
              const diff = cell.sub(seedCoord);
              const d2 = dot(diff, diff);

              If(d2.lessThan(minDist), () => {
                minDist.assign(d2);
                bestCellId.assign(neighborCell);
              });
            }
          );
        }
      );

      // Calculate direction from blade position to clump center (unnormalized)
      const clumpSeed = hash2(bestCellId);
      const clumpCenterWorld = bestCellId.add(clumpSeed).mul(uClumpSize);
      const toCenter = clumpCenterWorld.sub(worldXZ);

      return { toCenter, cellId: bestCellId };
    };

    // Calculate presence (fade-out factor) based on distance from clump center
    const calculatePresence = (toCenter: any) => {
      const distToCenter = length(toCenter);
      const r = clamp(distToCenter.div(uClumpRadius), float(0.0), float(1.0));
      const t = clamp(
        r.sub(float(0.7)).div(oneMinus(float(0.7))),
        float(0.0),
        float(1.0)
      );
      const smoothstepVal = t.mul(t).mul(float(3.0).sub(t.mul(float(2.0))));
      return oneMinus(smoothstepVal);
    };

    // Generate per-clump parameters (height, width, bend, type)
    const getClumpParams = (cellId: any) => {
      const c1 = hash21(cellId.mul(11.0));
      const c2 = hash21(cellId.mul(23.0));

      const clumpBaseHeight = mix(uBladeHeightMin, uBladeHeightMax, c1.x);
      const clumpBaseWidth = mix(uBladeWidthMin, uBladeWidthMax, c1.y);
      const clumpBaseBend = mix(uBendAmountMin, uBendAmountMax, c2.x);

      // Use mx_fractal_noise_float for typeTrend (matching simplexNoise2d from GLSL)
      const typeTrend = mx_fractal_noise_float(cellId.mul(uTypeTrendScale));
      const typeTrendNormalized = typeTrend.mul(0.5).add(0.5);

      return {
        height: clumpBaseHeight,
        width: clumpBaseWidth,
        bend: clumpBaseBend,
        type: typeTrendNormalized,
      };
    };

    // Generate per-blade parameters based on clump params
    const getBladeParams = (seed: any, clumpParams: any) => {
      const h1 = hash21(seed.mul(13.0));
      const h2 = hash21(seed.mul(29.0));

      const height = clumpParams.height.mul(
        mix(oneMinus(bladeRandX), float(1.0).add(bladeRandX), h1.x)
      );
      const width = clumpParams.width.mul(
        mix(oneMinus(bladeRandY), float(1.0).add(bladeRandY), h1.y)
      );
      const bend = clumpParams.bend.mul(
        mix(oneMinus(bladeRandZ), float(1.0).add(bladeRandZ), h2.x)
      );
      const type = clumpParams.type;

      return { height, width, bend, type };
    };

    // Calculate base angle with clump and per-blade variations
    const calculateBaseAngle = (
      toCenter: any,
      _worldXZ: any,
      cellId: any,
      perBladeHash01: any
    ) => {
      const clumpAngle = atan(toCenter.y, toCenter.x).mul(uCenterYaw);
      const randomOffset = perBladeHash01.sub(0.5).mul(uBladeYaw);
      const clumpHash = hash11(dot(cellId, vec2(97.7, 3.1)));
      const clumpYaw = clumpHash.sub(0.5).mul(uClumpYaw);
      return clumpAngle.add(randomOffset).add(clumpYaw);
    };

    // Blend angle towards wind direction
    const applyWindFacing = (
      baseAngle: any,
      windDir: any,
      windStrength01: any
    ) => {
      const windAngle = atan(windDir.y, windDir.x);
      const angleDiff = atan(
        sin(windAngle.sub(baseAngle)),
        cos(windAngle.sub(baseAngle))
      );
      return baseAngle.add(angleDiff.mul(uWindFacing.mul(windStrength01)));
    };

    // Apply wind facing and normalize angle to [0, 1] range
    const applyWindFacingAndNormalize = (
      baseAngle: any,
      windStrength01: any
    ) => {
      const windDir = safeNormalize(uWindDir);
      const facingAngle = applyWindFacing(baseAngle, windDir, windStrength01);
      return normalizeAngle(facingAngle).add(PI).div(TWO_PI);
    };

    const calculateWindStrength = (worldXZ: any) => {
      const windDirNorm = safeNormalize(uWindDir);
      const windUv = worldXZ
        .mul(uWindScale)
        .add(windDirNorm.mul(uTime).mul(uWindSpeed));

      const windStrength01 = mx_fractal_noise_float(windUv);
      // Remap noise value from [-1, 1] to [0, uWindStrength] and clamp to [0, 1]
      return remapClamp(
        windStrength01,
        float(-1.0),
        float(1.0),
        float(0.0),
        uWindStrength
      );
    };

    // Main compute logic
    const data = grassData.element(instanceIndex);
    const instancePos = positions.element(instanceIndex);

    // Get worldXZ position (x and z components)
    const worldXZ = vec2(instancePos.x, instancePos.z);

    // Calculate Voronoi clump information
    const { toCenter, cellId } = getClumpInfo(worldXZ);

    // Calculate clump-related data
    const presence = calculatePresence(toCenter);

    // Generate blade and clump parameters
    const clumpParams = getClumpParams(cellId);
    const bladeParams = getBladeParams(worldXZ, clumpParams);

    // Generate seeds
    const perBladeHash01 = hash11(dot(worldXZ, vec2(37.0, 17.0)));
    const clumpSeed01 = hash11(dot(cellId, vec2(47.3, 61.7)));

    // Calculate blade facing angle
    const baseAngle = calculateBaseAngle(
      toCenter,
      worldXZ,
      cellId,
      perBladeHash01
    );

    // Apply wind effects
    const windStrength = calculateWindStrength(worldXZ);
    const facingAngle01 = applyWindFacingAndNormalize(baseAngle, windStrength);

    // Write all parameters back to data structure
    data.get("bladeHeight").assign(bladeParams.height);
    data.get("bladeWidth").assign(bladeParams.width);
    data.get("bladeBend").assign(bladeParams.bend);
    data.get("bladeType").assign(bladeParams.type);

    data.get("toCenter").assign(toCenter);
    data.get("presence").assign(presence);
    data.get("clumpSeed01").assign(clumpSeed01);

    data.get("facingAngle01").assign(facingAngle01);
    data.get("perBladeHash01").assign(perBladeHash01);
    data.get("windStrength01").assign(windStrength);

    // Perform culling to check visibility
    const isVisible = performCulling(instancePos);
    
    // Calculate distance to camera for LOD decision
    const distToCamera = calculateDistance(instancePos);

    If(isVisible, () => {
      buildLODRouting(distToCamera, instanceIndex);
    });
  });

  return {
    computeFn,
    uniforms: {
      // Shape Parameters
      uBladeHeightMin,
      uBladeHeightMax,
      uBladeWidthMin,
      uBladeWidthMax,
      uBendAmountMin,
      uBendAmountMax,
      uBladeRandomness,
      // Clump Parameters
      uClumpSize,
      uClumpRadius,
      uCenterYaw,
      uBladeYaw,
      uClumpYaw,
      uTypeTrendScale,
      // Wind Parameters
      uTime,
      uWindScale,
      uWindSpeed,
      uWindStrength,
      uWindDir,
      uWindFacing,
      uCullOffset,
      // Camera and Model matrices for culling (manually updated each frame)
      uViewMatrix,
      uProjectionMatrix,
      uCameraPosition,
      uModelMatrix,
    },
  };
}

/**
 * Creates a lightweight compute shader to reset the indirect draw buffers
 * This should be executed before the main culling compute shader each frame
 * Supports multiple LOD buffers via array
 */
export function createResetDrawBufferCompute(
  lodConfigs: LODBufferConfig[]
) {
  const resetFn = Fn(() => {
    // Reset all LOD buffers - generate reset code for each buffer
    lodConfigs.forEach((lodConfig) => {
      const drawBuffer = lodConfig.drawStorage;
      
      drawBuffer.get("vertexCount").assign(uint(lodConfig.vertexCount));
      atomicStore(drawBuffer.get("instanceCount"), uint(0));
      drawBuffer.get("firstVertex").assign(uint(0));
      drawBuffer.get("firstInstance").assign(uint(0));
      drawBuffer.get("offset").assign(uint(0));
    });
  });

  // Only need 1 thread to reset all counters
  return resetFn().compute(1);
}

