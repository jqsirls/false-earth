import { useMemo } from 'react';
import { useControls } from 'leva';
import { useGameStore, CameraMode } from '../../core/store/gameStore';
import { usePrefersReducedMotion } from '../../core/utils/reducedMotion';
import { shouldDisableHeavyPostProcessing } from '../../core/utils/browserCaps';

export function useEffectsControls() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const cameraMode = useGameStore((state) => state.cameraMode);
  const quality = useGameStore((state) => state.quality);
  const disableHeavyPost = shouldDisableHeavyPostProcessing();
  const isHighQuality = quality === 'high' && !disableHeavyPost;

  const smaaParams = useControls('Effects.SMAA', {
    enabled: { value: false, label: 'Enable SMAA' },
  }, { collapsed: true });

  const bloomParams = useControls('Effects.Bloom', {
    enabled: { value: true, label: 'Enable Bloom' },
    threshold: { value: 0.35, min: 0, max: 1, step: 0.01 },
    strength: { value: 0.3, min: 0, max: 3, step: 0.01 },
    radius: { value: 0.5, min: 0, max: 1, step: 0.01 },
  }, { collapsed: true });

  const toneMappingParams = useControls('Effects.Tone Mapping', {
    enabled: { value: true, label: 'Enable Tone Mapping' },
    exposure: { value: 1.1, min: 0.1, max: 2, step: 0.01 },
  }, { collapsed: true });

  const dofParamsTPS = useControls('Effects.DoF.TPS', {
    enabled: { value: true, label: 'Enable Depth of Field' },
    autofocus: { value: true, label: 'Auto Focus Character' },
    focusDistance: { value: 1.3, min: 0, max: 100, step: 0.1, render: (get) => !get('Effects.DoF.TPS.autofocus') },
    focalLength: { value: 25.0, min: 0.01, max: 100, step: 0.1 },
    bokehScale: { value: 5, min: 0.0, max: 10.0, step: 0.1 },
  }, { collapsed: true });

  const dofParamsFREE = useControls('Effects.DoF.FREE', {
    enabled: { value: true, label: 'Enable Depth of Field' },
    autofocus: { value: false, label: 'Auto Focus Character' },
    focusDistance: { value: 5, min: 0, max: 100, step: 0.1, render: (get) => !get('Effects.DoF.FREE.autofocus') },
    focalLength: { value: 10.0, min: 0.01, max: 100, step: 0.1 },
    bokehScale: { value: 5, min: 0.0, max: 10.0, step: 0.1 },
  }, { collapsed: true });

  const dofParamsFPV = useControls('Effects.DoF.FPV', {
    enabled: { value: false, label: 'Enable Depth of Field' },
    autofocus: { value: false, label: 'Auto Focus Character' },
    focusDistance: { value: 10, min: 0, max: 100, step: 0.1, render: (get) => !get('Effects.DoF.FPV.autofocus') },
    focalLength: { value: 50.0, min: 0.01, max: 100, step: 0.1 },
    bokehScale: { value: 3, min: 0.0, max: 10.0, step: 0.1 },
  }, { collapsed: true });

  const dof = useMemo(() => {
    switch (cameraMode) {
      case CameraMode.FPV:
        return {
          enabled: dofParamsFPV.enabled,
          autofocus: dofParamsFPV.autofocus,
          focusDistance: dofParamsFPV.focusDistance,
          focalLength: dofParamsFPV.focalLength,
          bokehScale: dofParamsFPV.bokehScale,
        };
      case CameraMode.Detached:
        return {
          enabled: dofParamsFREE.enabled,
          autofocus: dofParamsFREE.autofocus,
          focusDistance: dofParamsFREE.focusDistance,
          focalLength: dofParamsFREE.focalLength,
          bokehScale: dofParamsFREE.bokehScale,
        };
      case CameraMode.Follow:
      default:
        return {
          enabled: dofParamsTPS.enabled,
          autofocus: dofParamsTPS.autofocus,
          focusDistance: dofParamsTPS.focusDistance,
          focalLength: dofParamsTPS.focalLength,
          bokehScale: dofParamsTPS.bokehScale,
        };
    }
  }, [cameraMode, dofParamsTPS, dofParamsFREE, dofParamsFPV]);

  const bloom = useMemo(() => {
    const motionScale = prefersReducedMotion ? 0.2 : 1;
    return {
      enabled: prefersReducedMotion ? false : bloomParams.enabled,
      threshold: bloomParams.threshold,
      strength: bloomParams.strength * motionScale,
      radius: bloomParams.radius * motionScale,
    };
  }, [prefersReducedMotion, bloomParams.enabled, bloomParams.threshold, bloomParams.strength, bloomParams.radius]);

  return {
    isHighQuality,
    cameraMode,
    prefersReducedMotion,
    smaa: prefersReducedMotion ? false : smaaParams.enabled,
    bloom,
    toneMapping: {
      enabled: toneMappingParams.enabled,
      exposure: toneMappingParams.exposure,
    },
    dof,
  };
}
