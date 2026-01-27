import { useEffect, useMemo, useRef, useImperativeHandle, forwardRef } from "react";
import * as THREE from "three/webgpu";
import { useTexture } from "@react-three/drei";
import { useVATPreloader, extractGeometryFromScene, setupVATGeometry } from "./core";
import { createVATMaterial } from "./core/vatMaterial";
import { useGameStore } from "../../core/store/gameStore";
import { useRoseUniforms } from "./hooks/useRoseUniforms";
import { useRoseCompute } from "./hooks/useRoseCompute";

export type RoseHandle = {
    spawn: (pos: THREE.Vector3, count?: number, radius?: number) => void
}

const Rose = forwardRef<RoseHandle, { count: number }>(({ count }, ref) => {
    const { scene, posTex, nrmTex, meta, isLoaded } = useVATPreloader('/vat/Rose_meta.json')
    const textures = useTexture({
        petal: '/textures/Rose/Rose_Petal_Diff.png',
        outline: '/textures/Rose/Rose_Outline.png',
        normal: '/textures/Rose/Rose_Petal_Normal.png'
    });
    
    const terrainUniforms = useGameStore((state) => state.terrainUniforms)
    const windUniforms = useGameStore((state) => state.windUniforms)
    
    const { uniforms, config } = useRoseUniforms()

    const geometry = useMemo(() => {
        if (!scene || !meta) return null;
        const geom = extractGeometryFromScene(scene);
        if (geom) setupVATGeometry(geom as any, meta as any);
        return geom;
    }, [scene, meta]);

    const { vatData, visibleIndices, spawn } = useRoseCompute(count, geometry, uniforms.compute)


    const material = useMemo(() => {
        if (!scene || !meta || !isLoaded || !vatData || !terrainUniforms || !windUniforms || !geometry) return


        textures.petal.colorSpace = THREE.SRGBColorSpace;
        textures.normal.repeat.set(0.8, 1);
        textures.normal.offset.set(0.1, 0);


        const mat = createVATMaterial(
            posTex as THREE.Texture,
            nrmTex as THREE.Texture,
            vatData,
            visibleIndices,
            meta as any,
            uniforms.mat,
            textures.petal,
            textures.outline,
            textures.normal,
            terrainUniforms || undefined,
            windUniforms || undefined,
        )

        return mat
    }, [scene, meta, isLoaded, posTex, nrmTex, vatData, terrainUniforms, windUniforms])

    useEffect(() => {
        if (!material) return
        material.metalness = config.metalness
        material.roughness = config.roughness
    }, [config.metalness, config.roughness])
    
    useImperativeHandle(ref, () => ({ spawn }), [spawn]);

    useEffect(() => {
        return () => {
            geometry?.dispose();
            material?.dispose();
        };
    }, [geometry, material]);

    if (!geometry || !material) return null

    return <mesh geometry={geometry} material={material} count={count} frustumCulled={false} />
})

Rose.displayName = 'Rose'

export default Rose
