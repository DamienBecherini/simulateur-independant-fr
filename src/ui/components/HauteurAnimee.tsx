// src/ui/components/HauteurAnimee.tsx
// Un bloc dont la hauteur suit son contenu en douceur : un autre mode de partage, un curseur ou un coût qui arrivent
// après leur calcul. Le contenu en dessous glisse au lieu de sauter. Sans animation si le système en demande moins.

import { useLayoutEffect, useRef, type ReactNode, type RefObject } from "react"

/** Pose un style de l'élément (hors du hook : le compilateur de React n'y voit pas une modification de ses arguments). */
function poser(element: HTMLElement, propriete: "height" | "transition", valeur: string) {
  element.style[propriete] = valeur
}

/** Pose la hauteur sans transition : lire une mesure l'applique avant de rendre la transition. */
function poserSansTransition(bloc: HTMLElement, hauteur: string) {
  poser(bloc, "transition", "none")
  poser(bloc, "height", hauteur)
  void bloc.offsetHeight
  poser(bloc, "transition", "")
}

/**
 * Donne à `exterieur` la hauteur de `interieur`, à chaque changement de celle-ci : la transition CSS de `exterieur`
 * l'anime quand le contenu change (un autre mode, un calcul qui arrive). Quand c'est la largeur qui change (fenêtre
 * redimensionnée, zoom), le texte passe à la ligne : la hauteur suit aussitôt, sans couper le texte le temps d'une
 * animation. La première hauteur est posée sans transition (rien ne bouge à l'affichage).
 */
function useHauteurQuiSuit(exterieur: RefObject<HTMLElement | null>, interieur: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const bloc = exterieur.current
    const contenu = interieur.current
    if (!bloc || !contenu || typeof ResizeObserver === "undefined") return
    let largeur = contenu.offsetWidth
    const suivre = () => {
      const hauteur = `${contenu.offsetHeight}px`
      if (contenu.offsetWidth === largeur) return poser(bloc, "height", hauteur)
      largeur = contenu.offsetWidth
      poserSansTransition(bloc, hauteur)
    }
    poserSansTransition(bloc, `${contenu.offsetHeight}px`)
    const observateur = new ResizeObserver(suivre)
    observateur.observe(contenu)
    return () => {
      observateur.disconnect()
      poser(bloc, "height", "")
    }
  }, [exterieur, interieur])
}

/**
 * Le contenu est coupé pendant qu'il s'agrandit (avec une marge, pour l'anneau de focus d'un champ au bord) ; la
 * transition (200 ms) n'a lieu que si le système ne demande pas moins d'animations.
 */
export function HauteurAnimee({ className, children }: { className?: string; children: ReactNode }) {
  const exterieur = useRef<HTMLDivElement>(null)
  const interieur = useRef<HTMLDivElement>(null)
  useHauteurQuiSuit(exterieur, interieur)
  return (
    <div ref={exterieur} data-hauteur-animee className="[overflow:clip] [overflow-clip-margin:8px] motion-safe:transition-[height] motion-safe:duration-200 motion-safe:ease-out print:!h-auto">
      <div ref={interieur} className={className}>
        {children}
      </div>
    </div>
  )
}

/** Fondu d'un texte qui arrive après son calcul (un coût, un plafond) : il ne surgit pas d'un coup. */
export const APPARITION = "motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
