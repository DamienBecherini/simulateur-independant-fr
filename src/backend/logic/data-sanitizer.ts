/**
 * @file data-sanitizer.ts
 * @description Version finale du sanitizer utilisant Zod comme source de vérité pour la structure des données,
 * et ajoutant une passe de validation sémantique pour garantir la cohérence (ex: pas de relations orphelines).
 */
import { SessionStateSchema, SaveSlotSchema } from "../../types.js"
import type { SessionState, SaveSlot, SanitizationReport } from "../../types.js"

interface SanitizationResult {
  safeState: SessionState
  report: SanitizationReport
}

/**
 * Nettoie et valide les données brutes d'une session.
 * 1. Valide la structure et applique les valeurs par défaut avec Zod.
 * 2. Valide la cohérence sémantique (ex: supprime les liens/flux orphelins).
 * @param rawData Les données brutes à nettoyer.
 * @returns Un état de session propre et un rapport des corrections.
 */
export function sanitizeStateAndFillDefaults(rawData: unknown): SanitizationResult {
  // Étape 1 : Validation de la structure et réparation avec Zod
  const parseResult = SessionStateSchema.safeParse(rawData)

  if (!parseResult.success) {
    console.error("Données de session invalides, réinitialisation à l'état par défaut. Erreurs Zod:", parseResult.error.flatten())
    // Les données sont irrécupérables, on repart d'un état neuf.
    // .parse({}) utilise tous les .default() définis dans le schéma.
    const defaultState = SessionStateSchema.parse({})
    return {
      safeState: defaultState,
      report: { entitiesRemoved: 0, relationshipsRemoved: 0, flowsRemoved: 0 } // Le rapport est vide car on n'a pas "nettoyé" mais "remplacé"
    }
  }

  // À ce stade, nous avons un état structurellement valide grâce à Zod.
  const structurallySafeState = parseResult.data

  // Étape 2 : Validation sémantique (logique métier)
  const initialEntities = structurallySafeState.entities
  const initialRelationships = structurallySafeState.relationships
  const initialFlowCount = structurallySafeState.monthlyData.reduce((acc, month) => acc + month.flows.length, 0)

  const entityIds = new Set(initialEntities.map(e => e.id))

  // 2a. Supprimer les relations orphelines
  const semanticallySafeRelationships = initialRelationships.filter(rel => entityIds.has(rel.fromId) && entityIds.has(rel.toId))

  // 2b. Supprimer les flux financiers orphelins
  const semanticallySafeMonthlyData = structurallySafeState.monthlyData.map(month => ({
    ...month,
    flows: month.flows.filter(flow => entityIds.has(flow.entityId))
  }))

  const finalFlowCount = semanticallySafeMonthlyData.reduce((acc, month) => acc + month.flows.length, 0)

  // Étape 3 : Assemblage final et rapport
  const finalSafeState: SessionState = {
    ...structurallySafeState,
    relationships: semanticallySafeRelationships,
    monthlyData: semanticallySafeMonthlyData
  }

  const report: SanitizationReport = {
    // La suppression d'entités est gérée par Zod. Ici, on se concentre sur la sémantique.
    // Un rapport plus fin nécessiterait de comparer `rawData` et `finalSafeState`.
    entitiesRemoved: 0, // Simplification : on suppose que Zod a tout réparé.
    relationshipsRemoved: initialRelationships.length - semanticallySafeRelationships.length,
    flowsRemoved: initialFlowCount - finalFlowCount
  }

  return { safeState: finalSafeState, report }
}

/**
 * Prend un tableau de slots potentiellement corrompus et retourne un tableau de slots propres.
 * @param rawSlotsData - Un tableau de données brutes.
 * @returns Un tableau de `SaveSlot` propres et garantis d'être complets.
 */
export function sanitizeSlots(rawSlotsData: unknown): SaveSlot[] {
  if (!Array.isArray(rawSlotsData)) return []

  const validatedSlots = SaveSlotSchema.array().safeParse(rawSlotsData)

  if (!validatedSlots.success) {
    console.warn("Certains slots de sauvegarde étaient corrompus et ont été ignorés.", validatedSlots.error.flatten())
    return []
  }

  // On applique en plus notre validation sémantique sur chaque slot valide
  return validatedSlots.data.map(slot => {
    const { safeState } = sanitizeStateAndFillDefaults(slot)
    return {
      ...safeState,
      id: slot.id,
      lastModified: slot.lastModified
    }
  })
}
