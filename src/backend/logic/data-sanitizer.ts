/**
 * @file data-sanitizer.ts
 * @description Nettoyage des données lues sur le disque ou importées. Zod reste la source de vérité pour la structure :
 * chaque entité, relation et flux est validé individuellement, afin qu'un élément corrompu ne fasse pas perdre le reste.
 * Une passe sémantique supprime ensuite les relations et les flux orphelins.
 */
import { EntitySchema, FinancialFlowSchema, RelationshipSchema, SessionStateSchema, SaveSlotSchema } from "../../types.js"
import type { SessionState, SaveSlot, SanitizationReport } from "../../types.js"

interface SanitizationResult {
  safeState: SessionState
  report: SanitizationReport
}

interface FilteredItems {
  /** Les données d'origine, privées de leurs éléments invalides. */
  kept: unknown
  removed: number
}

/** Le strict nécessaire pour tester un élément : tous les schémas Zod l'exposent. */
interface ItemSchema {
  safeParse(data: unknown): { success: boolean }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * Écarte d'une liste les éléments que le schéma refuse.
 * Une valeur qui n'est pas un tableau est rendue telle quelle : le schéma de session tranchera (valeur par défaut ou rejet).
 */
function keepValidItems(schema: ItemSchema, items: unknown): FilteredItems {
  if (!Array.isArray(items)) return { kept: items, removed: 0 }

  const kept = items.filter(item => schema.safeParse(item).success)
  return { kept, removed: items.length - kept.length }
}

/**
 * Écarte les flux invalides de chaque mois, sans toucher à la forme de la grille :
 * une grille inutilisable (mois manquant ou malformé) reste à la charge du schéma de session.
 */
function keepValidFlows(monthlyData: unknown): FilteredItems {
  if (!Array.isArray(monthlyData)) return { kept: monthlyData, removed: 0 }

  let removed = 0
  const kept = monthlyData.map((month: unknown) => {
    if (!isRecord(month)) return month

    const flows = keepValidItems(FinancialFlowSchema, month.flows)
    removed += flows.removed
    return { ...month, flows: flows.kept }
  })

  return { kept, removed }
}

function countFlows(monthlyData: SessionState["monthlyData"]): number {
  return monthlyData.reduce((total, month) => total + month.flows.length, 0)
}

/**
 * Nettoie une session élément par élément.
 * @returns La session nettoyée et son rapport, ou `null` si la structure est irrécupérable
 * (pas un objet, grille mensuelle inutilisable, champ de premier niveau invalide).
 */
function sanitizeSession(rawData: unknown): SanitizationResult | null {
  if (!isRecord(rawData)) {
    console.error("Données de session invalides : un objet était attendu.")
    return null
  }

  // Étape 1 : on écarte les éléments structurellement invalides, un par un
  const entities = keepValidItems(EntitySchema, rawData.entities)
  const relationships = keepValidItems(RelationshipSchema, rawData.relationships)
  const monthlyData = keepValidFlows(rawData.monthlyData)

  // Étape 2 : Zod valide l'ensemble et applique les valeurs par défaut
  const parseResult = SessionStateSchema.safeParse({
    ...rawData,
    entities: entities.kept,
    relationships: relationships.kept,
    monthlyData: monthlyData.kept
  })

  if (!parseResult.success) {
    console.error("Données de session invalides. Erreurs Zod:", parseResult.error.flatten())
    return null
  }

  const structurallySafeState = parseResult.data

  // Étape 3 : cohérence sémantique, on supprime ce qui pointe vers une entité absente
  const entityIds = new Set(structurallySafeState.entities.map(e => e.id))

  const safeRelationships = structurallySafeState.relationships.filter(rel => entityIds.has(rel.fromId) && entityIds.has(rel.toId))
  const safeMonthlyData = structurallySafeState.monthlyData.map(month => ({
    ...month,
    flows: month.flows.filter(flow => entityIds.has(flow.entityId))
  }))

  const orphanRelationships = structurallySafeState.relationships.length - safeRelationships.length
  const orphanFlows = countFlows(structurallySafeState.monthlyData) - countFlows(safeMonthlyData)

  return {
    safeState: { ...structurallySafeState, relationships: safeRelationships, monthlyData: safeMonthlyData },
    // Chaque compteur cumule les éléments invalides et, pour les relations et les flux, les orphelins.
    report: {
      entitiesRemoved: entities.removed,
      relationshipsRemoved: relationships.removed + orphanRelationships,
      flowsRemoved: monthlyData.removed + orphanFlows
    }
  }
}

/**
 * Nettoie et valide les données brutes d'une session.
 * 1. Écarte individuellement les entités, relations et flux invalides.
 * 2. Valide la structure d'ensemble et applique les valeurs par défaut avec Zod.
 * 3. Supprime les relations et les flux orphelins.
 * @param rawData Les données brutes à nettoyer.
 * @returns Un état de session propre et un rapport des corrections. Si la structure est irrécupérable,
 * la session par défaut est renvoyée avec un rapport vide : rien n'a été nettoyé, tout a été remplacé.
 */
export function sanitizeStateAndFillDefaults(rawData: unknown): SanitizationResult {
  const result = sanitizeSession(rawData)
  if (result) return result

  return {
    // .parse({}) utilise tous les .default() définis dans le schéma.
    safeState: SessionStateSchema.parse({}),
    report: { entitiesRemoved: 0, relationshipsRemoved: 0, flowsRemoved: 0 }
  }
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
