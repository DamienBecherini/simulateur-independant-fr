// src/backend/logic/outils/operations.ts
// Les opérations qu'une proposition peut contenir, et leur application pure à une session. Chaque opération est
// validée sur la session telle que les opérations précédentes l'ont laissée ; la moindre erreur refuse toute la
// proposition, avec un message qui dit quelle opération et pourquoi.

import { z } from "zod"
import { CAPITAL_SOCIAL_PAR_DEFAUT, grilleVide, MODES_REPARTITION, POSTES_FRAIS, RelationshipSchema, STATUTS_FRAIS, STATUTS_JURIDIQUES, STATUTS_SOCIETE, type Avatar, type Comparateur, type Entity, type FinancialFlow, type MonthlyGridData, type ReglagesComparateur, type SessionState } from "../../../types.js"
import { NOMBRE_MAX_ANNEES } from "../annees.js"
import { professionDe, professionsConnues } from "../professions.js"
import { ANNEE_COURANTE, reglesDesAnneesConnues } from "../regles.js"
import { STATUTS_A_PROFESSION } from "../statuts.js"
import { anneeDeLaSession, enumerer, ErreurOutil, genreDe, GENRES_D_ACTEUR, RELATIONS_REQUISES, trouverActeur, TYPES_DE_FLUX, verifierNouvelleRelation, verifierTypePermis, type GenreDActeur } from "./commun.js"
import { AnneeSchema, IdentifiantSchema, LibelleSchema, ListeDeMoisSchema, MontantSchema, NomSchema } from "./limites.js"

// ===================================================================================
// == SCHÉMAS
// ===================================================================================

/** Une série de flux : même acteur, même type, même libellé dans une année (montants libres d'un mois à l'autre). */
export const SerieSchema = z.strictObject({
  acteurId: IdentifiantSchema.describe("Acteur qui porte la série."),
  typeFlux: z.enum(TYPES_DE_FLUX),
  libelle: LibelleSchema
})

/** Réglages d'un acteur qu'une proposition peut fixer ; chacun ne vaut que pour certains genres d'acteur. */
export const ReglagesActeurSchema = z.strictObject({
  partsFiscales: z.number().min(0.5).max(20).optional().describe("Personne : parts fiscales propres (1 par adulte ; enfants : relation Enfant)."),
  capitalSocial: MontantSchema.optional().describe("SASU, EURL : capital social, en euros."),
  dateDeCreation: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, `Date de création : « AAAA-MM », par exemple ${ANNEE_COURANTE}-03.`).optional().describe("Activité : mois de création, « AAAA-MM »."),
  beneficieACRE: z.boolean().optional().describe("Micro : bénéficie de l'ACRE."),
  opteVFL: z.boolean().optional().describe("Micro : versement libératoire de l'impôt."),
  rfrN2: MontantSchema.optional().describe("Micro : revenu fiscal de référence N-2 du foyer, en euros."),
  horsPlafondAnneePrecedente: z.boolean().optional().describe("Micro : plafonds dépassés l'année précédant la simulation."),
  profession: z
    .string()
    .optional()
    .describe("EI, EURL, micro : profession réglementée (regles_de_l_annee)."),
  partConventionnee: z.number().min(0).max(1).optional().describe("Part conventionnée (CARPIMKO), 0 à 1.")
})
type ReglagesActeur = z.infer<typeof ReglagesActeurSchema>

/**
 * Genres d'acteur auxquels chaque réglage s'applique. Ceux des statuts au réel se déduisent des tables de statuts : le
 * capital, des sociétés à l'IS (`IMPOSITION_DES_STATUTS`) ; la profession, des dirigeants non salariés, qui cotisent à
 * sa caisse (`REGIME_DU_DIRIGEANT`).
 */
const REGLAGE_PAR_GENRE: Record<keyof ReglagesActeur, GenreDActeur[]> = {
  partsFiscales: ["personne"],
  capitalSocial: [...STATUTS_SOCIETE],
  dateDeCreation: [...STATUTS_JURIDIQUES, "micro-entreprise"],
  beneficieACRE: ["micro-entreprise"],
  opteVFL: ["micro-entreprise"],
  rfrN2: ["micro-entreprise"],
  horsPlafondAnneePrecedente: ["micro-entreprise"],
  profession: [...STATUTS_A_PROFESSION, "micro-entreprise"],
  partConventionnee: [...STATUTS_A_PROFESSION, "micro-entreprise"]
}

/**
 * La profession proposée doit être connue des règles ; une part conventionnée n'a de sens que pour une profession
 * conventionnable, celle que l'acteur aura après l'opération. Un acteur vaut pour toutes les années de la session :
 * comme pour `professionsConnues`, il suffit que la profession soit conventionnable dans les règles d'une année.
 */
function verifierProfession(acteur: Entity): void {
  if (acteur.type === "person") return
  if (acteur.profession !== undefined && !professionsConnues().has(acteur.profession)) throw new ErreurOutil(`Profession inconnue : « ${acteur.profession} » (identifiants : regles_de_l_annee, ou « non-reglementee »).`)
  if (acteur.partConventionnee === undefined || reglesDesAnneesConnues().some(regles => professionDe(acteur, regles)?.conventionnable)) return
  throw new ErreurOutil(`La part conventionnée ne vaut que pour une profession conventionnable (auxiliaires médicaux de la CARPIMKO) : « ${acteur.name} » n'en a pas.`)
}

/**
 * Frais de fonctionnement proposés : chaque statut, chaque poste, comme FraisFonctionnementSchema, écrits en
 * enregistrements pour que le schéma publié ne répète pas quatre fois les mêmes postes.
 */
const FraisProposesSchema = z.record(z.enum(STATUTS_FRAIS), z.record(z.enum(POSTES_FRAIS), z.number().min(0)))

export const ReglagesComparateurProposesSchema = z.strictObject({
  mode: z.enum(MODES_REPARTITION).optional().describe("Partage du bénéfice en SASU et EURL."),
  partDistribuee: z.number().min(0).max(1).optional().describe("Mode personnalisee : part du bénéfice distribuable versée en dividendes, de 0 à 1."),
  avecRetraite: z.boolean().optional().describe("Mode meilleurNet : exiger 4 trimestres de retraite."),
  remunerationNette: MontantSchema.optional().describe("Rémunération nette annuelle saisie pour l'année indiquée, en euros."),
  partBncPrestations: z.number().min(0).max(1).optional().describe("Part BNC des prestations si l'activité devient une micro-entreprise, de 0 à 1."),
  fraisFonctionnement: FraisProposesSchema.optional().describe("Frais de fonctionnement annuels par statut et par poste, en euros, tous requis."),
  statutEtudie: z.enum(STATUTS_SOCIETE).optional().describe("Statut étudié dans « Rémunération ou dividendes ? ».")
})

export const OperationSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("ajouter_annee"), annee: AnneeSchema }),
  z.strictObject({ type: z.literal("ajouter_acteur"), id: IdentifiantSchema, genre: z.enum(GENRES_D_ACTEUR), nom: NomSchema, reglages: ReglagesActeurSchema.default({}) }),
  z.strictObject({ type: z.literal("modifier_acteur"), acteurId: IdentifiantSchema, nom: NomSchema.optional(), reglages: ReglagesActeurSchema.default({}) }),
  z.strictObject({ type: z.literal("ajouter_relation"), id: IdentifiantSchema, deId: IdentifiantSchema, versId: IdentifiantSchema, typeRelation: RelationshipSchema.shape.type }),
  z.strictObject({ type: z.literal("supprimer_relation"), relationId: IdentifiantSchema }),
  z.strictObject({ type: z.literal("ajouter_flux"), annee: AnneeSchema, acteurId: IdentifiantSchema, typeFlux: z.enum(TYPES_DE_FLUX), libelle: LibelleSchema, montant: MontantSchema, montantBrut: MontantSchema.optional(), mois: ListeDeMoisSchema }),
  z.strictObject({ type: z.literal("modifier_serie"), annee: AnneeSchema, serie: SerieSchema, mois: ListeDeMoisSchema.optional(), montant: MontantSchema.optional(), montantBrut: MontantSchema.optional(), libelle: LibelleSchema.optional() }),
  z.strictObject({ type: z.literal("supprimer_serie"), annee: AnneeSchema, serie: SerieSchema, mois: ListeDeMoisSchema.optional() }),
  z.strictObject({ type: z.literal("regler_comparateur"), activiteId: IdentifiantSchema, annee: AnneeSchema.optional(), comparer: z.boolean().default(true), reglages: ReglagesComparateurProposesSchema })
])

export type Operation = z.infer<typeof OperationSchema>
type OperationDe<T extends Operation["type"]> = Extract<Operation, { type: T }>

/** Opérations qui retirent quelque chose de la session : elles sont comptées à part (voir LIMITES). */
export const estUneSuppression = (operation: Operation) => operation.type === "supprimer_relation" || operation.type === "supprimer_serie"

// ===================================================================================
// == APPLICATION
// ===================================================================================

/** La session en cours de transformation, et de quoi nommer les nouveaux flux sans collision. */
interface Chantier {
  session: SessionState
  nouvelIdDeFlux: () => string
  /** Activités dont les flux exigent peut-être une relation : vérifiées une fois toutes les opérations appliquées. */
  activitesAVerifier: Set<string>
}

const verifierIdLibre = (session: SessionState, id: string) => {
  const pris = [...session.entities.map(e => e.id), ...session.relationships.map(r => r.id)]
  if (pris.includes(id)) throw new ErreurOutil(`L'identifiant « ${id} » est déjà pris.`)
}

/** Pastille d'un nouvel acteur : couleur et icône de son genre, initiales pour une personne. */
function avatarDuGenre(genre: GenreDActeur, nom: string): Avatar {
  const icones: Record<Exclude<GenreDActeur, "personne">, [string, string]> = { SASU: ["Briefcase", "#b91c1c"], EURL: ["Building", "#16a34a"], EI: ["User", "#7e22ce"], "micro-entreprise": ["Store", "#d97706"] }
  if (genre === "personne") {
    const initiales = nom.split(/\s+/).map(mot => mot.charAt(0).toUpperCase()).join("").slice(0, 2)
    return { type: "initials", value: initiales || "?", color: "#3b82f6" }
  }
  const [icone, couleur] = icones[genre]
  return { type: "icon", value: icone, color: couleur }
}

function verifierReglages(genre: GenreDActeur, reglages: ReglagesActeur): void {
  for (const cle of Object.keys(reglages) as (keyof ReglagesActeur)[]) {
    if (reglages[cle] !== undefined && !REGLAGE_PAR_GENRE[cle].includes(genre)) throw new ErreurOutil(`Le réglage « ${cle} » ne s'applique pas à un acteur « ${genre} » (seulement : ${REGLAGE_PAR_GENRE[cle].join(", ")}).`)
  }
}

/** L'objet sans ses champs absents : un réglage non proposé ne doit pas effacer la valeur en place. */
function sansValeursAbsentes<T extends object>(objet: T): Partial<T> {
  return Object.fromEntries(Object.entries(objet).filter(([, valeur]) => valeur !== undefined)) as Partial<T>
}

/** Les réglages proposés, sous les noms des champs de la session. */
function champsDeLActeur(reglages: ReglagesActeur): Partial<Record<string, unknown>> {
  const { partsFiscales, ...reste } = reglages
  return sansValeursAbsentes({ fiscalParts: partsFiscales, ...reste })
}

function ajouterActeur(c: Chantier, op: OperationDe<"ajouter_acteur">): void {
  verifierIdLibre(c.session, op.id)
  verifierReglages(op.genre, op.reglages)
  const commun = { id: op.id, name: op.nom, avatar: avatarDuGenre(op.genre, op.nom), locked: false, ...champsDeLActeur(op.reglages) }
  const acteurs: Record<GenreDActeur, () => Entity> = {
    personne: () => ({ type: "person", fiscalParts: 1, ...commun }) as Entity,
    "micro-entreprise": () => ({ type: "micro-entreprise", beneficieACRE: false, opteVFL: false, ...commun }) as Entity,
    SASU: () => ({ type: "company", legalStatus: "SASU", capitalSocial: CAPITAL_SOCIAL_PAR_DEFAUT, ...commun }) as Entity,
    EURL: () => ({ type: "company", legalStatus: "EURL", capitalSocial: CAPITAL_SOCIAL_PAR_DEFAUT, ...commun }) as Entity,
    EI: () => ({ type: "company", legalStatus: "EI", capitalSocial: 0, ...commun }) as Entity
  }
  const nouvel = acteurs[op.genre]()
  verifierProfession(nouvel)
  c.session = { ...c.session, entities: [...c.session.entities, nouvel] }
}

function modifierActeur(c: Chantier, op: OperationDe<"modifier_acteur">): void {
  const acteur = trouverActeur(c.session, op.acteurId)
  if (acteur.locked) throw new ErreurOutil(`« ${acteur.name} » est verrouillé par l'utilisateur : il ne peut pas être modifié par une proposition.`)
  if (op.nom === undefined && Object.keys(sansValeursAbsentes(op.reglages)).length === 0) throw new ErreurOutil("Rien à modifier : indiquez un nom ou des réglages.")
  verifierReglages(genreDe(acteur), op.reglages)
  const modifie = { ...acteur, ...(op.nom ? { name: op.nom } : {}), ...champsDeLActeur(op.reglages) } as Entity
  verifierProfession(modifie)
  c.session = { ...c.session, entities: c.session.entities.map(e => (e.id === acteur.id ? modifie : e)) }
}

function ajouterRelation(c: Chantier, op: OperationDe<"ajouter_relation">): void {
  verifierIdLibre(c.session, op.id)
  verifierNouvelleRelation(c.session, op.deId, op.versId, op.typeRelation)
  c.session = { ...c.session, relationships: [...c.session.relationships, { id: op.id, fromId: op.deId, toId: op.versId, type: op.typeRelation }] }
}

function supprimerRelation(c: Chantier, op: OperationDe<"supprimer_relation">): void {
  const relation = c.session.relationships.find(r => r.id === op.relationId)
  if (!relation) throw new ErreurOutil(`Aucune relation « ${op.relationId} » dans la simulation (voir decrire_simulation).`)
  c.activitesAVerifier.add(relation.fromId).add(relation.toId)
  c.session = { ...c.session, relationships: c.session.relationships.filter(r => r.id !== op.relationId) }
}

function ajouterAnnee(c: Chantier, op: OperationDe<"ajouter_annee">): void {
  const annees = c.session.annees.map(a => a.annee)
  const [premiere, derniere] = [Math.min(...annees), Math.max(...annees)]
  if (annees.includes(op.annee)) throw new ErreurOutil(`L'année ${op.annee} est déjà dans la simulation.`)
  if (op.annee !== premiere - 1 && op.annee !== derniere + 1) throw new ErreurOutil(`Les années d'une simulation se suivent : seules ${premiere - 1} et ${derniere + 1} peuvent être ajoutées (des flux sur une année absente l'ajoutent : proposez aussi les années intermédiaires).`)
  if (annees.length >= NOMBRE_MAX_ANNEES) throw new ErreurOutil(`Une simulation compte au plus ${NOMBRE_MAX_ANNEES} années.`)
  const nouvelle = { annee: op.annee, monthlyData: grilleVide() }
  c.session = { ...c.session, annees: op.annee < premiere ? [nouvelle, ...c.session.annees] : [...c.session.annees, nouvelle] }
}

/** Remplace la grille d'une année de la session. */
function avecGrille(c: Chantier, annee: number, transformer: (grille: MonthlyGridData) => MonthlyGridData): void {
  anneeDeLaSession(c.session, annee)
  c.session = { ...c.session, annees: c.session.annees.map(a => (a.annee === annee ? { ...a, monthlyData: transformer(a.monthlyData) } : a)) }
}

function verifierMontantBrut(typeFlux: string, montant: number | undefined, montantBrut: number | undefined): void {
  if (montantBrut === undefined) return
  if (typeFlux !== "salary") throw new ErreurOutil("montantBrut ne s'applique qu'à un salaire (salary).")
  if (montant !== undefined && montantBrut < montant) throw new ErreurOutil(`Salaire brut (${montantBrut} €) inférieur au net (${montant} €).`)
}

function ajouterFlux(c: Chantier, op: OperationDe<"ajouter_flux">): void {
  const acteur = trouverActeur(c.session, op.acteurId)
  verifierTypePermis(acteur, op.typeFlux)
  verifierMontantBrut(op.typeFlux, op.montant, op.montantBrut)
  c.activitesAVerifier.add(acteur.id)
  const mois = new Set(op.mois.map(m => m - 1))
  avecGrille(c, op.annee, grille =>
    grille.map(m => {
      if (!mois.has(m.month)) return m
      const flux: FinancialFlow = { id: c.nouvelIdDeFlux(), label: op.libelle, amount: op.montant, entityId: acteur.id, type: op.typeFlux, ...(op.montantBrut === undefined ? {} : { grossAmount: op.montantBrut }) }
      return { ...m, flows: [...m.flows, flux] }
    })
  )
}

const dansLaSerie = (serie: z.infer<typeof SerieSchema>) => (f: FinancialFlow) => f.entityId === serie.acteurId && f.type === serie.typeFlux && f.label === serie.libelle

/** Applique `transformer` aux flux de la série dans les mois visés ; refuse une série absente de ces mois. */
function surLaSerie(c: Chantier, op: OperationDe<"modifier_serie" | "supprimer_serie">, transformer: (flux: FinancialFlow[]) => FinancialFlow[]): void {
  const acteur = trouverActeur(c.session, op.serie.acteurId)
  const mois = op.mois ? new Set(op.mois.map(m => m - 1)) : null
  const estDansLaSerie = dansLaSerie(op.serie)
  let touches = 0
  avecGrille(c, op.annee, grille =>
    grille.map(m => {
      if ((mois && !mois.has(m.month)) || !m.flows.some(estDansLaSerie)) return m
      touches++
      return { ...m, flows: transformer(m.flows) }
    })
  )
  if (touches === 0) throw new ErreurOutil(`Aucun flux « ${op.serie.libelle} » (${op.serie.typeFlux}) de « ${acteur.name} » en ${op.annee}${op.mois ? " dans les mois indiqués" : ""}. ${seriesDeLActeur(c.session, acteur, op.annee)}`)
}

/** Nombre de séries citées quand une série demandée est introuvable. */
const SERIES_CITEES = 20

/** Les séries d'un acteur dans une année, pour qu'un modèle retrouve le libellé et le type exacts d'une série. */
function seriesDeLActeur(session: SessionState, acteur: Entity, annee: number): string {
  const flux = session.annees.find(a => a.annee === annee)?.monthlyData.flatMap(m => m.flows.filter(f => f.entityId === acteur.id)) ?? []
  const series = [...new Set(flux.map(f => `« ${f.label} » (${f.type})`))]
  if (series.length === 0) return `« ${acteur.name} » n'a aucun flux en ${annee} : vérifiez l'année et l'acteur avec lister_flux.`
  const citees = series.slice(0, SERIES_CITEES).join(", ")
  return `Séries de « ${acteur.name} » en ${annee}, libellé et type exacts : ${citees}${series.length > SERIES_CITEES ? ", …" : ""} (voir lister_flux).`
}

function modifierSerie(c: Chantier, op: OperationDe<"modifier_serie">): void {
  if (op.montant === undefined && op.montantBrut === undefined && op.libelle === undefined) throw new ErreurOutil("Rien à modifier : indiquez montant, montantBrut ou libelle.")
  verifierMontantBrut(op.serie.typeFlux, op.montant, op.montantBrut)
  const changements = { ...(op.montant === undefined ? {} : { amount: op.montant }), ...(op.montantBrut === undefined ? {} : { grossAmount: op.montantBrut }), ...(op.libelle === undefined ? {} : { label: op.libelle }) }
  const estDansLaSerie = dansLaSerie(op.serie)
  surLaSerie(c, op, flux => flux.map(f => (estDansLaSerie(f) ? { ...f, ...changements } : f)))
}

function supprimerSerie(c: Chantier, op: OperationDe<"supprimer_serie">): void {
  const estDansLaSerie = dansLaSerie(op.serie)
  surLaSerie(c, op, flux => flux.filter(f => !estDansLaSerie(f)))
}

function reglerComparateur(c: Chantier, op: OperationDe<"regler_comparateur">): void {
  const activite = trouverActeur(c.session, op.activiteId)
  if (activite.type === "person") throw new ErreurOutil(`« ${activite.name} » est une personne : les réglages du comparateur portent sur une activité.`)
  const { mode, partDistribuee, avecRetraite, remunerationNette, ...autres } = op.reglages
  const avant: ReglagesComparateur = c.session.comparateur?.reglagesParActivite[activite.id] ?? {}
  // Seuls les réglages proposés rejoignent ceux de l'activité ; les autres gardent leur valeur, ou restent absents (ADR 009).
  const partage = sansValeursAbsentes({ mode, partDistribuee, avecRetraite })
  const reglages: ReglagesComparateur = { ...avant, ...sansValeursAbsentes(autres) }
  if (Object.keys(partage).length > 0) reglages.repartition = { mode: "meilleurNet", partDistribuee: 1, ...avant.repartition, ...partage }
  if (remunerationNette !== undefined) reglages.remunerationParAnnee = { ...avant.remunerationParAnnee, [String(anneeDeLaSession(c.session, op.annee))]: remunerationNette }
  const comparateur: Comparateur = { reglagesParActivite: {}, ...c.session.comparateur, ...(op.comparer ? { activiteComparee: activite.id } : {}) }
  c.session = { ...c.session, comparateur: { ...comparateur, reglagesParActivite: { ...comparateur.reglagesParActivite, [activite.id]: reglages } } }
}

const APPLICATIONS: { [T in Operation["type"]]: (c: Chantier, op: OperationDe<T>) => void } = {
  ajouter_annee: ajouterAnnee,
  ajouter_acteur: ajouterActeur,
  modifier_acteur: modifierActeur,
  ajouter_relation: ajouterRelation,
  supprimer_relation: supprimerRelation,
  ajouter_flux: ajouterFlux,
  modifier_serie: modifierSerie,
  supprimer_serie: supprimerSerie,
  regler_comparateur: reglerComparateur
}

/** Une rémunération ou des dividendes sans dirigeant ni associé relié : le moteur ne saurait à qui les verser. */
function verifierRelationsRequises(c: Chantier): void {
  for (const id of c.activitesAVerifier) {
    const flux = c.session.annees.flatMap(a => a.monthlyData.flatMap(m => m.flows)).filter(f => f.entityId === id)
    for (const type of new Set(flux.map(f => f.type))) {
      const requises = RELATIONS_REQUISES[type as keyof typeof RELATIONS_REQUISES]
      if (requises && !c.session.relationships.some(r => (r.fromId === id || r.toId === id) && requises.includes(r.type))) {
        throw new ErreurOutil(`Les flux « ${type} » de « ${c.session.entities.find(e => e.id === id)?.name ?? id} » exigent une relation ${enumerer(requises.map(t => `« ${t} »`), "ou")} avec une personne : proposez-la avec proposer_relation (dans la même proposition), ou retirez ces flux.`)
      }
    }
  }
}

/** « « Loyer » 2026 » : de quoi retrouver l'opération fautive parmi celles de suiteDe et de l'appel. */
function libelleDeLOperation(operation: Operation): string {
  if (operation.type === "ajouter_flux") return ` « ${operation.libelle} » ${operation.annee}`
  if (operation.type === "modifier_serie" || operation.type === "supprimer_serie") return ` « ${operation.serie.libelle} » ${operation.annee}`
  if (operation.type === "ajouter_annee") return ` ${operation.annee}`
  if (operation.type === "ajouter_acteur") return ` « ${operation.nom} »`
  return ""
}

/**
 * Applique les opérations dans l'ordre, sans modifier la session reçue. `graine` rend les identifiants des nouveaux
 * flux déterministes (la même proposition donne toujours la même session). Lève une `ErreurOutil` qui nomme
 * l'opération fautive.
 */
export function appliquerOperations(session: SessionState, operations: Operation[], graine: string): SessionState {
  const pris = new Set(session.annees.flatMap(a => a.monthlyData.flatMap(m => m.flows.map(f => f.id))))
  let compteur = 0
  const nouvelIdDeFlux = () => {
    let id: string
    do id = `flux-${graine}-${++compteur}`
    while (pris.has(id))
    return id
  }
  const chantier: Chantier = { session, nouvelIdDeFlux, activitesAVerifier: new Set() }
  operations.forEach((operation, index) => {
    try {
      ;(APPLICATIONS[operation.type] as (c: Chantier, op: Operation) => void)(chantier, operation)
    } catch (erreur) {
      if (erreur instanceof ErreurOutil) throw new ErreurOutil(`Opération ${index + 1} (${operation.type}${libelleDeLOperation(operation)}) : ${erreur.message}`)
      throw erreur
    }
  })
  verifierRelationsRequises(chantier)
  return chantier.session
}

/** « ajouter_flux « Loyer » 2026 » : une opération désignée pour un modèle. */
export const designationDeLOperation = (operation: Operation): string => `${operation.type}${libelleDeLOperation(operation)}`

/** Une opération que la session ne permet plus, avec son rang dans la proposition (à partir de 1) et la raison. */
export interface OperationRefusee {
  numero: number
  operation: Operation
  raison: string
}

/**
 * Sépare les opérations d'une proposition en celles qui s'appliquent encore à la session, dans leur ordre, et celles
 * qu'elle ne permet plus (série supprimée entre-temps, acteur verrouillé, relation déjà là…). Chaque opération est
 * essayée sur la session obtenue par les précédentes retenues : celles qui dépendent d'une opération refusée le sont
 * aussi. Les relations qu'exigent une rémunération ou des dividendes ne sont pas vérifiées ici, mais quand la
 * proposition reconstruite est validée en entier. Ne modifie pas `session`.
 */
export function operationsApplicables(session: SessionState, operations: Operation[]): { retenues: Operation[]; refusees: OperationRefusee[] } {
  let compteur = 0
  const chantier: Chantier = { session, nouvelIdDeFlux: () => `essai-${++compteur}`, activitesAVerifier: new Set() }
  const retenues: Operation[] = []
  const refusees: OperationRefusee[] = []
  operations.forEach((operation, index) => {
    const avant = chantier.session
    try {
      ;(APPLICATIONS[operation.type] as (c: Chantier, op: Operation) => void)(chantier, operation)
      retenues.push(operation)
    } catch (erreur) {
      if (!(erreur instanceof ErreurOutil)) throw erreur
      chantier.session = avant
      refusees.push({ numero: index + 1, operation, raison: erreur.message })
    }
  })
  return { retenues, refusees }
}
