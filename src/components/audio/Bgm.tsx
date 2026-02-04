import { useEffect, useMemo, useRef } from 'react';
import { useGameStore } from '../../core/store/gameStore';
import * as THREE from 'three/webgpu';
import { useLoader } from '@react-three/fiber';
import { AudioLoader } from 'three';

interface Track {
  id: string;
  url: string;
  volume?: number;
}

interface BgmProps {
  active: boolean;
  tracks: Track[];
}

const Bgm = ({ active, tracks }: BgmProps) => {
  const listener = useGameStore((state) => state.audioListener);

  const urls = useMemo(() => tracks.map(t => t.url), [tracks]);
  const buffers = useLoader(AudioLoader, urls);

  const sounds = useRef<Map<string, THREE.Audio>>(new Map());

  useEffect(() => {
    if (!listener) return;

    sounds.current.forEach(s => {
      if (s.isPlaying) s.stop();
      s.disconnect();
    })
    sounds.current.clear();

    tracks.forEach((t, index) => {
      const sound = new THREE.Audio(listener);
      sound.setBuffer(buffers[index]);
      sound.setLoop(true);
      sound.setVolume(t.volume ?? 0.5);
      sounds.current.set(t.id, sound);
    });


    return () => {
      sounds.current.forEach(s => {
        if (s.isPlaying) s.stop();
        s.disconnect();
      })
      sounds.current.clear();
    }
  }, [tracks, listener, buffers]);

  useEffect(() => {
    if (active) {
      sounds.current.forEach(s => !s.isPlaying && s.play());
    } else {
      sounds.current.forEach(s => s.isPlaying && s.pause());
    }
  }, [active, buffers]);

  return null;
};

export default Bgm;