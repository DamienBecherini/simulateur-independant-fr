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
  legalStatus: z.enum(["SASU", "EURL"]),
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

export interface SimulationInputs {
  ca_services_bic?: number
  ca_services_bnc?: number
  ca_vente?: number
  chiffreAffaires?: number
  chargesDeductibles?: number
  remunerationNetteVisee?: number
  capitalSocial?: number
  autresRevenusImposablesFoyer?: number
  partsFiscales?: number
  beneficieACRE?: boolean
  opteVFL?: boolean
  // Ajout pour la trésorerie de la micro
  depensesReelles?: number
}

export interface SanitizationReport {
  entitiesRemoved: number
  relationshipsRemoved: number
  flowsRemoved: number
}

export type ExportableState = {
  entities: Entity[]
  relationships: Relationship[]
  monthlyData: MonthlyGridData
}

export type NotificationPayload = {
  message: string
  type?: "success" | "info" | "warning" | "error"
}

// --- NOUVEAUX TYPES POUR LES RÉSULTATS DE SIMULATION (PHASE 6) ---

/**
 * Détail des résultats pour une Micro-Entreprise.
 */
export interface MicroEntrepriseResult {
  turnover: { total: number; servicesBic: number; servicesBnc: number; sales: number }
  socialContributions: { total: number; servicesBic: number; servicesBnc: number; sales: number }
  realExpenses: number
  taxableIncomeAfterAbattement: number
  netCashFlow: number // Ce qui est réellement disponible pour la personne (CA - cotisations - dépenses réelles)
  vflTax: number // Montant de l'impôt si VFL, sinon 0
  warning?: string
}

/**
 * Détail des résultats pour une Société à l'IS (SASU ou EURL).
 */
export interface CompanyISResult {
  turnover: number
  deductibleExpenses: number
  directorRemunerationCost: number // Coût total de la rémunération pour l'entreprise
  taxableProfit: number
  corporateTax: number
  netProfitAfterCorpTax: number
  distributableDividends: number
  dividendsSocialContributions: number // Cotisations sur les dividendes (pour EURL)
  netDividendsPaidToDirector: number // Dividendes nets après toutes taxes et cotisations
}

// Union pour tous les types de résultats d'entreprise
export type CompanyResult = { id: string; name: string; type: "MicroEntreprise" | "SASU" | "EURL" } & ({ type: "MicroEntreprise"; details: MicroEntrepriseResult } | { type: "SASU" | "EURL"; details: CompanyISResult })

/**
 * Interface pour le détail des revenus provenant d'une activité.
 */
export interface IncomeFromCompany {
  companyId: string
  companyName: string
  avatar: Avatar
  amount: number
}

/**
 * Détail des résultats pour une Personne physique.
 */
export interface PersonResult {
  id: string
  name: string
  // Détail des revenus pour la trésorerie
  cashInflows: {
    salaries: number
    unemploymentBenefits: number
    otherTaxableIncome: number
    // MODIFICATION : C'est maintenant un tableau détaillé
    fromOwnedCompanies: IncomeFromCompany[]
  }
  // NOUVEAU : Ajout des dépenses personnelles
  personalExpenses: number
  // Total des revenus imposables qui sera agrégé au niveau du foyer
  totalTaxableIncome: number
}

/**
 * Détail des résultats pour un Foyer fiscal.
 */
export interface HouseholdResult {
  id: string
  personIds: string[]
  personNames: string[]
  totalTaxableIncome: number
  totalFiscalParts: number
  incomeTax: number
  // Le "Net dans la poche" final pour tout le foyer
  finalNetInPocket: number
}

/**
 * L'objet complet retourné par le moteur de simulation.
 */
export interface SimulationOutput {
  companyResults: CompanyResult[]
  personResults: PersonResult[]
  householdResults: HouseholdResult[]
  errors: string[]
}
