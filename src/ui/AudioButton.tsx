'use client';

import { useGameStore } from '../core/store/gameStore';
import { WebGPUCanvas } from '@core';
import { DistortedCircle } from '@core';
import { useShortcut } from '@core/hooks/useShortcut';
import { resumeMeadowAudioContext } from '../config/meadowAudio';
import { setMeadowBgmMuted } from '../audio/meadowBgmPlayer';
import { useEffect } from 'react';

export default function AudioButton() {
    const listener = useGameStore(s => s.audioListener);
    const isControlEnabled = useGameStore((state) => state.isControlEnabled);
    const isSoundOn = useGameStore((state) => state.isSoundOn);
    const setIsSoundOn = useGameStore((state) => state.setIsSoundOn);

    const radius = 10;
    const size = 45;

    const toggleBgm = () => {
        void resumeMeadowAudioContext(listener).then(() => {
            setIsSoundOn(!isSoundOn);
        });
    };

    useShortcut('m', toggleBgm);

    useEffect(() => {
        setMeadowBgmMuted(!isSoundOn);
    }, [isSoundOn]);

    // Defer WebGPU mini-canvas until controls are live — useLoader throws on failure and would unmount the whole app.
    if (!isControlEnabled) return null;

    return (
        <WebGPUCanvas
            width={size}
            height={size}
            style={{ position: 'fixed', bottom: 0, right: 0, zIndex: 20 }}
        >
            {/* Interaction Layer (Invisible Hitbox) */}
            <mesh
                onClick={toggleBgm}
                onPointerOver={() => {
                    document.body.style.cursor = 'pointer';
                }}
                onPointerOut={() => {
                    document.body.style.cursor = 'auto';
                }}
                visible={false} // Invisible but captures events
            >
                <circleGeometry args={[radius * 1.2, 32]} />
                <meshBasicMaterial />
            </mesh>

            {/* Visual Layer */}
            <group>
                {[12.35, 0.58, 3.67].map((seed, i) => (
                    <DistortedCircle
                        key={i}
                        radius={radius}
                        distortionStrength={isSoundOn ? 1 : 0}
                        seed={seed}
                    />
                ))}
            </group>
        </WebGPUCanvas>
    );
}