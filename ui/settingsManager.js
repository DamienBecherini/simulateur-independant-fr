// ui/settingsManager.js
import * as DOM from "./domElements.js"
import { showToast } from "./toast.js"
import { formatDate } from "./utils/formatters.js"
import { showConfirmation } from "./confirmationModal.js"

// Fonction utilitaire pour le drag-and-drop
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

// Fonctions de gestion des vues du menu
const showMainSettingsView = () => {
  DOM.settingsTitle.textContent = "Configuration"
  DOM.mainSettingsView.classList.remove("is-hidden")
  DOM.loadSettingsView.classList.add("is-hidden")
}

const showLoadView = async () => {
  DOM.settingsTitle.textContent = "Charger une sauvegarde"
  const backups = await window.api.listBackups()
  DOM.backupsList.innerHTML = ""

  if (backups.length === 0) {
    DOM.backupsList.innerHTML = "<li><div class='backup-info'>Aucune sauvegarde trouvée.</div></li>"
  } else {
    backups.forEach(backup => {
      const li = document.createElement("li")
      li.setAttribute("draggable", "true")
      li.innerHTML = `
        <span class="drag-handle">⠿</span>
        <div class="backup-info">
          <span class="backup-name">${backup.name}</span>
          <span class="backup-date">Le ${formatDate(backup.modified)}</span>
        </div>
        <div class="backup-actions">
          <button class="export-btn" title="Exporter">📥</button>
          <button class="delete-btn" title="Supprimer">🗑️</button>
          <button class="load-btn" title="Charger">✅</button>
        </div>
      `
      li.querySelector(".load-btn").addEventListener("click", () => window.api.loadBackup(backup.name))
      li.querySelector(".delete-btn").addEventListener("click", async () => {
        await window.api.deleteBackup(backup.name)
        showToast(`Sauvegarde '${backup.name}' supprimée.`)
        showLoadView()
      })
      li.querySelector(".export-btn").addEventListener("click", () => window.api.exportBackup(backup.name))
      li.addEventListener("dragstart", () => li.classList.add("dragging"))
      li.addEventListener("dragend", () => li.classList.remove("dragging"))
      DOM.backupsList.appendChild(li)
    })
  }

  DOM.mainSettingsView.classList.add("is-hidden")
  DOM.loadSettingsView.classList.remove("is-hidden")
}

// Fonction d'initialisation principale pour ce module
export function initializeSettingsMenu() {
  DOM.settingsOpenBtn.addEventListener("click", () => DOM.settingsOverlay.classList.add("is-open"))
  DOM.settingsCloseBtn.addEventListener("click", () => {
    DOM.settingsOverlay.classList.remove("is-open")
    setTimeout(showMainSettingsView, 300)
  })
  DOM.settingsOverlay.addEventListener("click", event => {
    if (event.target === DOM.settingsOverlay) {
      DOM.settingsOverlay.classList.remove("is-open")
      setTimeout(showMainSettingsView, 300)
    }
  })

  DOM.loadConfigBtn.addEventListener("click", showLoadView)
  DOM.backToMainBtn.addEventListener("click", showMainSettingsView)

  // Écouteurs pour les actions
  DOM.saveConfigBtn.addEventListener("click", async () => {
    const configName = DOM.configNameInput.value.trim() || "Sauvegarde sans nom"
    const result = await window.api.createBackup(configName)
    if (result.success) {
      showToast(`Configuration '${configName}' enregistrée !`)
    } else {
      showToast(`Erreur : ${result.error}`, "error")
    }
  })

  const importBtn = document.getElementById("import-config-btn")
  importBtn.addEventListener("click", async () => {
    const result = await window.api.importBackup()
    if (result.success) {
      // Le rechargement est géré par main.js, pas besoin d'afficher de toast ici.
    } else if (!result.canceled) {
      showToast(`Erreur d'importation : ${result.error}`, "error")
    }
  })

  // MODIFIÉ : On utilise notre nouvelle modale pour la réinitialisation
  DOM.resetConfigBtn.addEventListener("click", async () => {
    const confirmed = await showConfirmation("Réinitialiser la configuration", "Toutes vos données et sauvegardes seront perdues. Cette action est irréversible. Êtes-vous sûr de vouloir continuer ?")
    if (confirmed) {
      window.api.resetToFactory()
    }
  })

  // Écouteurs pour le conteneur D&D
  DOM.backupsList.addEventListener("dragover", e => {
    e.preventDefault()
    const afterElement = getDragAfterElement(DOM.backupsList, e.clientY)
    const dragging = document.querySelector(".dragging")
    if (afterElement == null) {
      DOM.backupsList.appendChild(dragging)
    } else {
      DOM.backupsList.insertBefore(dragging, afterElement)
    }
  })

  DOM.backupsList.addEventListener("drop", async () => {
    const newOrder = [...DOM.backupsList.querySelectorAll("li .backup-name")].map(el => el.textContent)
    await window.api.saveBackupOrder(newOrder)
  })
}
