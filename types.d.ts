// types.d.ts

interface Person {
  id: string
  type: "person"
  name: string
  fiscalParts: number
  locked?: boolean
}

interface Company {
  id: string
  type: "company"
  name: string
  legalStatus: "SASU" | "EURL"
  locked?: boolean
}

type Entity = Person | Company

// --- NOUVEAUX TYPES ---
// Représente une ligne de transaction (revenu, dépense, etc.)
interface FinancialFlow {
  id: string
  label: string
  amount: number
  // Le type 'salary' sera utile plus tard pour l'arbitrage rémunération/dividendes
  type: "income" | "expense" | "salary"
  // ID de la Personne ou Société à laquelle ce flux est rattaché
  entityId: string
}

// Un tableau de 12 objets, un pour chaque mois (0 = Janvier)
type MonthlyGridData = Array<{
  month: number
  flows: FinancialFlow[]
}>
// --- FIN DES NOUVEAUX TYPES ---

interface SaveSlot {
  id: string
  name: string
  lastModified: number
  entities: Entity[]
  monthlyData: MonthlyGridData // <-- AJOUT
}

// L'état de la session de travail inclut maintenant la grille
interface SessionState {
  name: string
  entities: Entity[]
  monthlyData: MonthlyGridData // <-- AJOUT
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

type EventPayloadMapping = {
  getCurrentSession: () => Promise<SessionState>
  saveCurrentSession: (session: SessionState) => Promise<void>
  getSaveSlots: () => Promise<SaveSlot[]>
  saveSlots: (slots: SaveSlot[]) => Promise<void>
  exportState: (state: { entities: Entity[]; monthlyData: MonthlyGridData }) => Promise<void> // <-- MISE À JOUR
  importState: () => Promise<{ data?: { entities: Entity[]; monthlyData: MonthlyGridData }; error?: string }> // <-- MISE À JOUR
  getUserPreferences: () => Promise<UserPreferences>
  saveUserPreferences: (prefs: UserPreferences) => Promise<void>
}
