// src/ui/components/HauteurAnimee.tsx
// Un bloc dont la hauteur suit son contenu en douceur : un autre mode de partage, un curseur ou un coût qui arrivent
// après leur calcul. Le contenu en dessous glisse au lieu de sauter. Sans animation si le système en demande moins.

import { useLayoutEffect, useRef, type ReactNode, type RefObject } from "react"

/** Pose un style de l'élément (hors du hook : le compilateur de React n'y voit pas une modification de ses arguments). */
function poser(element: HTMLElement, propriete: "height" | "transition", valeur: string) {
  element.style[propriete] = valeur
}

/** Le bloc a une transition de hauteur : pas quand le système demande moins d'animations (classe `motion-safe`). */
function anime(bloc: HTMLElement): boolean {
  return Number.parseFloat(getComputedStyle(bloc).transitionDuration) > 0
}

/**
 * Au repos, `exterieur` a sa hauteur naturelle (rien n'est jamais coupé). Quand la hauteur de `interieur` change (un
 * autre mode, un calcul qui arrive), `exterieur` part de sa hauteur d'avant et va à la nouvelle par sa transition CSS,
 * puis reprend sa hauteur naturelle. Quand c'est la largeur qui change (fenêtre redimensionnée, zoom), le texte passe à
 * la ligne : rien à animer, la hauteur naturelle suit d'elle-même.
 */
function useHauteurQuiSuit(exterieur: RefObject<HTMLElement | null>, interieur: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const bloc = exterieur.current
    const contenu = interieur.current
    if (!bloc || !contenu || typeof ResizeObserver === "undefined") return
    let largeur = contenu.offsetWidth
    let hauteur = contenu.offsetHeight
    const suivre = () => {
      const nouvelle = contenu.offsetHeight
      const memeLargeur = contenu.offsetWidth === largeur
      largeur = contenu.offsetWidth
      if (nouvelle === hauteur) return
      // Pendant une transition, elle part de la hauteur atteinte ; au repos, de celle d'avant le changement.
      const depuis = bloc.style.height ? bloc.offsetHeight : hauteur
      hauteur = nouvelle
      if (!memeLargeur || !anime(bloc)) return poser(bloc, "height", "")
      poser(bloc, "transition", "none")
      poser(bloc, "height", `${depuis}px`)
      // Lire une mesure applique la hauteur de départ avant de rendre la transition.
      void bloc.offsetHeight
      poser(bloc, "transition", "")
      poser(bloc, "height", `${nouvelle}px`)
    }
    const auRepos = (evenement: TransitionEvent) => {
      if (evenement.target === bloc && evenement.propertyName === "height") poser(bloc, "height", "")
    }
    const observateur = new ResizeObserver(suivre)
    observateur.observe(contenu)
    bloc.addEventListener("transitionend", auRepos)
    bloc.addEventListener("transitioncancel", auRepos)
    return () => {
      observateur.disconnect()
      bloc.removeEventListener("transitionend", auRepos)
      bloc.removeEventListener("transitioncancel", auRepos)
      poser(bloc, "height", "")
    }
  }, [exterieur, interieur])
}

/**
 * Le contenu n'est coupé que pendant une transition (avec une marge, pour l'anneau de focus d'un champ au bord) ; la
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
