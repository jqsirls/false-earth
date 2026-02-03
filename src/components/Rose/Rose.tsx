import { useEffect, useMemo, useRef, useImperativeHandle, forwardRef } from "react";
import * as THREE from "three/webgpu";
import { useVATPreloader, extractGeometryFromScene, setupVATGeometry } from "./core";
import { createVATMaterial } from "./core/vatMaterial";
import { useGameStore } from "../../core/store/gameStore";
import { useRoseUniforms } from "./hooks/useRoseUniforms";
import { useRoseCompute } from "./hooks/useRoseCompute";
import { useKTX2Texture } from "../../core/utils/useKTX2Texture";
import { ROSE_TEXTURES } from "./core/config";
import { useFrame } from "@react-three/fiber";

import { gameEvents } from "../../core/events";

export default function Rose({ count }: { count: number }) {
    const { scene, posTex, nrmTex, meta, isLoaded } = useVATPreloader('/vat/Rose_meta.json')

    const textures = useKTX2Texture(ROSE_TEXTURES)
    const characterRef = useGameStore((state) => state.characterRef)
    const characterPos = useMemo(() => new THREE.Vector3(), [])

    const { uniforms, config } = useRoseUniforms()

    const geometry = useMemo(() => {
        if (!scene || !meta) return null;
        const geom = extractGeometryFromScene(scene);
        if (geom) setupVATGeometry(geom as any, meta as any);
        return geom;
    }, [scene, meta]);

    const { vatData, visibleIndices, spawn } = useRoseCompute(count, geometry, uniforms.compute)

    const material = useMemo(() => {
        if (!scene || !meta || !isLoaded || !vatData || !geometry) return

        textures.petal.colorSpace = THREE.SRGBColorSpace;
        textures.normal.colorSpace = THREE.NoColorSpace;
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
        )

        return mat
    }, [scene, meta, isLoaded, posTex, nrmTex, vatData])

    useEffect(() => {
        if (!material) return
        material.metalness = config.metalness
        material.roughness = config.roughness
    }, [config.metalness, config.roughness])

    useFrame(() => {
        if (!characterRef?.current) return
        characterRef.current.getWorldPosition(characterPos)
        uniforms.mat.uCharacterWorldPos.value.copy(characterPos)
        uniforms.compute.uCharacterWorldPos.value.copy(characterPos)
    })

    useEffect(() => {
        const onHit = ({ position, radius }: { position: THREE.Vector3, radius: number }) => {
            spawn(position, 256, radius);
        };
        gameEvents.on('beam:hit', onHit);
        return () => gameEvents.off('beam:hit', onHit);
    }, [spawn]);

    useEffect(() => {
        return () => {
            geometry?.dispose();
            material?.dispose();
        };
    }, [geometry, material]);

    if (!geometry || !material) return null

    return <mesh geometry={geometry} material={material} count={count} frustumCulled={false} />
}