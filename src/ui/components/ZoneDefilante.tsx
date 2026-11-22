// src/ui/components/ZoneDefilante.tsx

import { useRef, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { useDefilementHorizontal, useMontrerAuPremierAffichage } from "../hooks/useDefilementHorizontal"
import { useHautDesBarres } from "../hooks/useHautDesBarres"
import { FlechesDeDefilement, OmbresDesBords } from "./ReperesDeDefilement"

/**
 * Conteneur à défilement horizontal pour un tableau trop large (fenêtre étroite, interface agrandie) : il prend le
 * focus, pour qu'on puisse le faire défiler avec les flèches du clavier, et se présente comme une région nommée.
 * Quand le tableau déborde, une ombre marque chaque côté où des colonnes sont cachées, et une flèche y mène
 * (voir ReperesDeDefilement.tsx). `className` habille le cadre ; la zone qui défile en reprend les coins arrondis.
 * La zone est elle-même `relative` : un contenu positionné du tableau (un texte réservé aux lecteurs d'écran, par
 * exemple) reste ainsi coupé par elle, au lieu d'élargir la page. `montrerAuPremierAffichage` désigne (sélecteur) ce
 * que la zone fait voir à sa première apparition, s'il est caché : la colonne au meilleur net du comparateur.
 */
export function ZoneDefilante({ libelle, className, montrerAuPremierAffichage, children }: { libelle: string; className?: string; montrerAuPremierAffichage?: string; children: ReactNode }) {
  const zone = useRef<HTMLDivElement>(null)
  const { deborde, auDebut, aLaFin, colonneFixe, defiler } = useDefilementHorizontal(zone)
  useMontrerAuPremierAffichage(zone, montrerAuPremierAffichage)
  const hautDesBarres = useHautDesBarres(deborde)
  return (
    <div className={cn("group/zone relative", className)}>
      <div ref={zone} tabIndex={0} role="region" aria-label={libelle} className="relative overflow-x-auto rounded-[inherit] print:overflow-visible focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {children}
      </div>
      {deborde ? (
        <>
          <OmbresDesBords gauche={!auDebut} droite={!aLaFin} colonneFixe={colonneFixe} />
          <FlechesDeDefilement gauche={!auDebut} droite={!aLaFin} hautDesBarres={hautDesBarres} onDefiler={defiler} />
        </>
      ) : null}
    </div>
  )
}
