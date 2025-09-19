// Fichier : ui/uiInitializer.js

import { initializeTheme } from "./theme.js"

export async function initializeAppUI() {
  // 1. Charger l'état complet de l'application
  const appState = await window.api.getState()
  window.appState = appState // Stocker dans la fenêtre pour un accès global

  // 2. Initialiser le thème
  const savedUIState = appState.ui || {}
  initializeTheme(savedUIState.theme, () => {
    // Callback pour sauvegarder le thème quand il change
    const newTheme = document.body.classList.contains("dark-mode") ? "dark" : "light"
    window.appState.ui.theme = newTheme
    window.api.updateUIState({ ui: window.appState.ui })
  })
}
