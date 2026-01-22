import { useEffect, useMemo } from 'react';
import { useControls } from 'leva';
import * as THREE from 'three/webgpu';
import { useCosmicShockwaves } from "./useCosmicShockwaves";
import { MathUtils } from 'three';
import { useGameStore } from '../../store/gameStore';

export function Waves() {
    const { triggerShockwave } = useCosmicShockwaves();
    const characterRef = useGameStore((state) => state.characterRef);
    
    // Temporary vector to get character position
    const characterPos = useMemo(() => new THREE.Vector3(), []);

    const [waveParams] = useControls('Waves', () => ({
        radiusMin: { value: 5.0, min: 1.0, max: 50.0, step: 0.5 },
        radiusMax: { value: 10.0, min: 1.0, max: 50.0, step: 0.5 },
        lifetimeMin: { value: 3.0, min: 0.5, max: 20.0, step: 0.1 },
        lifetimeMax: { value: 5.0, min: 0.5, max: 20.0, step: 0.1 },
        donutMinRadius: { value: 5.0, min: 1.0, max: 30.0, step: 0.5 },
        donutMaxRadius: { value: 15.0, min: 1.0, max: 50.0, step: 0.5 },
    }), { collapsed: true });

    // Trigger wave when Z key is pressed
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key.toLowerCase() === 'z') {
                // Get character world position
                if (!characterRef?.current) {
                    console.warn('Character ref not available, spawning wave at origin');
                    characterPos.set(0, 0, 0);
                } else {
                    characterRef.current.getWorldPosition(characterPos);
                }

                // Generate random position in donut shape around character
                // Donut: random angle + random distance between min/max radius
                const angle = Math.random() * Math.PI * 2; // Random angle 0 to 2π
                const distance = MathUtils.lerp(waveParams.donutMinRadius, waveParams.donutMaxRadius, Math.random());
                
                const position = new THREE.Vector3(
                    characterPos.x + Math.cos(angle) * distance, // x: character x + offset
                    0, // y: ground level
                    characterPos.z + Math.sin(angle) * distance  // z: character z + offset
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
    }, [triggerShockwave, waveParams, characterRef, characterPos]);

    return null;
}