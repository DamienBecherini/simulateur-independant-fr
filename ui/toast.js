// ui/toast.js
import { toastContainer } from "./domElements.js"

export function showToast(message, type = "success") {
  const toast = document.createElement("div")
  toast.className = `toast ${type}`
  toast.textContent = message
  toastContainer.appendChild(toast)

  setTimeout(() => {
    toast.classList.add("fade-out")
    toast.addEventListener("animationend", () => toast.remove())
  }, 3000)
}
