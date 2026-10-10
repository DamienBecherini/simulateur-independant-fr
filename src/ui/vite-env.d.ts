// src/ui/vite-env.d.ts

/// <reference types="vite/client" />

// --- DÉCLARATION AJOUTÉE ---
// Cette partie étend l'objet Window pour que TypeScript connaisse notre API Electron.
/** Version de l'application (package.json), fixée à la construction par vite.config.ts et vitest.config.ts. */
declare const __APP_VERSION__: string

declare global {
  interface Window {
    api: EventPayloadMapping
  }
}
