// Fichier : renderer.js

import { initializeAppUI } from "./ui/uiInitializer.js"
import { setupEventListeners } from "./ui/eventListeners.js"
import { renderEntities } from "./ui/views/entitiesView.js"

window.addEventListener("DOMContentLoaded", async () => {
  try {
    // 1. Charge l'état de l'application (données + UI)
    await initializeAppUI()

    // 2. Affiche les entités initiales
    renderEntities()

    // 3. Met en place les écouteurs pour les boutons, etc.
    setupEventListeners()
  } catch (error) {
    console.error("Erreur critique lors de l'initialisation du renderer :", error)
    const errorContainer = document.getElementById("error-container")
    const errorMessage = document.getElementById("error-message")
    if (errorContainer && errorMessage) {
      errorMessage.textContent = "Impossible d'initialiser l'application. Détails : \n" + error.stack
      errorContainer.style.display = "block"
    }
  }
})
