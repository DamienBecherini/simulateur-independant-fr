// src/ui/testing/comparateur.tsx
// Le comparateur tel que l'application le monte : ses réglages rejoignent la session, qu'il relit au rendu suivant.

import { useState } from "react"
import type { Comparateur, SessionState } from "@/types"
import { ComparatorPanel } from "@/ui/components/ComparatorPanel"

interface ComparateurDeTestProps {
  session: SessionState
  annee: number
  /** Appelée avec les réglages du comparateur à chaque modification, pour les vérifier. */
  onComparateur?: (comparateur: Comparateur) => void
}

/** Le comparateur, avec les réglages qu'il enregistre gardés à côté de la session reçue. */
export function ComparateurDeTest({ session, annee, onComparateur }: ComparateurDeTestProps) {
  const [comparateur, setComparateur] = useState<Comparateur | undefined>(session.comparateur)
  return (
    <ComparatorPanel
      session={comparateur ? { ...session, comparateur } : session}
      annee={annee}
      onComparateurChange={modifier =>
        setComparateur(actuel => {
          const nouveau = modifier(actuel)
          onComparateur?.(nouveau)
          return nouveau
        })
      }
    />
  )
}
