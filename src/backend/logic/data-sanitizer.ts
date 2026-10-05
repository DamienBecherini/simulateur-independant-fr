/**
 * @file data-sanitizer.ts
 * @description Nettoyage des données lues sur le disque ou importées. Zod reste la source de vérité pour la structure :
 * chaque entité, relation et flux est validé individuellement, afin qu'un élément corrompu ne fasse pas perdre le reste.
 * Une passe sémantique supprime ensuite les relations et les flux orphelins.
 * Les fichiers d'un format précédent sont d'abord convertis (voir migrations.ts).
 */
import { EntitySchema, FinancialFlowSchema, RelationshipSchema, SessionStateSchema, SaveSlotSchema } from "../../types.js"
import type { SessionState, SaveSlot, SanitizationReport } from "../../types.js"
import { nombreDeFlux, ordonnerLesAnnees } from "./annees.js"
import { migrerVersFormatActuel } from "./migrations.js"

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

/**
 * Écarte les flux invalides de la grille de chaque année, sans toucher à la forme des années :
 * une année inutilisable (numéro ou grille malformés) reste à la charge du schéma de session.
 * Une liste vide est traitée comme absente : la session reçoit l'année par défaut plutôt que d'être perdue.
 */
function keepValidFlowsOfYears(annees: unknown): FilteredItems {
  if (Array.isArray(annees) && annees.length === 0) return { kept: undefined, removed: 0 }
  if (!Array.isArray(annees)) return { kept: annees, removed: 0 }

  let removed = 0
  const kept = annees.map((annee: unknown) => {
    if (!isRecord(annee)) return annee

    const monthlyData = keepValidFlows(annee.monthlyData)
    removed += monthlyData.removed
    return { ...annee, monthlyData: monthlyData.kept }
  })

  return { kept, removed }
}

/**
 * Nettoie une session élément par élément.
 * @returns La session nettoyée et son rapport, ou `null` si la structure est irrécupérable
 * (pas un objet, aucune année, année ou grille mensuelle inutilisable, champ de premier niveau invalide).
 */
function sanitizeSession(rawInput: unknown): SanitizationResult | null {
  const migration = migrerVersFormatActuel(rawInput)
  const rawData = migration.donnees
  if (!isRecord(rawData)) {
    console.error("Données de session invalides : un objet était attendu.")
    return null
  }

  // Étape 1 : on écarte les éléments structurellement invalides, un par un
  const entities = keepValidItems(EntitySchema, rawData.entities)
  const relationships = keepValidItems(RelationshipSchema, rawData.relationships)
  const annees = keepValidFlowsOfYears(rawData.annees)

  // Étape 2 : Zod valide l'ensemble et applique les valeurs par défaut
  const parseResult = SessionStateSchema.safeParse({
    ...rawData,
    entities: entities.kept,
    relationships: relationships.kept,
    annees: annees.kept
  })

  if (!parseResult.success) {
    console.error("Données de session invalides. Erreurs Zod:", parseResult.error.flatten())
    return null
  }

  const structurallySafeState = parseResult.data

  // Étape 3 : les années dans l'ordre chronologique ; une année en double est écartée avec ses flux.
  const ordonnees = ordonnerLesAnnees(structurallySafeState.annees)

  // Étape 4 : cohérence sémantique, on supprime ce qui pointe vers une entité absente
  const entityIds = new Set(structurallySafeState.entities.map(e => e.id))

  const safeRelationships = structurallySafeState.relationships.filter(rel => entityIds.has(rel.fromId) && entityIds.has(rel.toId))
  const safeAnnees = ordonnees.annees.map(annee => ({
    ...annee,
    monthlyData: annee.monthlyData.map(month => ({ ...month, flows: month.flows.filter(flow => entityIds.has(flow.entityId)) }))
  }))

  const orphanRelationships = structurallySafeState.relationships.length - safeRelationships.length
  const orphanFlows = nombreDeFlux(ordonnees.annees) - nombreDeFlux(safeAnnees)

  return {
    safeState: { ...structurallySafeState, relationships: safeRelationships, annees: safeAnnees },
    // Chaque compteur cumule les éléments invalides et, pour les relations et les flux, les orphelins
    // (et, pour les flux, ceux des années en double).
    report: {
      entitiesRemoved: entities.removed,
      relationshipsRemoved: relationships.removed + orphanRelationships,
      flowsRemoved: annees.removed + orphanFlows + nombreDeFlux(ordonnees.ecartees),
      migrationNotes: migration.notes
    }
  }
}

/**
 * Nettoie et valide les données brutes d'une session.
 * 0. Convertit au format actuel un fichier d'un format précédent.
 * 1. Écarte individuellement les entités, relations et flux invalides.
 * 2. Valide la structure d'ensemble et applique les valeurs par défaut avec Zod.
 * 3. Trie les années et écarte celles en double.
 * 4. Supprime les relations et les flux orphelins.
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
    report: { entitiesRemoved: 0, relationshipsRemoved: 0, flowsRemoved: 0, migrationNotes: [] }
  }
}

/** Les deux champs qu'un slot ajoute à une session. */
const SlotIdentitySchema = SaveSlotSchema.pick({ id: true, lastModified: true })

/**
 * Nettoie un slot comme une session, en conservant son identifiant et sa date.
 * @returns Le slot nettoyé, ou `null` s'il est irrécupérable (identité manquante ou session inutilisable).
 */
function sanitizeSlot(rawSlot: unknown): SaveSlot | null {
  const identity = SlotIdentitySchema.safeParse(rawSlot)
  if (!identity.success) return null

  const session = sanitizeSession(rawSlot)
  if (!session) return null

  return { ...session.safeState, ...identity.data }
}

/**
 * Prend un tableau de slots potentiellement corrompus et retourne un tableau de slots propres.
 * Chaque slot est validé individuellement : un slot corrompu est écarté sans faire perdre les autres.
 * @param rawSlotsData - Un tableau de données brutes.
 * @returns Les `SaveSlot` récupérables, nettoyés et garantis d'être complets, dans leur ordre d'origine.
 */
export function sanitizeSlots(rawSlotsData: unknown): SaveSlot[] {
  if (!Array.isArray(rawSlotsData)) return []

  const safeSlots = rawSlotsData.map(sanitizeSlot).filter(slot => slot !== null)

  const ignoredCount = rawSlotsData.length - safeSlots.length
  if (ignoredCount > 0) {
    console.warn(`Slots de sauvegarde corrompus ignorés : ${ignoredCount} sur ${rawSlotsData.length}.`)
  }

  return safeSlots
}
