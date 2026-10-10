// src/lib/export-markdown.ts
// Rapport Markdown de la simulation, à lire tel quel ou à confier à une IA pour l'analyser : hypothèses et limites,
// acteurs et relations, flux saisis, résultats, comparateur de statuts et avertissements.

import { estSocieteIS, type ComparaisonOptions, type ComparaisonResult, type DeplacementsProfessionnels, type Entity, type FraisProfessionnelsResult, type ModeRepartition, type Person, type Relationship, type ScenarioStatut, type SimulationAnnuelle, type SimulationPluriannuelle, type SimulationReport } from "@/types"
import { defaultFraisFonctionnement, libellesRepartition, posteFraisLabels, statutsFrais } from "./comparateur-options"
import { dateDeCreationLisible, dispositifsDesAnnees, fluxParActeur, fraisProfessionnelsDesPersonnes, issueDuVersementLiberatoire, libelleDeduction, libellePuissance, libelleRetenue, libelleVoiture, MOIS, natureActeur, nomDeLActeur, nomDuFoyer, origineDuRfr, reservesDeLAnnee, reservesDesAnnees, rfrDesAnnees, type LigneDeFlux } from "./export-commun"
import { numeroterNotes } from "./notes"
import { libelleDeLaProfession, lignesDeLaCaisse, professionDeLaFiche, statutEtProfession } from "./professions"
import { reglesDeLAnneeAffichee } from "./regles-affichees"

/** Comparaison calculée à l'export pour l'activité choisie dans le comparateur, ou la raison de son absence. */
export type ComparaisonDuRapport = { nomActivite: string; options: ComparaisonOptions; resultat: ComparaisonResult } | { nomActivite: string; erreur: string }

export interface DonneesDuRapport {
  session: SimulationAnnuelle
  report: SimulationReport | null
  /** `null` quand la simulation ne contient aucune activité à comparer. */
  comparaison: ComparaisonDuRapport | null
  date: Date
  /** Toutes les années de la session : leur synthèse suit les résultats quand il y en a au moins deux. */
  pluriannuelle?: SimulationPluriannuelle | null
}

/** Hypothèses et limites du simulateur, en bref. */
export const LIMITES = [
  "Montants annuels en euros, hors taxe ; la grille saisit des montants mensuels, additionnés sur l'année.",
  "Résultats indicatifs, non validés par un expert-comptable : ce n'est pas un conseil fiscal.",
  "Cotisations des travailleurs non salariés (gérant d'EURL, entrepreneur individuel au réel) calculées selon le barème des artisans, commerçants et professions libérales non réglementées ; celles du président de SASU calculées ligne à ligne avec les taux du régime général de l'année, sans assurance chômage.",
  "Professions libérales réglementées : seules la CIPAV et la CARPIMKO sont calculées (au réel et en micro-entreprise) ; les autres caisses le sont comme une profession non réglementée, avec un avertissement. CARPIMKO : retraite complémentaire et ASV calculées sur le revenu de l'année précédente quand elle est dans la simulation, sinon sur celui de l'année. En SASU ou en EURL, la rémunération d'un associé de société d'exercice libéral (BNC, caisse de la profession) n'est pas modélisée : un avertissement le signale.",
  "Micro-entreprise : cotisations au taux de chaque nature d'activité, plus la contribution à la formation professionnelle, comptée au taux des artisans pour les prestations de services BIC (artisan et commerçant ne sont pas distingués).",
  "La note de protection sociale est indicative ; l'arbitrage rémunération / dividendes porte sur une seule année.",
  "Non modélisés : réductions et crédits d'impôt, résidence alternée, report sur les années suivantes du déficit d'une entreprise individuelle supérieur aux autres revenus du foyer (celui d'une société à l'IS est reporté), TVA (seul le dépassement des seuils de franchise est signalé), répartition du capital entre associés (dividendes partagés à parts égales)."
]

// --- Mise en forme ---

/** Montant arrondi à l'euro, à la française, avec des espaces ordinaires (« 12 345 € »). */
export function euros(valeur: number): string {
  const arrondi = Math.round(valeur) || 0
  return `${arrondi.toLocaleString("fr-FR").replace(/\s/g, " ")} €`
}

const pourcentage = (ratio: number) => `${(Math.round(ratio * 1000) / 10).toLocaleString("fr-FR")} %`

/** Texte saisi par l'utilisateur, protégé pour qu'il ne casse ni un tableau ni la mise en forme. */
export function echapper(texte: string): string {
  return texte.replace(/\s*[\r\n]+\s*/g, " ").replace(/([\\`*_[\]<>|#])/g, "\\$1")
}

function tableau(entete: string[], lignes: string[][], alignesADroite: number[] = []): string {
  const separateur = entete.map((_, i) => (alignesADroite.includes(i) ? "---:" : "---"))
  return [entete, separateur, ...lignes].map(cellules => `| ${cellules.join(" | ")} |`).join("\n")
}

const colonnesNumeriques = (de: number, a: number) => Array.from({ length: a - de + 1 }, (_, i) => de + i)

const kilometres = (km: number) => `${km.toLocaleString("fr-FR").replace(/\s/g, " ")} km`

const ouiNon = (valeur: boolean) => (valeur ? "oui" : "non")

// --- Acteurs et relations ---

/** Frais réels saisis sur une personne, en bref : le détail des trajets suit le tableau des acteurs. */
function detailDesFraisReels(person: Person): string {
  if (!person.fraisReels) return ""
  const { trajets, autresFrais } = person.fraisReels
  return ` ; frais réels saisis : ${trajets.length} trajet${trajets.length > 1 ? "s" : ""} domicile-travail, autres frais ${euros(autresFrais)}`
}

/** Déplacements professionnels d'une activité, saisis en kilomètres par an. */
function detailDesDeplacements(deplacements: DeplacementsProfessionnels | undefined): string {
  return deplacements ? ` ; déplacements professionnels : ${kilometres(deplacements.kmParAn)} par an, ${libelleVoiture(deplacements)}` : ""
}

function detailDeLActeur(entity: Entity, annee: number): string {
  if (entity.type === "person") return `${entity.fiscalParts.toLocaleString("fr-FR")} part${entity.fiscalParts > 1 ? "s" : ""} fiscale${entity.fiscalParts > 1 ? "s" : ""}${detailDesFraisReels(entity)}`
  const creation = dateDeCreationLisible(entity)
  const profession = professionDeLaFiche(entity, reglesDeLAnneeAffichee(annee))
  const creee = `${creation ? ` ; créée en ${creation}` : ""}${profession ? ` ; profession : ${profession}` : ""}${detailDesDeplacements(entity.deplacementsProfessionnels)}`
  if (entity.type === "company") return `${estSocieteIS(entity.legalStatus) ? `Société à l'impôt sur les sociétés, capital social ${euros(entity.capitalSocial)}${entity.reservesInitiales ? `, réserves au début de la simulation ${euros(entity.reservesInitiales)}` : ""}` : "Entreprise individuelle au régime réel"}${creee}`
  const rfr = entity.rfrN2 === undefined ? "non renseigné" : euros(entity.rfrN2)
  const horsPlafond = entity.horsPlafondAnneePrecedente ? " ; au-delà des plafonds l'année d'avant la simulation" : ""
  return `ACRE : ${entity.beneficieACRE ? "oui" : "non"} ; versement libératoire demandé : ${entity.opteVFL ? "oui" : "non"} ; revenu fiscal de référence N-2 : ${rfr}${creee}${horsPlafond}`
}

/** Trajets domicile-travail saisis sur les personnes, un par ligne ; rien quand aucune n'en a. */
function trajetsDesPersonnes(session: SimulationAnnuelle): string {
  const lignes = session.entities.flatMap(e => (e.type === "person" ? (e.fraisReels?.trajets ?? []).map((t, i) => [echapper(e.name), echapper(t.libelle) || `Trajet ${i + 1}`, kilometres(t.kmParTrajet), String(t.joursTravailles), libellePuissance(t.puissanceFiscale), ouiNon(t.electrique), ouiNon(t.distanceJustifiee)]) : []))
  if (lignes.length === 0) return ""
  const distanceMax = reglesDeLAnneeAffichee(session.annee).baremeKilometrique.domicileTravail.distanceMaxParTrajet
  const entete = ["Personne", "Trajet", "Aller simple", "Jours travaillés", "Puissance fiscale", "Électrique", `Distance au-delà de ${kilometres(distanceMax)} justifiée`]
  return `\n\n### Trajets domicile-travail\n\nUn aller-retour par jour travaillé, avec une voiture personnelle, pour les frais réels.\n\n${tableau(entete, lignes, [2, 3])}`
}

function sectionActeurs(session: SimulationAnnuelle): string {
  if (session.entities.length === 0) return "## Acteurs\n\nAucun acteur saisi."
  const lignes = session.entities.map(e => [echapper(e.name), natureActeur(e), detailDeLActeur(e, session.annee)])
  return `## Acteurs\n\n${tableau(["Nom", "Nature", "Détails"], lignes)}${trajetsDesPersonnes(session)}`
}

const relationsDeCouple: Partial<Record<Relationship["type"], string>> = { "Marié(e)": "mariés", "PACSé(e)": "pacsés", "En couple": "en couple (union libre, deux foyers fiscaux distincts)" }

function phraseDeRelation(session: SimulationAnnuelle, relation: Relationship): string {
  const de = echapper(nomDeLActeur(session, relation.fromId))
  const vers = echapper(nomDeLActeur(session, relation.toId))
  const couple = relationsDeCouple[relation.type]
  if (couple) return `${de} et ${vers} : ${couple}`
  if (relation.type === "Enfant") return `${vers} : enfant à charge de ${de}`
  // Rôle d'une personne dans une activité : la relation peut avoir été créée depuis l'une ou l'autre.
  const deEstUnePersonne = session.entities.find(e => e.id === relation.fromId)?.type === "person"
  const [personne, activite] = deEstUnePersonne ? [de, vers] : [vers, de]
  return `${personne} : ${relation.type.toLowerCase()} de « ${activite} »`
}

function sectionRelations(session: SimulationAnnuelle): string {
  if (session.relationships.length === 0) return "## Relations\n\nAucune relation saisie."
  return `## Relations\n\n${session.relationships.map(r => `- ${phraseDeRelation(session, r)}`).join("\n")}`
}

// --- Flux saisis ---

/** Répartition d'un flux sur l'année : « 12 × 3 000 € » s'il est constant, sinon les mois concernés. */
export function repartition(mois: number[]): string {
  if (mois.every(m => m === mois[0]) && mois[0] !== 0) return `12 × ${euros(mois[0])}`
  const remplis = mois.map((m, i) => [MOIS[i].toLowerCase(), m] as const).filter(([, m]) => m !== 0)
  return remplis.length === 0 ? "—" : remplis.map(([nom, m]) => `${nom} ${euros(m)}`).join(", ")
}

const ligneDeFlux = (l: LigneDeFlux) => [l.libelle, l.sortie ? "Sortie" : "Entrée", euros(l.total), repartition(l.mois)]

function sectionFlux(session: SimulationAnnuelle): string {
  const acteurs = fluxParActeur(session)
  if (acteurs.length === 0) return "## Flux saisis\n\nAucun flux saisi dans la grille."
  const blocs = acteurs.map(({ entity, lignes }) => `### ${echapper(entity.name)} (${natureActeur(entity)})\n\n${tableau(["Flux", "Sens", "Total annuel", "Répartition"], lignes.map(ligneDeFlux), [2])}`)
  return `## Flux saisis\n\nMontants saisis dans la grille mensuelle, additionnés sur l'année.\n\n${blocs.join("\n\n")}`
}

// --- Résultats ---

function sousSectionBilan(report: SimulationReport): string {
  const { bilan } = report
  const base = bilan.revenusAvantPrelevements
  const taux = base > 0 ? pourcentage(bilan.totalPrelevements / base) : "—"
  const lignes = [
    ["Chiffre d'affaires", euros(bilan.chiffreAffaires)],
    ["Charges", euros(bilan.charges)],
    ["Salaires et autres revenus des personnes", euros(bilan.revenusDirects + bilan.cotisationsSalariales)],
    ["Revenus avant prélèvements", euros(base)],
    ["Cotisations sociales des activités", euros(bilan.cotisationsSociales)],
    ["Cotisations salariales", euros(bilan.cotisationsSalariales)],
    ["Impôt sur les sociétés", euros(bilan.impotSocietes)],
    ["Impôt sur le revenu", euros(bilan.impotSurLeRevenu)],
    ["Prélèvements sociaux sur dividendes", euros(bilan.prelevementsSociaux)],
    ["Total des prélèvements", euros(bilan.totalPrelevements)],
    ["Taux global de prélèvement", taux],
    ["Conservé dans les sociétés", euros(bilan.resultatConserve)],
    ["Non rattaché à une personne", euros(bilan.nonRattache)],
    ["**Net dans la poche (tous les foyers)**", `**${euros(report.totalNetApresImpots)}**`]
  ]
  return `### Bilan\n\n${tableau(["Indicateur", "Montant"], lignes, [1])}`
}

function sousSectionActivites(session: SimulationAnnuelle, report: SimulationReport): string {
  if (report.activities.length === 0) return "### Par activité\n\nAucune activité."
  const lignes = report.activities.map(a => [echapper(a.name), statutEtProfession(a), euros(a.chiffreAffaires), euros(a.charges), euros(a.cotisationsSociales), euros(a.impotSocietes), euros(a.revenuVerse), euros(a.resultatConserve), a.beneficiaireIds.map(id => echapper(nomDeLActeur(session, id))).join(", ") || "—"])
  return `### Par activité\n\n${tableau(["Activité", "Statut", "Chiffre d'affaires", "Charges", "Cotisations sociales", "Impôt sur les sociétés", "Versé aux personnes", "Conservé", "Bénéficiaires"], lignes, colonnesNumeriques(2, 7))}`
}

const imposition = { pfu: "prélèvement forfaitaire unique", bareme: "barème progressif" }

function sousSectionFoyers(session: SimulationAnnuelle, report: SimulationReport): string {
  if (report.foyers.length === 0) return "### Par foyer fiscal\n\nAucun foyer fiscal."
  const lignes = report.foyers.map(f => [echapper(nomDuFoyer(session, f)), f.totalParts.toLocaleString("fr-FR"), euros(f.revenusEncaisses), euros(f.revenuImposableGlobal), euros(f.revenuFiscalDeReference), euros(f.impotSurLeRevenu), euros(f.prelevementsSociaux), f.optionDividendes ? imposition[f.optionDividendes] : "—", `**${euros(f.netApresImpots)}**`])
  return `### Par foyer fiscal\n\n${tableau(["Foyer (membres)", "Parts", "Revenus encaissés", "Revenu imposable", "Revenu fiscal de référence", "Impôt sur le revenu", "Prélèvements sociaux", "Imposition des dividendes", "Net après impôts"], lignes, [1, 2, 3, 4, 5, 6, 8])}`
}

function sectionResultats(session: SimulationAnnuelle, report: SimulationReport | null): string {
  if (!report) return "## Résultats\n\nRésultats indisponibles : la simulation n'a pas pu être calculée."
  const sousSections = [
    sousSectionBilan(report),
    sousSectionActivites(session, report),
    sousSectionCaisses(report),
    sousSectionReserves(report),
    sousSectionDeplacements(report),
    sousSectionVersementLiberatoire(report),
    sousSectionDispositifs(report),
    sousSectionFoyers(session, report),
    sousSectionFraisProfessionnels(report)
  ].filter(Boolean)
  return `## Résultats ${report.annee} (règles fiscales ${report.anneeDesRegles})\n\nMontants annuels, avant les éventuelles dépenses personnelles.\n\n${sousSections.join("\n\n")}`
}

/** Professions libérales réglementées au réel : les cotisations que leur caisse change, ligne à ligne ; rien sans elles. */
function sousSectionCaisses(report: SimulationReport): string {
  const lignes = report.activities.flatMap(({ name, profession, cotisationsTNS }) => (cotisationsTNS && profession ? lignesDeLaCaisse(cotisationsTNS, euros).map(l => [echapper(name), libelleDeLaProfession(profession), l.libelle.replace(/^dont /, ""), euros(l.montant), l.precision ?? "—"]) : []))
  if (lignes.length === 0) return ""
  return `### Cotisations par caisse\n\nProfessions libérales réglementées : les cotisations que leur caisse change, comprises dans les cotisations sociales de l'activité.\n\n${tableau(["Activité", "Profession", "Cotisation", "Montant", "Précision"], lignes, [3])}`
}

/** Réserves des sociétés à l'IS : ce qui s'y ajoute ou en sort dans l'année, et ce qu'il en reste ; rien sans réserves. */
function sousSectionReserves(report: SimulationReport): string {
  const lignes = reservesDeLAnnee(report).map(({ activite, lecture: l }) => [echapper(activite), euros(l.ajoutees), euros(l.reserveLegaleDotee), euros(l.prisesSurLesReserves), euros(l.deficit), euros(l.deficitImpute), `**${euros(l.aLaFin)}**`, euros(l.reserveLegale)])
  if (lignes.length === 0) return ""
  const entete = ["Société", "Ajouté aux réserves", "Dont réserve légale", "Dividendes pris sur les réserves", "Déficit de l'année", "Déficit antérieur déduit avant l'IS", "Réserves au 31 décembre", "Réserve légale"]
  return `### Réserves des sociétés\n\nBénéfices gardés dans la société d'une année sur l'autre : l'impôt sur les sociétés est payé, l'impôt du foyer le sera quand ils seront distribués.\n\n${tableau(entete, lignes, [1, 2, 3, 4, 5, 6, 7])}`
}

/** Dispositifs limités dans le temps de l'année (sortie du régime micro, ACRE…) ; rien quand aucun ne joue. */
function sousSectionDispositifs(report: SimulationReport): string {
  const notes = report.activities.flatMap(a => (a.dispositifs ?? []).map(note => `- ${echapper(a.name)} : ${echapper(note)}`))
  return notes.length > 0 ? `### Dispositifs dans le temps\n\n${notes.join("\n")}` : ""
}

/** Déplacements professionnels des activités au barème kilométrique, compris dans leurs charges ; rien sans déplacements. */
function sousSectionDeplacements(report: SimulationReport): string {
  const lignes = report.activities.flatMap(({ name, fraisDeDeplacement: d }) => (d ? [[echapper(name), kilometres(d.kilometres), euros(d.montant), d.deductible ? "déductible" : "non déductible (micro-entreprise)"]] : []))
  if (lignes.length === 0) return ""
  return `### Déplacements professionnels\n\nAu barème kilométrique, compris dans les charges de l'activité.\n\n${tableau(["Activité", "Distance", "Montant", "Traitement"], lignes, [1, 2])}`
}

/** Micro-entreprises : le revenu fiscal de référence N-2 comparé au seuil du versement libératoire, et l'issue. */
function sousSectionVersementLiberatoire(report: SimulationReport): string {
  const lignes = report.activities.flatMap(({ name, versementLiberatoire: v }) => (v ? [[echapper(name), String(v.anneeRfr), v.rfrN2 === null ? "—" : euros(v.rfrN2), origineDuRfr(v), `${euros(v.plafondRfr)} (${v.partsFiscales.toLocaleString("fr-FR")} part${v.partsFiscales > 1 ? "s" : ""})`, issueDuVersementLiberatoire(v)]] : []))
  if (lignes.length === 0) return ""
  return `### Versement libératoire\n\n${tableau(["Micro-entreprise", "Année du revenu fiscal de référence", "Revenu fiscal de référence", "Origine", "Seuil", "Issue"], lignes, [2, 4])}`
}

/** Trajets au barème kilométrique d'une personne, voiture par voiture : « 5 CV : 6 800 km, 3 720 € ». */
function trajetsAuBareme(frais: FraisProfessionnelsResult): string {
  return frais.voitures.map(v => `${libelleVoiture(v)} : ${kilometres(v.distance)}, ${euros(v.montant)}`).join(" ; ") || "—"
}

/** Frais réels des personnes qui en ont saisi, face à la déduction forfaitaire ; rien quand aucune n'en a. */
function sousSectionFraisProfessionnels(report: SimulationReport): string {
  const personnes = fraisProfessionnelsDesPersonnes(report)
  if (personnes.length === 0) return ""
  const lignes = personnes.map(({ name, frais: f }) => [echapper(name), euros(f.revenusSalariaux), euros(f.deductionForfaitaire), euros(f.fraisReels), `**${libelleRetenue(f)}** : ${euros(f.deduction)}`, String(f.nombreDeTrajets), kilometres(f.distanceRetenue), trajetsAuBareme(f), euros(f.autresFrais)])
  // Toutes les personnes d'un rapport ont les règles de la même année : la première donne le taux.
  const deduction = libelleDeduction(personnes[0].frais)
  const entete = ["Personne", "Revenus imposés comme des salaires", deduction, "Frais réels", "Retenue", "Trajets", "Distance retenue", "Trajets au barème, par voiture", "Autres frais"]
  return `### Frais professionnels\n\nSur les revenus imposés comme des salaires, la plus favorable de la ${deduction.toLowerCase()} et des frais réels.\n\n${tableau(entete, lignes, [1, 2, 3, 5, 6, 8])}`
}

// --- Toutes les années ---

/** Synthèse des années de la session, une ligne par année, puis le revenu fiscal de référence de chaque foyer et les dispositifs. */
function sectionToutesLesAnnees(session: SimulationAnnuelle, pluriannuelle: SimulationPluriannuelle | null | undefined): string {
  if (!pluriannuelle || pluriannuelle.annees.length < 2) return ""
  const lignes = pluriannuelle.annees.map(({ annee, report: r, erreur }) => (r ? [String(annee), String(r.anneeDesRegles), euros(r.totalNetApresImpots), euros(r.bilan.totalPrelevements), euros(r.bilan.revenusAvantPrelevements)] : [String(annee), "—", `non calculée : ${echapper(erreur ?? "erreur inconnue")}`, "—", "—"]))
  const synthese = tableau(["Année", "Règles fiscales", "Net après impôts", "Total des prélèvements", "Revenus avant prélèvements"], lignes, [2, 3, 4])
  const rfr = rfrDesAnnees(session, pluriannuelle).map(({ annee, foyer, rfr }) => [String(annee), echapper(foyer), euros(rfr)])
  const blocRfr = rfr.length > 0 ? `\n\n### Revenu fiscal de référence, année par année\n\n${tableau(["Année", "Foyer (membres)", "Revenu fiscal de référence"], rfr, [2])}` : ""
  const reserves = reservesDesAnnees(pluriannuelle).map(({ annee, activite, lecture }) => [String(annee), echapper(activite), euros(lecture.aLaFin), euros(lecture.reserveLegale)])
  const blocReserves = reserves.length > 0 ? `\n\n### Réserves des sociétés, année par année\n\n${tableau(["Année", "Société", "Réserves au 31 décembre", "Réserve légale"], reserves, [2, 3])}` : ""
  const dispositifs = dispositifsDesAnnees(pluriannuelle).map(({ annee, activite, note }) => `- ${annee}, ${echapper(activite)} : ${echapper(note)}`)
  const blocDispositifs = dispositifs.length > 0 ? `\n\n### Dispositifs dans le temps, année par année\n\n${dispositifs.join("\n")}` : ""
  return `## Toutes les années\n\nUne ligne par année de la session, avec les mêmes acteurs et la grille de chaque année.\n\n${synthese}${blocRfr}${blocReserves}${blocDispositifs}`
}

// --- Comparateur ---

function totalDesFrais(options: ComparaisonOptions): string {
  const frais = options.fraisFonctionnement ?? defaultFraisFonctionnement()
  const postes = Object.keys(posteFraisLabels) as (keyof typeof posteFraisLabels)[]
  const libelles = { SASU: "SASU", EURL: "EURL", EI: "EI au réel", micro: "micro-entreprise" }
  return statutsFrais.map(statut => `${libelles[statut]} ${euros(postes.reduce((somme, poste) => somme + frais[statut][poste], 0))}`).join(", ")
}

/** Ce qu'on précise après la rémunération retenue d'une colonne : 4 trimestres hors d'atteinte, ou ce qu'ils coûtent en net. */
function precisionDeLaRemuneration({ retraiteHorsDAtteinte, coutDesQuatreTrimestres }: NonNullable<ScenarioStatut["remunerationOptimale"]>): string {
  if (retraiteHorsDAtteinte) return " (4 trimestres hors d'atteinte)"
  return coutDesQuatreTrimestres ? ` (4 trimestres : −${euros(coutDesQuatreTrimestres)} de net)` : ""
}

/**
 * Au meilleur net, la rémunération retenue dans chaque colonne de société, avec ce que coûtent les 4 trimestres de
 * retraite : « SASU 12 300 € (4 trimestres : −1 234 € de net), EURL 9 800 € ».
 */
function remunerationsRetenues(scenarios: ScenarioStatut[]): string {
  const retenues = scenarios.flatMap(s => (s.remunerationOptimale ? [`${s.libelle} ${euros(s.remunerationOptimale.remunerationNette)}${precisionDeLaRemuneration(s.remunerationOptimale)}`] : []))
  return retenues.length > 0 ? ` ; rémunération nette retenue : ${retenues.join(", ")}` : ""
}

/** La répartition choisie du bénéfice des sociétés, en une phrase. */
function descriptionRepartition(options: ComparaisonOptions, scenarios: ScenarioStatut[]): string {
  const { mode, partDistribuee, avecRetraite } = options.repartition
  const remuneration = euros(options.remunerationNette)
  const descriptions: Record<ModeRepartition, string> = {
    meilleurNet: `dans chaque statut, la rémunération nette au meilleur net du foyer${avecRetraite ? " parmi celles qui valident 4 trimestres de retraite" : ""}, tout le bénéfice restant versé en dividendes${remunerationsRetenues(scenarios)}`,
    dividendes: `rémunération nette de ${remuneration}, tout le bénéfice restant versé en dividendes`,
    remuneration: "la plus haute rémunération que la société peut verser, sans dividendes",
    personnalisee: `rémunération nette de ${remuneration}, ${pourcentage(partDistribuee)} du bénéfice distribuable versé en dividendes, le reste conservé dans la société`,
    grille: `rémunération nette de ${remuneration}, dividendes saisis dans la grille`
  }
  return `${libellesRepartition[mode]} (${descriptions[mode]})`
}

function reglagesUtilises(options: ComparaisonOptions, scenarios: ScenarioStatut[]): string {
  return [
    `- Bénéfice de la société en SASU et EURL : ${descriptionRepartition(options, scenarios)}`,
    `- En micro-entreprise, part des prestations de services en BNC : ${pourcentage(options.partBncPrestations)} (le reste en BIC)`,
    `- Frais de fonctionnement annuels ajoutés aux charges : ${options.fraisFonctionnement ? totalDesFrais(options) : "aucun"}`
  ].join("\n")
}

function tableauDeComparaison(resultat: ComparaisonResult, nomActivite: string): string {
  const { scenarios } = resultat
  const actuel = scenarios.find(s => s.actuel)
  const entete = (s: ScenarioStatut) => {
    const mentions = [s.actuel ? "actuel" : null, s.statut === resultat.meilleur ? "meilleur net" : null, s.regimeMicroFerme ? "plus accessible" : null].filter(Boolean)
    return mentions.length > 0 ? `${s.libelle} (${mentions.join(", ")})` : s.libelle
  }
  const indicateurs: [string, (s: ScenarioStatut) => string][] = [
    ["**Net dans la poche**", s => `**${euros(s.netApresImpots)}**`],
    ["Taux global de prélèvement", s => (s.revenusAvantPrelevements > 0 ? pourcentage(s.totalPrelevements / s.revenusAvantPrelevements) : "—")],
    ["Frais de fonctionnement", s => euros(s.fraisFonctionnement)],
    ["Cotisations sociales", s => euros(s.cotisationsSociales)],
    ["Impôt sur les sociétés", s => euros(s.impotSocietes)],
    ["Impôt sur le revenu", s => euros(s.impotSurLeRevenu)],
    ["Prélèvements sociaux", s => euros(s.prelevementsSociaux)],
    [`Conservé dans « ${echapper(nomActivite)} »`, s => euros(s.resultatConserveActivite)],
    ["Protection sociale", s => `${s.protectionSociale.etoiles}/5, ${s.protectionSociale.trimestres} trim. de retraite`],
    ["Écart avec le statut actuel", s => (actuel && !s.actuel ? euros(s.netApresImpots - actuel.netApresImpots).replace(/^(?!-)/, "+") : "—")]
  ]
  const lignes = indicateurs.map(([libelle, valeur]) => [libelle, ...scenarios.map(valeur)])
  return tableau(["Indicateur", ...scenarios.map(entete)], lignes, colonnesNumeriques(1, scenarios.length))
}

function notesDeComparaison(resultat: ComparaisonResult): string {
  const { notes } = numeroterNotes(resultat.scenarios.map(s => ({ id: s.statut, libelle: s.libelle, avertissements: s.warnings })))
  if (notes.length === 0) return ""
  return `\n\nNotes :\n\n${notes.map(n => `${n.numero}. ${n.colonnes.join(", ")} : ${echapper(n.texte)}`).join("\n")}`
}

function couplesEnUnionLibre(session: SimulationAnnuelle, resultat: ComparaisonResult): string {
  if (resultat.couples.length === 0) return ""
  const phrases = resultat.couples.map(c => `- ${c.personIds.map(id => echapper(nomDeLActeur(session, id))).join(" et ")} : impôt sur le revenu de ${euros(c.impotSurLeRevenuActuel)} en union libre, ${euros(c.impotSurLeRevenuMaries)} avec une imposition commune ; net après impôts de ${euros(c.netApresImpotsActuel)}, contre ${euros(c.netApresImpotsMaries)} mariés ou pacsés.`)
  return `\n\n### Et si le couple était marié ou pacsé ?\n\n${phrases.join("\n")}`
}

function sectionComparateur(session: SimulationAnnuelle, comparaison: ComparaisonDuRapport | null): string {
  if (!comparaison) return "## Comparateur de statuts\n\nAucune activité à comparer."
  const titre = `## Comparateur de statuts : « ${echapper(comparaison.nomActivite)} »`
  if ("erreur" in comparaison) return `${titre}\n\nComparaison indisponible : ${echapper(comparaison.erreur)}`
  const { options, resultat } = comparaison
  const intro = "L'activité est simulée dans chaque statut, le reste de la simulation restant identique. Les montants portent sur toute la simulation, sauf la ligne « Conservé », propre à l'activité. Comparaison calculée à l'export avec les réglages du comparateur :"
  const tableauOuAbsence = resultat.scenarios.length > 0 ? tableauDeComparaison(resultat, comparaison.nomActivite) + notesDeComparaison(resultat) : "Aucun statut comparé."
  const cfe = resultat.noteCFE ? `\n- ${echapper(resultat.noteCFE)}` : ""
  return `${titre}\n\n${intro}\n\n${reglagesUtilises(options, resultat.scenarios)}${cfe}\n\n${tableauOuAbsence}${couplesEnUnionLibre(session, resultat)}`
}

// --- Avertissements ---

function sectionAvertissements(session: SimulationAnnuelle, report: SimulationReport | null, comparaison: ComparaisonDuRapport | null): string {
  const avertissements = [
    ...(report?.avertissements.map(echapper) ?? []),
    ...(report?.activities.flatMap(a => a.warnings.map(w => `${echapper(a.name)} : ${echapper(w)}`)) ?? []),
    ...(report?.foyers.flatMap(f => f.warnings.map(w => `Foyer ${echapper(nomDuFoyer(session, f))} : ${echapper(w)}`)) ?? []),
    ...(comparaison && "resultat" in comparaison ? comparaison.resultat.warnings.map(w => `Comparateur : ${echapper(w)}`) : [])
  ]
  return `## Avertissements\n\n${avertissements.length > 0 ? avertissements.map(a => `- ${a}`).join("\n") : "Aucun avertissement."}`
}

/** Le rapport complet, en Markdown. */
export function rapportMarkdown({ session, report, comparaison, date, pluriannuelle }: DonneesDuRapport): string {
  const dateTexte = date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
  const regles = report ? `, année ${report.annee}, règles fiscales ${report.anneeDesRegles}` : `, année ${session.annee}`
  const entete = [
    `# Simulation « ${echapper(session.name)} »`,
    `Rapport exporté le ${dateTexte} depuis le Simulateur de revenus pour indépendants${regles}.`,
    "> Ce document décrit une simulation de revenus d'indépendants en France. Il se lit tel quel ou se confie à une IA (un assistant conversationnel) pour l'analyser : les montants sont annuels et en euros, sauf mention contraire.",
    `## Hypothèses et limites\n\n${LIMITES.map(l => `- ${l}`).join("\n")}`
  ]
  const sections = [sectionActeurs(session), sectionRelations(session), sectionFlux(session), sectionResultats(session, report), sectionToutesLesAnnees(session, pluriannuelle), sectionComparateur(session, comparaison), sectionAvertissements(session, report, comparaison)].filter(Boolean)
  return `${[...entete, ...sections].join("\n\n")}\n`
}
