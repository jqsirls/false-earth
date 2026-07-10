import { useEffect } from 'react';
import { useDeviceDetection } from '@core/hooks/useDeviceDetection';
import { useGameStore } from '../store/gameStore';
import { isMemoryConstrainedGpu } from './browserCaps';

export function DeviceDetector() {
  const setIsMobile = useGameStore((state) => state.setIsMobile);
  const setQuality = useGameStore((state) => state.setQuality);
  const isMobile = useDeviceDetection();

  useEffect(() => {
    setIsMobile(isMobile);
    if (isMobile || isMemoryConstrainedGpu()) {
      setQuality('low');
    }
  }, [isMobile, setIsMobile, setQuality]);

  return null;
}
