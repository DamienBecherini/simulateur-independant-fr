// ui/theme.js

// On rend cette fonction exportable pour que renderer.js puisse l'appeler
export function initializeTheme() {
  const themeToggleButton = document.getElementById("theme-toggle-checkbox")
  const body = document.body

  const applyTheme = theme => {
    body.classList.toggle("dark-mode", theme === "dark")
    themeToggleButton.checked = theme === "dark"
  }

  themeToggleButton.addEventListener("change", () => {
    const newTheme = themeToggleButton.checked ? "dark" : "light"
    localStorage.setItem("theme", newTheme)
    applyTheme(newTheme)
  })

  // Au chargement, on applique le thème sauvegardé ou le thème système
  const savedTheme = localStorage.getItem("theme")
  if (savedTheme) {
    applyTheme(savedTheme)
  } else {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    applyTheme(prefersDark ? "dark" : "light")
  }
}
