// Fichier : ui/eventListeners.js

import * as DOM from "./domElements.js"
import { renderEntities } from "./views/entitiesView.js"
import { showConfirmation } from "./confirmationModal.js"
import { openModal, closeModal } from "./modalManager.js"
import { generateEntityConfigForm } from "./views/entityConfigView.js"

/**
 * Sauvegarde l'état actuel de la simulation (entités, relations, etc.) et de l'UI (thème)
 * en l'envoyant au processus principal.
 */
const saveSimulationState = () => {
  window.api.updateState({
    simulation: window.appState.simulation,
    ui: window.appState.ui
  })
}

/**
 * Trouve l'élément de la liste après lequel on doit insérer l'élément en cours de déplacement.
 * @param {HTMLElement} container Le conteneur <ul> de la liste.
 * @param {number} y La position verticale (Y) de la souris.
 * @returns {HTMLElement|null} L'élément de la liste qui doit se trouver après l'élément déplacé.
 */
const getDragAfterElement = (container, y) => {
  const draggableElements = [...container.querySelectorAll("li:not(.dragging)")]
  return draggableElements.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect()
      const offset = y - box.top - box.height / 2
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child }
      }
      return closest
    },
    { offset: Number.NEGATIVE_INFINITY }
  ).element
}

/**
 * Met en place tous les écouteurs d'événements pour la page.
 */
export function setupEventListeners() {
  // --- Écouteurs pour les boutons d'ajout ---
  DOM.addPersonBtn.addEventListener("click", () => {
    const newPerson = {
      id: `person-${Date.now()}`,
      type: "person",
      name: `Personne ${window.appState.simulation.entities.filter(e => e.type === "person").length + 1}`,
      properties: {
        partsFiscales: 1,
        are: { dailyRate: 0, remainingDays: 0 }
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

  // --- Gestion des clics sur la liste d'entités (Supprimer / Configurer) ---
  DOM.entitiesList.addEventListener("click", async event => {
    const targetLi = event.target.closest("li")
    if (!targetLi) return // Si on a cliqué entre les <li>, on ne fait rien

    const entityId = targetLi.dataset.entityId

    // CAS 1 : Clic sur le bouton SUPPRIMER
    // On vérifie si la cible du clic ou l'un de ses parents a la classe 'delete-btn'
    if (event.target.closest(".delete-btn")) {
      const entityToDelete = window.appState.simulation.entities.find(e => e.id === entityId)
      if (!entityToDelete) return

      const confirmed = await showConfirmation("Supprimer l'entité ?", `Êtes-vous sûr de vouloir supprimer "${entityToDelete.name}" ? Cette action est irréversible.`)
      if (confirmed) {
        window.appState.simulation.entities = window.appState.simulation.entities.filter(e => e.id !== entityId)
        renderEntities()
        saveSimulationState()
      }
      return // On arrête le traitement pour ne pas ouvrir la config
    }

    // CAS 2 : Clic sur la poignée de Drag & Drop
    // Si on clique ici, on ne fait rien pour laisser le drag & drop se gérer
    if (event.target.closest(".drag-handle")) {
      return
    }

    // CAS 3 (par défaut) : Clic sur le reste de la ligne pour CONFIGURER
    const entityToConfigure = window.appState.simulation.entities.find(e => e.id === entityId)
    if (!entityToConfigure) return

    const formHTML = generateEntityConfigForm(entityToConfigure)
    openModal(`Configurer: ${entityToConfigure.name}`, formHTML)

    const form = document.getElementById("entity-config-form")
    form.addEventListener("submit", submitEvent => {
      submitEvent.preventDefault()

      const formData = new FormData(form)
      const updates = Object.fromEntries(formData.entries())

      const entityIndex = window.appState.simulation.entities.findIndex(e => e.id === entityId)
      if (entityIndex > -1) {
        const currentEntity = window.appState.simulation.entities[entityIndex]

        currentEntity.name = updates.name

        if (currentEntity.type === "person") {
          currentEntity.properties.partsFiscales = parseFloat(updates.partsFiscales)
          currentEntity.properties.are.dailyRate = parseFloat(updates.areDailyRate)
          currentEntity.properties.are.remainingDays = parseInt(updates.areRemainingDays)
        } else if (currentEntity.type === "company") {
          currentEntity.properties.status = updates.status
          currentEntity.properties.capitalSocial = parseFloat(updates.capitalSocial)
        }
      }

      renderEntities()
      saveSimulationState()
      closeModal()
    })
  })

  // --- Gestion du Drag & Drop ---
  DOM.entitiesList.addEventListener("dragstart", event => {
    const targetLi = event.target.closest("li")
    if (targetLi) {
      targetLi.classList.add("dragging")
    }
  })

  DOM.entitiesList.addEventListener("dragend", event => {
    const targetLi = event.target.closest("li")
    if (targetLi) {
      targetLi.classList.remove("dragging")
    }
  })

  DOM.entitiesList.addEventListener("dragover", event => {
    event.preventDefault() // Nécessaire pour autoriser le 'drop'
    const afterElement = getDragAfterElement(DOM.entitiesList, event.clientY)
    const dragging = document.querySelector(".dragging")
    if (dragging) {
      if (afterElement == null) {
        DOM.entitiesList.appendChild(dragging)
      } else {
        DOM.entitiesList.insertBefore(dragging, afterElement)
      }
    }
  })

  DOM.entitiesList.addEventListener("drop", () => {
    // Obtenir le nouvel ordre des ID depuis les attributs data-entity-id du DOM
    const newIdOrder = [...DOM.entitiesList.querySelectorAll("li")].map(li => li.dataset.entityId)

    // Créer une Map pour un accès rapide aux objets entités par leur ID
    const entityMap = new Map(window.appState.simulation.entities.map(e => [e.id, e]))

    // Reconstruire le tableau des entités dans le nouvel ordre
    const newEntitiesOrder = newIdOrder.map(id => entityMap.get(id))

    // Mettre à jour l'état de l'application et sauvegarder
    window.appState.simulation.entities = newEntitiesOrder
    saveSimulationState()
  })
}
