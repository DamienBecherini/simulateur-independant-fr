// src/types.ts
import { z } from "zod"

// ===================================================================================
// == 1. DÉFINITION DES SCHÉMAS DE VALIDATION (LA SOURCE DE VÉRITÉ)
// ===================================================================================

/** Puissances fiscales d'une voiture que distingue le barème kilométrique : « 3 » pour 3 CV et moins, « 7 » pour 7 CV et plus. */
export const PUISSANCES_FISCALES = ["3", "4", "5", "6", "7"] as const
export type PuissanceFiscale = (typeof PUISSANCES_FISCALES)[number]

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
  // Revenu fiscal de référence du foyer de l'année N-2 : il conditionne l'accès au versement libératoire.
  rfrN2: z.number().min(0).optional(),
  avatar: AvatarSchema,
  locked: z.boolean().default(false)
})

export const EntitySchema = z.union([PersonSchema, CompanySchema, MicroEntrepriseSchema])

export const RelationshipSchema = z.object({
  id: z.string(),
  fromId: z.string(),
  toId: z.string(),
  // « En couple » (union libre) est informatif : chaque concubin reste un foyer fiscal distinct.
  // « Salarié » va de la personne vers l'activité qui l'emploie : celle-ci supporte le coût employeur de ses salaires.
  type: z.enum(["Marié(e)", "PACSé(e)", "En couple", "Enfant", "Président", "Gérant", "Associé", "Titulaire", "Salarié"])
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

/**
 * Année d'une nouvelle session : la dernière dont le simulateur connaît les règles (un test le vérifie).
 * C'est aussi l'année où les migrations placent la grille d'une session d'avant les années multiples (format 2).
 */
export const ANNEE_PAR_DEFAUT = 2026

/** Douze mois sans flux. */
export function grilleVide(): z.infer<typeof MonthlyGridDataSchema> {
  return Array.from({ length: 12 }, (_, month) => ({ month, flows: [] }))
}

/** Une année simulée : son numéro et sa grille mensuelle. Les acteurs et les relations sont ceux de la session. */
export const AnneeSimuleeSchema = z.object({
  annee: z.number().int().min(1900).max(2200),
  monthlyData: MonthlyGridDataSchema
})

export const SessionStateSchema = z.object({
  appVersion: z.string().optional(),
  name: z.string().default("Nouvelle Simulation"),
  // Acteurs et relations communs à toutes les années de la session (voir l'ADR 008).
  entities: z.array(EntitySchema).default([]),
  relationships: z.array(RelationshipSchema).default([]),
  // Les années, de la plus ancienne à la plus récente, sans doublon (le nettoyage les trie) ; au moins une.
  annees: z.array(AnneeSimuleeSchema).min(1, "Une session contient au moins une année").default(() => [{ annee: ANNEE_PAR_DEFAUT, monthlyData: grilleVide() }])
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
export type AnneeSimulee = z.infer<typeof AnneeSimuleeSchema>
export type SessionState = z.infer<typeof SessionStateSchema>
export type SaveSlot = z.infer<typeof SaveSlotSchema>
export type UserPreferences = z.infer<typeof UserPreferencesSchema>

// ===================================================================================
// == 3. TYPES NON LIÉS À LA VALIDATION (API, ÉTATS VOLATILES, ETC.)
// ===================================================================================

/** Ce que le moteur calcule pour une année : les acteurs et les relations de la session, la grille de l'année. */
export interface DonneesDeLAnnee {
  entities: Entity[]
  relationships: Relationship[]
  monthlyData: MonthlyGridData
}

/** Une année de la session vue comme une simulation d'un an, avec le nom de la session (exports, comparateur). */
export interface SimulationAnnuelle extends DonneesDeLAnnee {
  name: string
  annee: number
}

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
  /** Personnes qui reçoivent les revenus de l'activité : dirigeant et associés d'une société, titulaire d'une entreprise individuelle. */
  beneficiaireIds: string[]
  /** Micro-entreprise seulement : accès au versement libératoire selon le revenu fiscal de référence du foyer. */
  versementLiberatoire?: VersementLiberatoireInfo
  /** EURL et entreprise individuelle au réel : détail des cotisations du travailleur non salarié. */
  cotisationsTNS?: DetailCotisationsTNS
  /** SASU : détail des cotisations du président, assimilé salarié, sur sa rémunération. */
  cotisationsPresident?: DetailCotisationsSalarie
  /** Salariés de l'activité (relation « Salarié ») : leurs salaires bruts sont dans les charges, les cotisations patronales dans les cotisations sociales. */
  salaries?: SalarieDeLActivite[]
  warnings: string[]
}

/** Les cotisations du régime général, une par ligne du détail : celles du barème, puis la CSG et la CRDS. */
export type CotisationSalarie =
  | "maladie"
  | "vieillessePlafonnee"
  | "vieillesseDeplafonnee"
  | "allocationsFamiliales"
  | "accidentsDuTravail"
  | "contributionSolidariteAutonomie"
  | "fnal"
  | "retraiteComplementaire"
  | "contributionEquilibreGeneral"
  | "contributionEquilibreTechnique"
  | "assuranceChomage"
  | "ags"
  | "dialogueSocial"
  | "formationProfessionnelle"
  | "taxeApprentissage"
  | "csgDeductible"
  | "csgNonDeductibleEtCrds"

/** Bulletin de paie annuel simplifié d'un président de SASU (assimilé salarié) ou d'un salarié. */
export interface DetailCotisationsSalarie {
  /** Le président, assimilé salarié, ne cotise pas à l'assurance chômage et n'a pas droit à la réduction générale. */
  statut: "president" | "salarie"
  brut: number
  /** Brut moins les cotisations salariales, CSG et CRDS comprises. */
  net: number
  cotisations: Record<CotisationSalarie, { salariale: number; patronale: number }>
  /** Cotisations salariales, CSG et CRDS comprises. */
  totalSalarial: number
  /** Cotisations patronales, avant la réduction générale. */
  totalPatronal: number
  /** Réduction générale dégressive unique des cotisations patronales (salariés seulement). */
  reductionGenerale: number
  /** Brut, plus les cotisations patronales, moins la réduction générale : ce que paie l'employeur. */
  coutEmployeur: number
  /** CSG non déductible et CRDS : elles s'ajoutent au net pour le revenu imposable. */
  partNonDeductible: number
}

/** Un salarié d'une activité de la simulation, avec son bulletin de paie annuel. */
export interface SalarieDeLActivite extends DetailCotisationsSalarie {
  personId: string
}

/** Les cotisations et contributions sociales d'un travailleur non salarié, une par ligne du détail. */
export type CotisationTNS =
  | "maladieMaternite"
  | "indemnitesJournalieres"
  | "retraiteDeBase"
  | "retraiteComplementaire"
  | "invaliditeDeces"
  | "allocationsFamiliales"
  | "csgDeductible"
  | "csgNonDeductibleEtCrds"
  | "formationProfessionnelle"

/** Cotisations annuelles d'un travailleur non salarié (gérant d'EURL, entrepreneur individuel au réel). */
export interface DetailCotisationsTNS {
  /** Revenu professionnel avant cotisations : bénéfice de l'entreprise individuelle, ou rémunération du gérant cotisations comprises et dividendes au-delà de 10 % du capital. */
  revenuAvantCotisations: number
  /** Assiette unique des cotisations et de la CSG-CRDS : le revenu avant cotisations après l'abattement forfaitaire. */
  assiette: number
  cotisations: Record<CotisationTNS, number>
  total: number
  /** CSG non déductible et CRDS : elles ne réduisent pas le revenu imposable. */
  partNonDeductible: number
}

export interface VersementLiberatoireInfo {
  /** Seuil de revenu fiscal de référence N-2 pour le foyer du titulaire : seuil par part x nombre de parts. */
  plafondRfr: number
  partsFiscales: number
  /** Revenu fiscal de référence N-2 retenu (calculé ou saisi), ou `null` s'il n'est pas connu. */
  rfrN2: number | null
  /** Année N-2 dont le revenu fiscal de référence est comparé au seuil. */
  anneeRfr: number
  /**
   * D'où vient le revenu fiscal de référence retenu : calculé par la simulation quand l'année N-2 en fait partie,
   * sinon saisi dans la fiche de la micro-entreprise ; `null` s'il n'est pas connu.
   */
  origineRfr: "calcule" | "saisi" | null
  /** `null` tant que le revenu fiscal de référence n'est pas renseigné. */
  eligible: boolean | null
  /** L'option est demandée et applicable : l'impôt est payé en pourcentage du chiffre d'affaires. */
  applique: boolean
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
  /**
   * Revenu fiscal de référence (article 1417 IV du CGI), tel que le simulateur peut le calculer : revenu imposable au
   * barème, plus les dividendes imposés au prélèvement forfaitaire (montant brut) ou l'abattement de 40 % s'ils sont
   * imposés au barème, plus le chiffre d'affaires après abattement des micro-entreprises au versement libératoire.
   */
  revenuFiscalDeReference: number
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
  /** Année simulée. */
  annee: number
  /** Année des règles fiscales appliquées : la même, ou la dernière connue pour une année plus récente. */
  anneeDesRegles: number
  /** Avertissements sur l'année elle-même (règles reprises d'une autre année). */
  avertissements: string[]
  bilan: SimulationBilan
  activities: ActivityResult[]
  persons: PersonResult[]
  foyers: FoyerFiscalResult[]
  /** Somme des nets après impôts de tous les foyers. */
  totalNetApresImpots: number
}

/** Résultat d'une année de la session : son rapport, ou l'erreur qui l'a empêchée d'être simulée. */
export interface ResultatAnnee {
  annee: number
  report: SimulationReport | null
  erreur: string | null
}

/** Résultats de toutes les années de la session, de la plus ancienne à la plus récente. */
export interface SimulationPluriannuelle {
  annees: ResultatAnnee[]
}

/** Statuts proposés par le comparateur ; la micro-entreprise est simulée avec et sans versement libératoire. */
export type StatutCompare = "SASU" | "EURL" | "EI" | "micro" | "micro-vfl"

export interface ComparaisonOptions {
  /** Activité à faire changer de statut ; le reste de la simulation ne bouge pas. */
  activityId: string
  /** Rémunération nette annuelle du dirigeant dans les colonnes SASU et EURL. */
  remunerationNette: number
  /** Verser en dividendes tout le bénéfice disponible des colonnes SASU et EURL, plutôt que les dividendes saisis. */
  distribuerToutLeBenefice: boolean
  /** Part BNC des prestations de services quand l'activité devient une micro-entreprise (0 à 1). Ignorée si elle en est déjà une. */
  partBncPrestations: number
  /** Frais de fonctionnement annuels par statut, ajoutés aux charges de l'activité dans chaque colonne. */
  fraisFonctionnement?: FraisFonctionnement
}

/** Postes de frais de fonctionnement d'une activité, hors cotisations et impôts. */
export type PosteFrais = "expertComptable" | "banque" | "logiciel" | "assurance" | "cfe"
/** Statuts pour lesquels on saisit des frais : la micro-entreprise a les mêmes, avec ou sans versement libératoire. */
export type StatutFrais = "SASU" | "EURL" | "EI" | "micro"
export type FraisFonctionnement = Record<StatutFrais, Record<PosteFrais, number>>

export interface ScenarioStatut {
  statut: StatutCompare
  libelle: string
  /** Statut actuel de l'activité. */
  actuel: boolean
  /** Frais de fonctionnement annuels ajoutés pour ce statut. */
  fraisFonctionnement: number
  /** Bénéfice laissé dans l'activité comparée (négatif si elle est déficitaire) ; les autres montants portent sur toute la simulation. */
  resultatConserveActivite: number
  /** Micro-entreprise au-delà des plafonds de chiffre d'affaires : régime tenable deux ans au plus, jamais désigné meilleur net. */
  horsPlafond: boolean
  protectionSociale: ProtectionSociale
  /** Indicateurs de toute la simulation, l'activité ayant pris ce statut. */
  netApresImpots: number
  revenusAvantPrelevements: number
  totalPrelevements: number
  cotisationsSociales: number
  impotSocietes: number
  impotSurLeRevenu: number
  prelevementsSociaux: number
  resultatConserve: number
  /** Avertissements de l'activité dans ce statut (plafond micro dépassé, société déficitaire…). */
  warnings: string[]
}

/** Note qualitative de protection sociale d'un statut, sur 5 étoiles. */
export interface ProtectionSociale {
  etoiles: number
  /** Trimestres de retraite validés sur l'année (4 au maximum). */
  trimestres: number
  resume: string
}

export interface ComparaisonCouple {
  /** Personnes en union libre, comparées comme si elles étaient mariées ou pacsées. */
  personIds: [string, string]
  netApresImpotsActuel: number
  impotSurLeRevenuActuel: number
  netApresImpotsMaries: number
  impotSurLeRevenuMaries: number
}

export interface ComparaisonResult {
  scenarios: ScenarioStatut[]
  /** Statut au meilleur net après impôts. */
  meilleur: StatutCompare | null
  /** Une entrée par couple en union libre. */
  couples: ComparaisonCouple[]
  warnings: string[]
}

/** Formats de fichier texte que l'application sait enregistrer ou ouvrir (exports, sauvegardes groupées). */
export type FormatFichierTexte = "csv" | "markdown" | "json"

/** Sociétés à l'impôt sur les sociétés, où l'on arbitre entre rémunération et dividendes. */
export type StatutSociete = "SASU" | "EURL"

/** Résultat de toute la simulation pour une rémunération donnée, le reste du bénéfice étant versé en dividendes. */
export interface PointRemuneration {
  remunerationNette: number
  dividendes: number
  netApresImpots: number
  cotisationsSociales: number
  impotSocietes: number
  impotSurLeRevenu: number
  prelevementsSociaux: number
  /** Trimestres de retraite validés par le dirigeant (4 au maximum). */
  trimestres: number
}

export interface OptimisationRemuneration {
  statut: StatutSociete
  /** Rémunération nette la plus haute que la société peut verser sans devenir déficitaire. */
  remunerationMaximale: number
  /** Points de la courbe, par rémunération croissante. */
  points: PointRemuneration[]
  /** Rémunération au meilleur net du foyer. */
  meilleur: PointRemuneration | null
  /** Meilleur net parmi les rémunérations qui valident 4 trimestres de retraite ; `null` si aucune n'y parvient. */
  meilleurAvecRetraite: PointRemuneration | null
  warnings: string[]
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
  annees: AnneeSimulee[]
  /** Résultats de chaque année, à titre d'information : ils sont recalculés à l'import. */
  simulation?: SimulationPluriannuelle | null
  simulationError?: string | null
  exportedAt?: string
}

export type NotificationPayload = {
  message: string
  type?: "success" | "info" | "warning" | "error"
}
