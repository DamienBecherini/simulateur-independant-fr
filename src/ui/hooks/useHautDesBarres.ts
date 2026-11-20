// src/ui/hooks/useHautDesBarres.ts
// Hauteur des barres collées en haut de la fenêtre : la barre d'outils (fixe) et, dans l'affichage « Résumé », la
// barre de résumé, par sa partie peinte (`data-barre-visible` : réduite, elle garde sa hauteur pleine dans le flux,
// transparente dessous). Un élément collant plus bas s'arrête dessous, sans être caché.

import { useEffect, useState } from "react"
import { useAffichage } from "./useAffichage"

const barresPresentes = () => [document.querySelector<HTMLElement>("nav[aria-label=\"Barre d'outils\"]"), document.querySelector<HTMLElement>("[data-barre-visible]")].filter(barre => barre !== null)

export function useHautDesBarres(actif: boolean): number {
  const [haut, setHaut] = useState(0)
  // La barre de résumé apparaît ou disparaît avec l'affichage choisi : on la cherche de nouveau à chaque changement.
  const affichage = useAffichage()

  useEffect(() => {
    if (!actif) return
    let suivies: HTMLElement[] = []
    const mesurer = () => {
      const barres = barresPresentes()
      // La barre de résumé attend les résultats de la simulation : apparue après la première mesure, elle est suivie à son tour.
      for (const barre of barres) if (!suivies.includes(barre)) observateur.observe(barre)
      suivies = barres
      setHaut(barres.reduce((total, barre) => total + barre.offsetHeight, 0))
    }
    const observateur = new ResizeObserver(mesurer)
    mesurer()
    // La page change de hauteur quand une barre y apparaît ou en disparaît : les barres sont alors cherchées de nouveau.
    observateur.observe(document.body)
    return () => observateur.disconnect()
  }, [actif, affichage])

  return haut
}
