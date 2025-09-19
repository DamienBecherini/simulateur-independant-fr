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
    li.dataset.entityId = entity.id // On stocke l'ID pour une utilisation future

    li.innerHTML = `
      <div class="entity-info">
        <span class="entity-name">${entity.name}</span>
        <span class="entity-type">${getEntityTypeLabel(entity.type)}</span>
      </div>
      <div class="entity-actions">
        <button class="configure-btn">⚙️ Configurer</button>
        <button class="delete-btn">🗑️ Supprimer</button>
      </div>
    `
    DOM.entitiesList.appendChild(li)
  })
}
