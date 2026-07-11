import { useEffect } from 'react';
import { useOneShotAudio } from '@core/hooks/useOneShotAudio';
import { useGameStore } from '../../core/store/gameStore';
import { AudioListener } from 'three/webgpu';
import { gameEvents } from '../../core/events';
import * as THREE from 'three/webgpu';
import { MEADOW_BEAM_HIT_VOLUME } from '../../config/meadowAudio';

export function BeamAudio() {
  const listener = useGameStore((state) => state.audioListener);
  const isGameStarted = useGameStore((state) => state.isGameStarted);
  const { play } = useOneShotAudio(listener as AudioListener, ['/audio/wave01.mp3']);

  useEffect(() => {
    const onHit = (payload: { position: THREE.Vector3; radius: number }) => {
      if (!isGameStarted) return;

      play({
        position: payload.position,
        volume: MEADOW_BEAM_HIT_VOLUME,
        detuneRange: 300,
        refDistance: 5,
        maxDistance: 60,
      });
    };
    gameEvents.on('beam:hit', onHit);
    return () => gameEvents.off('beam:hit', onHit);
  }, [play, isGameStarted]);

  return null;
}
