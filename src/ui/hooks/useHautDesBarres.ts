// src/ui/hooks/useHautDesBarres.ts
// Hauteur des barres collées en haut de la fenêtre : la barre d'outils (fixe) et, dans l'affichage « Résumé », la
// barre de résumé (marquée `data-barre-collante`). Un élément collant plus bas s'arrête dessous, sans être caché.

import { useEffect, useState } from "react"
import { useAffichage } from "./useAffichage"

export function useHautDesBarres(actif: boolean): number {
  const [haut, setHaut] = useState(0)
  // La barre de résumé apparaît ou disparaît avec l'affichage choisi : on la cherche de nouveau à chaque changement.
  const affichage = useAffichage()

  useEffect(() => {
    if (!actif) return
    const barres = [document.querySelector<HTMLElement>("nav[aria-label=\"Barre d'outils\"]"), document.querySelector<HTMLElement>("[data-barre-collante]")].filter(barre => barre !== null)
    const mesurer = () => setHaut(barres.reduce((total, barre) => total + barre.offsetHeight, 0))
    mesurer()
    const observateur = new ResizeObserver(mesurer)
    barres.forEach(barre => observateur.observe(barre))
    return () => observateur.disconnect()
  }, [actif, affichage])

  return haut
}
