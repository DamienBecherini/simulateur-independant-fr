// src/types.ts
import { z } from "zod"

// ===================================================================================
// == 1. DÉFINITION DES SCHÉMAS DE VALIDATION (LA SOURCE DE VÉRITÉ)
// ===================================================================================

export const AvatarSchema = z.object({
  type: z.enum(["initials", "icon"]),
  value: z.string(),
  color: z.string().startsWith("#").length(7)
})

export const PersonSchema = z.object({
  id: z.string(),
  type: z.literal("person"),
  name: z.string().min(1, "Le nom ne peut être vide").default("Nouvelle Personne"),
  fiscalParts: z.number().positive().default(1),
  avatar: AvatarSchema,
  locked: z.boolean().default(false)
})

export const CompanySchema = z.object({
  id: z.string(),
  type: z.literal("company"),
  name: z.string().min(1, "Le nom ne peut être vide").default("Nouvelle Société"),
  legalStatus: z.enum(["SASU", "EURL", "EI"]),
  // Sert au calcul des dividendes d'EURL soumis aux cotisations sociales (part dépassant 10 % du capital).
  capitalSocial: z.number().min(0).default(1000),
  avatar: AvatarSchema,
  locked: z.boolean().default(false)
})

export const MicroEntrepriseSchema = z.object({
  id: z.string(),
  type: z.literal("micro-entreprise"),
  name: z.string().min(1, "Le nom ne peut être vide").default("Nouvelle Micro-Entreprise"),
  beneficieACRE: z.boolean().default(false),
  opteVFL: z.boolean().default(false),
  avatar: AvatarSchema,
  locked: z.boolean().default(false)
})

export const EntitySchema = z.union([PersonSchema, CompanySchema, MicroEntrepriseSchema])

export const RelationshipSchema = z.object({
  id: z.string(),
  fromId: z.string(),
  toId: z.string(),
  type: z.enum(["Marié(e)", "PACSé(e)", "Enfant", "Président", "Gérant", "Associé", "Titulaire"])
})

export const FinancialFlowSchema = z.object({
  id: z.string(),
  label: z.string(),
  amount: z.number().default(0),
  // Salaire brut, facultatif et propre aux flux de type « salary » : `amount` reste le net,
  // et l'écart entre les deux compte comme cotisations salariales.
  grossAmount: z.number().min(0).optional(),
  entityId: z.string(),
  type: z.enum([
    // Person
    "are",
    "salary",
    "other_taxable_income",
    // Company
    "ca_services",
    "ca_vente",
    "deductible_expense",
    "director_remuneration",
    "dividends_payment",
    // Micro-entreprise
    "ca_micro_services_bic",
    "ca_micro_services_bnc",
    "ca_micro_vente",
    // Types temporaires pour la grille de test
    "income",
    "expense"
  ])
})

export const MonthlyGridDataSchema = z
  .array(
    z.object({
      month: z.number().int().min(0).max(11),
      flows: z.array(FinancialFlowSchema)
    })
  )
  .length(12, "La grille mensuelle doit contenir exactement 12 mois")

export const SessionStateSchema = z.object({
  appVersion: z.string().optional(),
  name: z.string().default("Nouvelle Simulation"),
  entities: z.array(EntitySchema).default([]),
  relationships: z.array(RelationshipSchema).default([]),
  monthlyData: MonthlyGridDataSchema.default(() => Array.from({ length: 12 }, (_, i) => ({ month: i, flows: [] })))
})

export const SaveSlotSchema = SessionStateSchema.extend({
  id: z.string(),
  lastModified: z.number()
})

export const UserPreferencesSchema = z.object({
  slotOrder: z.array(z.string()).default([]),
  // La clé (type de flux) est une string, la valeur (couleur) est une string
  flowTypeColors: z.record(z.string(), z.string()).optional()
})

// ===================================================================================
// == 2. DÉDUCTION DES TYPES TYPESCRIPT (PLUS DE MAINTENANCE MANUELLE)
// ===================================================================================

export type Avatar = z.infer<typeof AvatarSchema>
export type Person = z.infer<typeof PersonSchema>
export type Company = z.infer<typeof CompanySchema>
export type MicroEntreprise = z.infer<typeof MicroEntrepriseSchema>
export type Entity = z.infer<typeof EntitySchema>
export type Relationship = z.infer<typeof RelationshipSchema>
export type FinancialFlow = z.infer<typeof FinancialFlowSchema>
export type MonthlyGridData = z.infer<typeof MonthlyGridDataSchema>
export type SessionState = z.infer<typeof SessionStateSchema>
export type SaveSlot = z.infer<typeof SaveSlotSchema>
export type UserPreferences = z.infer<typeof UserPreferencesSchema>

// ===================================================================================
// == 3. TYPES NON LIÉS À LA VALIDATION (API, ÉTATS VOLATILES, ETC.)
// ===================================================================================

/** Résultat annuel d'une activité (société, entreprise individuelle ou micro-entreprise), avant impôt sur le revenu. */
export interface ActivityResult {
  entityId: string
  name: string
  type: Exclude<Entity["type"], "person">
  /** Statut affiché : « SASU », « EURL », « EI au réel » ou « Micro-entreprise ». */
  statut: string
  chiffreAffaires: number
  /** Charges déductibles (société, EI) ou dépenses non déductibles (micro-entreprise). */
  charges: number
  cotisationsSociales: number
  impotSocietes: number
  /** Ce que l'activité verse aux personnes sur l'année, avant impôt sur le revenu. */
  revenuVerse: number
  /** Bénéfice après IS laissé dans la société (toujours nul hors société à l'IS). */
  resultatConserve: number
  warnings: string[]
}

/** Revenus annuels d'une personne, avant impôt sur le revenu. */
export interface PersonResult {
  entityId: string
  name: string
  /** Salaires, allocations chômage et autres revenus saisis sur la personne. */
  revenusDirects: number
  /** Rémunérations, bénéfices et dividendes reçus de ses activités, nets de cotisations. */
  revenusActivites: number
  /** Les mêmes revenus, ventilés par nature. */
  detail: {
    salaires: number
    allocationsChomage: number
    autresRevenus: number
    remunerationsDirigeant: number
    /** Dividendes reçus, nets des cotisations sociales éventuelles (EURL). */
    dividendes: number
    /** Bénéfices de micro-entreprise ou d'entreprise individuelle, nets de cotisations. */
    benefices: number
  }
  /** Écart entre le brut et le net des salaires dont le brut est renseigné. */
  cotisationsSalariales: number
  depenses: number
}

export interface FoyerFiscalResult {
  /** Déclarants puis enfants rattachés. */
  personIds: string[]
  totalParts: number
  /** Tout ce que le foyer encaisse sur l'année, avant impôt sur le revenu. */
  revenusEncaisses: number
  /** Base soumise au barème, après abattements. */
  revenuImposableGlobal: number
  /** Impôt au barème, impôt forfaitaire sur les dividendes et versement libératoire. */
  impotSurLeRevenu: number
  /** Prélèvements sociaux sur les dividendes. */
  prelevementsSociaux: number
  /** Imposition des dividendes la plus favorable au foyer ; `null` s'il n'en reçoit pas. */
  optionDividendes: "pfu" | "bareme" | null
  netApresImpots: number
  /**
   * Part du foyer dans ce que produisent ses activités (chiffre d'affaires moins charges), plus ses revenus directs.
   * Dans une société à plusieurs associés, l'impôt sur les sociétés et le bénéfice conservé sont partagés à parts égales.
   */
  revenusAvantPrelevements: number
  /** Cotisations sociales et impôt sur les sociétés attribués au foyer, impôt sur le revenu et prélèvements sociaux. */
  totalPrelevements: number
  /** Part du foyer dans les bénéfices laissés dans les sociétés. */
  resultatConserve: number
  /** Dépenses personnelles saisies : elles ne réduisent pas l'impôt. */
  depenses: number
  warnings: string[]
}

/**
 * Vue d'ensemble de la simulation : ce que produisent les activités et les revenus directs, et où cela va.
 * Revenus avant prélèvements = prélèvements + résultat conservé + net après impôts + non rattaché.
 */
export interface SimulationBilan {
  chiffreAffaires: number
  /** Charges et dépenses des activités, hors cotisations et impôts. */
  charges: number
  /** Salaires, allocations et autres revenus saisis sur les personnes. */
  revenusDirects: number
  /** Cotisations salariales des salaires dont le brut est renseigné. */
  cotisationsSalariales: number
  /** Chiffre d'affaires moins charges, plus revenus directs et cotisations salariales. */
  revenusAvantPrelevements: number
  /** Cotisations sociales payées par les activités. */
  cotisationsSociales: number
  impotSocietes: number
  impotSurLeRevenu: number
  prelevementsSociaux: number
  /** Cotisations (activités et salaires), impôt sur les sociétés, impôt sur le revenu et prélèvements sociaux. */
  totalPrelevements: number
  /** Bénéfices laissés dans les sociétés (négatif en cas de déficit). */
  resultatConserve: number
  /** Revenus d'activités qu'aucune relation ne rattache à une personne. */
  nonRattache: number
}

export interface SimulationReport {
  /** Année des règles fiscales appliquées. */
  annee: number
  bilan: SimulationBilan
  activities: ActivityResult[]
  persons: PersonResult[]
  foyers: FoyerFiscalResult[]
  /** Somme des nets après impôts de tous les foyers. */
  totalNetApresImpots: number
}

export interface SanitizationReport {
  entitiesRemoved: number
  relationshipsRemoved: number
  flowsRemoved: number
  /** Points à vérifier après la conversion d'un fichier d'un format précédent. */
  migrationNotes: string[]
}

export type ExportableState = {
  entities: Entity[]
  relationships: Relationship[]
  monthlyData: MonthlyGridData
  simulationReport?: SimulationReport | null
  simulationError?: string | null
  exportedAt?: string
}

export type NotificationPayload = {
  message: string
  type?: "success" | "info" | "warning" | "error"
}
