/** Meadow GPU / scene error codes surfaced on the splash screen. */
export type MeadowGpuErrorCode =
  | 'WEBGPU_NOT_SUPPORTED'
  | 'NO_GPU_ADAPTER'
  | 'GPU_INIT_FAILED'
  | 'GPU_LOST'
  | 'GPU_MEMORY_EXCEEDED'
  | 'SCENE_INIT_FAILED'
  | 'ASSET_LOAD_FAILED'
  | 'SHADER_COMPILE_FAILED';

export type MeadowGpuError = {
  code: MeadowGpuErrorCode;
  detail: string;
};

const WEBGPU_CODES = new Set<MeadowGpuErrorCode>([
  'WEBGPU_NOT_SUPPORTED',
  'NO_GPU_ADAPTER',
  'GPU_INIT_FAILED',
]);

export function classifyLegacyGpuError(message: string): MeadowGpuError {
  const upper = message.toUpperCase();

  if (upper.includes('WEBGPU NOT SUPPORTED')) {
    return { code: 'WEBGPU_NOT_SUPPORTED', detail: message };
  }
  if (upper.includes('NO GPU ADAPTER')) {
    return { code: 'NO_GPU_ADAPTER', detail: message };
  }
  if (upper.includes('GPU INIT FAILED')) {
    return { code: 'GPU_INIT_FAILED', detail: message };
  }
  if (upper.includes('GPU LOST')) {
    return { code: 'GPU_LOST', detail: message };
  }
  if (upper.includes('GPU MEMORY EXCEEDED')) {
    return { code: 'GPU_MEMORY_EXCEEDED', detail: message };
  }
  if (upper.includes('SHADER') || upper.includes('COMPILE')) {
    return { code: 'SHADER_COMPILE_FAILED', detail: message };
  }
  if (upper.includes('ASSET') || upper.includes('TEXTURE') || upper.includes('CORS')) {
    return { code: 'ASSET_LOAD_FAILED', detail: message };
  }
  if (upper.includes('SCENE INIT FAILED')) {
    return { code: 'SCENE_INIT_FAILED', detail: message };
  }

  return { code: 'SCENE_INIT_FAILED', detail: message };
}

export function formatGpuError(error: MeadowGpuError | string | null): MeadowGpuError | null {
  if (!error) return null;
  if (typeof error === 'string') return classifyLegacyGpuError(error);
  return error;
}

export function getGpuErrorHeadline(error: MeadowGpuError): string {
  if (WEBGPU_CODES.has(error.code)) return 'SYSTEM INCOMPATIBLE';
  if (error.code === 'ASSET_LOAD_FAILED') return "COULDN'T LOAD SCENE ASSETS";
  if (error.code === 'SHADER_COMPILE_FAILED') return 'SHADER COMPILE FAILED';
  if (error.code === 'GPU_LOST' || error.code === 'GPU_MEMORY_EXCEEDED') return 'GPU NEEDS A BREAK';
  return "COULDN'T START THE MEADOW";
}

export function getGpuErrorHint(error: MeadowGpuError): string | null {
  switch (error.code) {
    case 'WEBGPU_NOT_SUPPORTED':
    case 'NO_GPU_ADAPTER':
    case 'GPU_INIT_FAILED':
      return 'Use Chrome or Edge 113+ on desktop, or Safari 18+ with WebGPU enabled.';
    case 'ASSET_LOAD_FAILED':
      return 'Check your connection and reload. If this keeps happening, try again in a few minutes.';
    case 'SHADER_COMPILE_FAILED':
      return 'Try Chrome or Edge on desktop, or reload once.';
    case 'GPU_LOST':
      return 'The GPU ran out of memory. Close other tabs, then reload this page.';
    case 'GPU_MEMORY_EXCEEDED':
      return 'Close other tabs, use one browser window, then reload.';
    default:
      return null;
  }
}
