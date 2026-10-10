// src/types.ts
import { z } from "zod"
import { ANNEE_COURANTE } from "./backend/regles/index.js"

// ===================================================================================
// == 1. DÉFINITION DES SCHÉMAS DE VALIDATION (LA SOURCE DE VÉRITÉ)
// ===================================================================================

/** Puissances fiscales d'une voiture que distingue le barème kilométrique : « 3 » pour 3 CV et moins, « 7 » pour 7 CV et plus. */
export const PUISSANCES_FISCALES = ["3", "4", "5", "6", "7"] as const
export type PuissanceFiscale = (typeof PUISSANCES_FISCALES)[number]

/**
 * Les caisses de libéraux réglementés que le simulateur calcule (voir l'ADR 015) : la seule liste, d'où se déduit le
 * type `CaisseLiberale`. Chaque particularité d'une caisse vit dans une table typée par caisse (calcul des cotisations,
 * micro-entreprise, couverture, textes) : ajouter une caisse ici sans ses règles ni ses entrées est une erreur de
 * compilation, jamais un calcul fait comme pour une autre caisse.
 */
export const CAISSES_LIBERALES = ["CIPAV", "CARPIMKO"] as const
export type CaisseLiberale = (typeof CAISSES_LIBERALES)[number]

/**
 * Les statuts juridiques d'une activité au réel (`Company.legalStatus`) : la seule liste, d'où se déduisent les types
 * `StatutJuridique`, `StatutSociete` et `StatutCompare`. La micro-entreprise n'en fait pas partie : c'est un autre type
 * d'acteur. Chaque particularité d'un statut vit dans une table typée par statut (calcul du moteur, protection sociale,
 * relations permises, libellés…) : ajouter un statut ici sans ses entrées est une erreur de compilation à chaque endroit
 * à compléter, jamais un calcul fait comme pour un autre statut (voir le guide du développeur, « Ajouter un statut »).
 */
export const STATUTS_JURIDIQUES = ["SASU", "EURL", "EI"] as const
export type StatutJuridique = (typeof STATUTS_JURIDIQUES)[number]

/**
 * Imposition du bénéfice de chaque statut au réel. « IS » : une société à l'impôt sur les sociétés, qui verse une
 * rémunération et des dividendes et garde des réserves ; « IR » : une entreprise individuelle, dont le bénéfice est le
 * revenu du titulaire. Décide de `StatutSociete` et de `estSocieteIS` : partout où seule compte cette distinction (flux
 * proposés, capital social, arbitrage rémunération / dividendes), un nouveau statut suit la ligne qu'on lui donne ici.
 */
export const IMPOSITION_DES_STATUTS = { SASU: "IS", EURL: "IS", EI: "IR" } as const satisfies Record<StatutJuridique, "IS" | "IR">

/** Sociétés à l'impôt sur les sociétés, où l'on arbitre entre rémunération et dividendes : déduit d'`IMPOSITION_DES_STATUTS`. */
export type StatutSociete = { [S in StatutJuridique]: (typeof IMPOSITION_DES_STATUTS)[S] extends "IS" ? S : never }[StatutJuridique]

/** Vrai pour une société à l'impôt sur les sociétés (SASU, EURL), d'après `IMPOSITION_DES_STATUTS`. */
export function estSocieteIS(statut: StatutCompare): statut is StatutSociete {
  return estStatutJuridique(statut) && IMPOSITION_DES_STATUTS[statut] === "IS"
}

/** Vrai pour un statut au réel de `STATUTS_JURIDIQUES` (faux pour la micro-entreprise, avec ou sans versement libératoire). */
export function estStatutJuridique(statut: string): statut is StatutJuridique {
  return (STATUTS_JURIDIQUES as readonly string[]).includes(statut)
}

/** Les sociétés à l'IS, dans l'ordre de `STATUTS_JURIDIQUES` (SASU, puis EURL). */
export const STATUTS_SOCIETE = STATUTS_JURIDIQUES.filter(estSocieteIS)

export const AvatarSchema = z.object({
  type: z.enum(["initials", "icon"]),
  value: z.string(),
  color: z.string().startsWith("#").length(7)
})

/** La voiture d'un déplacement : sa puissance fiscale, qui choisit la ligne du barème kilométrique, et si elle est 100 % électrique (+ 20 %). */
const champsVehicule = {
  puissanceFiscale: z.enum(PUISSANCES_FISCALES).default("5"),
  electrique: z.boolean().default(false)
}

/**
 * Un trajet domicile-travail d'une personne vers l'un de ses lieux de travail (plusieurs employeurs, un salaire et une
 * rémunération de dirigeant…) : un aller-retour par jour travaillé sur ce lieu, avec une voiture personnelle.
 */
export const TrajetSchema = z.object({
  /** Nom libre du lieu de travail ou de l'employeur, pour distinguer les trajets entre eux. */
  libelle: z.string().default(""),
  /** Distance d'un aller simple entre le domicile et le lieu de travail, en kilomètres. */
  kmParTrajet: z.number().min(0).default(0),
  joursTravailles: z.number().min(0).max(366).default(0),
  ...champsVehicule,
  /** Distance au-delà de 40 km par trajet justifiée (précarité de l'emploi, emploi du conjoint, santé…) : retenue entière. */
  distanceJustifiee: z.boolean().default(false)
})

const CHAMPS_D_UN_TRAJET = ["kmParTrajet", "joursTravailles", "puissanceFiscale", "electrique", "distanceJustifiee"]

/**
 * Frais réels enregistrés avant les trajets multiples : un seul trajet, à plat à côté des autres frais. Ils deviennent
 * une liste d'un trajet sans changer le numéro de format des fichiers, puisque chaque lecture passe par ce schéma.
 */
function versListeDeTrajets(valeur: unknown): unknown {
  if (typeof valeur !== "object" || valeur === null || Array.isArray(valeur) || "trajets" in valeur) return valeur
  const ancien = valeur as Record<string, unknown>
  const trajet = Object.fromEntries(CHAMPS_D_UN_TRAJET.filter(champ => champ in ancien).map(champ => [champ, ancien[champ]]))
  return { autresFrais: ancien.autresFrais, trajets: [trajet] }
}

/**
 * Frais réels d'une personne sur ses revenus imposés comme des salaires (salaires, allocations chômage, rémunérations de
 * dirigeant) : trajets domicile-travail convertis au barème kilométrique, et autres frais réels. Facultatifs : sans eux,
 * seule la déduction forfaitaire de 10 % s'applique. L'option vaut pour tous ces revenus à la fois, quel que soit le
 * nombre d'employeurs : un trajet par lieu de travail. Communs à toutes les années de la session, comme les acteurs.
 */
export const FraisReelsSchema = z.preprocess(
  versListeDeTrajets,
  z.object({
    trajets: z.array(TrajetSchema).default([]),
    /** Autres frais réels de l'année, en euros (repas, formation, double résidence…). */
    autresFrais: z.number().min(0).default(0)
  })
)

/**
 * Déplacements professionnels d'une activité avec une voiture personnelle, convertis au barème kilométrique : une charge
 * réelle de l'activité, déductible au réel, jamais en micro-entreprise. Facultatifs, communs à toutes les années.
 */
export const DeplacementsProfessionnelsSchema = z.object({
  kmParAn: z.number().min(0).default(0),
  ...champsVehicule
})

/**
 * Mois de création d'une activité, « AAAA-MM » (début d'activité déclaré, ou immatriculation) : il borne l'ACRE,
 * l'exonération de CFE et le prorata des plafonds de la micro-entreprise. Facultatif : sans lui, ces dispositifs gardent
 * leur traitement d'une année entière. Une valeur mal formée est écartée seule, sans faire perdre l'activité.
 */
const DateDeCreationSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
  .optional()
  .catch(undefined)

/**
 * Profession libérale réglementée d'une activité BNC (micro-entreprise, entreprise individuelle au réel, gérant d'EURL) :
 * l'identifiant d'une profession des règles de l'année, dont la caisse et les particularités se déduisent (voir l'ADR 015).
 * Facultative : absente, l'activité est non réglementée et calculée comme avant. Une profession inconnue des règles est
 * écartée par le nettoyage, qui le signale ; une valeur qui n'est pas un texte est écartée seule.
 */
const ProfessionSchema = z.string().min(1).optional().catch(undefined)

/**
 * Part des recettes conventionnées, nettes de dépassements d'honoraires, d'une profession conventionnable (0 à 1) :
 * la prise en charge par l'Assurance maladie ne porte que sur elle. Absente : 1 (tout est conventionné). Une valeur hors
 * limites est écartée seule.
 */
const PartConventionneeSchema = z.number().min(0).max(1).optional().catch(undefined)

export const PersonSchema = z.object({
  id: z.string(),
  type: z.literal("person"),
  name: z.string().min(1, "Le nom ne peut être vide").default("Nouvelle Personne"),
  fiscalParts: z.number().positive().default(1),
  fraisReels: FraisReelsSchema.optional(),
  avatar: AvatarSchema,
  locked: z.boolean().default(false)
})

/**
 * Capital social d'une SASU ou d'une EURL quand l'utilisateur ne l'a pas saisi : société créée dans l'interface ou par
 * une IA, fichier d'avant le champ, activité convertie depuis une micro-entreprise ou une EI dans le comparateur. Ce
 * n'est pas une règle fiscale (la loi n'impose aucun minimum, 1 € suffit) mais un choix de modélisation : un montant
 * courant pour une petite société, qui fixe la part des dividendes d'EURL échappant aux cotisations (10 % du capital
 * en 2026) et le plafond de la réserve légale. L'utilisateur le remplace par le sien dans la fiche de la société.
 */
export const CAPITAL_SOCIAL_PAR_DEFAUT = 1000

export const CompanySchema = z.object({
  id: z.string(),
  type: z.literal("company"),
  name: z.string().min(1, "Le nom ne peut être vide").default("Nouvelle Société"),
  legalStatus: z.enum(STATUTS_JURIDIQUES),
  // Sert au calcul des dividendes d'EURL soumis aux cotisations sociales (part dépassant 10 % du capital).
  capitalSocial: z.number().min(0).default(CAPITAL_SOCIAL_PAR_DEFAUT),
  /**
   * Société à l'IS : réserves distribuables au 1er janvier de la première année de la session (bénéfices des années
   * d'avant gardés dans la société, réserve légale non comprise). Les années suivantes, le moteur les reporte lui-même
   * (voir l'ADR 014). Absent : aucune.
   */
  reservesInitiales: z.number().min(0).optional(),
  dateDeCreation: DateDeCreationSchema,
  profession: ProfessionSchema,
  partConventionnee: PartConventionneeSchema,
  deplacementsProfessionnels: DeplacementsProfessionnelsSchema.optional(),
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
  dateDeCreation: DateDeCreationSchema,
  /**
   * Chiffre d'affaires au-delà des plafonds du régime l'année qui précède la première année de la session : un nouveau
   * dépassement cette première année fait sortir du régime au 1er janvier suivant. Absent : non.
   */
  horsPlafondAnneePrecedente: z.boolean().optional(),
  profession: ProfessionSchema,
  partConventionnee: PartConventionneeSchema,
  deplacementsProfessionnels: DeplacementsProfessionnelsSchema.optional(),
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
 * Année d'une nouvelle session : l'année en cours du simulateur, c'est-à-dire la plus récente dont un fichier de
 * règles existe (src/backend/regles/index.ts). Elle n'est écrite nulle part ailleurs : elle avance avec les fichiers.
 */
export const ANNEE_PAR_DEFAUT = ANNEE_COURANTE

/** Douze mois sans flux. */
export function grilleVide(): z.infer<typeof MonthlyGridDataSchema> {
  return Array.from({ length: 12 }, (_, month) => ({ month, flows: [] }))
}

/** Une année simulée : son numéro et sa grille mensuelle. Les acteurs et les relations sont ceux de la session. */
export const AnneeSimuleeSchema = z.object({
  annee: z.number().int().min(1900).max(2200),
  monthlyData: MonthlyGridDataSchema
})

/** Modes de partage du bénéfice d'une société à l'IS dans le comparateur (voir `ModeRepartition`). */
export const MODES_REPARTITION = ["meilleurNet", "dividendes", "remuneration", "personnalisee", "grille"] as const

export const RepartitionBeneficeSchema = z.object({
  mode: z.enum(MODES_REPARTITION),
  /** Répartition personnalisée : part du bénéfice distribuable versée en dividendes (0 à 1), le reste étant conservé. */
  partDistribuee: z.number().min(0).max(1),
  /** Au meilleur net : ne retenir que les rémunérations qui valident 4 trimestres de retraite. Absent : non. */
  avecRetraite: z.boolean().optional()
})

/** Postes de frais de fonctionnement d'une activité, hors cotisations et impôts. */
export const POSTES_FRAIS = ["expertComptable", "banque", "logiciel", "assurance", "cfe"] as const
/**
 * Statuts pour lesquels on saisit des frais : la micro-entreprise a les mêmes, avec ou sans versement libératoire.
 * Liste écrite à part de `STATUTS_JURIDIQUES` : chaque statut y est une clé obligatoire des fichiers enregistrés. Un
 * nouveau statut s'y ajoute (avec ses frais par défaut) ou reprend les frais d'un autre ; `FRAIS_DES_COLONNES`
 * (comparateur.ts) oblige à choisir.
 */
export const STATUTS_FRAIS = ["SASU", "EURL", "EI", "micro"] as const

const FraisDUnStatutSchema = z.object(Object.fromEntries(POSTES_FRAIS.map(poste => [poste, z.number().min(0)])) as Record<(typeof POSTES_FRAIS)[number], z.ZodNumber>)

/** Frais de fonctionnement annuels par statut, en euros. */
export const FraisFonctionnementSchema = z.object(Object.fromEntries(STATUTS_FRAIS.map(statut => [statut, FraisDUnStatutSchema])) as Record<(typeof STATUTS_FRAIS)[number], typeof FraisDUnStatutSchema>)

/**
 * Réglages du comparateur choisis par l'utilisateur pour une activité (voir l'ADR 009). Chaque champ est facultatif :
 * absent, le comparateur propose sa valeur par défaut, tirée de la grille de l'année affichée.
 */
export const ReglagesComparateurSchema = z.object({
  repartition: RepartitionBeneficeSchema.optional(),
  /** Rémunération nette annuelle saisie, par année (« 2026 ») : une autre année repart de sa grille. */
  remunerationParAnnee: z.record(z.string().regex(/^\d{4}$/), z.number().min(0)).optional(),
  /** Part BNC des prestations quand l'activité devient une micro-entreprise (0 à 1). */
  partBncPrestations: z.number().min(0).max(1).optional(),
  fraisFonctionnement: FraisFonctionnementSchema.optional(),
  /** Statut de société étudié dans « Rémunération ou dividendes ? » et la barre de partage du bénéfice. */
  statutEtudie: z.enum(STATUTS_SOCIETE).optional(),
  /** « Sur toutes les années » : part du bénéfice distribuable gardée chaque année, puis distribuée la dernière (0 à 1). */
  partMiseEnReserve: z.number().min(0).max(1).optional()
})

/** Comparateur de statuts : l'activité comparée et les réglages choisis pour chaque activité, par identifiant. */
export const ComparateurSchema = z.object({
  activiteComparee: z.string().optional(),
  reglagesParActivite: z.record(z.string(), ReglagesComparateurSchema).default({})
})

export const SessionStateSchema = z.object({
  /**
   * Version de l'application qui a écrit le fichier (session en cours, export) ou enregistré la sauvegarde nommée.
   * Une information, jamais une condition de lecture : c'est `formatVersion` qui décide des conversions.
   */
  appVersion: z.string().optional(),
  name: z.string().default("Nouvelle Simulation"),
  // Acteurs et relations communs à toutes les années de la session (voir l'ADR 008).
  entities: z.array(EntitySchema).default([]),
  relationships: z.array(RelationshipSchema).default([]),
  // Les années, de la plus ancienne à la plus récente, sans doublon (le nettoyage les trie) ; au moins une.
  annees: z.array(AnneeSimuleeSchema).min(1, "Une session contient au moins une année").default(() => [{ annee: ANNEE_PAR_DEFAUT, monthlyData: grilleVide() }]),
  // Facultatif : une session d'avant cet ajout se lit telle quelle, sans changer de format (voir l'ADR 009).
  comparateur: ComparateurSchema.optional()
})

export const SaveSlotSchema = SessionStateSchema.extend({
  id: z.string(),
  lastModified: z.number()
})

/** Affichage de la page choisi par l'utilisateur pendant la bêta : « Résumé » (par défaut), l'affichage d'origine ou « Trois vues ». */
export const AffichageSchema = z.enum(["resume", "classique", "vues"])

/** Longueur maximale de l'identifiant d'une section repliable mémorisée. */
export const LONGUEUR_MAXIMALE_ID_SECTION = 200

/**
 * Préférences de l'utilisateur, propres à son poste (ou à son navigateur pour la démo web) : elles ne voyagent pas avec
 * les fichiers de simulation. Chaque champ invalide est écarté seul (`catch`), sans faire perdre les autres préférences.
 */
export const UserPreferencesSchema = z.object({
  slotOrder: z.array(z.string()).default([]).catch([]),
  // La clé (type de flux) est une string, la valeur (couleur) est une string
  flowTypeColors: z.record(z.string(), z.string()).optional().catch(undefined),
  // Une valeur inconnue (affichage retiré, comme « panneaux ») est ignorée sans invalider les autres préférences.
  affichage: AffichageSchema.optional().catch(undefined),
  /**
   * Sauvegarde nommée chargée : « Sauvegarder » la met à jour, même après un redémarrage. C'est un état du poste, pas
   * une donnée de la simulation : un fichier exporté ou partagé ne doit pas désigner une sauvegarde d'un autre poste.
   */
  loadedSlotId: z.string().optional().catch(undefined),
  /** Zoom de l'interface demandé (1 = 100 %), entre le zoom minimal et le zoom maximal de src/lib/zoom.ts. */
  zoom: z.number().min(0.5).max(2).optional().catch(undefined),
  /** Sections repliables ouvertes (vrai) ou fermées (faux) par l'utilisateur, par identifiant de section. */
  sectionsOuvertes: z.record(z.string().max(LONGUEUR_MAXIMALE_ID_SECTION), z.boolean()).optional().catch(undefined)
})

// ===================================================================================
// == 2. DÉDUCTION DES TYPES TYPESCRIPT (PLUS DE MAINTENANCE MANUELLE)
// ===================================================================================

export type Avatar = z.infer<typeof AvatarSchema>
export type Trajet = z.infer<typeof TrajetSchema>
export type FraisReels = z.infer<typeof FraisReelsSchema>
export type DeplacementsProfessionnels = z.infer<typeof DeplacementsProfessionnelsSchema>
export type Person = z.infer<typeof PersonSchema>
export type Company = z.infer<typeof CompanySchema>
export type MicroEntreprise = z.infer<typeof MicroEntrepriseSchema>
export type Entity = z.infer<typeof EntitySchema>
export type Relationship = z.infer<typeof RelationshipSchema>
export type FinancialFlow = z.infer<typeof FinancialFlowSchema>
export type MonthlyGridData = z.infer<typeof MonthlyGridDataSchema>
export type AnneeSimulee = z.infer<typeof AnneeSimuleeSchema>
export type RepartitionBenefice = z.infer<typeof RepartitionBeneficeSchema>
export type PosteFrais = (typeof POSTES_FRAIS)[number]
export type StatutFrais = (typeof STATUTS_FRAIS)[number]
export type FraisFonctionnement = z.infer<typeof FraisFonctionnementSchema>
export type ReglagesComparateur = z.infer<typeof ReglagesComparateurSchema>
export type Comparateur = z.infer<typeof ComparateurSchema>
export type SessionState = z.infer<typeof SessionStateSchema>
export type SaveSlot = z.infer<typeof SaveSlotSchema>
export type UserPreferences = z.infer<typeof UserPreferencesSchema>
export type Affichage = z.infer<typeof AffichageSchema>

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
  /** Micro-entreprise seulement : contribution à la formation professionnelle, comprise dans les cotisations sociales. */
  formationProfessionnelle?: number
  /** EURL et entreprise individuelle au réel : détail des cotisations du travailleur non salarié. */
  cotisationsTNS?: DetailCotisationsTNS
  /** SASU : détail des cotisations du président, assimilé salarié, sur sa rémunération. */
  cotisationsPresident?: DetailCotisationsSalarie
  /** Salariés de l'activité (relation « Salarié ») : leurs salaires bruts sont dans les charges, les cotisations patronales dans les cotisations sociales. */
  salaries?: SalarieDeLActivite[]
  /**
   * Déplacements professionnels au barème kilométrique, compris dans les charges : déductibles en société et en
   * entreprise individuelle, simple dépense en micro-entreprise.
   */
  fraisDeDeplacement?: { kilometres: number; montant: number; deductible: boolean }
  /** Société à l'IS : partage de son bénéfice, montants non arrondis. */
  partage?: PartageDuBenefice
  /** Société à l'IS : ses réserves, du 1er janvier au 31 décembre, montants non arrondis. */
  reserves?: ReservesDeLaSociete
  /** Micro-entreprise passée au régime réel (deux années de suite au-delà des plafonds) : simulée en EI au réel. */
  sortieDuRegimeMicro?: SortieDuRegimeMicro
  /** Micro-entreprise à l'ACRE dont la date de création est connue : l'aide de l'année, mois par mois. */
  acre?: ACREDeLAnnee
  /** Dispositifs limités dans le temps qui jouent cette année (sortie du régime micro, ACRE, plafonds au prorata). */
  dispositifs?: string[]
  /** Profession libérale réglementée de l'activité (voir l'ADR 015). */
  profession?: ProfessionDeLActivite
  warnings: string[]
}

/**
 * Ce qu'une société à l'IS garde d'une année sur l'autre (voir l'ADR 014) : ses réserves distribuables (bénéfices
 * gardés ; négatives, des pertes à combler), sa réserve légale et son déficit reportable sur l'impôt sur les sociétés.
 */
export interface EtatDeLaSociete {
  reserves: number
  reserveLegale: number
  deficitReportable: number
}

/** Les réserves d'une société à l'IS sur une année, du 1er janvier au 31 décembre. */
export interface ReservesDeLaSociete {
  /** Au 1er janvier. */
  auDebut: EtatDeLaSociete
  /** Au 31 décembre : ce que l'année suivante reçoit. */
  aLaFin: EtatDeLaSociete
  /** Déficit des années précédentes déduit du bénéfice imposable à l'IS de l'année. */
  deficitImpute: number
  /** Part du bénéfice de l'année affectée à la réserve légale. */
  dotationReserveLegale: number
  /** Bénéfice distribuable de l'année : bénéfice après IS, moins la dotation à la réserve légale et les pertes antérieures. */
  beneficeDistribuableDeLAnnee: number
  /** Tout ce que la société peut distribuer dans l'année : son bénéfice distribuable et ses réserves. */
  distribuable: number
  /** Part des dividendes de l'année prise sur les réserves des années précédentes. */
  dividendesPrisSurLesReserves: number
}

/** Sortie du régime micro : au 1er janvier de `depuis`, après deux années de suite au-delà des plafonds. */
export interface SortieDuRegimeMicro {
  depuis: number
  depassements: [number, number]
}

/** ACRE d'une micro-entreprise sur une année : la réduction, sa période (« AAAA-MM ») et les mois de l'année couverts. */
export interface ACREDeLAnnee {
  /** Part des cotisations retirée : 0,5 ou 0,25 selon la date de création. */
  reduction: number
  debut: string
  fin: string
  /** Mois de l'année couverts par l'aide (0 pour janvier). */
  mois: number[]
  /** Cotisations économisées sur l'année. */
  economie: number
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

/**
 * Ce que la caisse d'une profession libérale réglementée change aux cotisations d'un travailleur non salarié (voir
 * l'ADR 015) : les lignes communes portent alors ses barèmes, et s'y ajoutent l'ASV et la CURPS.
 */
export interface DetailCaisseLiberale {
  caisse: CaisseLiberale
  profession: string
  libelleProfession: string
  /** Part des revenus conventionnés, nets de dépassements (0 pour une profession qui ne peut pas être conventionnée). */
  partConventionnee: number
  /** Avantage social vieillesse à la charge du praticien, compris dans le total. */
  asv: number
  /** Contribution aux unions régionales des professionnels de santé, comprise dans le total. */
  curps: number
  /** Ce que l'Assurance maladie paie pour un praticien conventionné, hors du total : sa maladie et son ASV. */
  priseEnCharge: { maladie: number; asv: number }
  /**
   * CARPIMKO : l'année et l'assiette sur lesquelles la retraite complémentaire et l'ASV sont calculées, celles de
   * l'année précédente quand elle est dans la session, sinon celles de l'année simulée.
   */
  baseDesCotisationsDeLAnneePrecedente?: { annee: number; assiette: number; anneePrecedenteConnue: boolean }
}

/** Profession libérale réglementée d'une activité, telle que les règles de l'année la décrivent. */
export interface ProfessionDeLActivite {
  id: string
  libelle: string
  /** Sa caisse, si le simulateur la calcule ; `null` pour « autre profession réglementée ». */
  caisse: CaisseLiberale | null
  /** Micro-entreprise d'un affilié de la CIPAV : son taux global de cotisations sur le chiffre d'affaires BNC. */
  tauxMicro?: number
}

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
  /** Profession libérale réglementée d'une caisse que le simulateur calcule : sa caisse, l'ASV et la CURPS. */
  caisse?: DetailCaisseLiberale
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
  /** Personne qui a saisi des frais réels et perçoit des revenus imposés comme des salaires : la déduction retenue. */
  fraisProfessionnels?: FraisProfessionnelsResult
}

/**
 * Déduction pour frais professionnels sur les revenus imposés comme des salaires d'une personne : la plus favorable entre
 * la déduction forfaitaire de 10 % (bornée) et les frais réels, sans dépasser ces revenus.
 */
export interface FraisProfessionnelsResult {
  /** Salaires, allocations chômage et rémunérations de dirigeant imposables. */
  revenusSalariaux: number
  /** Taux de la déduction forfaitaire de l'année (0,1 pour 10 %), pour les textes qui la nomment. */
  tauxDeductionForfaitaire: number
  deductionForfaitaire: number
  fraisReels: number
  /** Part des frais réels qui vient des trajets domicile-travail, au barème kilométrique. */
  fraisDeTrajet: number
  /** Distance annuelle des trajets retenue (aller-retour, chaque trajet limité à 40 km sauf justification). */
  distanceRetenue: number
  /** Trajets domicile-travail saisis. */
  nombreDeTrajets: number
  /** Trajets regroupés par voiture : distance retenue et montant au barème kilométrique de chacune. */
  voitures: { puissanceFiscale: PuissanceFiscale; electrique: boolean; distance: number; montant: number }[]
  /** Autres frais réels saisis (repas, formation, double résidence…). */
  autresFrais: number
  retenue: "forfait" | "reels"
  /** Montant déduit du revenu imposable. */
  deduction: number
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

/** Statuts proposés par le comparateur : chaque statut au réel, et la micro-entreprise avec et sans versement libératoire. */
export const STATUTS_COMPARES = [...STATUTS_JURIDIQUES, "micro", "micro-vfl"] as const
export type StatutCompare = (typeof STATUTS_COMPARES)[number]

/**
 * Partage du bénéfice d'une société à l'IS dans le comparateur :
 * - « meilleurNet » : dans chaque statut, la rémunération au meilleur net du foyer (ou au meilleur net parmi celles
 *   qui valident 4 trimestres de retraite), tout le reste en dividendes : garder du bénéfice n'améliore jamais le net de l'année ;
 * - « dividendes » : la rémunération saisie, tout le reste en dividendes ;
 * - « remuneration » : la plus haute rémunération que la société peut verser, sans dividendes ;
 * - « personnalisee » : la rémunération saisie, et une part du bénéfice distribuable en dividendes, le reste conservé ;
 * - « grille » : la rémunération saisie et les dividendes saisis dans la grille.
 */
export type ModeRepartition = (typeof MODES_REPARTITION)[number]

/** Au meilleur net, la rémunération retenue dans une colonne SASU ou EURL. */
export interface RemunerationOptimale {
  remunerationNette: number
  /** Cette rémunération valide 4 trimestres de retraite, comme demandé. */
  avecRetraite: boolean
  /** 4 trimestres demandés, mais aucune rémunération possible ne les valide : c'est le meilleur net sans condition. */
  retraiteHorsDAtteinte: boolean
  /**
   * Net du foyer perdu en exigeant 4 trimestres de retraite (meilleur net moins meilleur net avec 4 trimestres), en
   * euros arrondis ; absent quand le meilleur net les valide déjà, ou qu'aucune rémunération ne les valide.
   */
  coutDesQuatreTrimestres?: number
}

/**
 * Partage du bénéfice d'une société à l'IS, tiré de la simulation : le bénéfice avant rémunération du dirigeant
 * (chiffre d'affaires moins les charges) est exactement la somme des six postes.
 */
export interface PartageDuBenefice {
  beneficeAvantRemuneration: number
  remunerationNette: number
  /** Cotisations sociales sur la rémunération du dirigeant (salariales et patronales en SASU, du gérant en EURL). */
  cotisationsRemuneration: number
  impotSocietes: number
  /** Dividendes versés, moins les cotisations du gérant d'EURL sur leur part au-delà de 10 % du capital. */
  dividendesNets: number
  cotisationsSurDividendes: number
  /** Bénéfice après IS laissé dans la société (négatif si elle est déficitaire). */
  resultatConserve: number
}

export interface ComparaisonOptions {
  /** Activité à faire changer de statut ; le reste de la simulation ne bouge pas. */
  activityId: string
  /** Rémunération nette annuelle du dirigeant dans les colonnes SASU et EURL. */
  remunerationNette: number
  /** Partage du bénéfice des colonnes SASU et EURL entre rémunération, dividendes et réserves. */
  repartition: RepartitionBenefice
  /** Part BNC des prestations de services quand l'activité devient une micro-entreprise (0 à 1). Ignorée si elle en est déjà une. */
  partBncPrestations: number
  /** Frais de fonctionnement annuels par statut, ajoutés aux charges de l'activité dans chaque colonne. */
  fraisFonctionnement?: FraisFonctionnement
}

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
  /** Colonne micro d'une activité sortie du régime micro cette année-là : régime plus accessible, jamais désigné meilleur net. */
  regimeMicroFerme?: SortieDuRegimeMicro
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
  /** SASU et EURL : partage du bénéfice de l'activité entre rémunération, prélèvements, dividendes et réserves. */
  partage?: PartageDuBenefice
  /** SASU et EURL : réserves de l'activité, du 1er janvier au 31 décembre (voir l'ADR 014). */
  reserves?: ReservesDeLaSociete
  /** SASU et EURL, au meilleur net : la rémunération retenue pour ce statut. */
  remunerationOptimale?: RemunerationOptimale
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
  /** Au meilleur net : l'arbitrage rémunération / dividendes calculé pour chaque statut de société, à réutiliser tel quel. */
  optimisations?: Partial<Record<StatutSociete, OptimisationRemuneration>>
  /** CFE de l'année exonérée ou réduite d'après la date de création de l'activité comparée : ce qui est retenu. */
  noteCFE?: string
  /** Part de la CFE d'une année pleine comptée cette année (0 ou 0,5), quand elle n'est pas due en entier. */
  partCFE?: number
}

/** Formats de fichier texte que l'application sait enregistrer ou ouvrir (exports, sauvegardes groupées). */
export type FormatFichierTexte = "csv" | "markdown" | "json"


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

/** Stratégies de distribution comparées sur toutes les années de la session (voir l'ADR 014). */
export const STRATEGIES_DE_DISTRIBUTION = ["toutDistribuer", "garderPuisDistribuer", "lisser"] as const
export type StrategieDeDistribution = (typeof STRATEGIES_DE_DISTRIBUTION)[number]

/** Une année d'une stratégie de distribution, montants arrondis. */
export interface AnneeDUneStrategie {
  annee: number
  /** Dividendes versés par la société cette année. */
  dividendes: number
  /** Net après impôts de tous les foyers de la simulation. */
  netApresImpots: number
  /** Cotisations, impôt sur les sociétés, impôt sur le revenu et prélèvements sociaux de toute la simulation. */
  totalPrelevements: number
  /** Réserves distribuables de la société au 31 décembre. */
  reservesALaFin: number
}

/** Une stratégie de distribution sur toutes les années, montants arrondis. */
export interface ResultatDUneStrategie {
  strategie: StrategieDeDistribution
  libelle: string
  netCumule: number
  prelevementsCumules: number
  /** Réserves distribuables laissées dans la société à la fin de la dernière année : pas encore imposées au nom du foyer. */
  reservesALaFin: number
  annees: AnneeDUneStrategie[]
  warnings: string[]
}

/** Les stratégies de distribution d'une activité devenue SASU ou EURL. */
export interface StrategiesDUnStatut {
  statut: StatutSociete
  strategies: ResultatDUneStrategie[]
  /** Stratégie au meilleur net cumulé ; `null` si elles se valent à l'euro près. */
  meilleure: StrategieDeDistribution | null
}

/** « Sur toutes les années » : les stratégies de distribution de l'activité comparée, en SASU et en EURL. */
export interface StrategiesDeDistribution {
  /** Années simulées, de la plus ancienne à la plus récente. */
  annees: number[]
  /** Part du bénéfice distribuable gardée chaque année dans « Garder puis distribuer » (0 à 1). */
  partMiseEnReserve: number
  statuts: StrategiesDUnStatut[]
  /** Hypothèses et années non simulées. */
  notes: string[]
}

export interface SanitizationReport {
  entitiesRemoved: number
  relationshipsRemoved: number
  flowsRemoved: number
  /** Réglages du comparateur invalides (hors limites, mal formés), écartés un par un. */
  reglagesRemoved: number
  /** Professions inconnues des règles, écartées : l'activité redevient non réglementée (voir l'ADR 015). */
  professionsRemoved: number
  /** Années en double écartées (la première occurrence est gardée), qu'elles aient eu des flux ou non. */
  anneesEcartees: number[]
  /** Points à vérifier après la conversion d'un fichier d'un format précédent. */
  migrationNotes: string[]
}

export type ExportableState = {
  /** Nom de la simulation ; absent des exports d'avant son ajout. */
  name?: string
  entities: Entity[]
  relationships: Relationship[]
  annees: AnneeSimulee[]
  /** Réglages du comparateur, facultatifs. */
  comparateur?: Comparateur
  /** Résultats de chaque année, à titre d'information : ils sont recalculés à l'import. */
  simulation?: SimulationPluriannuelle | null
  simulationError?: string | null
  exportedAt?: string
  /** Version de l'application qui a écrit le fichier, si elle l'indique. */
  appVersion?: string
}

export type NotificationPayload = {
  message: string
  type?: "success" | "info" | "warning" | "error"
}
