import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useGameStore } from '../core/store/gameStore';
import { classifyLegacyGpuError } from '../core/utils/gpuError';

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
    const { code } = classifyLegacyGpuError(message);
    useGameStore.getState().setGpuError(code);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
