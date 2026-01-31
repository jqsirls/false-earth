import { forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { useOneShotAudio } from '../audio/useOneShotAudio';
import { useGameStore } from '../../core/store/gameStore';
import { AudioListener } from 'three/webgpu';

export interface BeamAudioHandle {
  playImpact: (position: THREE.Vector3, volume?: number) => void;
}

export const BeamAudio = forwardRef<BeamAudioHandle>((_, ref) => {
  const listener = useGameStore((state) => state.audioListener);
  const { play } = useOneShotAudio(listener as AudioListener, ['/audio/wave01.mp3']);

  useImperativeHandle(ref, () => ({
    playImpact: (position: THREE.Vector3, volume: number = 1) => {
      play({
        position,
        volume,
        detuneRange: 300,
        refDistance: 5,
        maxDistance: 60
      });
    },
  }));

  return null;
});

BeamAudio.displayName = 'BeamAudio';