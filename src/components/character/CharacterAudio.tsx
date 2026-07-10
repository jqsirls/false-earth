import { forwardRef, useImperativeHandle, useRef } from 'react';
import { useOneShotAudio } from '@core/hooks/useOneShotAudio';
import { StepType } from './hooks/useCharacterPhysics';
import { useGameStore } from '../../core/store/gameStore';
import { AudioListener } from 'three/webgpu';
import { MEADOW_FOOTSTEP_PATHS } from '../../config/meadowAudio';
import { Vector3 } from 'three';

export interface CharacterAudioHandle {
  playStep: (type: StepType, volume: number) => void;
}

const _worldPos = new Vector3();

export const CharacterAudio = forwardRef<CharacterAudioHandle>((_, ref) => {
  const listener = useGameStore((state) => state.audioListener);
  const characterRef = useGameStore((state) => state.characterRef);
  const isSoundOn = useGameStore((state) => state.isSoundOn);

  const { play } = useOneShotAudio(listener as AudioListener, [...MEADOW_FOOTSTEP_PATHS]);
  const playRef = useRef(play);
  playRef.current = play;

  useImperativeHandle(ref, () => ({
    playStep: (_type: StepType, volume: number) => {
      if (!isSoundOn) return;

      const group = characterRef?.current;
      if (group) {
        group.getWorldPosition(_worldPos);
      }

      void playRef.current({
        position: group ? _worldPos : undefined,
        volume,
        detuneRange: 200,
        spatial: false,
      });
    },
  }));

  return null;
});

CharacterAudio.displayName = 'CharacterAudio';
