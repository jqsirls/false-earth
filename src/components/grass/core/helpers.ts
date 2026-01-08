import * as THREE from 'three/webgpu'

/**
 * Extracts compute shader initial values from grass parameters
 */
export function extractComputeInitialValues(params: any) {
  return {
    bladeHeightMin: params.bladeHeightMin,
    bladeHeightMax: params.bladeHeightMax,
    bladeWidthMin: params.bladeWidthMin,
    bladeWidthMax: params.bladeWidthMax,
    bendAmountMin: params.bendAmountMin,
    bendAmountMax: params.bendAmountMax,
    bladeRandomness: params.bladeRandomness,
    clumpSize: params.clumpSize,
    clumpRadius: params.clumpRadius,
    centerYaw: params.centerYaw,
    bladeYaw: params.bladeYaw,
    clumpYaw: params.clumpYaw,
    typeTrendScale: params.typeTrendScale,
    windTime: 0.0,
    windScale: params.windScale ?? 0.25,
    windSpeed: params.windSpeed,
    windStrength: params.windStrength,
    windDir: { x: params.windDirX, y: params.windDirZ },
    windFacing: params.windFacing,
    cullOffset: params.bladeHeightMax ?? 0.8,
  }
}

/**
 * Updates compute shader uniforms from grass parameters
 */
export function updateComputeUniforms(uniforms: Record<string, any>, params: any) {
  // Shape parameters
  uniforms.uBladeHeightMin.value = params.bladeHeightMin
  uniforms.uBladeHeightMax.value = params.bladeHeightMax
  uniforms.uBladeWidthMin.value = params.bladeWidthMin
  uniforms.uBladeWidthMax.value = params.bladeWidthMax
  uniforms.uBendAmountMin.value = params.bendAmountMin
  uniforms.uBendAmountMax.value = params.bendAmountMax
  uniforms.uBladeRandomness.value.set(
    params.bladeRandomness.x,
    params.bladeRandomness.y,
    params.bladeRandomness.z
  )

  // Clump parameters
  uniforms.uClumpSize.value = params.clumpSize
  uniforms.uClumpRadius.value = params.clumpRadius
  uniforms.uCenterYaw.value = params.centerYaw
  uniforms.uBladeYaw.value = params.bladeYaw
  uniforms.uClumpYaw.value = params.clumpYaw
  uniforms.uTypeTrendScale.value = params.typeTrendScale

  // Wind parameters
  uniforms.uWindScale.value = params.windScale ?? 0.25
  uniforms.uWindSpeed.value = params.windSpeed
  uniforms.uWindStrength.value = params.windStrength
  uniforms.uWindDir.value.set(params.windDirX, params.windDirZ)
  uniforms.uWindFacing.value = params.windFacing

  // Culling parameters
  uniforms.uCullOffset.value = params.bladeHeightMax ?? 0.8
}

/**
 * Extracts material initial values from grass parameters and terrain params
 */
export function extractMaterialInitialValues(
  params: any,
  terrainParams?: { color?: string },
  light?: THREE.DirectionalLight,
  sharedUniforms?: Record<string, any>
) {
  const groundColor = terrainParams?.color || '#1a3319'
  const lightColor = light ? light.color : new THREE.Color('#ffffff')
  const lightDirection = new THREE.Vector3(0, 0, -1) // Default direction

  return {
    sharedUniforms,
    baseWidth: params.baseWidth,
    tipThin: params.tipThin,
    windTime: 0.0, // Will be updated in useFrame
    windDir: { x: params.windDirX, y: params.windDirZ },
    swayFreqMin: params.swayFreqMin,
    swayFreqMax: params.swayFreqMax,
    swayStrength: params.swayStrength,
    windDistanceStart: params.windDistanceStart,
    windDistanceEnd: params.windDistanceEnd,
    cullStart: params.cullStart,
    cullEnd: params.cullEnd,
    roughness: params.roughness,
    metalness: params.metalness,
    emissive: params.emissive,
    envMapIntensity: params.envMapIntensity,
    midSoft: params.midSoft,
    rimPos: params.rimPos,
    rimSoft: params.rimSoft,
    baseColor: params.baseColor,
    tipColor: params.tipColor,
    groundColor,
    bladeSeedRange: params.bladeSeedRange,
    clumpSeedRange: params.clumpSeedRange,
    aoPower: params.aoPower,
    lightDirection,
    lightColor,
    lightBackStrength: params.backLightStrength,
    noiseParams: {
      x: params.noiseFreqX,
      y: params.noiseFreqY,
      z: params.noiseRemapMin,
      w: params.noiseRemapMax,
    },
  }
}

/**
 * Updates material uniforms from grass parameters and terrain params
 */
export function updateMaterialUniforms(
  uniforms: Record<string, any>,
  material: THREE.MeshStandardNodeMaterial,
  grassParams: any,
  terrainParams?: { color?: string }
) {
  const params = grassParams as any

  // Wind parameters
  uniforms.uWindDir.value.set(params.windDirX, params.windDirZ)
  uniforms.uWindSwayFreqMin.value = params.swayFreqMin
  uniforms.uWindSwayFreqMax.value = params.swayFreqMax
  uniforms.uWindSwayStrength.value = params.swayStrength
  uniforms.uWindDistanceStart.value = params.windDistanceStart
  uniforms.uWindDistanceEnd.value = params.windDistanceEnd

  // Material properties
  material.roughness = params.roughness
  material.metalness = params.metalness
  if (params.emissive) {
    material.emissive = new THREE.Color(params.emissive)
  }
  material.envMapIntensity = params.envMapIntensity

  // Width shaping uniforms
  uniforms.uMidSoft.value = params.midSoft
  uniforms.uRimPos.value = params.rimPos
  uniforms.uRimSoft.value = params.rimSoft

  // Color uniforms
  const baseColor = new THREE.Color(params.baseColor)
  uniforms.uBaseColor.value.set(baseColor.r, baseColor.g, baseColor.b)

  const tipColor = new THREE.Color(params.tipColor)
  uniforms.uTipColor.value.set(tipColor.r, tipColor.g, tipColor.b)

  const groundColor = terrainParams?.color || '#1a3319'
  const groundColorObj = new THREE.Color(groundColor)
  uniforms.uGroundColor.value.set(groundColorObj.r, groundColorObj.g, groundColorObj.b)

  uniforms.uBladeSeedRange.value.set(params.bladeSeedRange.x, params.bladeSeedRange.y)
  uniforms.uClumpSeedRange.value.set(params.clumpSeedRange.x, params.clumpSeedRange.y)
  uniforms.uAOPower.value = params.aoPower

  // Lighting uniforms
  uniforms.uLightBackStrength.value = params.backLightStrength

  // Noise uniforms
  uniforms.uNoiseParams.value.set(
    params.noiseFreqX,
    params.noiseFreqY,
    params.noiseRemapMin,
    params.noiseRemapMax
  )
}

