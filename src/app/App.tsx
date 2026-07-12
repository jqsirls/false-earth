import { Environment, PerformanceMonitor, useGLTF } from "@react-three/drei";
import { LevaWrapper, AudioManager, KeyboardMapper, KTX2Preloader, preloadVATAssets } from "@core";
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
import { AudioLoader, TextureLoader } from 'three';
import { ROSE_TEXTURES } from "../components/Rose/core/config";
import { BODY_TEXTURE_PATHS, DETAIL_TEXTURE_PATHS, MODEL_PATHS } from '../components/character/config';
import { JQ_LOCOMOTION_ANIM_PATHS, getJqPartTexturePaths } from '../components/character/jqConfig';
import { STORYTAILOR } from '../config/storytailor';
import { CanvasErrorBoundary } from './CanvasErrorBoundary';
import { getInitialDpr, getMaxDpr, isDebugMode, isMemoryConstrainedGpu, shouldPreloadVatRoses } from '../core/utils/browserCaps';
import { MEADOW_FOOTSTEP_PATHS } from '../config/meadowAudio';
import { resolveMeadowAsset } from '../config/meadow';
import { configureCdnTextureLoader } from '../core/utils/cdnTextureLoader';

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

useLoader.preload(AudioLoader, [...MEADOW_FOOTSTEP_PATHS, '/audio/wave01.mp3']);

useGLTF.preload(
  STORYTAILOR.useJqCharacter
    ? [STORYTAILOR.characterModel, ...JQ_LOCOMOTION_ANIM_PATHS]
    : MODEL_PATHS,
);

if (STORYTAILOR.useJqCharacter) {
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

    // Check WebGPU support on mount
    useEffect(() => {
        const checkWebGPU = async () => {
            if (!navigator.gpu) {
                setGpuError("WEBGPU NOT SUPPORTED");
                console.error("WebGPU is not supported in this browser");
                return;
            }
            try {
                const adapter = await navigator.gpu.requestAdapter();
                if (!adapter) {
                    setGpuError("NO GPU ADAPTER FOUND");
                    console.error("No GPU adapter found");
                    return;
                }
                console.log('WebGPU initialized successfully');
                setGpuError(null); // Clear any previous errors
            } catch (e) {
                setGpuError("GPU INIT FAILED");
                console.error("WebGPU initialization failed:", e);
            }
        };
        checkWebGPU();
    }, [setGpuError]);

    return <>
        {/* Leva settings panel is a dev tool only: without ?debug it must not
            mount at all (the [H] zen shortcut also toggles LevaWrapper's own
            hidden state, which was exposing the collapsed bar to users). Leva
            control hooks (useControls) work headless without the panel. */}
        {isDebugMode() && <LevaWrapper collapsed={true} initialHidden={true} />}
        <DeviceDetector />
        <UI />
        <KeyboardMapper input={input} keyMap={keyBindings} />


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
                    const renderer = new WebGPURenderer({
                        ...canvas as any,
                        powerPreference: isMemoryConstrainedGpu() ? 'low-power' : 'high-performance',
                        antialias: !isMemoryConstrainedGpu(),
                        alpha: true,
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
                        const hint = isMemoryConstrainedGpu()
                            ? 'GPU memory exceeded — close other tabs and reload'
                            : 'GPU memory exceeded — reload on a smaller display or use Chrome';
                        setGpuError(hint);
                    };
                    canvasEl.addEventListener('webglcontextlost', onContextLost);

                    return renderer.init().then(() => {
                        attachGpuDeviceLostHandler(renderer, (message) => {
                            setGpuError(`GPU LOST — ${message}`);
                        });
                        return renderer;
                    }).catch((err: unknown) => {
                        const message = err instanceof Error ? err.message : String(err);
                        console.error('WebGPU renderer init failed:', err);
                        setGpuError(`GPU INIT FAILED — ${message}`);
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

                    <Suspense fallback={null}>
                        <color attach="background" args={['#000000']} />
                        <CameraViewControl />
                        <Environment
                            files={resolveMeadowAsset('/textures/potsdamer_platz_1k_nb.hdr')}
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
