import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useGameStore } from '../core/store/gameStore';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export class CanvasErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[false-earth] WebGPU canvas failed:', error, info.componentStack);
    const message = error?.message?.trim() || 'Unknown scene error';
    const upper = message.toUpperCase();
    if (upper.includes('CORS') || upper.includes('TEXTURE') || upper.includes('FAILED TO FETCH') || upper.includes('404') || upper.includes('403')) {
      useGameStore.getState().setGpuError(`ASSET LOAD FAILED — ${message}`);
      return;
    }
    if (upper.includes('SHADER') || upper.includes('COMPILE') || upper.includes('WGSL')) {
      useGameStore.getState().setGpuError(`SHADER COMPILE FAILED — ${message}`);
      return;
    }
    useGameStore.getState().setGpuError(`SCENE INIT FAILED — ${message}`);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
