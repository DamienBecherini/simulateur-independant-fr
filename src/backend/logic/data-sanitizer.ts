/**
 * @file data-sanitizer.ts
 * @description Nettoyage des données lues sur le disque ou importées. Zod reste la source de vérité pour la structure :
 * chaque entité, relation et flux est validé individuellement, afin qu'un élément corrompu ne fasse pas perdre le reste.
 * Une passe sémantique supprime ensuite les relations et les flux orphelins.
 * Les fichiers d'un format précédent sont d'abord convertis (voir migrations.ts).
 */
import { EntitySchema, FinancialFlowSchema, RelationshipSchema, SessionStateSchema, SaveSlotSchema } from "../../types.js"
import type { SessionState, SaveSlot, SanitizationReport } from "../../types.js"
import { erreurDesAnnees, nombreDeFlux, ordonnerLesAnnees } from "./annees.js"
import { estObjet } from "./donnees-brutes.js"
import { migrerVersFormatActuel } from "./migrations.js"
import { nettoyerComparateurBrut, sansReglagesOrphelins } from "./nettoyage-comparateur.js"
import { professionsConnues } from "./professions.js"

interface SanitizationResult {
  safeState: SessionState
  report: SanitizationReport
}

/** Une session lisible mais refusée, et pourquoi : ses années sont trop nombreuses ou ne se suivent pas. */
interface SessionRefusee {
  refus: string
}

/**
 * Fichier refusé à cause de ses années (plus de `NOMBRE_MAX_ANNEES`, ou un trou entre deux années) : rien n'y est
 * corrompu, mais le corriger à la place de l'utilisateur ferait perdre ou inventer des années. Le message, en
 * français, dit ce qui ne va pas et se montre tel quel.
 */
export class AnneesRefuseesError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AnneesRefuseesError"
  }
}

/**
 * Session refusée en bloc : ce n'est pas un objet, ou un champ de premier niveau (nom, liste des années, grille d'un
 * mois…) est inutilisable, si bien qu'il n'y a rien à garder élément par élément. À la lecture du fichier de la
 * session, c'est un fichier illisible : il est mis de côté et l'utilisateur est prévenu (voir l'ADR 005).
 */
export class SessionIrrecuperableError extends Error {
  constructor() {
    super("La session n'a pas la forme d'une session du simulateur : aucune de ses données n'a pu être reprise.")
    this.name = "SessionIrrecuperableError"
  }
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
    if (!estObjet(month)) return month

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
    if (!estObjet(annee)) return annee

    const monthlyData = keepValidFlows(annee.monthlyData)
    removed += monthlyData.removed
    return { ...annee, monthlyData: monthlyData.kept }
  })

  return { kept, removed }
}

/**
 * Écarte des activités brutes une profession inconnue des règles (fichier abîmé, profession retirée) : l'activité
 * redevient non réglementée, sans être perdue (voir l'ADR 015). Une profession qui n'est pas un texte est laissée au
 * schéma, qui l'écarte seule.
 */
function sansProfessionsInconnues(entities: unknown): FilteredItems {
  if (!Array.isArray(entities)) return { kept: entities, removed: 0 }
  const connues = professionsConnues()
  let removed = 0
  const kept = entities.map((entity: unknown) => {
    if (!estObjet(entity) || typeof entity.profession !== "string" || connues.has(entity.profession)) return entity
    removed++
    return Object.fromEntries(Object.entries(entity).filter(([cle]) => cle !== "profession"))
  })
  return { kept, removed }
}

/**
 * Nettoie une session élément par élément.
 * @returns La session nettoyée et son rapport ; le motif du refus si ses années sont trop nombreuses ou ne se suivent
 * pas ; ou `null` si la structure est irrécupérable (pas un objet, aucune année, année ou grille mensuelle
 * inutilisable, champ de premier niveau invalide).
 */
function sanitizeSession(rawInput: unknown): SanitizationResult | SessionRefusee | null {
  const migration = migrerVersFormatActuel(rawInput)
  const rawData = migration.donnees
  if (!estObjet(rawData)) {
    console.error("Données de session invalides : un objet était attendu.")
    return null
  }

  // Étape 1 : on écarte les éléments structurellement invalides, un par un
  const professions = sansProfessionsInconnues(rawData.entities)
  const entities = keepValidItems(EntitySchema, professions.kept)
  const relationships = keepValidItems(RelationshipSchema, rawData.relationships)
  const annees = keepValidFlowsOfYears(rawData.annees)
  const comparateur = nettoyerComparateurBrut(rawData.comparateur)

  // Étape 2 : Zod valide l'ensemble et applique les valeurs par défaut
  const parseResult = SessionStateSchema.safeParse({
    ...rawData,
    entities: entities.kept,
    relationships: relationships.kept,
    annees: annees.kept,
    comparateur: comparateur.kept
  })

  if (!parseResult.success) {
    console.error("Données de session invalides. Erreurs Zod:", parseResult.error.flatten())
    return null
  }

  const structurallySafeState = parseResult.data

  // Étape 3 : les années dans l'ordre chronologique ; une année en double est écartée avec ses flux.
  const ordonnees = ordonnerLesAnnees(structurallySafeState.annees)
  // Plus de NOMBRE_MAX_ANNEES années, ou un trou entre deux années : le fichier est refusé plutôt que deviné.
  const refus = erreurDesAnnees(ordonnees.annees.map(a => a.annee))
  if (refus !== null) return { refus }

  // Étape 4 : cohérence sémantique, on supprime ce qui pointe vers une entité absente
  const entityIds = new Set(structurallySafeState.entities.map(e => e.id))

  const safeRelationships = structurallySafeState.relationships.filter(rel => entityIds.has(rel.fromId) && entityIds.has(rel.toId))
  const safeAnnees = ordonnees.annees.map(annee => ({
    ...annee,
    monthlyData: annee.monthlyData.map(month => ({ ...month, flows: month.flows.filter(flow => entityIds.has(flow.entityId)) }))
  }))

  // Les réglages du comparateur d'une activité ou d'une année absentes sont retirés sans être signalés (voir l'ADR 009).
  const safeComparateur = sansReglagesOrphelins(structurallySafeState.comparateur, structurallySafeState.entities, safeAnnees.map(a => a.annee))
  const safeState: SessionState = { ...structurallySafeState, relationships: safeRelationships, annees: safeAnnees }
  if (safeComparateur) safeState.comparateur = safeComparateur
  else delete safeState.comparateur

  const orphanRelationships = structurallySafeState.relationships.length - safeRelationships.length
  const orphanFlows = nombreDeFlux(ordonnees.annees) - nombreDeFlux(safeAnnees)

  return {
    safeState,
    // Chaque compteur cumule les éléments invalides et, pour les relations et les flux, les orphelins
    // (et, pour les flux, ceux des années en double).
    report: {
      entitiesRemoved: entities.removed,
      relationshipsRemoved: relationships.removed + orphanRelationships,
      flowsRemoved: annees.removed + orphanFlows + nombreDeFlux(ordonnees.ecartees),
      reglagesRemoved: comparateur.removed,
      professionsRemoved: professions.removed,
      // Une année en double est signalée même vide : l'utilisateur doit savoir qu'une partie du fichier est ignorée.
      anneesEcartees: [...new Set(ordonnees.ecartees.map(a => a.annee))].sort((a, b) => a - b),
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
 * 4. Refuse une session de plus de `NOMBRE_MAX_ANNEES` années, ou dont les années ne se suivent pas.
 * 5. Supprime les relations et les flux orphelins.
 * @param rawData Les données brutes à nettoyer.
 * @returns Un état de session propre et un rapport des corrections.
 * @throws {SessionIrrecuperableError} Si la structure est irrécupérable : rien ne peut en être gardé.
 * @throws {AnneesRefuseesError} Si les années sont trop nombreuses ou ne se suivent pas.
 */
export function nettoyerLaSession(rawData: unknown): SanitizationResult {
  const result = sanitizeSession(rawData)
  if (result === null) throw new SessionIrrecuperableError()
  if ("refus" in result) throw new AnneesRefuseesError(result.refus)
  return result
}

/**
 * Comme `nettoyerLaSession`, mais une structure irrécupérable donne la session par défaut avec un rapport vide : rien
 * n'a été nettoyé, tout a été remplacé. Réservé aux données qui ne viennent pas d'un fichier de l'utilisateur, ou dont
 * l'appelant n'a rien à garder ; la lecture du fichier de la session utilise `nettoyerLaSession`, pour le mettre de côté.
 * @throws {AnneesRefuseesError} Si les années sont trop nombreuses ou ne se suivent pas.
 */
export function sanitizeStateAndFillDefaults(rawData: unknown): SanitizationResult {
  try {
    return nettoyerLaSession(rawData)
  } catch (error) {
    if (!(error instanceof SessionIrrecuperableError)) throw error
    return {
      // .parse({}) utilise tous les .default() définis dans le schéma.
      safeState: SessionStateSchema.parse({}),
      report: { entitiesRemoved: 0, relationshipsRemoved: 0, flowsRemoved: 0, reglagesRemoved: 0, professionsRemoved: 0, anneesEcartees: [], migrationNotes: [] }
    }
  }
}

/** Vrai si le nettoyage a corrigé, écarté ou converti quelque chose : l'utilisateur doit en être informé. */
export function rapportAvecCorrections(report: SanitizationReport): boolean {
  return report.entitiesRemoved > 0 || report.relationshipsRemoved > 0 || report.flowsRemoved > 0 || report.reglagesRemoved > 0 || report.professionsRemoved > 0 || report.anneesEcartees.length > 0 || report.migrationNotes.length > 0
}

/** « Année en double écartée : 2024 », « Années en double écartées : 2024, 2025 ». */
export function texteAnneesEcartees(annees: number[]): string {
  return annees.length > 1 ? `Années en double écartées : ${annees.join(", ")}` : `Année en double écartée : ${annees.join("")}`
}

/** « Profession inconnue écartée… » : le message du rapport quand le nettoyage a retiré des professions. */
export function texteProfessionsEcartees(nombre: number): string {
  if (nombre === 1) return "Profession inconnue écartée : l'activité est calculée comme une profession libérale non réglementée. Choisissez à nouveau sa profession dans sa fiche."
  return `Professions inconnues écartées : ${nombre} activités sont calculées comme des professions libérales non réglementées. Choisissez à nouveau leur profession dans leur fiche.`
}

/** Les deux champs qu'un slot ajoute à une session. */
const SlotIdentitySchema = SaveSlotSchema.pick({ id: true, lastModified: true })

/** Une sauvegarde lisible mais refusée à cause de ses années : son nom, pour la désigner, et le motif. */
export interface SauvegardeRefusee {
  nom: string
  raison: string
}

/** Les sauvegardes retenues, nettoyées, et celles refusées à cause de leurs années. */
export interface SlotsNettoyes {
  slots: SaveSlot[]
  refusees: SauvegardeRefusee[]
}

/** Le nom d'une sauvegarde brute, pour la désigner dans un message. */
function nomDuSlot(rawSlot: unknown): string {
  return estObjet(rawSlot) && typeof rawSlot.name === "string" && rawSlot.name !== "" ? rawSlot.name : "Sans nom"
}

/**
 * Nettoie un slot comme une session, en conservant son identifiant et sa date.
 * @returns Le slot nettoyé ; le motif du refus si ses années sont trop nombreuses ou ne se suivent pas ;
 * ou `null` s'il est irrécupérable (identité manquante ou session inutilisable).
 */
function sanitizeSlot(rawSlot: unknown): SaveSlot | SauvegardeRefusee | null {
  const identity = SlotIdentitySchema.safeParse(rawSlot)
  if (!identity.success) return null

  const session = sanitizeSession(rawSlot)
  if (!session) return null
  if ("refus" in session) return { nom: nomDuSlot(rawSlot), raison: session.refus }

  return { ...session.safeState, ...identity.data }
}

/**
 * Comme `sanitizeSlots`, en rendant aussi les sauvegardes refusées à cause de leurs années, pour les signaler.
 * @param rawSlotsData - Un tableau de données brutes.
 */
export function nettoyerLesSlots(rawSlotsData: unknown): SlotsNettoyes {
  if (!Array.isArray(rawSlotsData)) return { slots: [], refusees: [] }

  const resultats = rawSlotsData.map(sanitizeSlot)
  const slots = resultats.filter((r): r is SaveSlot => r !== null && !("raison" in r))
  const refusees = resultats.filter((r): r is SauvegardeRefusee => r !== null && "raison" in r)

  const ignoredCount = rawSlotsData.length - slots.length
  if (ignoredCount > 0) {
    console.warn(`Slots de sauvegarde corrompus ou refusés ignorés : ${ignoredCount} sur ${rawSlotsData.length}.`)
  }

  return { slots, refusees }
}

/**
 * Prend un tableau de slots potentiellement corrompus et retourne un tableau de slots propres.
 * Chaque slot est validé individuellement : un slot corrompu, ou refusé à cause de ses années, est écarté sans
 * faire perdre les autres.
 * @param rawSlotsData - Un tableau de données brutes.
 * @returns Les `SaveSlot` récupérables, nettoyés et garantis d'être complets, dans leur ordre d'origine.
 */
export function sanitizeSlots(rawSlotsData: unknown): SaveSlot[] {
  return nettoyerLesSlots(rawSlotsData).slots
}
