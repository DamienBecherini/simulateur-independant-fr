// Fichier : ui/views/entitiesView.js

import * as DOM from "../domElements.js"

// Fonction pour traduire le type d'entité en texte lisible
const getEntityTypeLabel = type => {
  switch (type) {
    case "person":
      return "Personne"
    case "company":
      return "Société"
    case "micro-enterprise":
      return "Micro-entreprise"
    default:
      return "Inconnu"
  }
}

function getEntityDetailsHTML(entity) {
  const p = entity.properties
  let details = []

  switch (entity.type) {
    case "person":
      details.push(`<span>PF: ${p.partsFiscales}</span>`)
      if (p.are?.dailyRate > 0 && p.are?.remainingDays > 0) {
        details.push(`<span>ARE: ${p.are.dailyRate}€ / ${p.are.remainingDays}j</span>`)
      }
      break
    case "company":
      details.push(`<span>${p.status}</span>`)
      details.push(`<span>Capital: ${new Intl.NumberFormat("fr-FR").format(p.capitalSocial)} €</span>`)
      break
  }
  return details.join("")
}

export function renderEntities() {
  // 1. Récupérer les entités depuis l'état global
  const entities = window.appState.simulation.entities

  // 2. Vider la liste actuelle pour éviter les doublons
  DOM.entitiesList.innerHTML = ""

  // 3. Si aucune entité, afficher un message
  if (entities.length === 0) {
    DOM.entitiesList.innerHTML = '<li class="no-entities">Aucune entité. Ajoutez une personne pour commencer.</li>'
    return
  }

  // 4. Boucler sur chaque entité et créer un élément <li>
  entities.forEach(entity => {
    const li = document.createElement("li")
    li.dataset.entityId = entity.id
    li.setAttribute("draggable", "true") // Rendre l'élément déplaçable

    li.innerHTML = `
      <span class="drag-handle">⠿</span>
      <div class="entity-info">
          <span class="entity-name">${entity.name}</span>
          <span class="entity-type">${getEntityTypeLabel(entity.type)}</span>
      </div>
      <div class="entity-details">
          ${getEntityDetailsHTML(entity)}
      </div>
      <div class="entity-actions">
          <!-- On retire le bouton configurer, il devient implicite -->
          <button class="delete-btn" title="Supprimer">🗑️</button>
      </div>
    `
    DOM.entitiesList.appendChild(li)
  })
}
