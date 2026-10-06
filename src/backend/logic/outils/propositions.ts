// src/backend/logic/outils/propositions.ts
// Le modèle propose, l'utilisateur valide. Une proposition est une liste d'opérations typées, construite sur une
// session dont elle porte l'empreinte, avec un résumé en français et l'effet calculé par le moteur sur le net de
// chaque année. La construire ne modifie rien ; l'appliquer rend une nouvelle session, sans toucher à l'ancienne :
// l'hôte (application, serveur MCP) l'enregistre comme une seule étape d'annulation, une fois l'utilisateur d'accord.

import { z } from "zod"
import { SessionStateSchema, type FinancialFlow, type SessionState, type SimulationReport } from "../../../types.js"
import { rapportAvecCorrections, sanitizeStateAndFillDefaults } from "../data-sanitizer.js"
import { euros as eurosDuMoteur } from "../format.js"
import { FORMAT_VERSION_ACTUEL } from "../migrations.js"
import { simulerLesAnnees } from "../simulation-pluriannuelle.js"
import { arrondir, empreinte, empreinteDeLaSession, enumerer, ErreurOutil, nomDe, phraseDeLaRelation } from "./commun.js"
import { LIMITES } from "./limites.js"
import { appliquerOperations, estUneSuppression, OperationSchema, type Operation } from "./operations.js"
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
    if (operations.filter(estUneSuppression).length > LIMITES.suppressionsParProposition) ctx.addIssue({ code: "custom", path: ["operations"], message: `Une proposition supprime au plus ${LIMITES.suppressionsParProposition} élément (une série de flux d'une année, ou une relation) : pas de suppression en masse.` })
    if (operations.filter(o => o.type === "ajouter_acteur").length > LIMITES.acteursParProposition) ctx.addIssue({ code: "custom", path: ["operations"], message: `Une proposition ajoute au plus ${LIMITES.acteursParProposition} acteurs.` })
  })
  .describe("Proposition rendue par un outil proposer_… : passez-la telle quelle (au moins empreinteSession et operations).")

export type Proposition = z.infer<typeof PropositionSchema>

/**
 * Une proposition telle que le modèle la renvoie. Son schéma public reste sommaire, pour ne pas répéter le détail des
 * opérations dans la description de chaque outil : elle est validée en entier par `propositionValidee`.
 */
export const PropositionRenvoyeeSchema = z
  .object({ empreinteSession: z.string().max(64), operations: z.array(z.record(z.string(), z.unknown())) })
  .describe("Proposition rendue par un outil proposer_… (champ « proposition » de son résultat), renvoyée telle quelle.")

/** La proposition renvoyée par le modèle, validée en entier (opérations et limites). */
export function propositionValidee(brute: unknown): Proposition {
  const verdict = PropositionSchema.safeParse(brute, { error: z.locales.fr().localeError })
  if (!verdict.success) throw new ErreurOutil(`Proposition refusée :\n${problemes(verdict.error)}`)
  return verdict.data
}

/** Paramètre commun aux outils de proposition : compléter une proposition précédente plutôt qu'en ouvrir une autre. */
export const SuiteDeSchema = PropositionRenvoyeeSchema.optional().describe(
  "Proposition précédente à compléter (champ « proposition » du résultat d'un outil proposer_…) : ses opérations sont reprises, puis celles-ci ajoutées, pour que l'utilisateur valide le tout en une fois. Indispensable pour ajouter des flux ou des relations à un acteur proposé mais pas encore appliqué."
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
    throw new ErreurOutil(`Proposition périmée : elle a été construite sur une autre version de la simulation (empreinte ${proposition.empreinteSession}, actuelle ${actuelle}). La simulation a changé depuis ; relisez-la (decrire_simulation, lister_flux) et refaites la proposition en rappelant les outils proposer_…, sans suiteDe : une proposition périmée ne peut pas être complétée.`)
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
const euros = (montant: number) => eurosDuMoteur(montant).replace(/\s/g, " ")

const NOMS_DES_MOIS =["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]

export function libelleDesMois(mois: number[] | undefined): string {
  if (!mois || mois.length === 12) return "toute l'année"
  return enumerer([...mois].sort((a, b) => a - b).map(m => NOMS_DES_MOIS[m - 1]))
}

/** « mode → meilleurNet, opteVFL → oui ». */
const changements = (valeurs: Record<string, unknown>) =>
  Object.entries(valeurs)
    .filter(([, v]) => v !== undefined)
    .map(([cle, v]) => `${cle} → ${typeof v === "boolean" ? (v ? "oui" : "non") : typeof v === "object" ? "nouvelles valeurs" : String(v)}`)
    .join(", ")

const eurosOuAbsent = (montant: number | undefined) => (montant === undefined ? undefined : euros(montant))

/** Les flux d'une série dans une année, sur les mois indiqués (tous si absents). */
function fluxDeLaSerie(session: SessionState, annee: number, serie: { acteurId: string; typeFlux: string; libelle: string }, mois?: number[]): FinancialFlow[] {
  const grille = session.annees.find(a => a.annee === annee)?.monthlyData ?? []
  return grille.filter(m => !mois || mois.includes(m.month + 1)).flatMap(m => m.flows.filter(f => f.entityId === serie.acteurId && f.type === serie.typeFlux && f.label === serie.libelle))
}

/** Une ligne de résumé par opération, avec les noms des acteurs de la session obtenue (tous y sont encore). */
function resumer(avant: SessionState, apres: SessionState, op: Operation): string {
  const nom = (id: string) => `« ${nomDe(apres, id)} »`
  switch (op.type) {
    case "ajouter_annee":
      return `Ajouter l'année ${op.annee}, avec une grille vide.`
    case "ajouter_acteur":
      return `Ajouter l'acteur « ${op.nom} » (${op.genre}, identifiant ${op.id})${Object.keys(op.reglages).length > 0 ? ` : ${changements(op.reglages)}` : ""}.`
    case "modifier_acteur":
      return `Modifier ${nom(op.acteurId)} : ${changements({ nom: op.nom, ...op.reglages })}.`
    case "ajouter_relation":
      return `Ajouter la relation ${phraseDeLaRelation(apres, { id: op.id, fromId: op.deId, toId: op.versId, type: op.typeRelation })}.`
    case "supprimer_relation": {
      const relation = avant.relationships.find(r => r.id === op.relationId)
      return `Supprimer la relation ${relation ? phraseDeLaRelation(avant, relation) : op.relationId}.`
    }
    case "ajouter_flux": {
      const quand = op.mois.length === 1 ? `en ${libelleDesMois(op.mois)} ${op.annee}` : `par mois, ${libelleDesMois(op.mois)} ${op.annee} (${op.mois.length} flux, ${euros(op.montant * op.mois.length)})`
      return `Ajouter « ${op.libelle} » (${op.typeFlux}) sur ${nom(op.acteurId)} : ${euros(op.montant)} ${quand}.`
    }
    case "modifier_serie":
      return `Modifier la série « ${op.serie.libelle} » (${op.serie.typeFlux}) de ${nom(op.serie.acteurId)}, ${libelleDesMois(op.mois)} ${op.annee} : ${changements({ montant: eurosOuAbsent(op.montant), montantBrut: eurosOuAbsent(op.montantBrut), libelle: op.libelle })}.`
    case "supprimer_serie": {
      const supprimes = fluxDeLaSerie(avant, op.annee, op.serie, op.mois)
      const total = supprimes.reduce((somme, f) => somme + f.amount, 0)
      return `Supprimer la série « ${op.serie.libelle} » (${op.serie.typeFlux}) de ${nom(op.serie.acteurId)}, ${libelleDesMois(op.mois)} ${op.annee} (${supprimes.length} flux, ${euros(total)}).`
    }
    case "regler_comparateur":
      return `Régler le comparateur de ${nom(op.activiteId)}${op.comparer ? ", qui devient l'activité comparée" : ""} : ${changements(op.reglages)}.`
  }
}

/** « Appliquer 24 flux, 1 acteur et 1 relation ? » : ce que l'hôte demande à l'utilisateur de valider. */
function recapituler(operations: Operation[]): string {
  const compter = (types: Operation["type"][]) => operations.filter(o => types.includes(o.type)).length
  const flux = operations.reduce((total, o) => total + (o.type === "ajouter_flux" ? o.mois.length : 0), 0)
  const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`
  const parties = [
    flux > 0 ? `ajouter ${flux} flux` : null,
    compter(["ajouter_acteur"]) > 0 ? `ajouter ${pluriel(compter(["ajouter_acteur"]), "acteur")}` : null,
    compter(["ajouter_relation"]) > 0 ? `ajouter ${pluriel(compter(["ajouter_relation"]), "relation")}` : null,
    compter(["ajouter_annee"]) > 0 ? `ajouter ${pluriel(compter(["ajouter_annee"]), "année")}` : null,
    compter(["modifier_acteur", "modifier_serie", "regler_comparateur"]) > 0 ? `faire ${pluriel(compter(["modifier_acteur", "modifier_serie", "regler_comparateur"]), "modification")}` : null,
    compter(["supprimer_relation", "supprimer_serie"]) > 0 ? `faire ${pluriel(compter(["supprimer_relation", "supprimer_serie"]), "suppression")}` : null
  ].filter((p): p is string => p !== null)
  const texte = enumerer(parties)
  return `${texte.charAt(0).toUpperCase()}${texte.slice(1)} ?`
}

/** Flux proposés identiques (acteur, type, libellé, montant) à un flux déjà saisi le même mois : un doublon probable. */
function doublons(avant: SessionState, operations: Operation[]): string[] {
  return operations.flatMap(op => {
    if (op.type !== "ajouter_flux") return []
    const grille = avant.annees.find(a => a.annee === op.annee)?.monthlyData
    const mois = op.mois.filter(m => grille?.[m - 1].flows.some(f => f.entityId === op.acteurId && f.type === op.typeFlux && f.label === op.libelle && f.amount === op.montant))
    return mois.length > 0 ? [`« ${op.libelle} » (${euros(op.montant)}) existe déjà sur « ${nomDe(avant, op.acteurId)} » en ${libelleDesMois(mois)} ${op.annee} : doublon probable.`] : []
  })
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
  return { apercu: annees.map(a => a.apercu), nouveauxAvertissements: [...new Set(annees.flatMap(a => a.nouveaux))] }
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
  return { recapitulatif: recapituler(operations), resume: operations.map(op => resumer(avant, apres, op)), avertissements: [...doublons(avant, operations), ...seriesExistantes(apres, operations), ...effets.nouveauxAvertissements], apercu: effets.apercu }
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
