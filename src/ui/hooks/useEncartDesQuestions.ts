// src/ui/hooks/useEncartDesQuestions.ts
// L'encart « Que voulez-vous savoir ? » dans l'application : quand il s'affiche, ce que fait « Partir de zéro », et sa
// fermeture, retenue dans les préférences.

import { useMemo, type Dispatch, type SetStateAction } from "react"
import { ANCRES } from "@/lib/ancres"
import { avecLesQuestions } from "@/lib/questions-de-depart"
import type { SessionState, UserPreferences } from "@/types"
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
  const affiche = useMemo(() => avecLesQuestions(session, fermees, sessionChargee, estLaSessionDExemple), [session, fermees, sessionChargee, estLaSessionDExemple])
  return {
    affiche,
    // « Partir de zéro » : une simulation vierge (annulable), et la saisie affichée, dans sa vue s'il y en a.
    partirDeZero: () => {
      if (session.entities.length > 0) reinitialiser()
      vues?.choisir("situation", true)
    },
    // L'encart fermé ne revient plus ; le focus passe au contenu, qui le suivait.
    fermer: () => {
      setPreferences(prefs => ({ ...prefs, questionsFermees: true }))
      document.getElementById(ANCRES.contenu)?.focus({ preventScroll: true })
    }
  }
}
