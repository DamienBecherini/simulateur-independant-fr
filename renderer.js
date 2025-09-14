// renderer.js
// Point d'entrée principal pour le processus de rendu.
// Son rôle est d'orchestrer l'initialisation des différents modules de l'interface.

import { initializeAppUI } from "./ui/uiInitializer.js"
import { setupEventListeners } from "./ui/eventListeners.js"
import { manageScrollShadowsWithObserver } from "./ui/utils/scrollManager.js"
import * as DOM from "./ui/domElements.js"

window.addEventListener("DOMContentLoaded", async () => {
  try {
    // 1. Initialise l'état de l'interface (formulaire, thème, onglets) à partir des données sauvegardées
    await initializeAppUI()

    // 2. Met en place tous les écouteurs d'événements pour rendre l'application interactive
    setupEventListeners()

    // 3. Initialise les modules d'UI complexes qui ne dépendent pas de l'état initial
    manageScrollShadowsWithObserver(DOM.tabsNav)

    // 4. NOUVEAU : On lance la simulation initiale ICI, une fois que tout est prêt.
    const formInputs = window.appState.ui?.formInputs || {}
    if (formInputs.caServices > 0 || formInputs.caVente > 0) {
      DOM.form.dispatchEvent(new Event("submit"))
    }
  } catch (error) {
    // Gestion d'une erreur critique au démarrage
    console.error("Erreur critique lors de l'initialisation du renderer :", error)
    const errorContainer = document.getElementById("error-container")
    const errorMessage = document.getElementById("error-message")
    if (errorContainer && errorMessage) {
      errorMessage.textContent = "Impossible d'initialiser l'application. Une erreur de chargement est survenue. Détails : \n" + error.stack
      errorContainer.style.display = "block"
    }
  }
})
