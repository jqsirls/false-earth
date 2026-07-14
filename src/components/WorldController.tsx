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
import { GrassStaticField } from './grass/GrassStaticField';
import { Character } from './character';
import { STORYTAILOR } from '../config/storytailor';
import { useMeadowCharacterStore } from '../core/store/meadowCharacterStore';
import { GrassCullingDebug } from '../debug/GrassCullingDebug';
import {
    getDefaultCompileTimeoutMs,
    getRoseInstanceCount,
    isDebugMode,
    isMeadowGpuConstrained,
    isQuestBrowser,
    shouldDeferAmbientOrbs,
    shouldEnableRoses,
    shouldUseGrassComputePath,
    shouldUseMinimalScene,
    shouldUseClassicSceneMaterials,
} from '../core/utils/browserCaps';
import { SafariGround } from './SafariGround';
import { TerrainWebGL } from './TerrainWebGL';
import { usePrefersReducedMotion } from '../core/utils/reducedMotion';

export function WorldController() {
    const prefersReducedMotion = usePrefersReducedMotion();
    const activeCharacter = useMeadowCharacterStore((state) => state.activeCharacter);
    const setActiveTargets = useGameStore((state) => state.setActiveTargets);
    const setComponentReady = useGameStore((state) => state.setComponentReady);

    const debugMode = isDebugMode();
    const compileTimeout = getDefaultCompileTimeoutMs();
    const roseCount = getRoseInstanceCount(2000);
    const rosesEnabled = shouldEnableRoses();
    const minimalScene = shouldUseMinimalScene();
    const grassComputePath = shouldUseGrassComputePath();
    const classicSceneMaterials = shouldUseClassicSceneMaterials();
    const deferOrbs = shouldDeferAmbientOrbs();
    const [grassCompileFailed, setGrassCompileFailed] = useState(false);
    const [orbsReady, setOrbsReady] = useState(!deferOrbs);

    const handleGrassCompileFailed = useCallback((id: string) => {
        if (id !== 'grass') return;
        if (isMeadowGpuConstrained() || isQuestBrowser() || !grassComputePath) {
            console.warn('[grass] Shader compile unavailable — using static grass fallback');
            setGrassCompileFailed(true);
        }
    }, [grassComputePath]);

    useEffect(() => {
        if (!deferOrbs) return;
        const timer = window.setTimeout(() => setOrbsReady(true), 4000);
        return () => window.clearTimeout(timer);
    }, [deferOrbs]);

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

    const contentControls = useControls('Game.Content', {
        enableEnv: { value: true, label: 'Environment' },
        enableCharacter: { value: true, label: '👤 Character' },
        enableGrass: { value: true, label: '🌿 Grass Field' },
        enableGrassDebug: { value: false, label: '🌿 Grass Culling Debug' },
    }, { collapsed: true });

    // Leva persists toggles in localStorage — never let a dev-panel grass/env off leak to prod.
    const enableEnv = debugMode ? contentControls.enableEnv : true;
    const enableGrass = debugMode ? contentControls.enableGrass : true;
    const enableCharacter = debugMode ? contentControls.enableCharacter : true;
    const enableGrassDebug = debugMode ? contentControls.enableGrassDebug : false;


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
        if (enableGrass && !minimalScene && (!grassCompileFailed || !grassComputePath)) targets.push('grass');
        if (enableCharacter) targets.push('character');
        return targets;
    }, [rosesEnabled, enableGrass, enableCharacter, minimalScene, grassCompileFailed, grassComputePath]);

    useEffect(() => {
        if (!minimalScene && enableGrass && (!grassComputePath || grassCompileFailed)) {
            setComponentReady('grass', true);
        }
    }, [minimalScene, enableGrass, grassComputePath, grassCompileFailed, setComponentReady]);

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
                {classicSceneMaterials ? (
                    <TerrainWebGL />
                ) : grassCompileFailed ? (
                    <SafariGround />
                ) : (
                    <Terrain />
                )}
            </group>
            {classicSceneMaterials && (
                <>
                    <hemisphereLight args={['#6a8fa8', '#0a1210', 0.55]} />
                    <ambientLight intensity={0.22} />
                </>
            )}

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
            {!minimalScene && orbsReady && (
                <Orbs onCompileReady={setComponentReady} compileDebug={debugMode} />
            )}

            {!minimalScene && enableGrass && !grassCompileFailed && grassComputePath && (
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

            {!minimalScene && enableGrass && (!grassComputePath || grassCompileFailed) && (
                <GrassStaticField visible={enableGrass} />
            )}

            <AsyncCompile
                id="character"
                onReady={setComponentReady}
                debug={debugMode}
                timeout={compileTimeout}
            >
                <Suspense fallback={null}>
                    <Character
                        key={activeCharacter}
                        position={[0, 0, 0]}
                        scale={STORYTAILOR.useJqCharacter ? STORYTAILOR.characterScale : 1}
                        visible={enableCharacter}
                    />
                </Suspense>
            </AsyncCompile>
        </Suspense>
    </>
}
