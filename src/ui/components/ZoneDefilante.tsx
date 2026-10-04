// src/ui/components/ZoneDefilante.tsx

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Conteneur à défilement horizontal pour un tableau trop large (sur téléphone) : il prend le focus, pour qu'on
 * puisse le faire défiler avec les flèches du clavier, et se présente comme une région nommée.
 */
export function ZoneDefilante({ libelle, className, children }: { libelle: string; className?: string; children: ReactNode }) {
  return (
    <div tabIndex={0} role="region" aria-label={libelle} className={cn("relative overflow-x-auto print:overflow-visible focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}>
      {children}
    </div>
  )
}
