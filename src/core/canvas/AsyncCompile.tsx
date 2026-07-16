import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three/webgpu';
import { useUploadQueue } from '@core/hooks/useUploadQueue';

interface AsyncCompileProps {
  children: React.ReactNode;
  id: string;
  onReady?: (id: string, isReady: boolean) => void;
  onCompileFailed?: (id: string) => void;
  debug?: boolean;
  uploadFrames?: number;
  timeout?: number;
  /** Jump to the front of the GPU upload queue (character-first load). */
  priority?: boolean;
  /** Show children while Stage 1 compiles (default hides until compiled). */
  visibleDuringIdle?: boolean;
  /** Fire onReady(true) after shader compile — skip upload-queue wait for START gate. */
  readyOnCompile?: boolean;
  /** Bumps compile when character identity or other scene inputs change. */
  compileKey?: string | number;
}

function getMeshFingerprint(group: THREE.Object3D): string {
  const ids: string[] = [];
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) ids.push(child.uuid);
  });
  return ids.join(',');
}

function isDestroyedBufferError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /destroyed|invalid|lost/i.test(message);
}

async function waitAnimationFrames(count: number): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
}

async function waitForMeshes(
  group: THREE.Object3D,
  maxFrames: number,
  isCancelled: () => boolean,
): Promise<boolean> {
  for (let i = 0; i < maxFrames; i += 1) {
    if (isCancelled()) return false;
    if (getMeshFingerprint(group)) return true;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
  return Boolean(getMeshFingerprint(group));
}

/**
 * Meadow fork: guards WebGPU compileAsync against disposed buffers during
 * Suspense material commits and Booster/Void character swaps.
 */
export function AsyncCompile({
  children,
  id,
  onReady,
  onCompileFailed,
  debug = false,
  uploadFrames = 3,
  timeout = 3000,
  priority = false,
  visibleDuringIdle = false,
  readyOnCompile = false,
  compileKey = 'default',
}: AsyncCompileProps) {
  // @ts-ignore - WebGPURenderer might have different types than WebGLRenderer
  const { gl, camera } = useThree();

  const enqueueUpload = useUploadQueue((state) => state.enqueueUpload);
  const processNextUpload = useUploadQueue((state) => state.processNextUpload);
  const removeUpload = useUploadQueue((state) => state.removeUpload);
  const currentUploader = useUploadQueue((state) => state.currentUploader);

  const groupRef = useRef<THREE.Group>(null);
  const [status, setStatus] = useState<'idle' | 'compiled' | 'uploading' | 'done'>('idle');
  const frameCount = useRef(0);
  const startTime = useRef<number>(0);
  const [meshFingerprint, setMeshFingerprint] = useState('');

  const log = useCallback((...args: unknown[]) => {
    if (debug) console.log(...args);
  }, [debug]);

  useFrame(() => {
    if (!groupRef.current) return;
    const next = getMeshFingerprint(groupRef.current);
    if (next && next !== meshFingerprint) {
      setMeshFingerprint(next);
    }
  });

  useEffect(() => {
    let isMounted = true;
    let compileGeneration = 0;

    const isCancelled = () => !isMounted;

    const runCompile = async (generation: number, attempt: number): Promise<void> => {
      const group = groupRef.current;
      if (!group || !isMounted || generation !== compileGeneration) return;

      log(`📦 [${id}] Stage 1: Starting async compilation (attempt ${attempt})...`);
      startTime.current = performance.now();

      await waitAnimationFrames(2);
      if (!isMounted || generation !== compileGeneration) return;

      const hasMeshes = await waitForMeshes(group, 240, isCancelled);
      if (!isMounted || generation !== compileGeneration) return;

      if (!hasMeshes) {
        log(`⚠️ [${id}] No meshes found — skipping precompile.`);
        onCompileFailed?.(id);
        onReady?.(id, true);
        setStatus('done');
        return;
      }

      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('TIMEOUT')), timeout);
        });

        // @ts-ignore - compileAsync is specific to Three/WebGPU
        await Promise.race([
          gl.compileAsync(group, camera),
          timeoutPromise,
        ]);

        if (!isMounted || generation !== compileGeneration) return;

        const compileTime = (performance.now() - startTime.current).toFixed(1);
        log(`✨ [${id}] Stage 1 Complete: Compiled in ${compileTime}ms. Joining queue...`);
        setStatus('compiled');
        if (readyOnCompile) {
          onReady?.(id, true);
        }
        enqueueUpload(id, priority);
      } catch (error: unknown) {
        if (!isMounted || generation !== compileGeneration) return;

        const message = error instanceof Error ? error.message : String(error);
        if (message === 'TIMEOUT') {
          log(`⚠️ [${id}] Compilation timed out. Skipping optimization.`);
        } else if (isDestroyedBufferError(error) && attempt < 2) {
          log(`♻️ [${id}] Buffer disposed during compile — retrying after settle...`);
          await waitAnimationFrames(3);
          if (!isMounted || generation !== compileGeneration) return;
          return runCompile(generation, attempt + 1);
        } else {
          log(`❌ [${id}] Compilation error:`, error);
        }

        onCompileFailed?.(id);
        onReady?.(id, true);
        setStatus('done');

        if (useUploadQueue.getState().currentUploader === id) {
          processNextUpload();
        }
      }
    };

    compileGeneration += 1;
    const generation = compileGeneration;
    setStatus('idle');
    onReady?.(id, false);
    void runCompile(generation, 1);

    return () => {
      isMounted = false;
      compileGeneration += 1;
      onReady?.(id, false);
      removeUpload(id);
    };
  }, [
    gl,
    camera,
    id,
    enqueueUpload,
    onReady,
    onCompileFailed,
    removeUpload,
    processNextUpload,
    timeout,
    priority,
    readyOnCompile,
    compileKey,
    meshFingerprint,
    log,
  ]);

  useEffect(() => {
    if (status === 'compiled' && currentUploader === id) {
      log(`⬆️ [${id}] Stage 2: Got upload slot! Transferring data to GPU...`);
      setStatus('uploading');
      frameCount.current = 0;
      startTime.current = performance.now();
    }
  }, [currentUploader, status, id, log]);

  useFrame(() => {
    if (status !== 'uploading') return;

    frameCount.current += 1;

    if (frameCount.current === 1 && debug) {
      log(`📤 [${id}] Frame 1: Initializing textures/geometry...`);
    }

    if (frameCount.current > uploadFrames) {
      const uploadTime = (performance.now() - startTime.current).toFixed(1);
      log(`💾 [${id}] Stage 3 Complete: Uploaded in ${uploadTime}ms (${frameCount.current} frames)`);

      setStatus('done');
      onReady?.(id, true);
      processNextUpload();
    }
  });

  const isVisible =
    visibleDuringIdle ||
    status === 'compiled' ||
    status === 'uploading' ||
    status === 'done';

  return (
    <group ref={groupRef} visible={isVisible}>
      {children}
    </group>
  );
}
