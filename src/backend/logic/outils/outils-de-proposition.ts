// src/backend/logic/outils/outils-de-proposition.ts
// Les outils qui proposent une modification de la simulation, et celui qui applique une proposition validée.
// Proposer ne modifie jamais la session ; appliquer rend une nouvelle session à l'hôte, qui ne l'enregistre qu'avec
// l'accord de l'utilisateur.

import { z } from "zod"
import { RelationshipSchema, type SessionState } from "../../../types.js"
import { empreinteDeLaSession, GENRES_D_ACTEUR, SENS_DES_TYPES, TYPES_DE_FLUX, type GenreDActeur } from "./commun.js"
import { AnneeSchema, IdentifiantSchema, LibelleSchema, LIMITES, ListeDeMoisSchema, MontantSchema, NomSchema } from "./limites.js"
import { ReglagesActeurSchema, ReglagesComparateurProposesSchema, SerieSchema, type Operation } from "./operations.js"
import { definirOutil, resultatSeul } from "./outil.js"
import { construireProposition, identifiantLibre, presenterProposition, PropositionRenvoyeeSchema, propositionValidee, ResultatPropositionSchema, sessionApresLaProposition, SuiteDeSchema, type Proposition } from "./propositions.js"

/**
 * Construit la proposition d'un outil : la proposition précédente (`suiteDe`, validée en entier), puis les opérations
 * de cet appel, qui peuvent dépendre de celles déjà proposées (identifiants libres, années déjà ajoutées).
 */
function proposer(session: SessionState, suiteDe: unknown, operations: (suite: Proposition | undefined) => Operation[]) {
  const suite = suiteDe === undefined ? undefined : propositionValidee(suiteDe)
  return resultatSeul(construireProposition(session, suite, operations(suite)))
}

const RAPPEL_VALIDATION = "Ne modifie rien : rend une proposition (opérations, résumé en français, effet calculé par le moteur sur le net de chaque année) à montrer à l'utilisateur, qui la valide ou non. Pour plusieurs ajouts liés, passez la proposition rendue dans « suiteDe » de l'appel suivant, puis faites valider l'ensemble."

const TYPES_EXPLIQUES = TYPES_DE_FLUX.map(type => `${type} : ${SENS_DES_TYPES[type]}`).join(" ; ")

/** Les années à ajouter avant des flux sur des années absentes, dans l'ordre qui les garde consécutives. */
function anneesAAjouter(session: SessionState, suiteDe: Proposition | undefined, annees: number[]): Operation[] {
  const connues = new Set([...session.annees.map(a => a.annee), ...(suiteDe?.operations ?? []).flatMap(op => (op.type === "ajouter_annee" ? [op.annee] : []))])
  const premiere = Math.min(...connues)
  const manquantes = [...new Set(annees.filter(a => !connues.has(a)))]
  const apres = manquantes.filter(a => a > premiere).sort((a, b) => a - b)
  const avant = manquantes.filter(a => a < premiere).sort((a, b) => b - a)
  return [...apres, ...avant].map(annee => ({ type: "ajouter_annee", annee }))
}

// ===================================================================================
// == proposer_flux
// ===================================================================================

const FluxProposeSchema = z.strictObject({
  annee: AnneeSchema,
  acteurId: IdentifiantSchema.describe("Identifiant de l'acteur qui porte le flux (decrire_simulation, ou un acteur proposé dans suiteDe)."),
  typeFlux: z.enum(TYPES_DE_FLUX).describe("Type du flux (voir la description de l'outil)."),
  libelle: LibelleSchema,
  montant: MontantSchema.describe(`Montant de chaque mois, en euros, positif (le type dit si c'est un revenu ou une dépense) : hors taxe pour le chiffre d'affaires et les charges, net pour un salaire ou une rémunération. Au plus ${LIMITES.montantMaximal.toLocaleString("fr-FR")} €.`),
  montantBrut: MontantSchema.optional().describe("Salaire (salary) seulement : brut mensuel, au moins égal au net."),
  mois: ListeDeMoisSchema
})

export const proposerFlux = definirOutil({
  nom: "proposer_flux",
  titre: "Proposer des flux",
  description: [
    "Propose d'ajouter des flux à la grille mensuelle : chiffre d'affaires d'une facture, charges, salaires, rémunération du dirigeant, dividendes…",
    "Chaque élément de « flux » est une série : un acteur, un type, un libellé et un montant mensuel, répété sur les mois indiqués d'une année (un mois seul pour une facture ponctuelle, [1,…,12] pour un loyer mensuel).",
    "Une année absente de la simulation est ajoutée si elle suit ou précède les années existantes.",
    `Types : ${TYPES_EXPLIQUES}.`,
    `Au plus ${LIMITES.operationsParProposition} séries par proposition, ${LIMITES.longueurLibelle} caractères par libellé. Les flux identiques à un flux déjà saisi le même mois sont signalés comme doublons probables.`,
    RAPPEL_VALIDATION
  ].join(" "),
  lecture: false,
  parametres: z.strictObject({ flux: z.array(FluxProposeSchema).min(1).max(LIMITES.operationsParProposition), suiteDe: SuiteDeSchema }),
  resultat: ResultatPropositionSchema,
  executer: (session, { flux, suiteDe }) =>
    proposer(session, suiteDe, suite => [...anneesAAjouter(session, suite, flux.map(f => f.annee)), ...flux.map((f): Operation => ({ type: "ajouter_flux", ...f }))])
})

// ===================================================================================
// == proposer_acteur
// ===================================================================================

const PREFIXES: Record<GenreDActeur, string> = { personne: "person", SASU: "company", EURL: "company", EI: "company", "micro-entreprise": "micro" }

export const proposerActeur = definirOutil({
  nom: "proposer_acteur",
  titre: "Proposer un acteur",
  description: [
    "Propose d'ajouter un acteur : une personne (membre du foyer), ou une activité (SASU, EURL, EI au réel, micro-entreprise).",
    "Réglages possibles selon le genre : partsFiscales (personne), capitalSocial (SASU, EURL), dateDeCreation « AAAA-MM » (activités), beneficieACRE, opteVFL, rfrN2, horsPlafondAnneePrecedente (micro-entreprise).",
    "L'identifiant du nouvel acteur est dans « nouveauxIdentifiants » : utilisez-le, avec suiteDe, pour proposer ses relations (proposer_relation : une activité doit être reliée à la personne qui la dirige ou en est titulaire) et ses flux.",
    `Au plus ${LIMITES.acteursParProposition} acteurs par proposition. Aucun outil ne supprime un acteur.`,
    RAPPEL_VALIDATION
  ].join(" "),
  lecture: false,
  parametres: z.strictObject({ genre: z.enum(GENRES_D_ACTEUR).describe("personne, SASU, EURL, EI (entreprise individuelle au réel) ou micro-entreprise."), nom: NomSchema, reglages: ReglagesActeurSchema.optional(), suiteDe: SuiteDeSchema }),
  resultat: ResultatPropositionSchema,
  executer: (session, { genre, nom, reglages, suiteDe }) => proposer(session, suiteDe, suite => [{ type: "ajouter_acteur", id: identifiantLibre(session, suite, PREFIXES[genre]), genre, nom, reglages: reglages ?? {} }])
})

// ===================================================================================
// == proposer_relation
// ===================================================================================

export const proposerRelation = definirOutil({
  nom: "proposer_relation",
  titre: "Proposer une relation",
  description: [
    "Propose une relation entre deux acteurs, toujours depuis une personne (deId).",
    "Entre deux personnes, un seul lien : Marié(e), PACSé(e) (imposition commune), En couple (union libre, foyers distincts) ou Enfant (deId = le parent, versId = l'enfant à charge).",
    "D'une personne vers une activité : Président (SASU), Gérant (EURL), Titulaire (EI, micro-entreprise), Associé (SASU, EURL), Salarié (SASU, EURL, EI ; jamais avec une relation de direction).",
    "Une rémunération de dirigeant exige un Président ou un Gérant ; des dividendes, un Président, un Gérant ou un Associé.",
    RAPPEL_VALIDATION
  ].join(" "),
  lecture: false,
  parametres: z.strictObject({ deId: IdentifiantSchema.describe("Identifiant de la personne d'où part la relation."), versId: IdentifiantSchema.describe("Identifiant de l'autre personne ou de l'activité."), typeRelation: RelationshipSchema.shape.type, suiteDe: SuiteDeSchema }),
  resultat: ResultatPropositionSchema,
  executer: (session, { deId, versId, typeRelation, suiteDe }) => proposer(session, suiteDe, suite => [{ type: "ajouter_relation", id: identifiantLibre(session, suite, "rel"), deId, versId, typeRelation }])
})

// ===================================================================================
// == proposer_modification
// ===================================================================================

const ModificationSchema = z.discriminatedUnion("cible", [
  z.strictObject({
    cible: z.literal("serie"),
    annee: AnneeSchema,
    serie: SerieSchema.describe("La série à modifier, telle que lister_flux la donne."),
    mois: ListeDeMoisSchema.optional().describe("Mois à modifier ; tous les mois de la série si absent."),
    montant: MontantSchema.optional().describe("Nouveau montant mensuel, en euros."),
    montantBrut: MontantSchema.optional().describe("Salaire seulement : nouveau brut mensuel."),
    libelle: LibelleSchema.optional().describe("Nouveau libellé.")
  }),
  z.strictObject({ cible: z.literal("acteur"), acteurId: IdentifiantSchema, nom: NomSchema.optional().describe("Nouveau nom."), reglages: ReglagesActeurSchema.optional() })
])

export const proposerModification = definirOutil({
  nom: "proposer_modification",
  titre: "Proposer des modifications",
  description: [
    "Propose de modifier des séries de flux existantes (montant, brut d'un salaire, libellé ; sur tous les mois de la série ou certains, par exemple une hausse de loyer à partir de juillet) ou les réglages d'acteurs (nom, parts fiscales, capital, date de création, ACRE, versement libératoire, revenu fiscal de référence N-2).",
    "Une série est désignée par son année, son acteur, son type et son libellé exacts, tels que lister_flux les donne. Un acteur verrouillé par l'utilisateur n'est jamais modifié. Le statut juridique d'une activité ne se change pas ici : comparez plutôt les statuts avec comparer_statuts.",
    "Au plus 50 modifications par appel.",
    RAPPEL_VALIDATION
  ].join(" "),
  lecture: false,
  parametres: z.strictObject({ modifications: z.array(ModificationSchema).min(1).max(50), suiteDe: SuiteDeSchema }),
  resultat: ResultatPropositionSchema,
  executer: (session, { modifications, suiteDe }) =>
    proposer(session, suiteDe, () => modifications.map((m): Operation => (m.cible === "serie" ? { type: "modifier_serie", annee: m.annee, serie: m.serie, mois: m.mois, montant: m.montant, montantBrut: m.montantBrut, libelle: m.libelle } : { type: "modifier_acteur", acteurId: m.acteurId, nom: m.nom, reglages: m.reglages ?? {} })))
})

// ===================================================================================
// == proposer_suppression
// ===================================================================================

export const proposerSuppression = definirOutil({
  nom: "proposer_suppression",
  titre: "Proposer une suppression",
  description: [
    "Propose de supprimer UNE série de flux d'une année (tous ses mois, ou ceux indiqués), ou UNE relation.",
    `Une proposition contient au plus ${LIMITES.suppressionsParProposition} suppression : pas de suppression en masse, et aucun outil ne supprime un acteur ou une année (l'utilisateur le fait lui-même dans l'application).`,
    "Une relation dont dépendent une rémunération ou des dividendes ne peut être supprimée qu'avec ces flux.",
    RAPPEL_VALIDATION
  ].join(" "),
  lecture: false,
  parametres: z.strictObject({
    suppression: z.discriminatedUnion("cible", [z.strictObject({ cible: z.literal("serie"), annee: AnneeSchema, serie: SerieSchema, mois: ListeDeMoisSchema.optional() }), z.strictObject({ cible: z.literal("relation"), relationId: IdentifiantSchema })]),
    suiteDe: SuiteDeSchema
  }),
  resultat: ResultatPropositionSchema,
  executer: (session, { suppression, suiteDe }) =>
    proposer(session, suiteDe, () => [suppression.cible === "relation" ? { type: "supprimer_relation", relationId: suppression.relationId } : { type: "supprimer_serie", annee: suppression.annee, serie: suppression.serie, mois: suppression.mois }])
})

// ===================================================================================
// == proposer_reglages_comparateur
// ===================================================================================

export const proposerReglagesComparateur = definirOutil({
  nom: "proposer_reglages_comparateur",
  titre: "Proposer des réglages du comparateur",
  description: [
    "Propose d'enregistrer des réglages du comparateur de statuts pour une activité, ceux que comparer_statuts et l'application utilisent ensuite : partage du bénéfice en SASU et EURL (mode, partDistribuee, avecRetraite), rémunération nette annuelle saisie pour une année, part BNC des prestations, frais de fonctionnement par statut, statut étudié.",
    "Seuls les réglages indiqués changent ; les autres gardent leur valeur. « comparer » (vrai par défaut) ouvre cette activité dans le comparateur.",
    RAPPEL_VALIDATION
  ].join(" "),
  lecture: false,
  parametres: z.strictObject({
    activiteId: IdentifiantSchema,
    annee: AnneeSchema.optional().describe("Année de la rémunération saisie ; par défaut, la plus récente de la simulation."),
    comparer: z.boolean().default(true),
    reglages: ReglagesComparateurProposesSchema,
    suiteDe: SuiteDeSchema
  }),
  resultat: ResultatPropositionSchema,
  executer: (session, { activiteId, annee, comparer, reglages, suiteDe }) => proposer(session, suiteDe, () => [{ type: "regler_comparateur", activiteId, annee, comparer, reglages }])
})

// ===================================================================================
// == appliquer_proposition
// ===================================================================================

export const appliquerProposition = definirOutil({
  nom: "appliquer_proposition",
  titre: "Appliquer une proposition validée",
  description: [
    "Applique une proposition rendue par un outil proposer_…, telle quelle, APRÈS que l'utilisateur l'a acceptée. L'application peut encore lui demander confirmation ; tout s'annule ensuite en une étape.",
    "Refusée si la simulation a changé depuis la proposition (empreinte différente) : relisez alors la simulation et refaites la proposition. Toutes les vérifications sont refaites : une proposition modifiée à la main est contrôlée comme une nouvelle.",
    "Rend le récapitulatif de ce qui a été appliqué, l'effet sur le net de chaque année et la nouvelle empreinte de la simulation."
  ].join(" "),
  lecture: false,
  parametres: z.strictObject({ proposition: PropositionRenvoyeeSchema }),
  resultat: z.object({ appliquee: z.literal(true), empreinte: z.string(), recapitulatif: z.string(), resume: z.array(z.string()), apercu: ResultatPropositionSchema.shape.apercu }),
  executer: (session, parametres) => {
    const proposition = propositionValidee(parametres.proposition)
    const nouvelleSession = sessionApresLaProposition(session, proposition)
    const { recapitulatif, resume, apercu } = presenterProposition(session, nouvelleSession, proposition.operations)
    return { resultat: { appliquee: true as const, empreinte: empreinteDeLaSession(nouvelleSession), recapitulatif, resume, apercu }, nouvelleSession }
  }
})
