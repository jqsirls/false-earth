import * as THREE from 'three/webgpu'
import { useMemo, useEffect } from 'react'
import { useControls } from 'leva'
import {
    Fn,
    vec3,
    vec2,
    vec4,
    float,
    uniform,
    positionLocal,
    modelWorldMatrix,
} from 'three/tsl'
import { DEFAULT_PATCH_SIZE } from '../grass/core/constants'
import {
    getTerrainHeight,
} from './terrainHelpers'

export function Terrain({
    onUniformsChange,
    patchSize = DEFAULT_PATCH_SIZE
}: {
    onUniformsChange?: (uniforms: { uTerrainAmp: any; uTerrainFreq: any; uTerrainSeed: any; uColor: any }) => void
    patchSize?: number
}) {
    const terrainParams = useControls('Terrain', {
        amplitude: { value: 1.5, min: 0.1, max: 3.0, step: 0.1 },
        frequency: { value: 0.1, min: 0.01, max: 0.1, step: 0.01 },
        seed: { value: 0.0, min: 0.0, max: 100.0, step: 0.1 },
        color: { value: '#1a3310' }
    }, { collapsed: true })


    const uniforms = useMemo(() => {
        const colorValue = new THREE.Color(terrainParams.color);
        return {
            uTerrainAmp: uniform(terrainParams.amplitude),
            uTerrainFreq: uniform(terrainParams.frequency),
            uTerrainSeed: uniform(terrainParams.seed),
            uColor: uniform(vec3(colorValue.r, colorValue.g, colorValue.b))
        }
    }, [])

    // Expose uniforms to parent
    useEffect(() => {
        if (onUniformsChange) {
            onUniformsChange(uniforms)
        }
    }, [uniforms, onUniformsChange])

    // Create material with terrain functions
    const material = useMemo(() => {
        const terrainHeight = getTerrainHeight(uniforms.uTerrainAmp, uniforms.uTerrainFreq, uniforms.uTerrainSeed)

        const mat = new THREE.MeshBasicNodeMaterial()
        mat.side = THREE.DoubleSide
        mat.colorNode = vec4(uniforms.uColor, float(1.0))

        mat.positionNode = Fn(() => {
            const localPos = positionLocal
            const worldPos = modelWorldMatrix.mul(vec4(localPos, float(1.0))).xyz
            const h = terrainHeight(worldPos.xz)
            const displacedPos = vec3(localPos.x, localPos.y, localPos.z.add(h))
            return vec4(displacedPos, float(1.0))
        })()

        return mat
    }, [])

    // Update uniforms when terrainParams change
    useEffect(() => {
        uniforms.uTerrainAmp.value = terrainParams.amplitude
        uniforms.uTerrainFreq.value = terrainParams.frequency
        uniforms.uTerrainSeed.value = terrainParams.seed
        const colorObj = new THREE.Color(terrainParams.color)
        uniforms.uColor.value.set(colorObj.r, colorObj.g, colorObj.b)
    }, [terrainParams, uniforms])


    return (
        // High segment count is needed for smooth FBM terrain
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[patchSize, patchSize, 20, 20]} />
            <primitive object={material} />
        </mesh>
    )
}

