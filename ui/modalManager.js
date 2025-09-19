// Fichier : ui/modalManager.js

const modal = document.getElementById("config-modal")
const titleEl = document.getElementById("config-modal-title")
const bodyEl = document.getElementById("config-modal-body")
const closeBtn = document.getElementById("config-modal-close-btn")

function closeModal() {
  modal.style.display = "none"
  bodyEl.innerHTML = "" // Vider le contenu pour la prochaine fois
}

export function openModal(title, contentHTML) {
  titleEl.textContent = title
  bodyEl.innerHTML = contentHTML
  modal.style.display = "flex"
}

// Attacher les écouteurs pour fermer la modale
closeBtn.addEventListener("click", closeModal)
modal.addEventListener("click", event => {
  // Ne ferme que si on clique sur l'overlay gris, pas sur le contenu
  if (event.target === modal) {
    closeModal()
  }
})

// Exporter la fonction de fermeture pour pouvoir l'appeler après avoir sauvegardé
export { closeModal }
