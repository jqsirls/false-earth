import { useEffect } from 'react';
import { useControls } from 'leva';
import * as THREE from 'three/webgpu';
import { useCosmicShockwaves } from "./useCosmicShockwaves";
import { MathUtils } from 'three';

export function Waves() {
    const { triggerShockwave } = useCosmicShockwaves();

    const [waveParams] = useControls('Waves', () => ({
        radiusMin: { value: 5.0, min: 1.0, max: 50.0, step: 0.5 },
        radiusMax: { value: 10.0, min: 1.0, max: 50.0, step: 0.5 },
        lifetimeMin: { value: 1.0, min: 0.5, max: 20.0, step: 0.1 },
        lifetimeMax: { value: 2.0, min: 0.5, max: 20.0, step: 0.1 },
    }), { collapsed: true });

    // Trigger wave when Z key is pressed
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key.toLowerCase() === 'z') {
                // Trigger wave at random position within xz -10 to 10
                const position = new THREE.Vector3(
                    Math.random() * 20 - 10, // x: -10 to 10
                    0, // y: ground level
                    Math.random() * 20 - 10  // z: -10 to 10
                );
                // Random radius and lifetime within min/max ranges
                const radius = MathUtils.lerp(waveParams.radiusMin, waveParams.radiusMax, Math.random());
                const lifetime = MathUtils.lerp(waveParams.lifetimeMin, waveParams.lifetimeMax, Math.random());
                triggerShockwave(position, radius, lifetime);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [triggerShockwave, waveParams]);

    return null;
}