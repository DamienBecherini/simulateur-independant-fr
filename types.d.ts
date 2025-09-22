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

interface SaveSlot {
  id: string
  name: string
  lastModified: number
  entities: Entity[]
}

// --- NOUVEAU TYPE : L'ÉTAT DE LA SESSION ---
// Représente la simulation sur laquelle l'utilisateur travaille en ce moment.
interface SessionState {
  name: string
  entities: Entity[]
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

// Un objet pour stocker toutes les futures préférences. Pour l'instant, juste l'ordre des slots.
interface UserPreferences {
  slotOrder: string[]
}

// --- MISE À JOUR MAJEURE DE L'API DE COMMUNICATION ---
type EventPayloadMapping = {
  // Fonctions pour gérer la session de travail (sauvegarde auto)
  getCurrentSession: () => Promise<SessionState>
  saveCurrentSession: (session: SessionState) => Promise<void>

  // Fonctions pour gérer les slots de sauvegarde (sauvegarde manuelle)
  getSaveSlots: () => Promise<SaveSlot[]>
  saveSlots: (slots: SaveSlot[]) => Promise<void>

  // Fonctions pour l'import/export d'une simulation unique
  exportState: (entities: Entity[]) => Promise<void>
  importState: () => Promise<{ data?: Entity[]; error?: string }>

  // --- NOUVELLES FONCTIONS POUR LES PRÉFÉRENCES ---
  getUserPreferences: () => Promise<UserPreferences>
  saveUserPreferences: (prefs: UserPreferences) => Promise<void>
}
