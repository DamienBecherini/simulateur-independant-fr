// src/ui/hooks/useDefilementHorizontal.ts
// Suivi du défilement horizontal d'un tableau plus large que sa zone : déborde-t-il, est-on au début ou à la fin, et
// où finit sa première colonne quand elle reste fixe. Mesuré au défilement (une fois par image) et quand la zone ou
// son contenu changent de taille.

import { useCallback, useEffect, useState, type RefObject } from "react"
import { defilementDUnPas, etatDuDefilement, memeDefilement, SANS_DEFILEMENT, type EtatDuDefilement, type GeometrieDeLaZone } from "@/lib/defilement"

/** Défilement doux, sauf si l'utilisateur a demandé de réduire les animations. */
export function comportementDuDefilement(): ScrollBehavior {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth"
}

/** Largeur de la première cellule de la zone si elle reste fixe pendant le défilement (`position: sticky`), 0 sinon. */
function largeurDeLaColonneFixe(zone: HTMLElement): number {
  const premiere = zone.querySelector<HTMLElement>("[data-colonne-fixe], th, td")
  return premiere && getComputedStyle(premiere).position === "sticky" ? premiere.offsetWidth : 0
}

function mesurer(zone: HTMLElement): GeometrieDeLaZone {
  return { defilement: zone.scrollLeft, largeurVisible: zone.clientWidth, largeurTotale: zone.scrollWidth, colonneFixe: largeurDeLaColonneFixe(zone) }
}

export function useDefilementHorizontal(zone: RefObject<HTMLElement | null>): EtatDuDefilement & { defiler: (sens: -1 | 1) => void } {
  const [etat, setEtat] = useState<EtatDuDefilement>(SANS_DEFILEMENT)

  useEffect(() => {
    const element = zone.current
    if (!element) return
    let image = 0
    const noter = () => {
      image = 0
      const suivant = etatDuDefilement(mesurer(element))
      setEtat(precedent => (memeDefilement(precedent, suivant) ? precedent : suivant))
    }
    // Une seule mesure par image, si nombreux que soient les événements de défilement.
    const planifier = () => {
      if (image === 0) image = requestAnimationFrame(noter)
    }
    noter()
    element.addEventListener("scroll", planifier, { passive: true })
    const observateur = new ResizeObserver(planifier)
    observateur.observe(element)
    if (element.firstElementChild) observateur.observe(element.firstElementChild)
    return () => {
      element.removeEventListener("scroll", planifier)
      observateur.disconnect()
      cancelAnimationFrame(image)
    }
  }, [zone])

  const defiler = useCallback(
    // Le compilateur React (absent de la compilation) ne reconnaît pas `zone`, reçue en paramètre, comme une ref et lui
    // demande `zone.current` en dépendance ; [zone] est juste : la ref est stable, son contenu est lu à l'appel.
    // eslint-disable-next-line react-hooks/preserve-manual-memoization -- faux positif, voir ci-dessus
    (sens: -1 | 1) => {
      const element = zone.current
      if (element) element.scrollTo({ left: defilementDUnPas(mesurer(element), sens), behavior: comportementDuDefilement() })
    },
    [zone]
  )

  return { ...etat, defiler }
}
