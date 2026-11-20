// src/ui/hooks/useAvis.ts
// Ce que partagent les deux accès à la fenêtre « Donner mon avis » (barre d'outils, paramètres) : le diagnostic
// proposé avec un avis, et le réglage qui retire le bouton de la barre d'outils.

import { useMemo, type Dispatch, type SetStateAction } from "react"
import { systemeEtNavigateur, type Diagnostic } from "@/lib/retours"
import { VERSION_DE_L_APPLICATION } from "@/lib/version"
import type { Affichage, SessionState, UserPreferences } from "@/types"
import { usePlateforme } from "../plateforme"

/**
 * « Donner mon avis » dans la barre d'outils (son bouton, ou son entrée du menu « Plus d'actions » sur un téléphone) :
 * affiché d'office, retiré au choix de l'utilisateur. La fenêtre reste accessible depuis les paramètres.
 */
export interface ReglageDuBoutonDAvis {
  masque: boolean
  onMasquer: (masque: boolean) => void
}

/** Diagnostic proposé avec un avis : aucune donnée de la simulation, seulement des nombres d'années et d'acteurs. */
export function useDiagnostic(session: SessionState, affichage: Affichage): Diagnostic {
  const plateforme = usePlateforme()
  return { version: VERSION_DE_L_APPLICATION, web: plateforme.web, installee: plateforme.installee(), ...systemeEtNavigateur(navigator.userAgent), affichageEnCours: affichage, nombreDAnnees: session.annees.length, nombreDActeurs: session.entities.length }
}

/** Le réglage du bouton, tenu dans les préférences du poste (`boutonDAvisMasque`). */
export function useReglageDuBoutonDAvis(masque: UserPreferences["boutonDAvisMasque"], setPreferences: Dispatch<SetStateAction<UserPreferences>>): ReglageDuBoutonDAvis {
  return useMemo(() => ({ masque: masque === true, onMasquer: (oui: boolean) => setPreferences(prefs => ({ ...prefs, boutonDAvisMasque: oui || undefined })) }), [masque, setPreferences])
}
