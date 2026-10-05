// src/ui/hooks/useActionsSurLesActeurs.ts
// Modifications des acteurs et de leurs relations, depuis la liste des acteurs : chacune est une seule étape
// d'historique.

import { toast } from "sonner"
import { sanitizeFlowsAfterRelationshipChange } from "@/lib/business-logic"
import { nombreDeFlux, transformerLesGrilles } from "@/backend/logic/annees"
import type { Entity, Relationship, SessionState } from "@/types"

export function useActionsSurLesActeurs(session: SessionState, setSession: (session: SessionState) => void) {
  const { entities, relationships } = session

  /**
   * Applique une modification des entités ou des relations en une seule étape d'historique.
   * Quand les relations changent, les flux qui n'ont plus de bénéficiaire (rémunération sans dirigeant,
   * dividendes sans associé) sont retirés de toutes les années, et l'utilisateur en est averti.
   */
  const applyChange = (changes: Partial<Pick<SessionState, "entities" | "relationships" | "annees">>) => {
    const next = { ...session, ...changes }
    const nettoyee = changes.relationships ? transformerLesGrilles(next, monthlyData => sanitizeFlowsAfterRelationshipChange({ relationships: next.relationships, monthlyData })) : next
    const removedFlows = nombreDeFlux(next.annees) - nombreDeFlux(nettoyee.annees)
    if (removedFlows > 0) {
      toast.info(`${removedFlows} flux ${removedFlows > 1 ? "supprimés" : "supprimé"} : ${removedFlows > 1 ? "ils n'avaient" : "il n'avait"} plus de bénéficiaire. Ctrl+Z pour annuler.`)
    }
    setSession(nettoyee)
  }

  return {
    applyChange,
    addEntity: (entity: Entity) => applyChange({ entities: [...entities, entity] }),
    deleteEntity: (idToDelete: string) =>
      applyChange({
        entities: entities.filter(e => e.id !== idToDelete),
        relationships: relationships.filter(rel => rel.fromId !== idToDelete && rel.toId !== idToDelete),
        // Ses flux disparaissent de toutes les années.
        annees: transformerLesGrilles(session, grille => grille.map(month => ({ ...month, flows: month.flows.filter(flow => flow.entityId !== idToDelete) }))).annees
      }),
    updateEntity: (updatedEntity: Entity) => applyChange({ entities: entities.map(entity => (entity.id === updatedEntity.id ? updatedEntity : entity)) }),
    toggleLock: (idToToggle: string) => applyChange({ entities: entities.map(entity => (entity.id === idToToggle ? { ...entity, locked: !entity.locked } : entity)) }),
    addRelationship: (relationship: Relationship) => applyChange({ relationships: [...relationships, relationship] }),
    deleteRelationship: (relationshipId: string) => applyChange({ relationships: relationships.filter(rel => rel.id !== relationshipId) })
  }
}
