// Fichier : ui/eventListeners.js

import * as DOM from "./domElements.js"
import { renderEntities } from "./views/entitiesView.js"
import { showConfirmation } from "./confirmationModal.js"
import { openModal, closeModal } from "./modalManager.js"
import { generateEntityConfigForm } from "./views/entityConfigView.js"

// Fonction pour sauvegarder l'état (inchangée)
const saveSimulationState = () => {
  // Note: le nom "updateUIState" est un peu trompeur maintenant,
  // car il sauvegarde aussi les données de simulation. On le renommera plus tard.
  window.api.updateUIState({
    simulation: window.appState.simulation,
    ui: window.appState.ui // Important de sauvegarder aussi l'UI (thème, etc.)
  })
}

// La fonction principale qui attache tous les écouteurs
export function setupEventListeners() {
  // --- Écouteurs pour les boutons d'ajout (inchangés) ---
  DOM.addPersonBtn.addEventListener("click", () => {
    const newPerson = {
      id: `person-${Date.now()}`,
      type: "person",
      name: `Personne ${window.appState.simulation.entities.filter(e => e.type === "person").length + 1}`,
      properties: {
        partsFiscales: 1,
        are: { dailyRate: 0, daysPerMonth: 0 }
      }
    }
    window.appState.simulation.entities.push(newPerson)
    renderEntities()
    saveSimulationState()
  })

  DOM.addCompanyBtn.addEventListener("click", () => {
    const newCompany = {
      id: `company-${Date.now()}`,
      type: "company",
      name: `Société ${window.appState.simulation.entities.filter(e => e.type === "company").length + 1}`,
      properties: {
        status: "SASU",
        capitalSocial: 1000
      }
    }
    window.appState.simulation.entities.push(newCompany)
    renderEntities()
    saveSimulationState()
  })

  // Gestion des clics sur la liste d'entités (Supprimer / Configurer) ---
  DOM.entitiesList.addEventListener("click", async event => {
    // On cherche si le clic a eu lieu sur un bouton "supprimer" ou "configurer"
    const deleteBtn = event.target.closest(".delete-btn")
    const configureBtn = event.target.closest(".configure-btn")

    // Si on n'a cliqué sur aucun de ces boutons, on ne fait rien.
    if (!deleteBtn && !configureBtn) {
      return
    }

    // On remonte à l'élément <li> parent pour récupérer l'ID de l'entité
    const li = event.target.closest("li")
    const entityId = li.dataset.entityId

    // CAS 1 : Clic sur le bouton SUPPRIMER
    if (deleteBtn) {
      const entityToDelete = window.appState.simulation.entities.find(e => e.id === entityId)
      if (!entityToDelete) return

      // On utilise notre modale de confirmation
      const confirmed = await showConfirmation("Supprimer l'entité ?", `Êtes-vous sûr de vouloir supprimer "${entityToDelete.name}" ? Cette action est irréversible.`)

      if (confirmed) {
        // On met à jour l'état en filtrant le tableau pour exclure l'entité
        window.appState.simulation.entities = window.appState.simulation.entities.filter(entity => entity.id !== entityId)
        // On met à jour l'affichage et on sauvegarde
        renderEntities()
        saveSimulationState()
      }
    }

    // CAS 2 : Clic sur le bouton CONFIGURER
    if (configureBtn) {
      const entityToConfigure = window.appState.simulation.entities.find(e => e.id === entityId)
      if (!entityToConfigure) return

      // 1. Générer le HTML du formulaire
      const formHTML = generateEntityConfigForm(entityToConfigure)

      // 2. Ouvrir la modale avec le formulaire
      openModal(`Configurer: ${entityToConfigure.name}`, formHTML)

      // 3. Attacher un écouteur de soumission au formulaire DANS la modale
      const form = document.getElementById("entity-config-form")
      form.addEventListener("submit", submitEvent => {
        submitEvent.preventDefault()

        // Récupérer les données du formulaire
        const formData = new FormData(form)
        const updates = Object.fromEntries(formData.entries())

        // Mettre à jour l'état de l'application
        const entityIndex = window.appState.simulation.entities.findIndex(e => e.id === entityId)
        if (entityIndex > -1) {
          const currentEntity = window.appState.simulation.entities[entityIndex]

          // Mettre à jour le nom
          currentEntity.name = updates.name

          // Mettre à jour les propriétés spécifiques
          if (currentEntity.type === "person") {
            currentEntity.properties.partsFiscales = parseFloat(updates.partsFiscales)
            currentEntity.properties.are.dailyRate = parseFloat(updates.areDailyRate)
            currentEntity.properties.are.daysPerMonth = parseInt(updates.areDaysPerMonth)
          } else if (currentEntity.type === "company") {
            currentEntity.properties.status = updates.status
            currentEntity.properties.capitalSocial = parseFloat(updates.capitalSocial)
          }
        }

        // Mettre à jour l'UI, sauvegarder, et fermer
        renderEntities()
        saveSimulationState()
        closeModal()
      })
    }
  })
}
