// src/ui/hooks/useEncartDesQuestions.ts
// L'encart « Que voulez-vous savoir ? » dans l'application : quand il s'affiche, ce que fait « Partir de zéro », et sa
// fermeture, retenue dans les préférences.

import { useMemo, useState, type Dispatch, type SetStateAction } from "react"
import { ANCRES } from "@/lib/ancres"
import { avecLesQuestions } from "@/lib/questions-de-depart"
import type { SessionState, UserPreferences } from "@/types"
import { montrerOuRetrouverLeDepart } from "../depart"
import { usePlateforme } from "../plateforme"
import type { Vues } from "./useVues"

interface EncartDesQuestionsDeLApplication {
  session: SessionState
  sessionChargee: boolean
  preferences: UserPreferences
  setPreferences: Dispatch<SetStateAction<UserPreferences>>
  /** Remplace la simulation par une simulation vierge, annulable. */
  reinitialiser: () => void
  /** Les vues de la page ; `null` hors de l'affichage « Trois vues ». */
  vues: Vues | null
}

export function useEncartDesQuestions({ session, sessionChargee, preferences, setPreferences, reinitialiser, vues }: EncartDesQuestionsDeLApplication) {
  // Sur une simulation vide ou sur l'exemple ; comparer l'exemple coûte une sérialisation de la session, faite à chaque
  // modification seulement.
  const { estLaSessionDExemple } = usePlateforme()
  const fermees = preferences.questionsFermees
  const proposees = useMemo(() => avecLesQuestions(session, fermees, sessionChargee, estLaSessionDExemple), [session, fermees, sessionChargee, estLaSessionDExemple])
  // « Partir de zéro » efface le bloc jusqu'au prochain lancement, sans le retenir comme la fermeture : l'utilisateur a
  // choisi, le bloc ne ferait que repousser la saisie.
  const [masquees, setMasquees] = useState(false)
  const affiche = proposees && !masquees
  return {
    affiche,
    // « Partir de zéro » : une simulation vierge (annulable), et la saisie affichée, dans sa vue s'il y en a ; le bloc
    // de la page s'efface, et la barre d'outils montre où le retrouver.
    partirDeZero: () => {
      if (session.entities.length > 0) reinitialiser()
      vues?.choisir("situation", true)
      if (affiche) {
        setMasquees(true)
        montrerOuRetrouverLeDepart()
      }
    },
    // L'encart fermé ne revient plus ; le focus passe au contenu, qui le suivait.
    fermer: () => {
      setPreferences(prefs => ({ ...prefs, questionsFermees: true }))
      document.getElementById(ANCRES.contenu)?.focus({ preventScroll: true })
    }
  }
}
