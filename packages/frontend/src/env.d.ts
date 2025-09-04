/*eslint-disable*/

/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string;
  readonly VITE_RUNTIME_ENV: string;
  readonly VITE_YOUDAO_APP_KEY: string;
  readonly VITE_YOUDAO_APP_SECRET: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_TENCENT_SDK_APP_ID: string;
  readonly VITE_TENCENT_SDK_SECRET_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
