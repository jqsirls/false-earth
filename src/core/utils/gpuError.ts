import { isQuestBrowser, isVisionOsBrowser } from '../../config/vrProfile';

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
};

/** Bootstrap failure copy — never show raw JS errors in the DOM. */
export const MEADOW_BOOTSTRAP_ERROR = {
  headline: "We couldn't start the meadow right now.",
  body: 'Try refreshing, or come back in a moment.',
} as const;

const WEBGPU_CODES = new Set<MeadowGpuErrorCode>([
  'WEBGPU_NOT_SUPPORTED',
  'NO_GPU_ADAPTER',
  'GPU_INIT_FAILED',
]);

const MEADOW_GPU_ERROR_CODES = new Set<MeadowGpuErrorCode>([
  'WEBGPU_NOT_SUPPORTED',
  'NO_GPU_ADAPTER',
  'GPU_INIT_FAILED',
  'GPU_LOST',
  'GPU_MEMORY_EXCEEDED',
  'SCENE_INIT_FAILED',
  'ASSET_LOAD_FAILED',
  'SHADER_COMPILE_FAILED',
]);

function extractCodeFromLegacyMessage(message: string): MeadowGpuErrorCode {
  if (MEADOW_GPU_ERROR_CODES.has(message as MeadowGpuErrorCode)) {
    return message as MeadowGpuErrorCode;
  }

  const upper = message.toUpperCase();

  if (upper.includes('WEBGPU NOT SUPPORTED')) return 'WEBGPU_NOT_SUPPORTED';
  if (upper.includes('NO GPU ADAPTER')) return 'NO_GPU_ADAPTER';
  if (upper.includes('GPU INIT FAILED')) return 'GPU_INIT_FAILED';
  if (upper.includes('GPU LOST')) return 'GPU_LOST';
  if (upper.includes('GPU MEMORY EXCEEDED') || upper.includes('GPU MEMORY')) {
    return 'GPU_MEMORY_EXCEEDED';
  }
  if (upper.includes('SHADER') || upper.includes('COMPILE') || upper.includes('WGSL')) {
    return 'SHADER_COMPILE_FAILED';
  }
  if (
    upper.includes('ASSET') ||
    upper.includes('TEXTURE') ||
    upper.includes('CORS') ||
    upper.includes('FAILED TO FETCH') ||
    upper.includes('404') ||
    upper.includes('403')
  ) {
    return 'ASSET_LOAD_FAILED';
  }
  if (upper.includes('SCENE INIT FAILED')) return 'SCENE_INIT_FAILED';
  if (
    upper.includes("CAN'T FIND VARIABLE") ||
    upper.includes('IS NOT DEFINED') ||
    upper.includes('REFERENCEERROR') ||
    upper.includes('TYPEERROR') ||
    upper.includes('SYNTAXERROR')
  ) {
    return 'SCENE_INIT_FAILED';
  }

  return 'SCENE_INIT_FAILED';
}

export function classifyLegacyGpuError(message: string): MeadowGpuError {
  return { code: extractCodeFromLegacyMessage(message) };
}

export function formatGpuError(error: MeadowGpuError | string | null): MeadowGpuError | null {
  if (!error) return null;
  if (typeof error === 'string') return classifyLegacyGpuError(error);
  return error;
}

const QUEST_WEBGPU_BODY =
  'Update Meta Quest Browser to version 146 or newer, then refresh. The flat meadow at booster.storytailor.com works without ?webxr=1. You can also try Wolvic.';

const VISION_PRO_WEBGPU_BODY =
  'In Safari Settings open Feature Flags, enable WebGPU, then restart Safari and refresh booster.storytailor.com.';

export function getGpuErrorHeadline(error: MeadowGpuError): string {
  if (WEBGPU_CODES.has(error.code) && isQuestBrowser()) {
    return 'Your Quest browser needs a quick update.';
  }
  if (WEBGPU_CODES.has(error.code) && isVisionOsBrowser()) {
    return 'Safari needs WebGPU enabled for the meadow.';
  }
  if (WEBGPU_CODES.has(error.code)) {
    return "This browser can't run the meadow yet.";
  }
  if (error.code === 'ASSET_LOAD_FAILED') {
    return "We couldn't load part of the meadow.";
  }
  if (error.code === 'SHADER_COMPILE_FAILED') {
    return "We couldn't finish setting up the meadow.";
  }
  if (error.code === 'GPU_LOST' || error.code === 'GPU_MEMORY_EXCEEDED') {
    return 'The meadow needs a short pause.';
  }
  return MEADOW_BOOTSTRAP_ERROR.headline;
}

export function getGpuErrorBody(error: MeadowGpuError): string {
  if (WEBGPU_CODES.has(error.code) && isQuestBrowser()) {
    return QUEST_WEBGPU_BODY;
  }
  if (WEBGPU_CODES.has(error.code) && isVisionOsBrowser()) {
    return VISION_PRO_WEBGPU_BODY;
  }
  if (WEBGPU_CODES.has(error.code)) {
    return 'Try Safari 18+ or a recent desktop browser with WebGPU enabled.';
  }
  if (error.code === 'ASSET_LOAD_FAILED') {
    return 'Check your connection and try again in a few minutes.';
  }
  if (error.code === 'SHADER_COMPILE_FAILED') {
    return 'Refresh once. If it keeps happening, try another browser.';
  }
  if (error.code === 'GPU_LOST') {
    return 'Close a few other tabs, then refresh this page.';
  }
  if (error.code === 'GPU_MEMORY_EXCEEDED') {
    return 'Close other tabs, use one browser window, then refresh.';
  }
  return MEADOW_BOOTSTRAP_ERROR.body;
}
