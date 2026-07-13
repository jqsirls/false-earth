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

/** Per-character flight-loop configuration (Booster is the default). */
export interface FlightLoopConfig {
  path: string;
  /**
   * When set, the loop only plays while flight speed exceeds this
   * (world-units/second) — the Void's loop is silent while hovering still.
   */
  moveSpeedThreshold?: number;
}

/** Read-only flight-loop state for programmatic production verification. */
declare global {
  interface Window {
    __MEADOW_FLIGHT_SFX__?: Readonly<{ playing: boolean; volume: number; speed: number }>;
  }
}

/**
 * Flight loop: fades in while flying, fades out (~400ms) when flight ends —
 * or, with a moveSpeedThreshold, when the character hovers still. SFX
 * contract: gated on isGameStarted, independent of the music toggle.
 */
function FlightLoopAudio({ path, moveSpeedThreshold }: FlightLoopConfig) {
  const listener = useGameStore((state) => state.audioListener);
  const isGameStarted = useGameStore((state) => state.isGameStarted);
  const isFlying = useGameStore((state) => state.isFlying);
  const characterRef = useGameStore((state) => state.characterRef);

  const audioRef = useRef<THREE.Audio | null>(null);
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const prevPosRef = useRef<THREE.Vector3 | null>(null);
  const smoothedSpeedRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const loader = configureCdnAudioLoader(new AudioLoader());
    loader
      .loadAsync(path)
      .then((buf) => {
        if (!cancelled) setBuffer(buf);
      })
      .catch((err) => {
        console.warn('[FlightLoopAudio] flight loop skipped:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

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

    // Smoothed world-space speed (only needed when a movement gate is set).
    if (moveSpeedThreshold !== undefined) {
      const pos = characterRef?.current?.position;
      if (pos) {
        if (prevPosRef.current && delta > 0) {
          const instSpeed = prevPosRef.current.distanceTo(pos) / delta;
          smoothedSpeedRef.current = THREE.MathUtils.lerp(
            smoothedSpeedRef.current,
            instSpeed,
            0.2,
          );
        }
        prevPosRef.current = (prevPosRef.current ?? new THREE.Vector3()).copy(pos);
      } else {
        smoothedSpeedRef.current = 0;
        prevPosRef.current = null;
      }
    }

    const moving =
      moveSpeedThreshold === undefined || smoothedSpeedRef.current > moveSpeedThreshold;
    const target = isGameStarted && isFlying && moving ? MEADOW_FLIGHT_LOOP_VOLUME : 0;
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
      speed: smoothedSpeedRef.current,
    });
  });

  return null;
}

interface CharacterAudioProps {
  /** Defaults to Booster's galactic flight loop (always-on while flying). */
  flightLoop?: FlightLoopConfig;
}

export const CharacterAudio = forwardRef<CharacterAudioHandle, CharacterAudioProps>(
  ({ flightLoop }, ref) => {
    const listener = useGameStore((state) => state.audioListener);
    const characterRef = useGameStore((state) => state.characterRef);
    const isGameStarted = useGameStore((state) => state.isGameStarted);

    const { play } = useOneShotAudio(listener as AudioListener, [...MEADOW_FOOTSTEP_PATHS]);

    useImperativeHandle(ref, () => ({
      playStep: (_type: StepType, volume: number) => {
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

    return <FlightLoopAudio {...(flightLoop ?? { path: MEADOW_FLIGHT_LOOP_PATH })} />;
  },
);

CharacterAudio.displayName = 'CharacterAudio';
