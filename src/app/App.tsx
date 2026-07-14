import { Environment, PerformanceMonitor, useGLTF } from "@react-three/drei";
import { Leva } from "leva";
import { LevaWrapper, AudioManager, KTX2Preloader, preloadVATAssets } from "@core";
import { Canvas, useLoader } from "@react-three/fiber";
import { useEffect, Suspense, useMemo, useState } from "react";
import { DirectionalLight } from "../components/DirectionalLight";
import { WebGPURenderer } from "three/webgpu";
import Effects from "../components/Effects/Effects";
import { useGameStore } from "../core/store/gameStore";
import { CameraViewControl } from "../components/camera/CameraViewControl";
import { DeviceDetector } from "../core/utils/DeviceDetector";
import { UI } from "../ui/UI";
import { WorldController } from "../components/WorldController";
import { createContext } from "react";
import * as THREE from "three/webgpu";
import { input, keyBindings } from "../core/input/controls";
import { MeadowKeyboardMapper } from "../core/input/MeadowKeyboardMapper";
import { AudioLoader, TextureLoader } from 'three';
import { ROSE_TEXTURES } from "../components/Rose/core/config";
import { BODY_TEXTURE_PATHS, DETAIL_TEXTURE_PATHS, MODEL_PATHS } from '../components/character/config';
import { JQ_LOCOMOTION_ANIM_PATHS, getJqPartTexturePaths } from '../components/character/jqConfig';
import { VOID_MESH_PARTS, VOID_MODEL_PATHS, getVoidPartTexturePaths } from '../components/character/voidConfig';
import { isVoidCharacterActive } from '../config/meadowCharacter';
import { STORYTAILOR } from '../config/storytailor';
import { CanvasErrorBoundary } from './CanvasErrorBoundary';
import { getInitialDpr, getMaxDpr, isDebugMode, isMemoryConstrainedGpu, shouldPreloadVatRoses } from '../core/utils/browserCaps';
import { setVrRenderer } from '../core/xr/webXrSession';
import { shouldForceWebGlRendererBackend, VR_MAX_DPR } from '../config/vrProfile';
import { useVrStore } from '../core/store/vrStore';
import { VrSessionBridge } from '../components/xr/VrSessionBridge';
import { VrLocomotionMenu } from '../components/xr/VrLocomotionMenu';
import { MEADOW_FOOTSTEP_PATHS } from '../config/meadowAudio';
import { resolveMeadowAsset } from '../config/meadow';
import { configureCdnTextureLoader } from '../core/utils/cdnTextureLoader';
import { MEADOW_ENV_INTENSITY } from '../config/meadowVisualGrade';

function attachGpuDeviceLostHandler(
    renderer: WebGPURenderer,
    onLost: (message: string) => void,
): void {
    const backend = (renderer as unknown as { backend?: { device?: GPUDevice } }).backend;
    const device = backend?.device;
    if (!device?.lost) return;

    void device.lost.then((info) => {
        onLost(info.message || 'GPU device lost — reload this page');
    });
}

function collectJqTexturePaths(): string[] {
    const paths = new Set<string>();

    for (const part of ['astroboy_f', 'jumper', 'strap', 'glove', 'pack', 'boots'] as const) {
        const tex = getJqPartTexturePaths(part);
        paths.add(tex.map);
        paths.add(tex.normalMap);
        paths.add(tex.roughnessMap);
        paths.add(tex.metalnessMap);
        if (tex.emissiveMap) paths.add(tex.emissiveMap);
        if (tex.alphaMap) paths.add(tex.alphaMap);
    }

    return [...paths];
}

function collectVoidTexturePaths(): string[] {
    const paths = new Set<string>();

    for (const part of VOID_MESH_PARTS) {
        const tex = getVoidPartTexturePaths(part);
        paths.add(tex.map);
        paths.add(tex.normalMap);
        paths.add(tex.roughnessMap);
        if (tex.metalnessMap) paths.add(tex.metalnessMap);
        if (tex.emissiveMap) paths.add(tex.emissiveMap);
        if (tex.alphaMap) paths.add(tex.alphaMap);
    }

    return [...paths];
}

useLoader.preload(AudioLoader, [...MEADOW_FOOTSTEP_PATHS, '/audio/wave01.mp3']);

// Starting character (param override → persisted choice → Booster). Only the
// STARTING character preloads; a live switch loads the other on demand under
// the switch name overlay (Suspense in WorldController).
const voidCharacterActive = isVoidCharacterActive();

useGLTF.preload(
  voidCharacterActive
    ? [...VOID_MODEL_PATHS]
    : STORYTAILOR.useJqCharacter
      ? [STORYTAILOR.characterModel, ...JQ_LOCOMOTION_ANIM_PATHS]
      : MODEL_PATHS,
);

if (voidCharacterActive) {
  useLoader.preload(TextureLoader, collectVoidTexturePaths(), configureCdnTextureLoader);
} else if (STORYTAILOR.useJqCharacter) {
  useLoader.preload(TextureLoader, collectJqTexturePaths(), configureCdnTextureLoader);
}

if (shouldPreloadVatRoses()) {
  preloadVATAssets(resolveMeadowAsset('/vat/Rose_meta.json'));
  preloadVATAssets(resolveMeadowAsset('/vat/RoseLowPoly_meta.json'));
}

export const BeamSceneContext = createContext<THREE.Scene | null>(null);

export default function App() {
    const beamScene = useMemo(() => new THREE.Scene(), []);
    const [dpr, setDpr] = useState(getInitialDpr);

    const setAudioListener = useGameStore((state) => state.setAudioListener);
    const gpuError = useGameStore((state) => state.gpuError);
    const setGpuError = useGameStore((state) => state.setGpuError);

    useEffect(() => {
        return useVrStore.subscribe((state, prev) => {
            if (state.isActive && !prev.isActive) {
                setDpr(VR_MAX_DPR);
            }
        });
    }, []);

    // Check WebGPU support on mount
    useEffect(() => {
        const checkWebGPU = async () => {
            const webxrWebGlPath = shouldForceWebGlRendererBackend();
            if (!navigator.gpu && !webxrWebGlPath) {
                setGpuError('WEBGPU_NOT_SUPPORTED');
                console.error("WebGPU is not supported in this browser");
                return;
            }
            if (webxrWebGlPath) {
                console.log('WebXR spike: WebGL2 renderer backend for headset compatibility');
                setGpuError(null);
                return;
            }
            try {
                const adapter = await navigator.gpu.requestAdapter();
                if (!adapter) {
                    setGpuError('NO_GPU_ADAPTER');
                    console.error("No GPU adapter found");
                    return;
                }
                console.log('WebGPU initialized successfully');
                setGpuError(null); // Clear any previous errors
            } catch (e) {
                setGpuError('GPU_INIT_FAILED');
                console.error("WebGPU initialization failed:", e);
            }
        };
        checkWebGPU();
    }, [setGpuError]);

    return <>
        {/* Leva settings panel is a dev tool only (?debug=1 / ?debug=true).
            Without debug we still mount <Leva hidden /> — it renders nothing
            but suppresses leva's useControls auto-mount fallback, which uses
            the legacy ReactDOM.render removed in React 19 and crashes the
            scene. LevaWrapper (debug only) additionally binds [H] to toggle
            the panel, which was exposing the collapsed bar to users entering
            zen mode. */}
        {isDebugMode()
            ? <LevaWrapper collapsed={true} initialHidden={true} />
            : <Leva hidden />}
        <DeviceDetector />
        <UI />
        <MeadowKeyboardMapper input={input} keyMap={keyBindings} />


        {!gpuError && (
            <CanvasErrorBoundary>
            <Canvas
                camera={{
                    fov: 45,
                    near: 0.1,
                    far: 200,
                    position: [20, 20, 30]
                }}
                gl={(canvas) => {
                    const forceWebGlForXr = shouldForceWebGlRendererBackend();
                    const renderer = new WebGPURenderer({
                        ...canvas as any,
                        powerPreference: isMemoryConstrainedGpu() ? 'low-power' : 'high-performance',
                        antialias: !isMemoryConstrainedGpu(),
                        alpha: true,
                        forceWebGL: forceWebGlForXr,
                    });
                    renderer.setClearColor('#000000');
                    renderer.autoClear = true;
                    renderer.outputColorSpace = THREE.SRGBColorSpace;
                    renderer.toneMapping = THREE.NoToneMapping;
                    renderer.shadowMap.enabled = true;
                    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
                    // renderer.inspector = new Inspector();
                    renderer.sortObjects = false;

                    const canvasEl = renderer.domElement;
                    const onContextLost = (event: Event) => {
                        event.preventDefault();
                        setGpuError('GPU_MEMORY_EXCEEDED');
                    };
                    canvasEl.addEventListener('webglcontextlost', onContextLost);

                    return renderer.init().then(() => {
                        setVrRenderer(renderer);
                        attachGpuDeviceLostHandler(renderer, (message) => {
                            console.error('[false-earth] GPU device lost:', message);
                            setGpuError('GPU_LOST');
                        });
                        return renderer;
                    }).catch((err: unknown) => {
                        console.error('WebGPU renderer init failed:', err);
                        setGpuError('GPU_INIT_FAILED');
                        throw err;
                    });
                }}
                dpr={dpr}
            >
                <Suspense fallback={null}>
                    {shouldPreloadVatRoses() && <KTX2Preloader paths={ROSE_TEXTURES} />}
                    {!STORYTAILOR.useJqCharacter && (
                      <>
                        <KTX2Preloader paths={BODY_TEXTURE_PATHS} />
                        <KTX2Preloader paths={DETAIL_TEXTURE_PATHS} />
                      </>
                    )}
                </Suspense>

                <AudioManager onListenerCreated={setAudioListener} />

                <PerformanceMonitor
                    bounds={() => [28, 32]}
                    onFallback={() => setDpr(1)}
                    onChange={({ factor }) => {
                        const maxDpr = getMaxDpr();
                        setDpr(Math.min(1 + factor, maxDpr));
                    }}
                />

                <BeamSceneContext.Provider value={beamScene}>
                    <WorldController />
                    <VrSessionBridge />
                    <VrLocomotionMenu />

                    <Suspense fallback={null}>
                        <color attach="background" args={['#000000']} />
                        <CameraViewControl />
                        <Environment
                            files={resolveMeadowAsset('/textures/potsdamer_platz_1k_nb.hdr')}
                            environmentIntensity={MEADOW_ENV_INTENSITY}
                        />
                        <DirectionalLight />
                        <Effects />
                    </Suspense>
                </BeamSceneContext.Provider>
            </Canvas>
            </CanvasErrorBoundary>
        )}
    </>
}
