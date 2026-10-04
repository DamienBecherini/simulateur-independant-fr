// src/lib/business-logic.ts

import type { SessionState, FinancialFlow, Relationship } from "@/types"

/**
 * Ce dictionnaire définit les dépendances entre les types de flux et les types de relations.
 * La clé est le type de flux, la valeur est un tableau des types de relations qui le justifient.
 */
const FLOW_RELATIONSHIP_DEPENDENCIES: Partial<Record<FinancialFlow["type"], Relationship["type"][]>> = {
  director_remuneration: ["Président", "Gérant"],
  dividends_payment: ["Associé"]
  // On pourrait ajouter d'autres règles ici à l'avenir
}

/**
 * Analyse l'état d'une session et supprime les flux financiers qui sont devenus invalides
 * suite à un changement dans les relations entre entités.
 *
 * @param sessionState L'état actuel de la session (entités, relations, données mensuelles).
 * @returns Le `monthlyData` nettoyé de tous les flux orphelins logiques.
 */
export function sanitizeFlowsAfterRelationshipChange(sessionState: SessionState): SessionState["monthlyData"] {
  const { relationships, monthlyData } = sessionState

  // On parcourt chaque mois et on filtre ses flux
  const sanitizedMonthlyData = monthlyData.map(month => {
    const sanitizedFlows = month.flows.filter(flow => {
      const requiredRelations = FLOW_RELATIONSHIP_DEPENDENCIES[flow.type]

      // Si ce type de flux n'a aucune dépendance, on le garde toujours.
      if (!requiredRelations) {
        return true
      }

      // Pour les flux qui ont une dépendance, il faut trouver QUI reçoit l'argent.
      // Dans notre modèle, la rémunération ou les dividendes sont des flux sortants de l'entreprise.
      // Il faut donc trouver la personne liée à cette entreprise.
      const companyId = flow.entityId

      // On cherche une relation qui part de l'entreprise et qui a un des types requis.
      const fulfillingRelationship = relationships.find(rel => (rel.fromId === companyId || rel.toId === companyId) && requiredRelations.includes(rel.type))

      // Si on trouve au moins une relation qui justifie ce flux, on le garde.
      return !!fulfillingRelationship
    })

    return { ...month, flows: sanitizedFlows }
  })

  return sanitizedMonthlyData
}
