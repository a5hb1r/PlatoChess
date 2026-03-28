/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APPLE_APP_STORE_URL?: string;
  readonly VITE_GOOGLE_PLAY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
