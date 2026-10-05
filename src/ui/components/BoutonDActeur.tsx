// src/ui/components/BoutonDActeur.tsx

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { ID_DU_PANNEAU, useInspecteur } from "../hooks/useInspecteur"

interface BoutonDActeurProps {
  id: string
  className?: string
  /** Balise rendue hors de l'affichage « Panneaux », où le nom n'ouvre rien. */
  balise?: "div" | "span"
  children: ReactNode
}

/**
 * Le nom d'un acteur (liste des acteurs, grille, résultats). Dans l'affichage « Panneaux », un bouton qui ouvre son
 * panneau, ou le referme ; ailleurs, le contenu tel quel.
 */
export function BoutonDActeur({ id, className, balise: Balise = "span", children }: BoutonDActeurProps) {
  const inspecteur = useInspecteur()
  if (!inspecteur) return <Balise className={className}>{children}</Balise>
  const ouvert = inspecteur.acteurOuvert === id
  return (
    <button
      type="button"
      data-acteur={id}
      aria-expanded={ouvert}
      aria-controls={ouvert ? ID_DU_PANNEAU : undefined}
      title={ouvert ? "Fermer le panneau" : "Réglages et résultats"}
      className={cn("min-h-6 cursor-pointer rounded-md underline-offset-2 hover:underline pointer-coarse:min-h-11", ouvert && "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-100", className)}
      onClick={event => inspecteur.basculer(id, event.currentTarget)}
    >
      {children}
      <span className="sr-only"> : réglages et résultats</span>
    </button>
  )
}
