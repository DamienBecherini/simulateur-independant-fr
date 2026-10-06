// src/lib/export-csv.ts
// Exports CSV pour un tableur : la grille mensuelle, les résultats de la simulation, le tableau du comparateur
// et les points de la courbe rémunération / dividendes. Les montants sont écrits au centime, sans symbole €.

import type { ComparaisonOptions, ComparaisonResult, FoyerFiscalResult, OptimisationRemuneration, PointRemuneration, ScenarioStatut, SimulationAnnuelle, SimulationPluriannuelle, SimulationReport } from "@/types"
import { documentCsv, montant, type CelluleCsv } from "./csv"
import { dispositifsDesAnnees, fluxParActeur, fraisProfessionnelsDesPersonnes, issueDuVersementLiberatoire, libelleRetenue, libelleVoiture, MOIS, natureActeur, nomDeLActeur, nomDuFoyer, origineDuRfr, reservesDeLAnnee, reservesDesAnnees, rfrDesAnnees } from "./export-commun"
import { libellesRepartition, posteFraisLabels, statutsFrais } from "./comparateur-options"
import { numeroterNotes } from "./notes"

type Ligne = CelluleCsv[]

const ouiNon = (valeur: boolean) => (valeur ? "oui" : "non")

// --- Grille mensuelle ---

/** Une ligne par acteur et par type de flux : les douze mois, puis le total de l'année. */
export function csvGrilleMensuelle(session: SimulationAnnuelle): string {
  const entete: Ligne = ["Acteur", "Nature", "Flux", "Sens", ...MOIS, "Total"]
  const lignes = fluxParActeur(session).flatMap(({ entity, lignes }) => lignes.map((l): Ligne => [entity.name, natureActeur(entity), l.libelle, l.sortie ? "Sortie" : "Entrée", ...l.mois.map(montant), montant(l.total)]))
  return documentCsv([entete, ...lignes])
}

// --- Résultats de la simulation ---

function lignesDuBilan(report: SimulationReport): Ligne[] {
  const { bilan } = report
  const indicateurs: [string, number][] = [
    ["Chiffre d'affaires", bilan.chiffreAffaires],
    ["Charges", bilan.charges],
    ["Revenus directs des personnes", bilan.revenusDirects],
    ["Cotisations salariales", bilan.cotisationsSalariales],
    ["Revenus avant prélèvements", bilan.revenusAvantPrelevements],
    ["Cotisations sociales des activités", bilan.cotisationsSociales],
    ["Impôt sur les sociétés", bilan.impotSocietes],
    ["Impôt sur le revenu", bilan.impotSurLeRevenu],
    ["Prélèvements sociaux", bilan.prelevementsSociaux],
    ["Total des prélèvements", bilan.totalPrelevements],
    ["Résultat conservé dans les sociétés", bilan.resultatConserve],
    ["Revenus non rattachés à une personne", bilan.nonRattache],
    ["Net après impôts (tous les foyers)", report.totalNetApresImpots]
  ]
  return [["Bilan", "Montant"], ["Année simulée", report.annee], ["Année des règles fiscales", report.anneeDesRegles], ...indicateurs.map(([libelle, valeur]): Ligne => [libelle, montant(valeur)])]
}

function lignesDesActivites(session: SimulationAnnuelle, report: SimulationReport): Ligne[] {
  const entete: Ligne = ["Activité", "Statut", "Chiffre d'affaires", "Charges", "Cotisations sociales", "Impôt sur les sociétés", "Revenu versé aux personnes", "Résultat conservé", "Bénéficiaires", "Dispositifs de l'année"]
  const lignes = report.activities.map((a): Ligne => [a.name, a.statut, montant(a.chiffreAffaires), montant(a.charges), montant(a.cotisationsSociales), montant(a.impotSocietes), montant(a.revenuVerse), montant(a.resultatConserve), a.beneficiaireIds.map(id => nomDeLActeur(session, id)).join(", "), (a.dispositifs ?? []).join(" ")])
  return [entete, ...lignes]
}

function lignesDesPersonnes(report: SimulationReport): Ligne[] {
  const entete: Ligne = ["Personne", "Revenus directs", "Revenus des activités", "Salaires", "Allocations chômage", "Autres revenus", "Rémunérations de dirigeant", "Dividendes", "Bénéfices", "Cotisations salariales", "Dépenses"]
  const lignes = report.persons.map(({ name, revenusDirects, revenusActivites, detail: d, cotisationsSalariales, depenses }): Ligne => [name, ...[revenusDirects, revenusActivites, d.salaires, d.allocationsChomage, d.autresRevenus, d.remunerationsDirigeant, d.dividendes, d.benefices, cotisationsSalariales, depenses].map(montant)])
  return [entete, ...lignes]
}

const optionsDividendes: Record<NonNullable<FoyerFiscalResult["optionDividendes"]>, string> = { pfu: "Prélèvement forfaitaire unique", bareme: "Barème progressif" }

function lignesDesFoyers(session: SimulationAnnuelle, report: SimulationReport): Ligne[] {
  const entete: Ligne = ["Foyer fiscal", "Parts", "Revenus encaissés", "Revenu imposable", "Revenu fiscal de référence", "Impôt sur le revenu", "Prélèvements sociaux", "Imposition des dividendes", "Net après impôts", "Revenus avant prélèvements", "Total des prélèvements", "Résultat conservé", "Dépenses"]
  const lignes = report.foyers.map((f): Ligne => [nomDuFoyer(session, f), f.totalParts, montant(f.revenusEncaisses), montant(f.revenuImposableGlobal), montant(f.revenuFiscalDeReference), montant(f.impotSurLeRevenu), montant(f.prelevementsSociaux), f.optionDividendes ? optionsDividendes[f.optionDividendes] : "", montant(f.netApresImpots), montant(f.revenusAvantPrelevements), montant(f.totalPrelevements), montant(f.resultatConserve), montant(f.depenses)])
  return [entete, ...lignes]
}

/** Un tableau précédé d'une ligne vide, ou rien s'il n'a aucune ligne sous son en-tête. */
const tableauFacultatif = (entete: Ligne, lignes: Ligne[]): Ligne[] => (lignes.length > 0 ? [[], entete, ...lignes] : [])

/** Micro-entreprises : le revenu fiscal de référence N-2 comparé au seuil du versement libératoire, et l'issue. */
function lignesDuVersementLiberatoire(report: SimulationReport): Ligne[] {
  const entete: Ligne = ["Versement libératoire", "Année du revenu fiscal de référence", "Revenu fiscal de référence retenu", "Origine", "Parts", "Seuil", "Issue"]
  const lignes = report.activities.flatMap(({ name, versementLiberatoire: v }): Ligne[] => (v ? [[name, v.anneeRfr, v.rfrN2 === null ? null : montant(v.rfrN2), origineDuRfr(v), v.partsFiscales, montant(v.plafondRfr), issueDuVersementLiberatoire(v)]] : []))
  return tableauFacultatif(entete, lignes)
}

/** Réserves des sociétés à l'IS : ce qui s'y ajoute ou en sort dans l'année, et ce qu'il en reste au 31 décembre. */
function lignesDesReserves(report: SimulationReport): Ligne[] {
  const entete: Ligne = ["Réserves de la société", "Ajouté aux réserves", "Dont réserve légale", "Dividendes pris sur les réserves", "Déficit de l'année", "Déficit antérieur déduit avant l'IS", "Réserves au 31 décembre", "Réserve légale au 31 décembre"]
  const lignes = reservesDeLAnnee(report).map(({ activite, lecture: l }): Ligne => [activite, ...[l.ajoutees, l.reserveLegaleDotee, l.prisesSurLesReserves, l.deficit, l.deficitImpute, l.aLaFin, l.reserveLegale].map(montant)])
  return tableauFacultatif(entete, lignes)
}

/** Déplacements professionnels des activités au barème kilométrique, compris dans leurs charges. */
function lignesDesDeplacements(report: SimulationReport): Ligne[] {
  const entete: Ligne = ["Déplacements professionnels", "Statut", "Kilomètres", "Montant au barème", "Déductible"]
  const lignes = report.activities.flatMap(({ name, statut, fraisDeDeplacement: d }): Ligne[] => (d ? [[name, statut, d.kilometres, montant(d.montant), ouiNon(d.deductible)]] : []))
  return tableauFacultatif(entete, lignes)
}

/** Frais professionnels des personnes qui ont saisi des frais réels, puis leurs trajets au barème, voiture par voiture. */
function lignesDesFraisProfessionnels(report: SimulationReport): Ligne[] {
  const personnes = fraisProfessionnelsDesPersonnes(report)
  const entete: Ligne = ["Frais professionnels", "Revenus imposés comme des salaires", "Déduction de 10 %", "Frais réels", "Retenue", "Montant déduit", "Trajets domicile-travail", "Distance retenue (km)", "Frais de trajet", "Autres frais"]
  const lignes = personnes.map(({ name, frais: f }): Ligne => [name, montant(f.revenusSalariaux), montant(f.deductionForfaitaire), montant(f.fraisReels), libelleRetenue(f), montant(f.deduction), f.nombreDeTrajets, f.distanceRetenue, montant(f.fraisDeTrajet), montant(f.autresFrais)])
  const voitures = personnes.flatMap(({ name, frais }) => frais.voitures.map((v): Ligne => [name, libelleVoiture(v), v.distance, montant(v.montant)]))
  return [...tableauFacultatif(entete, lignes), ...tableauFacultatif(["Voiture des trajets", "Puissance", "Distance retenue (km)", "Montant au barème"], voitures)]
}

/**
 * Bilan, activités, personnes et foyers fiscaux, séparés par une ligne vide ; puis, quand la simulation en contient,
 * le versement libératoire, les déplacements professionnels et les frais professionnels.
 */
export function csvResultats(session: SimulationAnnuelle, report: SimulationReport): string {
  const tableaux = [...lignesDuBilan(report), [], ...lignesDesActivites(session, report), [], ...lignesDesPersonnes(report), [], ...lignesDesFoyers(session, report)]
  return documentCsv([...tableaux, ...lignesDesReserves(report), ...lignesDuVersementLiberatoire(report), ...lignesDesDeplacements(report), ...lignesDesFraisProfessionnels(report)])
}

// --- Toutes les années ---

/**
 * Synthèse de toutes les années de la session : une ligne par année, puis le revenu fiscal de référence de chaque foyer
 * année par année et les dispositifs limités dans le temps. Une année qui n'a pas pu être simulée garde sa ligne, avec l'erreur.
 */
export function csvSyntheseDesAnnees(session: SimulationAnnuelle, simulation: SimulationPluriannuelle): string {
  const entete: Ligne = ["Année", "Année des règles fiscales", "Net après impôts", "Total des prélèvements", "Revenus avant prélèvements", "Cotisations sociales des activités", "Impôt sur les sociétés", "Impôt sur le revenu", "Résultat conservé dans les sociétés", "Erreur"]
  const annees = simulation.annees.map(({ annee, report: r, erreur }): Ligne => (r ? [annee, r.anneeDesRegles, ...[r.totalNetApresImpots, r.bilan.totalPrelevements, r.bilan.revenusAvantPrelevements, r.bilan.cotisationsSociales, r.bilan.impotSocietes, r.bilan.impotSurLeRevenu, r.bilan.resultatConserve].map(montant), ""] : [annee, null, null, null, null, null, null, null, null, erreur ?? "Non calculée"]))
  const rfr = rfrDesAnnees(session, simulation).map(({ annee, foyer, rfr }): Ligne => [annee, foyer, montant(rfr)])
  const dispositifs = dispositifsDesAnnees(simulation).map(({ annee, activite, note }): Ligne => [annee, activite, note])
  const reserves = reservesDesAnnees(simulation).map(({ annee, activite, lecture }): Ligne => [annee, activite, montant(lecture.aLaFin), montant(lecture.reserveLegale)])
  return documentCsv([entete, ...annees, ...tableauFacultatif(["Année", "Foyer fiscal", "Revenu fiscal de référence"], rfr), ...tableauFacultatif(["Année", "Société", "Réserves au 31 décembre", "Réserve légale au 31 décembre"], reserves), ...tableauFacultatif(["Année", "Activité", "Dispositif"], dispositifs)])
}

// --- Comparateur de statuts ---

/** Taux global de prélèvement en pourcentage, ou rien si la simulation ne produit aucun revenu. */
function tauxDePrelevement(s: ScenarioStatut): number | null {
  return s.revenusAvantPrelevements > 0 ? (s.totalPrelevements / s.revenusAvantPrelevements) * 100 : null
}

function lignesDesIndicateurs(result: ComparaisonResult, nomActivite: string): Ligne[] {
  const actuel = result.scenarios.find(s => s.actuel)
  const indicateurs: [string, (s: ScenarioStatut) => CelluleCsv][] = [
    ["Statut actuel", s => ouiNon(s.actuel)],
    ["Meilleur net", s => ouiNon(s.statut === result.meilleur)],
    // Seulement quand l'activité est sortie du régime micro : ses colonnes micro ne sont plus accessibles.
    ...(result.scenarios.some(s => s.regimeMicroFerme) ? [["Régime plus accessible", s => ouiNon(s.regimeMicroFerme !== undefined)] as [string, (s: ScenarioStatut) => CelluleCsv]] : []),
    ["Net dans la poche", s => montant(s.netApresImpots)],
    ["Taux global de prélèvement (%)", tauxDePrelevement],
    ["Revenus avant prélèvements", s => montant(s.revenusAvantPrelevements)],
    ["Frais de fonctionnement", s => montant(s.fraisFonctionnement)],
    ["Cotisations sociales", s => montant(s.cotisationsSociales)],
    ["Impôt sur les sociétés", s => montant(s.impotSocietes)],
    ["Impôt sur le revenu", s => montant(s.impotSurLeRevenu)],
    ["Prélèvements sociaux", s => montant(s.prelevementsSociaux)],
    ["Total des prélèvements", s => montant(s.totalPrelevements)],
    [`Conservé dans « ${nomActivite} »`, s => montant(s.resultatConserveActivite)],
    ["Protection sociale (étoiles sur 5)", s => s.protectionSociale.etoiles],
    ["Trimestres de retraite validés", s => s.protectionSociale.trimestres],
    ["Écart avec le statut actuel", s => (actuel ? montant(s.netApresImpots - actuel.netApresImpots) : null)]
  ]
  return [["Indicateur", ...result.scenarios.map(s => s.libelle)], ...indicateurs.map(([libelle, valeur]): Ligne => [libelle, ...result.scenarios.map(valeur)])]
}

const libellesFrais: Record<(typeof statutsFrais)[number], string> = { SASU: "SASU", EURL: "EURL", EI: "EI au réel", micro: "Micro-entreprise" }

/** Rémunération nette annuelle des colonnes SASU et EURL, selon la répartition choisie. */
function lignesDeRemuneration(options: ComparaisonOptions, scenarios: ScenarioStatut[]): [string, CelluleCsv][] {
  const { mode, avecRetraite } = options.repartition
  if (mode === "remuneration") return [["Rémunération nette annuelle (SASU, EURL)", "la plus haute possible"]]
  if (mode !== "meilleurNet") return [["Rémunération nette annuelle (SASU, EURL)", montant(options.remunerationNette)]]
  const retenues = scenarios.flatMap((s): [string, CelluleCsv][] => (s.remunerationOptimale ? [[`Rémunération nette annuelle retenue, ${s.libelle}`, montant(s.remunerationOptimale.remunerationNette)]] : []))
  // Ce que coûtent les 4 trimestres en net du foyer, colonne par colonne, que la case soit cochée ou non.
  const couts = scenarios.flatMap((s): [string, CelluleCsv][] => (s.remunerationOptimale?.coutDesQuatreTrimestres ? [[`Net en moins avec 4 trimestres de retraite, ${s.libelle}`, montant(s.remunerationOptimale.coutDesQuatreTrimestres)]] : []))
  return [["Rémunération nette annuelle (SASU, EURL)", "au meilleur net de chaque statut"], ["4 trimestres de retraite exigés", ouiNon(avecRetraite === true)], ...retenues, ...couts]
}

/** Réglages du comparateur, pour qu'on sache à quoi correspondent les chiffres ; au meilleur net, la rémunération retenue par statut. */
export function reglagesDuComparateur(options: ComparaisonOptions, nomActivite: string, scenarios: ScenarioStatut[] = []): [string, CelluleCsv][] {
  const frais = options.fraisFonctionnement
  const totalFrais = frais ? statutsFrais.map((statut): [string, CelluleCsv] => [`Frais de fonctionnement annuels, ${libellesFrais[statut]}`, montant((Object.keys(posteFraisLabels) as (keyof typeof posteFraisLabels)[]).reduce((somme, poste) => somme + frais[statut][poste], 0))]) : []
  return [
    ["Activité comparée", nomActivite],
    ["Bénéfice de la société (SASU, EURL)", libellesRepartition[options.repartition.mode]],
    ...lignesDeRemuneration(options, scenarios),
    ...(options.repartition.mode === "personnalisee" ? [["Part du bénéfice distribuable versée en dividendes (%)", Math.round(options.repartition.partDistribuee * 100)] as [string, CelluleCsv]] : []),
    ["Part des prestations en BNC en micro (%)", options.partBncPrestations * 100],
    ...totalFrais
  ]
}

function lignesDesAvertissements(result: ComparaisonResult): Ligne[] {
  const { notes } = numeroterNotes(result.scenarios.map(s => ({ id: s.statut, libelle: s.libelle, avertissements: s.warnings })))
  const cfe: Ligne[] = result.noteCFE ? [[result.noteCFE, "Tous"]] : []
  const lignes: Ligne[] = [...result.warnings.map((texte): Ligne => [texte, "Tous"]), ...cfe, ...notes.map((note): Ligne => [note.texte, note.colonnes.join(", ")])]
  return lignes.length > 0 ? [[], ["Avertissement", "Statuts concernés"], ...lignes] : []
}

/** Le tableau du comparateur (un statut par colonne), puis les réglages utilisés et les avertissements. */
export function csvComparaison(result: ComparaisonResult, options: ComparaisonOptions, nomActivite: string): string {
  return documentCsv([...lignesDesIndicateurs(result, nomActivite), [], ["Réglage", "Valeur"], ...reglagesDuComparateur(options, nomActivite, result.scenarios), ...lignesDesAvertissements(result)])
}

// --- Courbe rémunération / dividendes ---

function repere(p: PointRemuneration, { meilleur, meilleurAvecRetraite }: OptimisationRemuneration): string {
  const estMeilleur = meilleur?.remunerationNette === p.remunerationNette
  const estMeilleurAvecRetraite = meilleurAvecRetraite?.remunerationNette === p.remunerationNette
  if (estMeilleur && estMeilleurAvecRetraite) return "Meilleur net, 4 trimestres validés"
  if (estMeilleur) return "Meilleur net"
  return estMeilleurAvecRetraite ? "Meilleur net avec 4 trimestres" : ""
}

/** Tous les points de la courbe, par rémunération croissante, avec les deux rémunérations retenues signalées. */
export function csvCourbeRemuneration(optimisation: OptimisationRemuneration): string {
  const entete: Ligne = ["Statut", "Rémunération nette", "Dividendes", "Net du foyer", "Cotisations sociales", "Impôt sur les sociétés", "Impôt sur le revenu", "Prélèvements sociaux", "Trimestres de retraite", "Repère"]
  const lignes = optimisation.points.map((p): Ligne => [optimisation.statut, ...[p.remunerationNette, p.dividendes, p.netApresImpots, p.cotisationsSociales, p.impotSocietes, p.impotSurLeRevenu, p.prelevementsSociaux].map(montant), p.trimestres, repere(p, optimisation)])
  return documentCsv([entete, ...lignes])
}
