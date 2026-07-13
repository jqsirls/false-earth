import { useGameStore } from '../core/store/gameStore';
import { LampButton } from './LampButton';

/**
 * Top-right HUD: lamp only. Character switching is About-modal easter egg only.
 * Inside the zen wrapper so [H] hides it with the rest of the chrome.
 */
export function TopRightCluster() {
  const isControlEnabled = useGameStore((state) => state.isControlEnabled);
  const gpuError = useGameStore((state) => state.gpuError);

  if (!isControlEnabled || gpuError) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 'max(20px, env(safe-area-inset-top))',
        right: 'max(20px, env(safe-area-inset-right))',
        zIndex: 20,
        pointerEvents: 'auto',
      }}
    >
      <LampButton />
    </div>
  );
}
