// src/components/cosmic/CosmicSystem.tsx
// Orchestrator component that coordinates beams and waves
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useControls } from 'leva';
import * as THREE from 'three/webgpu';
import { useCosmicWaves } from "./useCosmicWaves";
import { MathUtils } from 'three';
import { useGameStore } from '../../store/gameStore';
import { CosmicBeams, CosmicBeamsRef } from './CosmicBeams';

export function CosmicSystem() {
    const { triggerShockwave } = useCosmicWaves();
    const characterRef = useGameStore((state) => state.characterRef);
    const roseRef = useGameStore((state) => state.roseRef);
    const beamsRef = useRef<CosmicBeamsRef>(null);
    
    const characterPos = useMemo(() => new THREE.Vector3(), []);
    const prevCharacterPos = useRef<THREE.Vector3 | null>(null);
    const spawnTimer = useRef<number>(0);

    const [waveParams] = useControls('Waves', () => ({
        radiusMin: { value: 5.0, min: 1.0, max: 50.0, step: 0.5 },
        radiusMax: { value: 10.0, min: 1.0, max: 50.0, step: 0.5 },
        lifetimeMin: { value: 3.0, min: 0.5, max: 20.0, step: 0.1 },
        lifetimeMax: { value: 5.0, min: 0.5, max: 20.0, step: 0.1 },
        donutMinRadius: { value: 5.0, min: 1.0, max: 30.0, step: 0.5 },
        donutMaxRadius: { value: 15.0, min: 1.0, max: 50.0, step: 0.5 },
        autoSpawn: { value: true, label: 'Auto Spawn' },
        minSpawnInterval: { value: 2.0, min: 0.1, max: 10.0, step: 0.1, label: 'Min Interval (s)' },
        maxSpawnInterval: { value: 5.0, min: 0.1, max: 10.0, step: 0.1, label: 'Max Interval (s)' },
        speedThreshold: { value: 0.1, min: 0.01, max: 5.0, step: 0.01, label: 'Speed Threshold' },
    }), { collapsed: true });

    // Minimum distance between beams to avoid overlap
    const MIN_BEAM_DISTANCE = 10.0; // Minimum distance in world units
    const MAX_POSITION_ATTEMPTS = 10; // Maximum attempts to find a valid position

    // Helper function to check if position is too close to existing beams
    const isPositionValid = (position: THREE.Vector3, activePositions: THREE.Vector3[]): boolean => {
        for (const activePos of activePositions) {
            const distance = position.distanceTo(activePos);
            if (distance < MIN_BEAM_DISTANCE) {
                return false;
            }
        }
        return true;
    };

    // Helper function to generate a random position in donut shape
    const generateRandomPosition = (): THREE.Vector3 => {
        const angle = Math.random() * Math.PI * 2;
        const distance = MathUtils.lerp(waveParams.donutMinRadius, waveParams.donutMaxRadius, Math.random());
        
        return new THREE.Vector3(
            characterPos.x + Math.cos(angle) * distance,
            0,
            characterPos.z + Math.sin(angle) * distance
        );
    };

    // Function to spawn a beam (extracted for reuse)
    const spawnBeam = () => {
        // Get character world position
        if (!characterRef?.current) {
            return; // Skip if character not available
        }
        characterRef.current.getWorldPosition(characterPos);

        // Get active beam positions
        const beamPositions = beamsRef.current?.getBeamPositions() || [];

        // Try to find a valid position that doesn't overlap with existing beams
        let position: THREE.Vector3 | null = null;
        for (let attempt = 0; attempt < MAX_POSITION_ATTEMPTS; attempt++) {
            const candidatePosition = generateRandomPosition();
            if (isPositionValid(candidatePosition, beamPositions)) {
                position = candidatePosition;
                break;
            }
        }

        // If no valid position found after max attempts, use the last generated position anyway
        if (!position) {
            position = generateRandomPosition();
        }

        // Trigger beam, and when it hits the ground, trigger shockwave and spawn roses
        beamsRef.current?.triggerBeam(position, (beamPosition) => {
            // Calculate wave parameters when beam hits the ground
            const radius = MathUtils.lerp(waveParams.radiusMin, waveParams.radiusMax, Math.random());
            const lifetime = MathUtils.lerp(waveParams.lifetimeMin, waveParams.lifetimeMax, Math.random());
            
            // Trigger shockwave at impact position
            triggerShockwave(beamPosition, radius, lifetime);
            
            // Spawn roses at impact position
            roseRef?.current?.spawn(beamPosition, 256, radius);
        });
    };

    // Auto-spawn logic based on character speed
    useFrame((_, delta) => {
        if (!waveParams.autoSpawn || !characterRef?.current) {
            return;
        }

        // Get current character position
        const currentPos = new THREE.Vector3();
        characterRef.current.getWorldPosition(currentPos);

        // Calculate speed (distance moved per second)
        let speed = 0;
        if (prevCharacterPos.current) {
            const distance = currentPos.distanceTo(prevCharacterPos.current);
            speed = distance / delta; // Speed in units per second
        } else {
            prevCharacterPos.current = currentPos.clone();
            return; // First frame, skip
        }

        // Update character position for next frame
        prevCharacterPos.current = currentPos.clone();
        characterPos.copy(currentPos);

        // Only spawn if character is moving above threshold
        if (speed < waveParams.speedThreshold) {
            spawnTimer.current = 0; // Reset timer when not moving
            return;
        }

        // Calculate spawn interval based on speed
        // Faster speed = shorter interval (more frequent spawns)
        // Map speed to interval: higher speed -> lower interval
        const speedNormalized = Math.min(speed / 5.0, 1.0); // Normalize speed (assuming max speed ~5 units/s)
        const spawnInterval = MathUtils.lerp(
            waveParams.maxSpawnInterval, // Slow speed = long interval
            waveParams.minSpawnInterval, // Fast speed = short interval
            speedNormalized
        );

        // Accumulate timer
        spawnTimer.current += delta;

        // Spawn when timer exceeds interval
        if (spawnTimer.current >= spawnInterval) {
            spawnTimer.current = 0; // Reset timer
            spawnBeam();
        }
    });

    // Handle manual keypress to trigger beam (optional, for testing)
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key.toLowerCase() === 'z') {
                spawnBeam();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [triggerShockwave, waveParams, characterRef, roseRef]);

    return <CosmicBeams ref={beamsRef} />;
}
