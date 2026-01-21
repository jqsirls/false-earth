import { atomicAdd, atomicStore, storage, uint, instanceIndex, instancedArray, If, time, Fn, float, fract, mix, step } from "three/tsl";

/**
 * Create update compute shader
 * Updates animation frame based on lifecycle progress (Delay, Grow, Keep, Die)
 * Uses seed to determine per-instance phase durations
 */
export function createUpdateCompute(
    drawStorage: ReturnType<typeof storage>,
    indices: ReturnType<typeof instancedArray>,
    vatData: ReturnType<typeof instancedArray>,
    count: number,
    uniforms: Record<string, any>,
) {
    const updateFn = Fn(() => {
        /**
         * Easing function: easeInOutCubic
         * Provides smooth acceleration and deceleration
         */
        const easeInOutCubic = (t: any) => {
            const clampedT = t.clamp(0.0, 1.0);
            const val1 = clampedT.mul(clampedT).mul(clampedT).mul(4.0);
            const p = clampedT.sub(1.0);
            const val2 = p.mul(p).mul(p).mul(4.0).add(1.0);
            const isSecondHalf = step(0.5, clampedT);
            return mix(val1, val2, isSecondHalf);
        };

        const data = vatData.element(instanceIndex)

        // Simple animation logic: if active, update frame
        If(data.get("isActive").greaterThan(0), () => {
            const seed = data.get("seed")
            const age = time.sub(data.get("startTime"))

            // Use seed to interpolate between min/max for each phase duration
            const delayDuration = mix(uniforms.uDelayMin, uniforms.uDelayMax,  seed)
            const growDuration = mix(uniforms.uGrowMin, uniforms.uGrowMax, seed)
            const keepDuration = mix(uniforms.uKeepMin, uniforms.uKeepMax, seed)
            const dieDuration = mix(uniforms.uDieMin, uniforms.uDieMax, seed)

            // Calculate total lifetime and phase boundaries
            const lifetime = delayDuration.add(growDuration).add(keepDuration).add(dieDuration)
            const p1 = delayDuration.div(lifetime) // Delay phase boundary
            const p2 = delayDuration.add(growDuration).div(lifetime) // Grow phase boundary
            const p3 = delayDuration.add(growDuration).add(keepDuration).div(lifetime) // Keep phase boundary
            // p3 ~ 1.0: Die phase

            const progress = age.div(lifetime)

            If(progress.greaterThan(1.0), () => {
                data.get("isActive").assign(0.0)
                data.get("progress").assign(0.0)
                data.get("frame").assign(0.0)
            }).Else(() => {
                const currentFrame = float(0.0).toVar();

                // Phase 0: Delay (0.0 ~ p1) - frame stays at 0
                If(progress.lessThan(p1), () => {
                    currentFrame.assign(0.0)
                })
                    // Phase 1: Grow (p1 ~ p2) - frame grows from 0 to 1 with easing
                    .ElseIf(progress.lessThan(p2), () => {
                        const stateProgress = progress.sub(p1).div(p2.sub(p1))
                        const easedProgress = easeInOutCubic(stateProgress)
                        currentFrame.assign(easedProgress)
                    })
                    // Phase 2: Keep (p2 ~ p3) - frame stays at 1
                    .ElseIf(progress.lessThan(p3), () => {
                        currentFrame.assign(1.0)
                    })
                    // Phase 3: Die (p3 ~ 1.0) - frame decays from 1 to 0 with easing
                    .Else(() => {
                        const stateProgress = progress.sub(p3).div(float(1.0).sub(p3))
                        const easedProgress = easeInOutCubic(stateProgress)
                        currentFrame.assign(float(1.0).sub(easedProgress))
                    })

                data.get("progress").assign(progress.clamp(0.0, 1.0))
                data.get("frame").assign(currentFrame) // Animate
                // Add to draw queue
                const idx = atomicAdd(drawStorage.get("instanceCount"), uint(1))
                indices.element(idx).assign(uint(instanceIndex))
            })
        })
    })
    return updateFn().compute(count)
}

/**
 * Create reset compute shader
 * Resets the indirect draw buffer counters each frame
 */
export function createResetCompute(drawStorage: ReturnType<typeof storage>, indexCount: number) {
    return Fn(() => {
        drawStorage.get("vertexCount").assign(uint(indexCount))
        atomicStore(drawStorage.get("instanceCount"), uint(0))
    })().compute(1)
}

/**
 * Create spawn compute shader
 * Spawns a new rose instance at the specified position when triggered
 */
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
                const seed = fract(float(time).mul(123.45))
                const instance = vatData.element(headIndex)

                instance.get('position').assign(uniforms.uSpawnPos) // set to the current position of the character
                instance.get('isActive').assign(1.0)                // mark as alive
                instance.get('frame').assign(0.0)                   // reset the animation frame
                instance.get('startTime').assign(time)              // record the birth time
                instance.get('seed').assign(seed)                   // set the seed
                instance.get('progress').assign(0.0)                // reset lifecycle progress
            })
        })
    })
    // this shader only needs to run 1 time (single thread processing pointer movement)
    return spawnFn().compute(1)
}

/**
 * Create visible indices buffer
 * Buffer to store indices of visible instances for indirect drawing
 */
export function createVisibleIndicesBuffer(count: number) {
    return instancedArray(new Uint32Array(count), 'uint')
}
