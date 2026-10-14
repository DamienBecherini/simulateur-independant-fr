// src/ui/components/GrilleDeLAnnee.tsx
// La grille mensuelle de l'année affichée, avec son sélecteur d'année : chaque modification de la grille, ajout ou
// suppression d'année remplace la session, en une étape d'annulation.

import type { Dispatch, SetStateAction } from "react"
import { ajouterAnnee, anneeAAjouter, anneesDeLaSession, donneesDeLAnnee, remplacerGrille, supprimerAnnee } from "@/backend/logic/annees"
import { PREMIERE_ANNEE_DES_REGLES } from "@/backend/logic/regles"
import { createId } from "@/lib/id"
import type { MonthlyGridData, SessionState, UserPreferences } from "@/types"
import MonthlyGrid from "./MonthlyGrid"
import { SelecteurAnnee } from "./SelecteurAnnee"

interface GrilleDeLAnneeProps {
  session: SessionState
  setSession: Dispatch<SetStateAction<SessionState>>
  annee: number
  /** Affiche une autre année (choisie, ou tout juste ajoutée). */
  onAnnee: (annee: number) => void
  /** La grille de l'année affichée. */
  monthlyData: MonthlyGridData
  preferences: UserPreferences
  flowTypeToNumberMap: Map<string, number>
  /** Une case touchée sur un écran tactile : l'aide au-dessus de la grille ne revient plus. */
  onGrilleTouchee?: () => void
}

export function GrilleDeLAnnee({ session, setSession, annee, onAnnee, monthlyData, preferences, flowTypeToNumberMap, onGrilleTouchee }: GrilleDeLAnneeProps) {
  return (
    <MonthlyGrid
      entities={session.entities}
      monthlyData={monthlyData}
      setMonthlyData={newMonthlyDataOrUpdater => {
        setSession(prev => {
          const actuelle = donneesDeLAnnee(prev, annee).monthlyData
          const grille = typeof newMonthlyDataOrUpdater === "function" ? newMonthlyDataOrUpdater(actuelle) : newMonthlyDataOrUpdater
          // Données inchangées : la session est renvoyée telle quelle, sans créer d'entrée d'historique.
          return remplacerGrille(prev, annee, grille)
        })
      }}
      preferences={preferences}
      flowTypeToNumberMap={flowTypeToNumberMap}
      onGrilleTouchee={onGrilleTouchee}
      annee={annee}
      // Une opération appliquée aussi à d'autres années remplace toutes les années d'un coup : une seule étape d'annulation.
      annees={session.annees}
      setAnnees={annees => setSession(prev => ({ ...prev, annees }))}
      selecteurAnnee={
        <SelecteurAnnee
          annees={anneesDeLaSession(session)}
          annee={annee}
          premiereAnneeConnue={PREMIERE_ANNEE_DES_REGLES}
          onChange={onAnnee}
          onAjouter={(position, copier) => {
            // La nouvelle année est affichée tout de suite ; son numéro se déduit de la session actuelle.
            onAnnee(anneeAAjouter(session, position))
            setSession(prev => ajouterAnnee(prev, position, copier, () => createId("flow")))
          }}
          onSupprimer={anneeASupprimer => setSession(prev => supprimerAnnee(prev, anneeASupprimer))}
        />
      }
    />
  )
}
