// ui/theme.js
// VERSION MODIFIÉE : Ne gère plus la persistance, piloté par renderer.js

export function initializeTheme(initialTheme, onThemeChangeCallback) {
  const themeToggleButton = document.getElementById("theme-toggle-checkbox")
  const body = document.body

  // Applique un thème donné (light ou dark)
  const applyTheme = theme => {
    body.classList.toggle("dark-mode", theme === "dark")
    themeToggleButton.checked = theme === "dark"
  }

  // Écouteur de changement sur le bouton
  themeToggleButton.addEventListener("change", () => {
    const newTheme = themeToggleButton.checked ? "dark" : "light"
    applyTheme(newTheme)
    // Notifie le renderer.js qu'un changement a eu lieu pour qu'il puisse sauvegarder l'état
    if (onThemeChangeCallback) {
      onThemeChangeCallback()
    }
  })

  // Applique le thème initial passé par renderer.js au chargement
  // S'il n'y en a pas, on détecte celui du système comme avant
  if (initialTheme) {
    applyTheme(initialTheme)
  } else {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    applyTheme(prefersDark ? "dark" : "light")
  }
}
