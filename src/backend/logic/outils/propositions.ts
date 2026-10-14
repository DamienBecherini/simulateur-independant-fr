// src/backend/logic/outils/propositions.ts
// Le modèle propose, l'utilisateur valide. Une proposition est une liste d'opérations typées, construite sur une
// session dont elle porte l'empreinte, avec un résumé en français et l'effet calculé par le moteur sur le net de
// chaque année. La construire ne modifie rien ; l'appliquer rend une nouvelle session, sans toucher à l'ancienne :
// l'hôte (application, serveur MCP) l'enregistre comme une seule étape d'annulation, une fois l'utilisateur d'accord.

import { z } from "zod"
import { SessionStateSchema, type FinancialFlow, type SessionState, type SimulationReport } from "../../../types.js"
import { anneesDeLaSession } from "../annees.js"
import { rapportAvecCorrections, sanitizeStateAndFillDefaults } from "../data-sanitizer.js"
import { eurosEnTexteBrut } from "../format.js"
import { FORMAT_VERSION_ACTUEL } from "../migrations.js"
import { simulerLesAnnees } from "../simulation-pluriannuelle.js"
import { arrondir, empreinte, empreinteDeLaSession, enumerer, ErreurOutil, genreDe, nomDe, phraseDeLaRelation } from "./commun.js"
import { LIMITES } from "./limites.js"
import { appliquerOperations, estUneSuppression, OperationSchema, sessionsAvantChaqueOperation, type Operation } from "./operations.js"
import { problemes } from "./outil.js"

// ===================================================================================
// == PROPOSITION
// ===================================================================================

export const PropositionSchema = z
  .object({
    empreinteSession: z.string().regex(/^[0-9a-f]{16}$/, "Empreinte de session : 16 caractères hexadécimaux, telle que rendue par l'outil de proposition.").describe("Empreinte de la session sur laquelle la proposition a été construite."),
    operations: z.array(OperationSchema).min(1, "Une proposition contient au moins une opération.").max(LIMITES.operationsParProposition, `Une proposition contient au plus ${LIMITES.operationsParProposition} opérations : découpez-la en plusieurs propositions.`)
  })
  .superRefine(({ operations }, ctx) => {
    if (operations.filter(estUneSuppression).length > LIMITES.suppressionsParProposition) ctx.addIssue({ code: "custom", path: ["operations"], message: `Une proposition fait au plus ${LIMITES.suppressionsParProposition} suppressions : découpez-la, ou proposez de repartir de zéro (cible « simulation »).` })
    if (operations.some((o, rang) => o.type === "vider_simulation" && rang > 0)) ctx.addIssue({ code: "custom", path: ["operations"], message: "Repartir de zéro ouvre une proposition : proposez-le sans suiteDe, puis complétez cette proposition (suiteDe) pour reconstruire la simulation." })
    if (operations.filter(o => o.type === "ajouter_acteur").length > LIMITES.acteursParProposition) ctx.addIssue({ code: "custom", path: ["operations"], message: `Une proposition ajoute au plus ${LIMITES.acteursParProposition} acteurs.` })
  })
  .describe("Proposition rendue par un outil proposer_… : passez-la telle quelle (au moins empreinteSession et operations).")

export type Proposition = z.infer<typeof PropositionSchema>

/**
 * Vrai si la proposition supprime quelque chose (série, relation, acteur, année, ou tout) : même quand l'utilisateur
 * laisse l'IA modifier directement la simulation, elle attend son clic (ADR 011, addendum du 2026-10-14).
 */
export const supprimeQuelqueChose = (proposition: Pick<Proposition, "operations">) => proposition.operations.some(estUneSuppression)

/**
 * Une proposition telle que le modèle la renvoie. Son schéma public reste sommaire, pour ne pas répéter le détail des
 * opérations dans la description de chaque outil : elle est validée en entier par `propositionValidee`.
 */
export const PropositionRenvoyeeSchema = z
  .object({ empreinteSession: z.string().max(64), operations: z.array(z.unknown()) })
  .describe("Champ « proposition » du résultat d'un outil proposer_…, tel quel.")

/** La proposition renvoyée par le modèle, validée en entier (opérations et limites). */
export function propositionValidee(brute: unknown): Proposition {
  const verdict = PropositionSchema.safeParse(brute, { error: z.locales.fr().localeError })
  if (!verdict.success) throw new ErreurOutil(`Proposition refusée :\n${problemes(verdict.error)}`)
  return verdict.data
}

/** Paramètre commun aux outils de proposition : compléter une proposition précédente plutôt qu'en ouvrir une autre. */
export const SuiteDeSchema = PropositionRenvoyeeSchema.optional().describe(
  "Proposition précédente (champ « proposition » d'un résultat proposer_…) à compléter, pour tout faire valider en une fois."
)

const ApercuSchema = z.object({ annee: z.number(), netAvant: z.number().nullable(), netApres: z.number().nullable(), ecart: z.number().nullable(), resultatConserveAvant: z.number().nullable(), resultatConserveApres: z.number().nullable(), erreur: z.string().nullable() })

export const ResultatPropositionSchema = z.object({
  proposition: z.object({ empreinteSession: z.string(), operations: z.array(z.unknown()) }),
  recapitulatif: z.string(),
  resume: z.array(z.string()),
  avertissements: z.array(z.string()),
  apercu: z.array(ApercuSchema),
  nouveauxIdentifiants: z.array(z.object({ id: z.string(), nom: z.string() }))
})
type ResultatProposition = z.infer<typeof ResultatPropositionSchema>

/**
 * Applique une proposition à la session sur laquelle elle a été construite, et vérifie la session obtenue comme un
 * fichier relu : schéma de session, puis nettoyage, qui ne doit rien avoir à corriger. Ne modifie pas `session`.
 */
export function sessionApresLaProposition(session: SessionState, proposition: Proposition): SessionState {
  const actuelle = empreinteDeLaSession(session)
  if (proposition.empreinteSession !== actuelle) {
    throw new ErreurOutil(`Proposition périmée : elle a été construite sur une autre version de la simulation (empreinte ${proposition.empreinteSession}, actuelle ${actuelle}). La simulation a changé depuis : appelez rafraichir_proposition avec cette proposition pour la reconstruire sur la simulation actuelle (il dit quelles opérations ne s'appliquent plus), ou relisez la simulation (decrire_simulation, lister_flux) et refaites-la avec les outils proposer_…, sans suiteDe : une proposition périmée ne peut pas être complétée.`)
  }
  const apres = appliquerOperations(session, proposition.operations, empreinte(proposition.operations).slice(0, 8))
  const verdict = SessionStateSchema.safeParse(apres)
  if (!verdict.success) throw new ErreurOutil(`La simulation obtenue serait invalide :\n${problemes(verdict.error)}`)
  const { safeState, report } = sanitizeStateAndFillDefaults({ ...verdict.data, formatVersion: FORMAT_VERSION_ACTUEL })
  if (rapportAvecCorrections(report)) throw new ErreurOutil("La simulation obtenue contiendrait des éléments incohérents (flux ou relation vers un acteur absent, année en double) : proposition refusée.")
  return safeState
}

// ===================================================================================
// == RÉSUMÉ ET APERÇU
// ===================================================================================

/** « 9 600 € », avec des espaces ordinaires : le texte part chez un modèle, qui recopie mal les espaces insécables. */
const euros = eurosEnTexteBrut

const NOMS_DES_MOIS =["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]

export function libelleDesMois(mois: number[] | undefined): string {
  if (!mois || mois.length === 12) return "toute l'année"
  return enumerer([...mois].sort((a, b) => a - b).map(m => NOMS_DES_MOIS[m - 1]))
}

/** Une valeur changée, en texte : « oui », « non », « nouvelles valeurs » pour un objet (ou `null`), sinon la valeur. */
function valeurChangee(valeur: unknown): string {
  if (typeof valeur === "boolean") return valeur ? "oui" : "non"
  if (typeof valeur === "object") return "nouvelles valeurs"
  return String(valeur as string | number | bigint | symbol | undefined)
}

/** « mode → meilleurNet, opteVFL → oui ». */
const changements = (valeurs: Record<string, unknown>) =>
  Object.entries(valeurs)
    .filter(([, v]) => v !== undefined)
    .map(([cle, v]) => `${cle} → ${valeurChangee(v)}`)
    .join(", ")

const eurosOuAbsent = (montant: number | undefined) => (montant === undefined ? undefined : euros(montant))

/** Les flux d'une série dans une année, sur les mois indiqués (tous si absents). */
function fluxDeLaSerie(session: SessionState, annee: number, serie: { acteurId: string; typeFlux: string; libelle: string }, mois?: number[]): FinancialFlow[] {
  const grille = session.annees.find(a => a.annee === annee)?.monthlyData ?? []
  return grille.filter(m => !mois || mois.includes(m.month + 1)).flatMap(m => m.flows.filter(f => f.entityId === serie.acteurId && f.type === serie.typeFlux && f.label === serie.libelle))
}

/** « : mode → meilleurNet » après le nom d'un acteur ajouté, ou rien s'il est ajouté sans réglages. */
const reglagesDeLAjout = (reglages: Record<string, unknown>) => (Object.keys(reglages).length > 0 ? ` : ${changements(reglages)}` : "")

/** La relation supprimée, en phrase si elle existe dans la session de départ, sinon son identifiant. */
function relationSupprimee(avant: SessionState, relationId: string): string {
  const relation = avant.relationships.find(r => r.id === relationId)
  return relation ? phraseDeLaRelation(avant, relation) : relationId
}

/** « en mars 2026 » pour un seul mois ; sinon les mois, le nombre de flux et leur total. */
function moisDesFluxAjoutes(op: Extract<Operation, { type: "ajouter_flux" }>): string {
  return op.mois.length === 1 ? `en ${libelleDesMois(op.mois)} ${op.annee}` : `par mois, ${libelleDesMois(op.mois)} ${op.annee} (${op.mois.length} flux, ${euros(op.montant * op.mois.length)})`
}

/** Ce qu'une suppression retire de la session qu'elle trouve, ce qu'elle emporte avec elle compris. */
interface Retrait {
  acteurs: number
  /** Acteurs verrouillés par l'utilisateur parmi eux : seul « repartir de zéro » en supprime. */
  verrouilles: number
  relations: number
  annees: number
  /** Séries de flux (même acteur, type et libellé dans une année) touchées. */
  series: number
}

const AUCUN_RETRAIT: Retrait = { acteurs: 0, verrouilles: 0, relations: 0, annees: 0, series: 0 }

/** Les flux de la session retenus par `garder`, avec leur année. */
function fluxRetenus(session: SessionState, garder: (annee: number, flux: FinancialFlow) => boolean): { annee: number; flux: FinancialFlow }[] {
  return session.annees.flatMap(a => a.monthlyData.flatMap(m => m.flows.filter(f => garder(a.annee, f)).map(flux => ({ annee: a.annee, flux }))))
}

/** Nombre de séries (même année, acteur, type et libellé) parmi des flux. */
const nombreDeSeries = (flux: { annee: number; flux: FinancialFlow }[]) => new Set(flux.map(({ annee, flux: f }) => `${annee}|${f.entityId}|${f.type}|${f.label}`)).size

const relationsDe = (session: SessionState, acteurId: string) => session.relationships.filter(r => r.fromId === acteurId || r.toId === acteurId)

const fluxDeLActeur = (acteurId: string) => (_: number, f: FinancialFlow) => f.entityId === acteurId
const fluxDeLAnnee = (annee: number) => (a: number) => a === annee

/** La session vierge de l'application, celle que laisse « repartir de zéro ». */
const sessionVierge = () => SessionStateSchema.parse({})

/** Ce que retire une opération de la session qu'elle trouve (`etat`) ; rien pour une opération qui ne supprime pas. */
function retrait(etat: SessionState, op: Operation): Retrait {
  switch (op.type) {
    case "supprimer_serie":
      return { ...AUCUN_RETRAIT, series: 1 }
    case "supprimer_relation":
      return { ...AUCUN_RETRAIT, relations: 1 }
    case "supprimer_acteur":
      return { ...AUCUN_RETRAIT, acteurs: 1, relations: relationsDe(etat, op.acteurId).length, series: nombreDeSeries(fluxRetenus(etat, fluxDeLActeur(op.acteurId))) }
    case "supprimer_annee":
      return { ...AUCUN_RETRAIT, annees: 1, series: nombreDeSeries(fluxRetenus(etat, fluxDeLAnnee(op.annee))) }
    case "vider_simulation": {
      const restantes = new Set(anneesDeLaSession(sessionVierge()))
      return { acteurs: etat.entities.length, verrouilles: etat.entities.filter(e => e.locked).length, relations: etat.relationships.length, annees: etat.annees.filter(a => !restantes.has(a.annee)).length, series: nombreDeSeries(fluxRetenus(etat, () => true)) }
    }
    default:
      return AUCUN_RETRAIT
  }
}

const pluriel = (n: number, mot: string, motAuPluriel = `${mot}s`) => `${n} ${n > 1 ? motAuPluriel : mot}`

/**
 * « 3 séries de flux (36 flux, 2026 et 2027) » ; « aucun flux » s'il n'y en a pas. Sans total : recettes et dépenses
 * mêlées, il ne voudrait rien dire.
 */
function phraseDesSeries(session: SessionState, garder: (annee: number, flux: FinancialFlow) => boolean): string {
  const retenus = fluxRetenus(session, garder)
  if (retenus.length === 0) return "aucun flux"
  return `${pluriel(nombreDeSeries(retenus), "série")} de flux (${retenus.length} flux, ${enumerer([...new Set(retenus.map(r => r.annee))])})`
}

/** Relations citées une à une dans un résumé ; au-delà, leur nombre seul. */
const RELATIONS_CITEES = 5

/** « 2 relations (Julien Martin — Président — Conseil SASU ; …) » ; « aucune relation ». */
function phraseDesRelations(session: SessionState, acteurId: string): string {
  const relations = relationsDe(session, acteurId)
  if (relations.length === 0) return "aucune relation"
  const citees = relations.length <= RELATIONS_CITEES ? ` (${relations.map(r => phraseDeLaRelation(session, r)).join(" ; ")})` : ""
  return `${pluriel(relations.length, "relation")}${citees}`
}

/** « Repartir de zéro… » : tout ce que la simulation perd, les acteurs verrouillés nommés, et ce qui reste. */
function resumerRepartirDeZero(etat: SessionState): string {
  const vierge = sessionVierge()
  const verrouilles = etat.entities.filter(e => e.locked).map(e => `« ${e.name} »`)
  const dont = verrouilles.length > 0 ? ` (dont ${enumerer(verrouilles)}, ${verrouilles.length > 1 ? "verrouillés" : "verrouillé"} par l'utilisateur)` : ""
  const supprimes = [`${pluriel(etat.entities.length, "acteur")}${dont}`, pluriel(etat.relationships.length, "relation"), phraseDesSeries(etat, () => true), "les réglages du comparateur"]
  return `Repartir de zéro, comme « Nouvelle simulation » dans l'application : supprimer ${enumerer(supprimes)}. Il reste l'année ${enumerer(anneesDeLaSession(vierge))}, vide, et le nom « ${vierge.name} ».`
}

/**
 * Une ligne de résumé par opération. `etat` est la session que trouve l'opération : ce qu'une suppression emporte avec
 * elle s'y compte. Les noms viennent de la session obtenue, ou de `etat` pour un acteur supprimé.
 */
function resumer(etat: SessionState, apres: SessionState, op: Operation): string {
  const nom = (id: string) => `« ${nomDe(apres.entities.some(e => e.id === id) ? apres : etat, id)} »`
  switch (op.type) {
    case "ajouter_annee":
      return `Ajouter l'année ${op.annee}, avec une grille vide.`
    case "ajouter_acteur":
      return `Ajouter l'acteur « ${op.nom} » (${op.genre}, identifiant ${op.id})${reglagesDeLAjout(op.reglages)}.`
    case "modifier_acteur":
      return `Modifier ${nom(op.acteurId)} : ${changements({ nom: op.nom, ...op.reglages })}.`
    case "ajouter_relation":
      return `Ajouter la relation ${phraseDeLaRelation(apres, { id: op.id, fromId: op.deId, toId: op.versId, type: op.typeRelation })}.`
    case "ajouter_flux":
      return `Ajouter « ${op.libelle} » (${op.typeFlux}) sur ${nom(op.acteurId)} : ${euros(op.montant)} ${moisDesFluxAjoutes(op)}.`
    case "modifier_serie":
      return `Modifier la série « ${op.serie.libelle} » (${op.serie.typeFlux}) de ${nom(op.serie.acteurId)}, ${libelleDesMois(op.mois)} ${op.annee} : ${changements({ montant: eurosOuAbsent(op.montant), montantBrut: eurosOuAbsent(op.montantBrut), libelle: op.libelle })}.`
    case "regler_comparateur":
      return `Régler le comparateur de ${nom(op.activiteId)}${op.comparer ? ", qui devient l'activité comparée" : ""} : ${changements(op.reglages)}.`
    default:
      return resumerUneSuppression(etat, nom, op)
  }
}

type Suppression = Extract<Operation, { type: "supprimer_serie" | "supprimer_relation" | "supprimer_acteur" | "supprimer_annee" | "vider_simulation" }>

/** La ligne de résumé d'une suppression, avec ce qu'elle emporte : relations et flux d'un acteur, grille d'une année. */
function resumerUneSuppression(etat: SessionState, nom: (id: string) => string, op: Suppression): string {
  switch (op.type) {
    case "supprimer_serie": {
      const supprimes = fluxDeLaSerie(etat, op.annee, op.serie, op.mois)
      const total = supprimes.reduce((somme, f) => somme + f.amount, 0)
      return `Supprimer la série « ${op.serie.libelle} » (${op.serie.typeFlux}) de ${nom(op.serie.acteurId)}, ${libelleDesMois(op.mois)} ${op.annee} (${supprimes.length} flux, ${euros(total)}).`
    }
    case "supprimer_relation":
      return `Supprimer la relation ${relationSupprimee(etat, op.relationId)}.`
    case "supprimer_acteur": {
      const acteur = etat.entities.find(e => e.id === op.acteurId)
      return `Supprimer l'acteur ${nom(op.acteurId)}${acteur ? ` (${genreDe(acteur)})` : ""}, avec ${phraseDesRelations(etat, op.acteurId)} et ${phraseDesSeries(etat, fluxDeLActeur(op.acteurId))}.`
    }
    case "supprimer_annee":
      return `Supprimer l'année ${op.annee} et sa grille : ${phraseDesSeries(etat, fluxDeLAnnee(op.annee))}.`
    case "vider_simulation":
      return resumerRepartirDeZero(etat)
  }
}

/**
 * « supprimer 2 acteurs, 3 relations et 7 séries de flux » : ce que retirent les suppressions, ce qu'elles emportent
 * avec elles compris (relations et flux d'un acteur, grille d'une année) ; « repartir de zéro : supprimer… ». `null`
 * sans suppression.
 */
function phraseDesRetraits(etats: SessionState[], operations: Operation[]): string | null {
  const retraits = operations.map((op, rang) => retrait(etats[rang], op))
  const total = (cle: keyof Retrait) => retraits.reduce((somme, r) => somme + r[cle], 0)
  const verrouilles = total("verrouilles")
  const objets = [
    total("acteurs") > 0 ? `${pluriel(total("acteurs"), "acteur")}${verrouilles > 0 ? ` (dont ${verrouilles} ${verrouilles > 1 ? "verrouillés" : "verrouillé"})` : ""}` : null,
    total("relations") > 0 ? pluriel(total("relations"), "relation") : null,
    total("annees") > 0 ? pluriel(total("annees"), "année") : null,
    total("series") > 0 ? `${pluriel(total("series"), "série")} de flux` : null
  ].filter((p): p is string => p !== null)
  const supprimer = objets.length > 0 ? `supprimer ${enumerer(objets)}` : null
  if (operations[0]?.type === "vider_simulation") return supprimer ? `repartir de zéro : ${supprimer}` : "repartir de zéro"
  return supprimer
}

/**
 * « Ajouter 24 flux, ajouter 1 acteur et ajouter 1 relation ? » : ce que l'hôte demande à l'utilisateur de valider. Les
 * suppressions viennent d'abord, détaillées : « Supprimer 1 acteur et 3 séries de flux ; ajouter 12 flux ? »,
 * « Repartir de zéro : supprimer 4 acteurs (dont 1 verrouillé)…, puis ajouter 1 acteur ? ». `etats` : la session que
 * trouve chaque opération.
 */
function recapituler(etats: SessionState[], operations: Operation[]): string {
  const compter = (types: Operation["type"][]) => operations.filter(o => types.includes(o.type)).length
  const flux = operations.reduce((total, o) => total + (o.type === "ajouter_flux" ? o.mois.length : 0), 0)
  const parties = [
    flux > 0 ? `ajouter ${flux} flux` : null,
    compter(["ajouter_acteur"]) > 0 ? `ajouter ${pluriel(compter(["ajouter_acteur"]), "acteur")}` : null,
    compter(["ajouter_relation"]) > 0 ? `ajouter ${pluriel(compter(["ajouter_relation"]), "relation")}` : null,
    compter(["ajouter_annee"]) > 0 ? `ajouter ${pluriel(compter(["ajouter_annee"]), "année")}` : null,
    compter(["modifier_acteur", "modifier_serie", "regler_comparateur"]) > 0 ? `faire ${pluriel(compter(["modifier_acteur", "modifier_serie", "regler_comparateur"]), "modification")}` : null
  ].filter((p): p is string => p !== null)
  const retraits = phraseDesRetraits(etats, operations)
  const separateur = operations[0]?.type === "vider_simulation" ? ", puis " : " ; "
  const texte = [retraits, parties.length > 0 ? enumerer(parties) : null].filter((p): p is string => p !== null).join(separateur)
  return `${texte.charAt(0).toUpperCase()}${texte.slice(1)} ?`
}

/**
 * Flux proposés identiques (acteur, type, libellé, montant) à un flux déjà saisi le même mois : un doublon probable.
 * Seuls comptent les flux saisis encore là quand vient l'ajout : après « repartir de zéro », plus aucun.
 */
function doublons(avant: SessionState, etats: SessionState[], operations: Operation[]): string[] {
  const saisis = new Set(avant.annees.flatMap(a => a.monthlyData.flatMap(m => m.flows)))
  return operations.flatMap((op, rang) => {
    if (op.type !== "ajouter_flux") return []
    const grille = etats[rang].annees.find(a => a.annee === op.annee)?.monthlyData
    const mois = op.mois.filter(m => grille?.[m - 1].flows.some(f => saisis.has(f) && f.entityId === op.acteurId && f.type === op.typeFlux && f.label === op.libelle && f.amount === op.montant))
    return mois.length > 0 ? [`« ${op.libelle} » (${euros(op.montant)}) existe déjà sur « ${nomDe(avant, op.acteurId)} » en ${libelleDesMois(mois)} ${op.annee} : doublon probable.`] : []
  })
}

/** Repartir de zéro supprime aussi les acteurs verrouillés, ce que ne fait aucune autre opération : l'avertissement les nomme. */
function acteursVerrouillesSupprimes(avant: SessionState, operations: Operation[]): string[] {
  if (operations[0]?.type !== "vider_simulation") return []
  const verrouilles = avant.entities.filter(e => e.locked).map(e => `« ${e.name} »`)
  if (verrouilles.length === 0) return []
  return [`Repartir de zéro supprime aussi ${enumerer(verrouilles)}, que l'utilisateur a ${verrouilles.length > 1 ? "verrouillés" : "verrouillé"} : vérifiez avec lui que c'est bien voulu.`]
}

/** Séries citées par avertissement : de quoi reconnaître une estimation à remplacer, sans allonger la réponse. */
const SERIES_CITEES = 5

/**
 * Flux ajoutés à un acteur qui a déjà, la même année, d'autres séries du même type (une estimation « Prestations »
 * quand arrivent les factures, par exemple) : ils s'additionnent. Les séries supprimées par la proposition ne comptent pas.
 */
function seriesExistantes(apres: SessionState, operations: Operation[]): string[] {
  const ajouts = operations.filter((op): op is Extract<Operation, { type: "ajouter_flux" }> => op.type === "ajouter_flux")
  const groupes = new Map<string, { annee: number; acteurId: string; typeFlux: string; libelles: Set<string> }>()
  for (const op of ajouts) {
    const cle = `${op.annee}|${op.acteurId}|${op.typeFlux}`
    const groupe = groupes.get(cle) ?? { annee: op.annee, acteurId: op.acteurId, typeFlux: op.typeFlux, libelles: new Set<string>() }
    groupe.libelles.add(op.libelle)
    groupes.set(cle, groupe)
  }
  return [...groupes.values()].flatMap(({ annee, acteurId, typeFlux, libelles }) => {
    const totaux = new Map<string, number>()
    for (const f of apres.annees.find(a => a.annee === annee)?.monthlyData.flatMap(m => m.flows) ?? []) {
      if (f.entityId === acteurId && f.type === typeFlux && !libelles.has(f.label)) totaux.set(f.label, (totaux.get(f.label) ?? 0) + f.amount)
    }
    if (totaux.size === 0) return []
    const series = [...totaux].slice(0, SERIES_CITEES).map(([libelle, total]) => `« ${libelle} » (${euros(total)})`)
    const suite = totaux.size > SERIES_CITEES ? ", …" : ""
    return [`Ces flux s'ajoutent à ceux déjà saisis sur « ${nomDe(apres, acteurId)} » en ${annee} (${typeFlux}) : ${series.join(", ")}${suite}. S'ils les remplacent, proposez aussi de supprimer ou de modifier ces séries.`]
  })
}

/** Les avertissements du moteur pour une année : ceux de l'année, de chaque activité (avec son nom) et de chaque foyer. */
function avertissementsDuRapport(report: SimulationReport | null | undefined): string[] {
  if (!report) return []
  const textes = [...report.avertissements, ...report.activities.flatMap(a => a.warnings.map(w => `« ${a.name} » : ${w}`)), ...report.foyers.flatMap(f => f.warnings)]
  // Espaces ordinaires, comme dans le résumé : le moteur écrit les montants avec des espaces insécables.
  return textes.map(texte => texte.replace(/\s/g, " "))
}

/** Net après impôts et résultat conservé d'une année, arrondis ; `null` pour une année absente ou impossible à simuler. */
function chiffresCles(report: SimulationReport | null | undefined): { net: number | null; conserve: number | null } {
  return report ? { net: arrondir(report.totalNetApresImpots), conserve: arrondir(report.bilan.resultatConserve) } : { net: null, conserve: null }
}

type Apercu = z.infer<typeof ApercuSchema>

/**
 * Pour chaque année : le net après impôts et le résultat conservé, avant et après la proposition, et les avertissements
 * du moteur que la proposition fait apparaître (dividendes plafonnés, seuil de la micro-entreprise dépassé…).
 */
function effetsSurLesAnnees(avant: SessionState, apres: SessionState): { apercu: Apercu[]; nouveauxAvertissements: string[] } {
  const rapportsAvant = new Map(simulerLesAnnees(avant).annees.map(a => [a.annee, a.report]))
  const annees = simulerLesAnnees(apres).annees.map(({ annee, report, erreur }) => {
    const a = chiffresCles(rapportsAvant.get(annee))
    const b = chiffresCles(report)
    const dejaLa = new Set(avertissementsDuRapport(rapportsAvant.get(annee)))
    const nouveaux = avertissementsDuRapport(report).filter(texte => !dejaLa.has(texte)).map(texte => `${annee} : ${texte}`)
    return { apercu: { annee, netAvant: a.net, netApres: b.net, ecart: a.net === null || b.net === null ? null : b.net - a.net, resultatConserveAvant: a.conserve, resultatConserveApres: b.conserve, erreur }, nouveaux }
  })
  // Une année supprimée garde sa ligne, sans chiffres après : l'utilisateur voit ce qu'il perd.
  const restantes = new Set(anneesDeLaSession(apres))
  const supprimees = [...rapportsAvant].flatMap(([annee, report]): Apercu[] => {
    if (restantes.has(annee)) return []
    const a = chiffresCles(report)
    return [{ annee, netAvant: a.net, netApres: null, ecart: null, resultatConserveAvant: a.conserve, resultatConserveApres: null, erreur: "Année supprimée par la proposition." }]
  })
  const lignes = [...annees.map(a => a.apercu), ...supprimees].sort((x, y) => x.annee - y.annee)
  return { apercu: lignes, nouveauxAvertissements: [...new Set(annees.flatMap(a => a.nouveaux))] }
}

/** Net après impôts et résultat conservé de chaque année, avant et après la proposition, calculés par le moteur. */
export function apercu(avant: SessionState, apres: SessionState): Apercu[] {
  return effetsSurLesAnnees(avant, apres).apercu
}

/**
 * Ce que l'hôte montre à l'utilisateur pour une proposition : récapitulatif, résumé, avertissements (doublons probables,
 * séries existantes auxquelles les flux s'ajoutent, avertissements du moteur nouveaux) et effet sur le net.
 */
export function presenterProposition(avant: SessionState, apres: SessionState, operations: Operation[]): Omit<ResultatProposition, "proposition" | "nouveauxIdentifiants"> {
  const effets = effetsSurLesAnnees(avant, apres)
  const etats = sessionsAvantChaqueOperation(avant, operations)
  return {
    recapitulatif: recapituler(etats, operations),
    resume: operations.map((op, rang) => resumer(etats[rang], apres, op)),
    avertissements: [...acteursVerrouillesSupprimes(avant, operations), ...doublons(avant, etats, operations), ...seriesExistantes(apres, operations), ...effets.nouveauxAvertissements],
    apercu: effets.apercu
  }
}

/**
 * Construit une proposition : les opérations de `suiteDe`, puis les nouvelles, validées en les appliquant à une copie
 * de la session. Lève une `ErreurOutil` si une opération est refusée, si les limites sont dépassées ou si `suiteDe`
 * a été construite sur une autre version de la session.
 */
export function construireProposition(session: SessionState, suiteDe: Proposition | undefined, nouvelles: Operation[]): ResultatProposition {
  const proposition = propositionValidee({ empreinteSession: suiteDe?.empreinteSession ?? empreinteDeLaSession(session), operations: [...(suiteDe?.operations ?? []), ...nouvelles] })
  const apres = sessionApresLaProposition(session, proposition)
  const nouveauxIdentifiants = proposition.operations.flatMap(op => (op.type === "ajouter_acteur" ? [{ id: op.id, nom: op.nom }] : op.type === "ajouter_relation" ? [{ id: op.id, nom: phraseDeLaRelation(apres, { id: op.id, fromId: op.deId, toId: op.versId, type: op.typeRelation }) }] : []))
  return { proposition, ...presenterProposition(session, apres, proposition.operations), nouveauxIdentifiants }
}

/**
 * Un identifiant libre pour un acteur ou une relation proposés : préfixe, début de l'empreinte de la session et rang,
 * déterministe et distinct des identifiants de la session et de ceux déjà proposés.
 */
export function identifiantLibre(session: SessionState, suiteDe: Proposition | undefined, prefixe: string): string {
  const pris = new Set([...session.entities.map(e => e.id), ...session.relationships.map(r => r.id), ...(suiteDe?.operations ?? []).flatMap(op => ("id" in op ? [op.id] : []))])
  const graine = (suiteDe?.empreinteSession ?? empreinteDeLaSession(session)).slice(0, 6)
  let rang = 1
  while (pris.has(`${prefixe}-${graine}-${rang}`)) rang++
  return `${prefixe}-${graine}-${rang}`
}
