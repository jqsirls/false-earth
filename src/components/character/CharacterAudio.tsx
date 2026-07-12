import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { AudioLoader } from 'three';
import * as THREE from 'three/webgpu';
import { useOneShotAudio } from '@core/hooks/useOneShotAudio';
import { StepType } from './hooks/useCharacterPhysics';
import { useGameStore } from '../../core/store/gameStore';
import { AudioListener } from 'three/webgpu';
import {
  MEADOW_FOOTSTEP_PATHS,
  MEADOW_FOOTSTEP_GAIN,
  MEADOW_FLIGHT_LOOP_PATH,
  MEADOW_FLIGHT_LOOP_VOLUME,
  MEADOW_FLIGHT_LOOP_FADE_SECONDS,
  configureCdnAudioLoader,
} from '../../config/meadowAudio';

export interface CharacterAudioHandle {
  playStep: (type: StepType, volume: number) => void;
}

/** Read-only flight-loop state for programmatic production verification. */
declare global {
  interface Window {
    __MEADOW_FLIGHT_SFX__?: Readonly<{ playing: boolean; volume: number }>;
  }
}

/**
 * Galactic flight loop: fades in while flying, fades out (~400ms) when flight
 * ends. SFX contract: gated on isGameStarted, independent of the music toggle.
 */
function FlightLoopAudio() {
  const listener = useGameStore((state) => state.audioListener);
  const isGameStarted = useGameStore((state) => state.isGameStarted);
  const isFlying = useGameStore((state) => state.isFlying);

  const audioRef = useRef<THREE.Audio | null>(null);
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loader = configureCdnAudioLoader(new AudioLoader());
    loader
      .loadAsync(MEADOW_FLIGHT_LOOP_PATH)
      .then((buf) => {
        if (!cancelled) setBuffer(buf);
      })
      .catch((err) => {
        console.warn('[FlightLoopAudio] flight loop skipped:', err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!listener || !buffer) return;
    const audio = new THREE.Audio(listener as AudioListener);
    audio.setBuffer(buffer);
    audio.setLoop(true);
    audio.setVolume(0);
    audioRef.current = audio;
    return () => {
      audioRef.current = null;
      if (audio.isPlaying) audio.stop();
      audio.disconnect();
    };
  }, [listener, buffer]);

  useFrame((_, delta) => {
    const audio = audioRef.current;
    if (!audio) return;

    const target = isGameStarted && isFlying ? MEADOW_FLIGHT_LOOP_VOLUME : 0;
    const current = audio.getVolume();

    if (target > 0 && !audio.isPlaying) {
      const ctx = audio.context;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      audio.play();
      audio.setVolume(0);
    } else if (target === 0 && audio.isPlaying && current <= 0.001) {
      audio.pause();
    }

    // Linear ramp at full-fade-in-FADE_SECONDS rate — soft attack + release.
    const rate = MEADOW_FLIGHT_LOOP_VOLUME / MEADOW_FLIGHT_LOOP_FADE_SECONDS;
    const maxStep = rate * Math.min(delta, 0.1);
    const diff = target - current;
    if (diff !== 0) {
      audio.setVolume(current + Math.sign(diff) * Math.min(Math.abs(diff), maxStep));
    }

    window.__MEADOW_FLIGHT_SFX__ = Object.freeze({
      playing: audio.isPlaying,
      volume: audio.getVolume(),
    });
  });

  return null;
}

export const CharacterAudio = forwardRef<CharacterAudioHandle>((_, ref) => {
  const listener = useGameStore((state) => state.audioListener);
  const characterRef = useGameStore((state) => state.characterRef);
  const isGameStarted = useGameStore((state) => state.isGameStarted);

  const { play } = useOneShotAudio(listener as AudioListener, [...MEADOW_FOOTSTEP_PATHS]);

  useImperativeHandle(ref, () => ({
    playStep: (type: StepType, volume: number) => {
      if (!isGameStarted) return;

      play({
        position: characterRef?.current?.position,
        volume: volume * MEADOW_FOOTSTEP_GAIN,
        detuneRange: 200,
        refDistance: 2,
        maxDistance: 30,
      });
    },
  }));

  return <FlightLoopAudio />;
});

CharacterAudio.displayName = 'CharacterAudio';
