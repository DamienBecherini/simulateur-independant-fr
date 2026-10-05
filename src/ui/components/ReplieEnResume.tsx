// src/ui/components/ReplieEnResume.tsx

import type { ReactNode } from "react"
import { useAffichageResume } from "../hooks/useAffichage"
import { Depliable } from "./Depliable"

interface ReplieEnResumeProps {
  titre: string
  className?: string
  /** Faux : le contenu reste affiché, même dans l'affichage « Résumé ». */
  replie?: boolean
  children: ReactNode
}

/**
 * Détail replié dans l'affichage « Résumé » (section dépliable, toujours dépliée à l'impression), affiché tel quel
 * dans l'affichage classique.
 */
export function ReplieEnResume({ titre, className, replie = true, children }: ReplieEnResumeProps) {
  const resume = useAffichageResume()
  if (!resume || !replie) return <>{children}</>
  return (
    <Depliable titre={titre} className={className}>
      {children}
    </Depliable>
  )
}
