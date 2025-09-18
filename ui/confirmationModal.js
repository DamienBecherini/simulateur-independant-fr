// ui/confirmationModal.js
const modal = document.getElementById("confirmation-modal")
const titleEl = document.getElementById("confirmation-title")
const messageEl = document.getElementById("confirmation-message")
const confirmBtn = document.getElementById("confirm-btn")
const cancelBtn = document.getElementById("cancel-btn")

/**
 * Affiche une modale de confirmation et retourne une promesse.
 * @param {string} title Le titre de la modale.
 * @param {string} message Le message de confirmation.
 * @returns {Promise<boolean>} Résout à `true` si confirmé, `false` si annulé.
 */
export function showConfirmation(title, message) {
  titleEl.textContent = title
  messageEl.textContent = message
  modal.style.display = "flex"

  return new Promise(resolve => {
    const close = result => {
      modal.style.display = "none"
      confirmBtn.onclick = null
      cancelBtn.onclick = null
      resolve(result)
    }

    confirmBtn.onclick = () => close(true)
    cancelBtn.onclick = () => close(false)
  })
}
