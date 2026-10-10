// src/ui/hooks/useRaccourcisDAnnulation.ts
// Branche Ctrl+Z / Ctrl+Y (Cmd sur Mac) sur l'historique de la simulation, partout dans la page sauf dans un champ où
// l'on écrit : là, le navigateur annule la frappe du champ (voir src/lib/raccourcis-clavier.ts).

import { useEffect } from "react"
import { actionDuRaccourci, estUnMac, saisieDeTexte } from "@/lib/raccourcis-clavier"

interface Historique {
  annuler: () => void
  retablir: () => void
  peutAnnuler: boolean
  peutRetablir: boolean
}

export function useRaccourcisDAnnulation({ annuler, retablir, peutAnnuler, peutRetablir }: Historique) {
  useEffect(() => {
    const mac = estUnMac(navigator.userAgent)
    const surTouche = (event: KeyboardEvent) => {
      const action = actionDuRaccourci(event, mac)
      if (action === null || saisieDeTexte(event.target as HTMLElement | null)) return
      // Le raccourci est pris même quand il n'y a rien à annuler : le navigateur n'a rien à en faire hors d'un champ.
      event.preventDefault()
      if (action === "annuler" && peutAnnuler) annuler()
      if (action === "retablir" && peutRetablir) retablir()
    }
    window.addEventListener("keydown", surTouche)
    return () => window.removeEventListener("keydown", surTouche)
  }, [annuler, retablir, peutAnnuler, peutRetablir])
}
