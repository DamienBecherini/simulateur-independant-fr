// src/ui/components/ThemeToggle.tsx

import { Moon, Sun } from "lucide-react"
import { Switch } from "@/components/ui/switch" // On utilise le Switch de base
import { cn } from "@/lib/utils"
import { useTheme } from "../hooks/useTheme"

/** Interrupteur clair / sombre ; plusieurs peuvent coexister (barre d'outils, paramètres), ils partagent le thème. */
export function ThemeToggle({ id, className }: { id?: string; className?: string }) {
  const [theme, setTheme] = useTheme()
  const handleThemeChange = (isDarkMode: boolean) => setTheme(isDarkMode ? "dark" : "light")

  return (
    // Le conteneur `relative` est la clé pour le positionnement des icônes
    <div className={cn("relative", className)}>
      <Switch
        id={id}
        checked={theme === "dark"}
        onCheckedChange={handleThemeChange}
        aria-label="Changer de thème"
        // On surcharge les styles ici pour créer notre version custom sans toucher au fichier de base.
        // Au doigt, une bordure transparente porte la zone cliquable à 44 px sans grossir l'interrupteur.
        className={cn("h-8 w-14 border-transparent pointer-coarse:h-11 pointer-coarse:w-[68px] pointer-coarse:border-8 pointer-coarse:bg-clip-padding", "data-[state=checked]:bg-slate-700", "data-[state=unchecked]:bg-yellow-400")}
        // On personnalise également le pouce
        thumbClassName="h-6 w-6 data-[state=checked]:translate-x-6"
      />
      {/* On utilise des conteneurs séparés pour chaque icône pour un contrôle total */}
      <div className="absolute top-1/2 left-1 -translate-y-1/2 pointer-events-none pointer-coarse:left-2.5">
        <Moon className={cn("h-5 w-5 text-white transition-opacity", theme === "light" ? "opacity-0" : "opacity-100")} />
      </div>
      <div className="absolute top-1/2 right-1 -translate-y-1/2 pointer-events-none pointer-coarse:right-2.5">
        <Sun className={cn("h-5 w-5 text-yellow-900 transition-opacity", theme === "dark" ? "opacity-0" : "opacity-100")} />
      </div>
    </div>
  )
}
