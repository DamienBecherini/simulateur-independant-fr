// src/ui/vite-env.d.ts

/// <reference types="vite/client" />

// --- DÉCLARATION AJOUTÉE ---
// Cette partie étend l'objet Window pour que TypeScript connaisse notre API Electron.
declare global {
  interface Window {
    api: EventPayloadMapping
  }
}
