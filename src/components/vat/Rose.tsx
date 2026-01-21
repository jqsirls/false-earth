import { useEffect, useMemo, useRef, useImperativeHandle, forwardRef } from "react";
import * as THREE from "three/webgpu";
import { useTexture } from "@react-three/drei";
import { folder, useControls } from "leva";
import { atomicAdd, atomicStore, storage, uint, uniform, vec3, instanceIndex, instancedArray, If, time, Fn, float, struct } from "three/tsl";
import { useVATPreloader } from "./VATPreloader";
import { extractGeometryFromScene, setupVATGeometry } from "./utils";
import { createVATMaterial } from "./materials/vatNodeMaterial";
import { drawIndirectStructure } from "../grass/core/constants";
import { useFrame, useThree } from "@react-three/fiber";
import { WebGPURenderer } from 'three/webgpu'
import { vatStructure } from "./constant";

// Define API exposed to parent component
export type RoseHandle = {
    spawn: (pos: THREE.Vector3) => void
}

const Rose = forwardRef<RoseHandle, { count: number }>(({ count }, ref) => {
    const gl = useThree((state) => state.gl)
    const { scene, posTex, nrmTex, meta, isLoaded } = useVATPreloader('/vat/Rose_meta.json')
    const groupRef = useRef<THREE.Group>(null)

    const uniforms = useMemo(() => ({
        uGreen: uniform(vec3(0.6, 0.9, 0.6)),
    }), [])

    const petalTex = useTexture('/textures/Rose/Rose_Petal_Diff.png')
    petalTex.colorSpace = THREE.SRGBColorSpace
    const outlineTex = useTexture('/textures/Rose/Rose_Outline.png')

    const [config] = useControls('Rose', () => ({
        Render: folder({
            Green: { value: '#325825' },
        }),
    }))

    const spawnUniforms = useMemo(() => ({
        uSpawnPos: uniform(vec3(0)),
        uDoSpawn: uniform(0), // 0=no spawn, 1=spawn
    }), [])

    const spawnStorage = useMemo(() => {
        const spawnStateStruct = struct({
            index: { type: 'uint', atomic: true }
        })
        const buffer = new THREE.StorageBufferAttribute(new Uint32Array([0]), 1)
        return storage(buffer, spawnStateStruct, 1)
    }, [])

    // Expose spawn method to parent component
    useImperativeHandle(ref, () => ({
        spawn: (pos: THREE.Vector3) => {
            // Directly write to uniform, bypassing React State
            spawnUniforms.uSpawnPos.value.copy(pos)
            spawnUniforms.uDoSpawn.value = 1
        }
    }), [spawnUniforms])


    // Initialize data buffer (using struct: vec3 + float + float + float = 6 floats per instance)
    const vatData = useMemo(() => {
        // Calculate total size (vec3=3 + float=1 + float=1 + float=1 = 6 floats per instance)
        const data = new Float32Array(count * 6)

        // Pre-fill initial positions in CPU (Refactor: positions in buffer, not calculated in shader)
        for (let i = 0; i < count; i++) {
            const stride = 6
            // Position (x, y, z) - currently linear arrangement for visual confirmation
            data[i * stride + 0] = i * 0.1
            data[i * stride + 1] = 0
            data[i * stride + 2] = 0
            // Scale
            data[i * stride + 3] = 1.0
            // Frame
            data[i * stride + 4] = 0
            // isActive
            data[i * stride + 5] = 1.0
        }
        return instancedArray(data, vatStructure)
    }, [count])

    const computeRefs = useRef<{ reset: THREE.ComputeNode, spawn: THREE.ComputeNode, update: THREE.ComputeNode } | null>(null)

    useEffect(() => {
        if (!groupRef.current || !scene || !meta || !isLoaded || !vatData || !spawnStorage) return

        const geometry = extractGeometryFromScene(scene)
        if (!geometry) {
            console.warn('VAT geometry not found in scene')
            return
        }

        // Indirect Draw Setup
        const indexCount = geometry.index ? geometry.index.count : geometry.attributes.position.count
        const drawBuffer = new THREE.IndirectStorageBufferAttribute(new Uint32Array(indexCount), indexCount)
        const drawStorage = storage(drawBuffer, drawIndirectStructure, 1)
        geometry.setIndirect(drawBuffer)

        const visibleIndicesBuffer = createVisibleIndicesBuffer(count)

        // Compute Shaders
        const resetCompute = createResetCompute(drawStorage, indexCount)
        const spawnCompute = createSpawnCompute(vatData, spawnStorage, spawnUniforms, count)
        const updateCompute = createUpdateCompute(drawStorage, visibleIndicesBuffer, vatData, count)

        computeRefs.current = { reset: resetCompute, spawn: spawnCompute, update: updateCompute }

        setupVATGeometry(geometry as any, meta as any)

        const mat = createVATMaterial(
            posTex as THREE.Texture,
            nrmTex as THREE.Texture,
            vatData,
            visibleIndicesBuffer,
            meta as any,
            uniforms,
            petalTex,
            outlineTex,
        )
        const mesh = new THREE.Mesh(geometry, mat)
        mesh.count = count
        mesh.frustumCulled = false
        groupRef.current.add(mesh)

        return () => {
            groupRef.current?.remove(mesh)
            geometry.dispose()
            mat.dispose()
        }
    }, [scene, meta, isLoaded, posTex, nrmTex, vatData])

    useEffect(() => {
        const baseColor = new THREE.Color(config.Green)
        uniforms.uGreen.value.set(baseColor.r, baseColor.g, baseColor.b)
    }, [config, uniforms])

    useFrame(() => {
        const renderer = gl as unknown as WebGPURenderer
        if (!computeRefs.current) return

        renderer.compute(computeRefs.current.reset)
        renderer.compute(computeRefs.current.spawn)
        renderer.compute(computeRefs.current.update)

        // Reset spawn flag each frame (important, keep this)
        spawnUniforms.uDoSpawn.value = 0
    })

    return <group ref={groupRef}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} scale={10}>
            <planeGeometry />
            <meshBasicMaterial color="white" />
        </mesh>
    </group>
})

Rose.displayName = 'Rose'

export default Rose


export function createUpdateCompute(
    drawStorage: ReturnType<typeof storage>,
    indices: ReturnType<typeof instancedArray>,
    vatData: ReturnType<typeof instancedArray>,
    count: number,
) {
    const updateFn = Fn(() => {
        const data = vatData.element(instanceIndex)

        // Simple animation logic: if active, update frame
        If(data.get("isActive").greaterThan(0), () => {

            const age = time.sub(data.get("startTime"))
            const progress = age.div(float(2.0))

            If(progress.greaterThan(1.0), () => {
                data.get("isActive").assign(0.0)
                data.get("scale").assign(0.0)
            }).Else(() => {
                data.get("frame").assign(progress) // Animate
                // Add to draw queue
                const idx = atomicAdd(drawStorage.get("instanceCount"), uint(1))
                indices.element(idx).assign(uint(instanceIndex))
            })
        })
    })
    return updateFn().compute(count)
}


export function createResetCompute(drawStorage: ReturnType<typeof storage>, indexCount: number) {
    return Fn(() => {
        drawStorage.get("vertexCount").assign(uint(indexCount))
        atomicStore(drawStorage.get("instanceCount"), uint(0))
    })().compute(1)
}

export function createSpawnCompute(
    vatData: ReturnType<typeof instancedArray>,
    spawnStorage: ReturnType<typeof storage>, // use to record the current index of the rose
    uniforms: { uSpawnPos: any, uDoSpawn: any },
    maxCount: number
) {
    const spawnFn = Fn(() => {
        // only execute when the CPU notifies to Spawn
        If(uniforms.uDoSpawn.greaterThan(0), () => {

            // atomic operation only allow one thread to execute at a time
            // this can prevent the other 63 threads in the same Workgroup from executing
            If(instanceIndex.equal(0), () => {
                const headIndex = atomicAdd(spawnStorage.get("index"), uint(1)).mod(uint(maxCount))

                const instance = vatData.element(headIndex)

                instance.get('position').assign(uniforms.uSpawnPos) // set to the current position of the character
                instance.get('startTime').assign(time)              // record the birth time
                instance.get('isActive').assign(1.0)                // mark as alive
                instance.get('frame').assign(0.0)                   // reset the animation frame
                instance.get('scale').assign(2.0)                   // (optional) add random scale
            })
        })
    })
    // this shader only needs to run 1 time (single thread processing pointer movement)
    return spawnFn().compute(1)
}

export function createVisibleIndicesBuffer(count: number) {
    return instancedArray(new Uint32Array(count), 'uint')
}
