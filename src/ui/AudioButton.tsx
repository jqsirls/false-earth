'use client';

import { useGameStore } from '../core/store/gameStore';
import { WebGPUCanvas, Bgm } from '@core';
import { DistortedCircle } from '@core';
import { useShortcut } from '@core/hooks/useShortcut';
import { resumeMeadowAudioContext } from '../config/meadowAudio';
import {
    resumeMeadowBgmIfPaused,
    setMeadowBgmMuted,
    subscribeMeadowBgmPlayback,
} from '../audio/meadowBgmPlayer';
import { useEffect } from 'react';
import { MEADOW_AMBIENT_TRACKS, MEADOW_WIND_DUCK_MULTIPLIER } from '../config/meadowAudio';
import { useIsMeadowOverlayOpen } from '../core/hooks/useIsMeadowOverlayOpen';
import VolumeUpOutlinedIcon from '@mui/icons-material/VolumeUpOutlined';
import VolumeOffOutlinedIcon from '@mui/icons-material/VolumeOffOutlined';
import { meadowFocusCss, meadowIconPillStyle } from './meadowUiStyles';

export default function AudioButton() {
    const listener = useGameStore(s => s.audioListener);
    const isControlEnabled = useGameStore((state) => state.isControlEnabled);
    const isGameStarted = useGameStore((state) => state.isGameStarted);
    const isMobile = useGameStore((state) => state.isMobile);
    const isSoundOn = useGameStore((state) => state.isSoundOn);
    const setIsSoundOn = useGameStore((state) => state.setIsSoundOn);
    const meadowBgmPlaying = useGameStore((state) => state.meadowBgmPlaying);
    const setMeadowBgmPlaying = useGameStore((state) => state.setMeadowBgmPlaying);
    const isOverlayOpen = useIsMeadowOverlayOpen();

    const radius = 10;
    const size = 45;

    const toggleSound = () => {
        // No toggling before START or while a modal/sheet is open (useShortcut
        // already ignores keypresses inside INPUT/TEXTAREA fields).
        if (!isControlEnabled || isOverlayOpen) return;
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
        // A CTA click soft-pauses the BGM element; turning sound back on runs
        // inside the user's tap (or M key), so play() is never policy-blocked.
        if (isSoundOn) resumeMeadowBgmIfPaused();
    }, [isSoundOn, isGameStarted]);

    // Duck wind only while Cosmic Lullaby is audibly playing — not when BGM is toggled off.
    const windVolumeScale =
        isSoundOn && meadowBgmPlaying ? MEADOW_WIND_DUCK_MULTIPLIER : 1;

    if (!isControlEnabled) return null;

    return (
        <>
        {isMobile && (
            <>
                <style>{meadowFocusCss}</style>
                <button
                    type="button"
                    className="meadow-focusable"
                    aria-label={isSoundOn ? 'Turn music off' : 'Turn music on'}
                    aria-pressed={isSoundOn}
                    onClick={toggleSound}
                    style={{
                        ...meadowIconPillStyle,
                        position: 'fixed',
                        // Top-LEFT region, below the centered CTA strip; the lamp keeps
                        // the top-right alone. The ORBS readout sits beside this pill.
                        top: 'calc(max(20px, env(safe-area-inset-top)) + 52px)',
                        left: 'max(20px, env(safe-area-inset-left))',
                        zIndex: 20,
                        pointerEvents: 'auto',
                        color: isSoundOn ? '#fff' : 'rgba(255,255,255,0.5)',
                        cursor: 'pointer',
                    }}
                >
                    {isSoundOn ? (
                        <VolumeUpOutlinedIcon sx={{ fontSize: 20, color: 'inherit' }} />
                    ) : (
                        <VolumeOffOutlinedIcon sx={{ fontSize: 20, color: 'inherit' }} />
                    )}
                </button>
            </>
        )}
        <WebGPUCanvas
            width={size}
            height={size}
            style={{
                position: 'fixed',
                bottom: 0,
                right: 0,
                zIndex: 20,
                // Mobile gets the labeled MUSIC pill instead; keep the canvas
                // mounted (it hosts the wind Bgm) but hide the circle visual.
                opacity: isMobile ? 0 : 1,
                pointerEvents: isMobile ? 'none' : 'auto',
            }}
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
                active={isGameStarted}
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
        </>
    );
}
