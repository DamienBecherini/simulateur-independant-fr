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
}

export interface SimulationResult {
  statut: string
  chiffreAffaires: number
  netDansLaPoche: number
  warning?: string
  error?: string
}

export interface UserPreferences {
  slotOrder: string[]
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
