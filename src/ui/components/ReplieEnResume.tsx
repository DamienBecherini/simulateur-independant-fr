// src/ui/components/ReplieEnResume.tsx

import type { ReactNode } from "react"
import { useAffichageResume } from "../hooks/useAffichage"
import { Depliable } from "./Depliable"

interface ReplieEnResumeProps {
  titre: string
  /** Identifiant stable de la section repliée, pour retenir son état (voir Depliable). */
  id?: string
  className?: string
  /** Classes du contenu une fois déplié (affichage « Résumé » seulement : sans lui, le contenu est rendu tel quel). */
  classNameContenu?: string
  /** Faux : le contenu reste affiché, même dans l'affichage « Résumé ». */
  replie?: boolean
  children: ReactNode
}

/**
 * Détail replié dans l'affichage « Résumé » (section dépliable, toujours dépliée à l'impression), affiché tel quel
 * dans l'affichage classique.
 */
export function ReplieEnResume({ titre, id, className, classNameContenu, replie = true, children }: ReplieEnResumeProps) {
  const resume = useAffichageResume()
  if (!resume || !replie) return <>{children}</>
  return (
    <Depliable titre={titre} id={id} className={className}>
      {classNameContenu ? <div className={classNameContenu}>{children}</div> : children}
    </Depliable>
  )
}
