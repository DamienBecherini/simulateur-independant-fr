// src/ui/curseur.ts
// Logique partagée des curseurs du comparateur (voir src/ui/components/Curseur.tsx) : réglage au clavier et
// glissement au pointeur (souris, doigt, stylet). Pendant le glissement, seul l'aperçu suit le pointeur ; la valeur
// n'est validée qu'au relâchement, pour un seul recalcul du comparateur.

import type { KeyboardEvent, PointerEvent } from "react"
import { valeurAuClavier } from "@/lib/repartition-benefice"

/** Une poignée en cours de glissement et la valeur qu'elle montre. */
export interface Glissement<P extends string = string> {
  poignee: P
  valeur: number
}

export interface Bornes {
  min: number
  max: number
  pas: number
  /** Pas des touches Page précédente et Page suivante. */
  grandPas: number
}

/** Montant visé par le pointeur sur une piste qui va de 0 à `echelle`, d'un bord à l'autre de l'élément. */
export function montantAuPointeur(element: HTMLElement, clientX: number, echelle: number): number {
  const cadre = element.getBoundingClientRect()
  return ((clientX - cadre.left) / Math.max(1, cadre.width)) * echelle
}

/** Réglage au clavier d'une poignée : flèches, pages, début et fin ; la nouvelle valeur est validée aussitôt. */
export function clavierDuCurseur(valeur: number, bornes: Bornes, onValider: (valeur: number) => void) {
  return (e: KeyboardEvent<HTMLElement>) => {
    const nouvelle = valeurAuClavier(e.key, valeur, bornes)
    if (nouvelle === null) return
    e.preventDefault()
    onValider(nouvelle)
  }
}

interface GestesProps<P extends string> {
  /** Faux : la piste ne réagit pas au pointeur. */
  actif: boolean
  glissement: Glissement<P> | null
  onGlisser: (glissement: Glissement<P> | null) => void
  onValider: (glissement: Glissement<P>) => void
  /** La poignée saisie, ou la plus proche du point où l'on appuie sur la piste. */
  poigneeVisee: (e: PointerEvent<HTMLDivElement>) => P
  valeurAuPointeur: (poignee: P, clientX: number) => number
}

/**
 * Gestes du pointeur sur la piste d'un curseur, à étaler sur son élément : l'appui saisit la poignée visée (le
 * pointeur est capturé, la poignée prend le focus), le déplacement montre la valeur, le relâchement la valide.
 * Un glissement annulé (geste du système, appel entrant) ne valide rien.
 */
export function gestesDuCurseur<P extends string>({ actif, glissement, onGlisser, onValider, poigneeVisee, valeurAuPointeur }: GestesProps<P>) {
  return {
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      if (!actif || e.button !== 0) return
      e.preventDefault()
      e.currentTarget.setPointerCapture?.(e.pointerId)
      const poignee = poigneeVisee(e)
      ;(e.currentTarget.querySelector<HTMLElement>(`[data-poignee="${poignee}"]`) ?? e.currentTarget).focus()
      onGlisser({ poignee, valeur: valeurAuPointeur(poignee, e.clientX) })
    },
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
      if (glissement) onGlisser({ poignee: glissement.poignee, valeur: valeurAuPointeur(glissement.poignee, e.clientX) })
    },
    onPointerUp: () => {
      if (glissement) onValider(glissement)
      onGlisser(null)
    },
    onPointerCancel: () => onGlisser(null)
  }
}
