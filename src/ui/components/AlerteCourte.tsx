// src/ui/components/AlerteCourte.tsx

import { couperLAlerte } from "@/lib/alerte-courte"
import { AideEnBulle } from "./Bulle"

/**
 * Une alerte des résultats en une ligne (voir src/lib/alerte-courte.ts), le reste dans une bulle ouverte par (?).
 * À l'impression, sans bulle, le texte entier : la suite s'affiche à sa place derrière la ligne courte, ou le texte
 * entier remplace une ligne courte écrite à la main.
 */
export function AlerteCourte({ texte }: { texte: string }) {
  const { court, detail, coupeEnCours } = couperLAlerte(texte)
  if (!detail) return <>{texte}</>
  const debutDuTexte = texte.startsWith(court)
  return (
    <>
      <span className={debutDuTexte ? undefined : "print:hidden"}>{court}</span>
      {debutDuTexte ? <span className="hidden print:inline">{texte.slice(court.length)}</span> : <span className="hidden print:inline">{texte}</span>}
      {coupeEnCours ? (
        <span aria-hidden="true" className="print:hidden">
          …
        </span>
      ) : null}{" "}
      <AideEnBulle libelle="Détail de l'alerte" texte={detail} />
    </>
  )
}
