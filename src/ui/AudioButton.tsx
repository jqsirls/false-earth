'use client';

import { useGameStore } from '../core/store/gameStore';
import { WebGPUCanvas, Bgm } from '@core';
import { DistortedCircle } from '@core';
import { useShortcut } from '@core/hooks/useShortcut';
import { resumeMeadowAudioContext } from '../config/meadowAudio';
import { setMeadowBgmMuted, subscribeMeadowBgmPlayback } from '../audio/meadowBgmPlayer';
import { useEffect } from 'react';
import { MEADOW_AMBIENT_TRACKS, MEADOW_WIND_DUCK_MULTIPLIER } from '../config/meadowAudio';

export default function AudioButton() {
    const listener = useGameStore(s => s.audioListener);
    const isControlEnabled = useGameStore((state) => state.isControlEnabled);
    const isGameStarted = useGameStore((state) => state.isGameStarted);
    const isSoundOn = useGameStore((state) => state.isSoundOn);
    const setIsSoundOn = useGameStore((state) => state.setIsSoundOn);
    const meadowBgmPlaying = useGameStore((state) => state.meadowBgmPlaying);
    const setMeadowBgmPlaying = useGameStore((state) => state.setMeadowBgmPlaying);

    const radius = 10;
    const size = 45;

    const toggleSound = () => {
        void resumeMeadowAudioContext(listener).then(() => {
            setIsSoundOn(!isSoundOn);
        });
    };

    useShortcut('m', toggleSound);

    useEffect(() => {
        return subscribeMeadowBgmPlayback(setMeadowBgmPlaying);
    }, [setMeadowBgmPlaying]);

    useEffect(() => {
        if (!isGameStarted) return;
        setMeadowBgmMuted(!isSoundOn);
    }, [isSoundOn, isGameStarted]);

    const windVolumeScale =
        isSoundOn && meadowBgmPlaying ? MEADOW_WIND_DUCK_MULTIPLIER : 1;

    if (!isControlEnabled) return null;

    return (
        <WebGPUCanvas
            width={size}
            height={size}
            style={{ position: 'fixed', bottom: 0, right: 0, zIndex: 20 }}
        >
            <mesh
                onClick={toggleSound}
                onPointerOver={() => {
                    document.body.style.cursor = 'pointer';
                }}
                onPointerOut={() => {
                    document.body.style.cursor = 'auto';
                }}
                visible={false}
            >
                <circleGeometry args={[radius * 1.2, 32]} />
                <meshBasicMaterial />
            </mesh>

            <Bgm
                listener={listener}
                active={isSoundOn}
                tracks={[...MEADOW_AMBIENT_TRACKS]}
                volumeScale={windVolumeScale}
            />

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
