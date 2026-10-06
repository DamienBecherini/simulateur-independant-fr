// src/ui/hooks/useFenetreParLAdresse.ts
// Une fenêtre que l'adresse de la page ouvre (#mentions-legales, #donner-mon-avis), au chargement ou en cours de
// route, et que l'on peut aussi ouvrir par un bouton. À la fermeture, l'adresse reprend le fragment d'avant (la vue
// affichée), sans nouvelle entrée dans l'historique.

import { useEffect, useRef, useState } from "react"

/** L'état d'ouverture de la fenêtre et sa fonction de changement, comme un `useState`. */
export function useFenetreParLAdresse(adresse: string): [boolean, (ouvrir: boolean) => void] {
  const estLAdresse = (hash: string) => hash === `#${adresse}`
  const [ouverte, setOuverte] = useState(() => estLAdresse(window.location.hash))
  const fragmentPrecedent = useRef("")

  useEffect(() => {
    const cible = `#${adresse}`
    const suivre = (evenement: HashChangeEvent) => {
      const ouvrir = window.location.hash === cible
      if (ouvrir) {
        const precedent = new URL(evenement.oldURL).hash
        fragmentPrecedent.current = precedent === cible ? "" : precedent
      }
      setOuverte(ouvrir)
    }
    window.addEventListener("hashchange", suivre)
    return () => window.removeEventListener("hashchange", suivre)
  }, [adresse])

  const changerOuverture = (ouvrir: boolean) => {
    setOuverte(ouvrir)
    if (ouvrir || !estLAdresse(window.location.hash)) return
    const { pathname, search } = window.location
    window.history.replaceState(window.history.state, "", `${pathname}${search}${fragmentPrecedent.current}`)
  }

  return [ouverte, changerOuverture]
}
