'use client';

import { useGameStore } from '../core/store/gameStore';
import { WebGPUCanvas } from '@core';
import { DistortedCircle } from '@core';
import { Bgm } from '@core';
import { useShortcut } from '@core/hooks/useShortcut';
import { meadowPlaylistTracks } from '../config/meadowPlaylist';
import { resumeMeadowAudioContext } from '../config/meadowAudio';

export default function AudioButton() {
    const listener = useGameStore(s => s.audioListener);
    const isControlEnabled = useGameStore((state) => state.isControlEnabled);
    const isSoundOn = useGameStore((state) => state.isSoundOn);
    const setIsSoundOn = useGameStore((state) => state.setIsSoundOn);

    const radius = 10;
    const size = 45;

    const toggleBgm = () => {
        resumeMeadowAudioContext(listener);
        setIsSoundOn(!isSoundOn);
    };

    useShortcut('m', toggleBgm);

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

            <Bgm
                listener={listener}
                active={isSoundOn}
                tracks={meadowPlaylistTracks}
                mode="sequential"
            />

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