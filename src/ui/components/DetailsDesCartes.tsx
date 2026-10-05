// src/ui/components/DetailsDesCartes.tsx
// Détail des cartes de résultats, ouvert ou fermé par groupe (voir useDetailsDesCartes) : le fournisseur de l'état
// partagé et le bouton « Afficher le détail » de chaque carte.

import type { ReactNode } from "react"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { DetailsDesCartesContext, useDetailDuGroupe, useDetailsDesCartes, useDetailsDesCartesExistants, type GroupeDeCartes } from "../hooks/useDetailsDesCartes"

/** Fournit l'état partagé des détails, sauf s'il est déjà fourni plus haut : les cartes d'un groupe n'en ont qu'un. */
export function FournisseurDesDetails({ children }: { children: ReactNode }) {
  const existants = useDetailsDesCartesExistants()
  return existants ? <>{children}</> : <NouveauxDetails>{children}</NouveauxDetails>
}

function NouveauxDetails({ children }: { children: ReactNode }) {
  return <DetailsDesCartesContext.Provider value={useDetailsDesCartes()}>{children}</DetailsDesCartesContext.Provider>
}

/** Ce que désigne le bouton quand le groupe compte plusieurs cartes : il agit sur toutes. */
const TOUTES: Record<GroupeDeCartes, string> = { foyers: "tous les foyers", activites: "toutes les activités" }

interface BoutonDuDetailProps {
  groupe: GroupeDeCartes
  /** Nombre de cartes du groupe : au-delà d'une, le libellé dit que le bouton les ouvre toutes. */
  nombre: number
  /** Identifiant du détail de la carte, que le bouton montre ou masque. */
  controle: string
  className?: string
}

/**
 * Affiche ou masque le détail de toutes les cartes du groupe. Le libellé et `aria-expanded` suivent l'état du groupe ;
 * le bouton garde sa place dans la fenêtre et le focus, même quand des cartes s'ouvrent au-dessus de lui.
 */
export function BoutonDuDetailDesCartes({ groupe, nombre, controle, className }: BoutonDuDetailProps) {
  const { ouvert, basculer } = useDetailDuGroupe(groupe)
  return (
    <button
      type="button"
      aria-expanded={ouvert}
      aria-controls={controle}
      onClick={event => basculer(event.currentTarget)}
      className={cn("flex min-h-6 w-fit items-center gap-1.5 rounded-md text-left text-sm font-medium text-blue-700 underline-offset-2 hover:underline pointer-coarse:min-h-11 dark:text-blue-400 print:hidden", className)}
    >
      <ChevronRight aria-hidden className={cn("h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none", ouvert && "rotate-90")} />
      <span>
        {ouvert ? "Masquer le détail" : "Afficher le détail"}
        {nombre > 1 ? (
          <>
            {" "}
            <span className="font-normal text-slate-600 dark:text-slate-400">({TOUTES[groupe]})</span>
          </>
        ) : null}
      </span>
    </button>
  )
}
