/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MEADOW_ANALYTICS_URL?: string
  readonly VITE_MEADOW_AUTH_URL?: string
  readonly VITE_MEADOW_HUE_URL?: string
  readonly VITE_MEADOW_ASSET_BASE?: string
  readonly VITE_BASE_PATH?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.glsl' {
  const content: string
  export default content
}

