/**
 * @file data-sanitizer.ts
 * @description Version finale du sanitizer utilisant Zod comme source de vérité pour la structure des données,
 * et ajoutant une passe de validation sémantique pour garantir la cohérence (ex: pas de relations orphelines).
 */
import { SessionStateSchema, SaveSlotSchema } from "@/types.js"
import type { SessionState, SaveSlot, SanitizationReport, Entity } from "@/types.js"
// NOUVEAU: Import des listes de flux par défaut
import { defaultPersonFlows, defaultCompanyFlows, defaultMicroFlows } from "@/lib/entity-factory.js"

interface SanitizationResult {
  safeState: SessionState
  report: SanitizationReport
}

/**
 * Nettoie et valide les données brutes d'une session.
 * 1. Valide la structure et applique les valeurs par défaut avec Zod.
 * 2. Valide la cohérence sémantique (ex: supprime les liens/flux orphelins).
 * 3. Assure la rétrocompatibilité en peuplant les champs manquants (ex: enabledFlowTypes).
 */
export function sanitizeStateAndFillDefaults(rawData: unknown): SanitizationResult {
  // Étape 1 : Validation de la structure et réparation avec Zod
  const parseResult = SessionStateSchema.safeParse(rawData)

  if (!parseResult.success) {
    console.error("Données de session invalides, réinitialisation à l'état par défaut. Erreurs Zod:", parseResult.error.flatten())
    const defaultState = SessionStateSchema.parse({})
    return {
      safeState: defaultState,
      report: { entitiesRemoved: 0, relationshipsRemoved: 0, flowsRemoved: 0 }
    }
  }

  const structurallySafeState = parseResult.data
  const initialRelationships = structurallySafeState.relationships
  const initialFlowCount = structurallySafeState.monthlyData.reduce((acc, month) => acc + month.flows.length, 0)

  // Étape 2 : Validation sémantique et migration de données (rétrocompatibilité)
  const semanticallySafeEntities = structurallySafeState.entities.map(entity => {
    // CORRECTION DE RÉTROCOMPATIBILITÉ: Si `enabledFlowTypes` est vide ou n'existe pas, on le peuple.
    if (!entity.enabledFlowTypes || entity.enabledFlowTypes.length === 0) {
      switch (entity.type) {
        case "person":
          entity.enabledFlowTypes = [...defaultPersonFlows]
          break
        case "company":
          entity.enabledFlowTypes = [...defaultCompanyFlows]
          break
        case "micro-entreprise":
          entity.enabledFlowTypes = [...defaultMicroFlows]
          break
      }
    }
    return entity
  })

  const entityIds = new Set(semanticallySafeEntities.map(e => e.id))
  const semanticallySafeRelationships = initialRelationships.filter(rel => entityIds.has(rel.fromId) && entityIds.has(rel.toId))
  const semanticallySafeMonthlyData = structurallySafeState.monthlyData.map(month => ({
    ...month,
    flows: month.flows.filter(flow => entityIds.has(flow.entityId))
  }))
  const finalFlowCount = semanticallySafeMonthlyData.reduce((acc, month) => acc + month.flows.length, 0)

  // Étape 3 : Assemblage final et rapport
  const finalSafeState: SessionState = {
    ...structurallySafeState,
    entities: semanticallySafeEntities, // On utilise les entités migrées
    relationships: semanticallySafeRelationships,
    monthlyData: semanticallySafeMonthlyData
  }

  const report: SanitizationReport = {
    entitiesRemoved: 0,
    relationshipsRemoved: initialRelationships.length - semanticallySafeRelationships.length,
    flowsRemoved: initialFlowCount - finalFlowCount
  }

  return { safeState: finalSafeState, report }
}

export function sanitizeSlots(rawSlotsData: unknown): SaveSlot[] {
  if (!Array.isArray(rawSlotsData)) return []

  const validatedSlots = SaveSlotSchema.array().safeParse(rawSlotsData)

  if (!validatedSlots.success) {
    console.warn("Certains slots de sauvegarde étaient corrompus et ont été ignorés.", validatedSlots.error.flatten())
    return []
  }

  return validatedSlots.data.map(slot => {
    const { safeState } = sanitizeStateAndFillDefaults(slot)
    return {
      ...safeState,
      id: slot.id,
      lastModified: slot.lastModified
    }
  })
}
