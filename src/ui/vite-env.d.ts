// src/ui/vite-env.d.ts

/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** « web » pour la démo en ligne (vite --mode web) ; absent dans l'application Electron. */
  readonly VITE_CIBLE?: "web"
}

// --- DÉCLARATION AJOUTÉE ---
// Cette partie étend l'objet Window pour que TypeScript connaisse notre API Electron.
declare global {
  interface Window {
    api: EventPayloadMapping
  }
}
