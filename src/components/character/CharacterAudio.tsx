import { forwardRef, useImperativeHandle } from 'react';
import { useOneShotAudio } from '@core/hooks/useOneShotAudio';
import { StepType } from './hooks/useCharacterPhysics';
import { useGameStore } from '../../core/store/gameStore';
import { AudioListener } from 'three/webgpu';
import { MEADOW_FOOTSTEP_PATHS } from '../../config/meadowAudio';

export interface CharacterAudioHandle {
  playStep: (type: StepType, volume: number) => void;
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
        volume,
        detuneRange: 200,
        refDistance: 2,
        maxDistance: 30,
      });
    },
  }));

  return null;
});

CharacterAudio.displayName = 'CharacterAudio';
