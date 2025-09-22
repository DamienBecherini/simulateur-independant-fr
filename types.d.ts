// types.d.ts

// 1. DÉFINITIONS DES ENTITÉS (au lieu de les importer)
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

// 2. TYPES POUR LES SIMULATIONS (inchangé)
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

// 3. TYPES POUR LA COMMUNICATION (inchangé)
type EventPayloadMapping = {
  runTestSimulation: () => Promise<SimulationResult>
  getState: () => Promise<Entity[]>
  saveState: (entities: Entity[]) => Promise<void>
  exportState: (entities: Entity[]) => Promise<void>
  importState: () => Promise<{ data?: Entity[]; error?: string }>
}
