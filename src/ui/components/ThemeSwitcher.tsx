// src/ui/components/ThemeSwitcher.tsx

import { useState, useEffect } from "react"
import { Moon, Sun } from "lucide-react" // On importe les icônes
import { Button } from "@/components/ui/button"

// On définit un type pour s'assurer qu'on ne peut utiliser que 'light' ou 'dark'
type Theme = "light" | "dark"

function ThemeSwitcher() {
  // 1. On crée un état pour le thème.
  // On initialise l'état en lisant le localStorage, ou en se basant sur la préférence système.
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem("theme") as Theme | null
    if (savedTheme) {
      return savedTheme
    }
    // Si rien n'est sauvegardé, on regarde la préférence du système d'exploitation
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark"
    }
    return "light"
  })

  // 2. On utilise useEffect pour appliquer la classe au chargement et à chaque changement de thème.
  useEffect(() => {
    const root = window.document.documentElement // C'est la balise <html>
    root.classList.remove("light", "dark") // On nettoie les classes précédentes
    root.classList.add(theme) // On ajoute la classe actuelle ('light' ou 'dark')
    localStorage.setItem("theme", theme) // On sauvegarde le choix dans le localStorage
  }, [theme]) // Ce code se ré-exécute à chaque fois que la variable 'theme' change

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light")
  }

  return (
    <Button variant="outline" size="icon" onClick={toggleTheme}>
      {/* On affiche l'icône du soleil si le thème est 'light', et la lune sinon */}
      {theme === "light" ? <Sun className="h-[1.2rem] w-[1.2rem]" /> : <Moon className="h-[1.2rem] w-[1.2rem]" />}
      <span className="sr-only">Changer de thème</span>
    </Button>
  )
}

export default ThemeSwitcher
