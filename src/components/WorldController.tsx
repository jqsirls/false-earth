import { Suspense, useEffect, useMemo, useState, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { useControls } from 'leva';
import * as THREE from 'three/webgpu';
import {
    uTime,
    uDeltaTime,
    uGlobalHueShift,
    uWindDir,
    uWindScale,
    uWindSpeed,
    uWindStrength,
    uWindFacing,
    uTerrainAmp,
    uTerrainFreq,
    uTerrainSeed,
    uTerrainColor,
} from '../core/shaders/uniforms';
import { CosmicSystem } from './cosmic/CosmicSystem';
import { Terrain } from './Terrain';
import { StarrySky } from './background/StarrySky';
import { useGameStore } from '../core/store/gameStore';
import { AsyncCompile } from '@core';
import Rose from './Rose/Rose';
import Orbs from './Orb/Orbs';
import GrassWebGPU from './grass/GrassWebGPU';
import { Character } from './character';
import { STORYTAILOR } from '../config/storytailor';
import { GrassCullingDebug } from '../debug/GrassCullingDebug';
import {
    getDefaultCompileTimeoutMs,
    getRoseInstanceCount,
    isMemoryConstrainedGpu,
    shouldEnableRoses,
    shouldUseMinimalScene,
} from '../core/utils/browserCaps';
import { SafariGround } from './SafariGround';
import { usePrefersReducedMotion } from '../core/utils/reducedMotion';

export function WorldController() {
    const prefersReducedMotion = usePrefersReducedMotion();
    const setActiveTargets = useGameStore((state) => state.setActiveTargets);
    const setComponentReady = useGameStore((state) => state.setComponentReady);

    const debugMode = new URLSearchParams(window.location.search).get('debug') === 'true';
    const compileTimeout = getDefaultCompileTimeoutMs();
    const roseCount = getRoseInstanceCount(2000);
    const rosesEnabled = shouldEnableRoses();
    const minimalScene = shouldUseMinimalScene();
    const [grassCompileFailed, setGrassCompileFailed] = useState(false);

    const handleGrassCompileFailed = useCallback((id: string) => {
        if (id === 'grass' && isMemoryConstrainedGpu()) {
            console.warn('[grass] Shader compile failed on memory-constrained GPU — using static ground fallback');
            setGrassCompileFailed(true);
        }
    }, []);

    // Enable eruda console only in debug mode (?debug=true)
    useEffect(() => {
        if (!debugMode) return;

        let cancelled = false;

        (async () => {
            try {
                const mod = await import('eruda');
                if (cancelled) return;
                const eruda: any = (mod as any).default ?? mod;
                if (typeof eruda.init === 'function') {
                    eruda.init();
                }
            } catch (e) {
                console.error('Failed to initialize eruda', e);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [debugMode]);

    const { enableEnv, enableGrass, enableCharacter, enableGrassDebug } = useControls('Game.Content', {
        enableEnv: { value: true, label: 'Environment' },
        enableCharacter: { value: true, label: '👤 Character' },
        enableGrass: { value: true, label: '🌿 Grass Field' },
        enableGrassDebug: { value: false, label: '🌿 Grass Culling Debug' },
    }, { collapsed: true });


    const { timeScale, globalHue } = useControls('Game.System', {
        timeScale: { value: 1.0, min: 0.0, max: 2.0, label: 'Game Speed' },
        globalHue: { value: 0.0, min: 0.0, max: 1.0, label: 'Global Hue' },
    });

    const [windParams] = useControls('Game.Wind', () => ({
        windDirX: { value: 1, min: -1, max: 1, step: 0.01 },
        windDirZ: { value: -0.8, min: -1, max: 1, step: 0.01 },
        windSpeed: { value: uWindSpeed.value, min: 0, max: 3, step: 0.01 },
        windStrength: { value: uWindStrength.value, min: 0, max: 10, step: 0.01 },
        windScale: { value: uWindScale.value, min: 0.01, max: 1, step: 0.01 },
        windFacing: { value: uWindFacing.value, min: 0.0, max: 1.0, step: 0.01 },
    }), { collapsed: true });

    const [terrainParams] = useControls('Game.Terrain', () => ({
        amplitude: { value: uTerrainAmp.value, min: 0.1, max: 3.0, step: 0.1 },
        frequency: { value: uTerrainFreq.value, min: 0.01, max: 0.1, step: 0.01 },
        seed: { value: uTerrainSeed.value, min: 0.0, max: 100.0, step: 0.1 },
        color: { value: '#000000' },
    }), { collapsed: true });

    useEffect(() => {
        const windScale = prefersReducedMotion ? 0.35 : 1;
        uWindDir.value.set(windParams.windDirX, windParams.windDirZ);
        uWindScale.value = windParams.windScale;
        uWindSpeed.value = windParams.windSpeed * windScale;
        uWindStrength.value = windParams.windStrength * windScale;
        uWindFacing.value = windParams.windFacing;
    }, [windParams, prefersReducedMotion]);

    useEffect(() => {
        uTerrainAmp.value = terrainParams.amplitude;
        uTerrainFreq.value = terrainParams.frequency;
        uTerrainSeed.value = terrainParams.seed;
        const c = new THREE.Color(terrainParams.color);
        uTerrainColor.value.set(c.r, c.g, c.b);
    }, [terrainParams]);

    const activeTargetIds = useMemo(() => {
        const targets: string[] = [];
        if (rosesEnabled) targets.push('rose');
        if (enableGrass && !minimalScene && !grassCompileFailed) targets.push('grass');
        if (enableCharacter) targets.push('character');
        return targets;
    }, [rosesEnabled, enableGrass, enableCharacter, minimalScene, grassCompileFailed]);

    useEffect(() => {
        setActiveTargets(activeTargetIds);
    }, [activeTargetIds, setActiveTargets]);

    useFrame((_state, rawDelta) => {
        const delta = Math.min(rawDelta, 0.1);
        uGlobalHueShift.value = prefersReducedMotion ? 0 : globalHue;

        const effectiveTimeScale = prefersReducedMotion ? Math.min(timeScale, 0.35) : timeScale;
        uTime.value += delta * effectiveTimeScale;
        uDeltaTime.value = delta * effectiveTimeScale;
    });

    return <>
        {/* Environment - use group visibility to avoid remounting */}
        <Suspense fallback={null}>
            <group visible={enableEnv}>
                <StarrySky />
                <CosmicSystem />
                {grassCompileFailed ? <SafariGround /> : <Terrain />}
            </group>

            {/* Major components - toggle visibility instead of unmounting */}
            {rosesEnabled && (
                <Rose
                    count={roseCount}
                    visible={rosesEnabled}
                    onCompileReady={setComponentReady}
                    compileDebug={debugMode}
                />
            )}

            {/* Orbs are ambient, never load-blocking — 'orb' is intentionally not in activeTargets */}
            {!minimalScene && (
                <Orbs onCompileReady={setComponentReady} compileDebug={debugMode} />
            )}

            {!minimalScene && !grassCompileFailed && (
                <AsyncCompile
                    id="grass"
                    onReady={setComponentReady}
                    onCompileFailed={handleGrassCompileFailed}
                    debug={debugMode}
                    timeout={compileTimeout}
                >
                    {enableGrassDebug && <GrassCullingDebug />}
                    {!enableGrassDebug && <GrassWebGPU visible={enableGrass} />}
                </AsyncCompile>
            )}

            <AsyncCompile
                id="character"
                onReady={setComponentReady}
                debug={debugMode}
                timeout={compileTimeout}
            >
                <Suspense fallback={null}>
                    <Character
                        position={[0, 0, 0]}
                        scale={STORYTAILOR.useJqCharacter ? STORYTAILOR.characterScale : 1}
                        visible={enableCharacter}
                    />
                </Suspense>
            </AsyncCompile>
        </Suspense>
    </>
}
