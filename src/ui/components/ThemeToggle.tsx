// src/ui/components/ThemeToggle.tsx

import { useState, useEffect } from "react"
import { Moon, Sun } from "lucide-react"
import { Switch } from "@/components/ui/switch" // On utilise le Switch de base
import { cn } from "@/lib/utils"

type Theme = "light" | "dark"

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem("theme") as Theme | null
    if (savedTheme) return savedTheme
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark"
    return "light"
  })

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove("light", "dark")
    root.classList.add(theme)
    localStorage.setItem("theme", theme)
  }, [theme])

  const handleThemeChange = (isDarkMode: boolean) => {
    setTheme(isDarkMode ? "dark" : "light")
  }

  return (
    // Le conteneur `relative` est la clé pour le positionnement des icônes
    <div className="relative">
      <Switch
        id="theme-toggle"
        checked={theme === "dark"}
        onCheckedChange={handleThemeChange}
        aria-label="Changer de thème"
        // On surcharge les styles ici pour créer notre version custom sans toucher au fichier de base
        className={cn("h-8 w-14 border-transparent", "data-[state=checked]:bg-slate-700", "data-[state=unchecked]:bg-yellow-400")}
        // On personnalise également le pouce
        thumbClassName="h-6 w-6 data-[state=checked]:translate-x-6"
      />
      {/* On utilise des conteneurs séparés pour chaque icône pour un contrôle total */}
      <div className="absolute top-1/2 left-1 -translate-y-1/2 pointer-events-none">
        <Moon className={cn("h-5 w-5 text-white transition-opacity", theme === "light" ? "opacity-0" : "opacity-100")} />
      </div>
      <div className="absolute top-1/2 right-1 -translate-y-1/2 pointer-events-none">
        <Sun className={cn("h-5 w-5 text-yellow-900 transition-opacity", theme === "dark" ? "opacity-0" : "opacity-100")} />
      </div>
    </div>
  )
}
