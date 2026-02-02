import { create } from 'zustand';
import { Group } from 'three';
import { AudioListener } from 'three/webgpu';
import * as THREE from 'three/webgpu';
import { RoseHandle } from '../../components/Rose/Rose';

export enum CameraMode {
  Follow  = 0,
  FPV = 1,
  Detached = 2,
}

interface GameState {
  // ===== Camera State =====
  cameraMode: CameraMode;
  setCameraMode: (mode: CameraMode) => void;
  toggleCameraMode: () => void;
  
  // ===== Character State =====
  characterRef: React.MutableRefObject<Group | null> | null;
  setCharacterRef: (ref: React.MutableRefObject<Group | null> | null) => void;

  roseRef: React.MutableRefObject<RoseHandle | null> | null;
  setRoseRef: (ref: React.MutableRefObject<RoseHandle | null> | null) => void;

  componentsReady: { rose: boolean; grass: boolean; character: boolean };
  setComponentReady: (key: 'rose' | 'grass' | 'character') => void;

  isGameStarted: boolean;
  setIsGameStarted: (loaded: boolean) => void;

  isSoundOn: boolean;
  setIsSoundOn: (isSoundOn: boolean) => void;

  audioListener: AudioListener | null;
  setAudioListener: (listener: THREE.AudioListener) => void;

  isMobile: boolean;
  setIsMobile: (isMobile: boolean) => void;

  quality: 'low' | 'high';
  toggleQuality: () => void;

  isControlEnabled: boolean; 
  setControlEnabled: (enabled: boolean) => void;
}

export const useGameStore = create<GameState>((set) => ({
  // ===== Camera State =====
  cameraMode: CameraMode.Follow,
  setCameraMode: (mode) => set({ cameraMode: mode }),
  toggleCameraMode: () => set((state) => ({
    cameraMode: (state.cameraMode + 1) % 3
  })),
  
  // ===== Character State =====
  characterRef: null,
  setCharacterRef: (ref) => set({ characterRef: ref }),

  roseRef: null,
  setRoseRef: (ref) => set({ roseRef: ref }),

  componentsReady: { rose: false, grass: false, character: false },
  setComponentReady: (key) => set((state) => ({
    componentsReady: {
      ...state.componentsReady,
      [key]: true
    }
  })),

  isGameStarted: false,
  setIsGameStarted: (loaded) => set({ isGameStarted: loaded }),

  isSoundOn: false,
  setIsSoundOn: (isSoundOn) => set({ isSoundOn: isSoundOn }),

  audioListener: null,
  setAudioListener: (listener) => set({ audioListener: listener }),

  isMobile: false,
  setIsMobile: (isMobile) => set({ isMobile: isMobile }),

  quality: 'high',
  toggleQuality: () => set((state) => ({ quality: state.quality === 'high' ? 'low' : 'high' })),

  isControlEnabled: false,
  setControlEnabled: (enabled) => set({ isControlEnabled: enabled }),
}));
