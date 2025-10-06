// types.d.ts

// --- AVATAR ---
type Avatar = {
  type: "initials" | "icon"
  value: string
  color: string
}

// --- DÉFINITION DES ENTITÉS ---

// Une personne physique, le pilier de toute simulation.
interface Person {
  id: string
  type: "person"
  name: string
  fiscalParts: number
  avatar: Avatar
  locked?: boolean
}

// Une société avec une personnalité morale distincte (à l'IS).
interface Company {
  id: string
  type: "company"
  name: string
  legalStatus: "SASU" | "EURL" // On pourrait ajouter SARL, SA... plus tard
  avatar: Avatar
  locked?: boolean
}

// L'entreprise individuelle, qui n'est PAS une personne morale, mais que l'on traite
// comme une entité distincte pour la clarté de l'interface.
interface MicroEntreprise {
  id: string
  type: "micro-entreprise"
  name: string
  // On pourra ajouter ici des options spécifiques à la micro : ACRE, VFL...
  beneficieACRE: boolean
  opteVFL: boolean
  avatar: Avatar
  locked?: boolean
}

// L'union de toutes les briques que l'utilisateur peut manipuler.
type Entity = Person | Company | MicroEntreprise

// --- DÉFINITION DES RELATIONS ---

type PersonToPersonRelationshipType = "Marié(e)" | "PACSé(e)" | "Enfant"
type PersonToCompanyRelationshipType = "Président" | "Gérant" | "Associé"
// Une personne est "Titulaire" de son entreprise individuelle.
type PersonToMicroEntrepriseRelationshipType = "Titulaire"

interface BaseRelationship {
  id: string
  fromId: string
  toId: string
}

interface PersonToPersonRelationship extends BaseRelationship {
  type: PersonToPersonRelationshipType
}
interface PersonToCompanyRelationship extends BaseRelationship {
  type: PersonToCompanyRelationshipType
}
interface PersonToMicroEntrepriseRelationship extends BaseRelationship {
  type: PersonToMicroEntrepriseRelationshipType
}

// L'union de tous les liens possibles.
type Relationship = PersonToPersonRelationship | PersonToCompanyRelationship | PersonToMicroEntrepriseRelationship

// --- DÉFINITION DES FLUX FINANCIERS ---

// Flux pour une personne (hors revenus de ses propres entreprises)
type PersonFlowType = "are" | "salary" | "other_taxable_income"

// Flux pour une société à l'IS
type CompanyFlowType = "ca_services" | "ca_vente" | "deductible_expense" | "director_remuneration" | "dividends_payment"

// Flux spécifiques à une micro-entreprise
type MicroEntrepriseFlowType = "ca_micro_services_bic" | "ca_micro_services_bnc" | "ca_micro_vente"

interface BaseFinancialFlow {
  id: string
  label: string
  amount: number
  entityId: string
}

interface PersonFinancialFlow extends BaseFinancialFlow {
  type: PersonFlowType
}
interface CompanyFinancialFlow extends BaseFinancialFlow {
  type: CompanyFlowType
}
interface MicroEntrepriseFinancialFlow extends BaseFinancialFlow {
  type: MicroEntrepriseFlowType
}

// L'union de tous les flux financiers possibles.
type FinancialFlow = PersonFinancialFlow | CompanyFinancialFlow | MicroEntrepriseFinancialFlow

// --- STRUCTURES GLOBALES DE L'APPLICATION ---

type MonthlyGridData = Array<{ month: number; flows: FinancialFlow[] }>

interface SaveSlot {
  id: string
  name: string
  lastModified: number
  entities: Entity[]
  relationships: Relationship[]
  monthlyData: MonthlyGridData
}

// DONNÉES BRUTES ET NON FIABLES
type RawSaveSlot = {
  id: string
  name: string
  lastModified: number
  entities?: unknown // Peut être manquant ou de n'importe quel type
  relationships?: unknown
  monthlyData?: unknown
}

interface SessionState {
  name: string
  entities: Entity[]
  relationships: Relationship[]
  monthlyData: MonthlyGridData
}

interface SimulationInputs {
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

interface SimulationResult {
  statut: string
  chiffreAffaires: number
  netDansLaPoche: number
  warning?: string
  error?: string
}

interface UserPreferences {
  slotOrder: string[]
}

// Décrit les corrections effectuées par le sanitizer.
interface SanitizationReport {
  entitiesRemoved: number
  relationshipsRemoved: number
  flowsRemoved: number
}

type ExportableState = { entities: Entity[]; relationships: Relationship[]; monthlyData: MonthlyGridData }

type EventPayloadMapping = {
  getCurrentSession: () => Promise<SessionState>
  saveCurrentSession: (session: SessionState) => Promise<void>
  getSaveSlots: () => Promise<SaveSlot[]>
  saveSlots: (slots: SaveSlot[]) => Promise<void>
  exportState: (state: ExportableState) => Promise<void>
  importState: () => Promise<{ data?: ExportableState; report?: SanitizationReport; error?: string }>
  getUserPreferences: () => Promise<UserPreferences>
  saveUserPreferences: (prefs: UserPreferences) => Promise<void>
}

declare global {
  interface Window {
    api: EventPayloadMapping
  }
}
