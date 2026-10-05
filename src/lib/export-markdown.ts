// src/lib/export-markdown.ts
// Rapport Markdown de la simulation, à lire tel quel ou à confier à une IA pour l'analyser : hypothèses et limites,
// acteurs et relations, flux saisis, résultats, comparateur de statuts et avertissements.

import type { ComparaisonOptions, ComparaisonResult, Entity, ModeRepartition, Relationship, ScenarioStatut, SimulationAnnuelle, SimulationReport } from "@/types"
import { defaultFraisFonctionnement, libellesRepartition, posteFraisLabels, statutsFrais } from "./comparateur-options"
import { fluxParActeur, MOIS, natureActeur, nomDeLActeur, nomDuFoyer, type LigneDeFlux } from "./export-commun"
import { numeroterNotes } from "./notes"

/** Comparaison calculée à l'export pour la première activité, ou la raison de son absence. */
export type ComparaisonDuRapport = { nomActivite: string; options: ComparaisonOptions; resultat: ComparaisonResult } | { nomActivite: string; erreur: string }

export interface DonneesDuRapport {
  session: SimulationAnnuelle
  report: SimulationReport | null
  /** `null` quand la simulation ne contient aucune activité à comparer. */
  comparaison: ComparaisonDuRapport | null
  date: Date
}

/** Hypothèses et limites du simulateur, en bref. */
export const LIMITES = [
  "Montants annuels en euros, hors taxe ; la grille saisit des montants mensuels, additionnés sur l'année.",
  "Résultats indicatifs, non validés par un expert-comptable : ce n'est pas un conseil fiscal.",
  "Cotisations des travailleurs non salariés (gérant d'EURL, entrepreneur individuel au réel) calculées selon le barème des artisans, commerçants et professions libérales non réglementées ; celles du président de SASU approchées par un ratio moyen entre coût total et net.",
  "La note de protection sociale est indicative ; l'arbitrage rémunération / dividendes porte sur une seule année.",
  "Non modélisés : réductions et crédits d'impôt, résidence alternée, report des déficits, TVA (seul le dépassement des seuils de franchise est signalé), répartition du capital entre associés (dividendes partagés à parts égales)."
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

// --- Acteurs et relations ---

function detailDeLActeur(entity: Entity): string {
  if (entity.type === "person") return `${entity.fiscalParts.toLocaleString("fr-FR")} part${entity.fiscalParts > 1 ? "s" : ""} fiscale${entity.fiscalParts > 1 ? "s" : ""}`
  if (entity.type === "company") return entity.legalStatus === "EI" ? "Entreprise individuelle au régime réel" : `Société à l'impôt sur les sociétés, capital social ${euros(entity.capitalSocial)}`
  const rfr = entity.rfrN2 === undefined ? "non renseigné" : euros(entity.rfrN2)
  return `ACRE : ${entity.beneficieACRE ? "oui" : "non"} ; versement libératoire demandé : ${entity.opteVFL ? "oui" : "non"} ; revenu fiscal de référence N-2 : ${rfr}`
}

function sectionActeurs(session: SimulationAnnuelle): string {
  if (session.entities.length === 0) return "## Acteurs\n\nAucun acteur saisi."
  const lignes = session.entities.map(e => [echapper(e.name), natureActeur(e), detailDeLActeur(e)])
  return `## Acteurs\n\n${tableau(["Nom", "Nature", "Détails"], lignes)}`
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
  const lignes = report.activities.map(a => [echapper(a.name), a.statut, euros(a.chiffreAffaires), euros(a.charges), euros(a.cotisationsSociales), euros(a.impotSocietes), euros(a.revenuVerse), euros(a.resultatConserve), a.beneficiaireIds.map(id => echapper(nomDeLActeur(session, id))).join(", ") || "—"])
  return `### Par activité\n\n${tableau(["Activité", "Statut", "Chiffre d'affaires", "Charges", "Cotisations sociales", "Impôt sur les sociétés", "Versé aux personnes", "Conservé", "Bénéficiaires"], lignes, colonnesNumeriques(2, 7))}`
}

const imposition = { pfu: "prélèvement forfaitaire unique", bareme: "barème progressif" }

function sousSectionFoyers(session: SimulationAnnuelle, report: SimulationReport): string {
  if (report.foyers.length === 0) return "### Par foyer fiscal\n\nAucun foyer fiscal."
  const lignes = report.foyers.map(f => [echapper(nomDuFoyer(session, f)), f.totalParts.toLocaleString("fr-FR"), euros(f.revenusEncaisses), euros(f.revenuImposableGlobal), euros(f.impotSurLeRevenu), euros(f.prelevementsSociaux), f.optionDividendes ? imposition[f.optionDividendes] : "—", `**${euros(f.netApresImpots)}**`])
  return `### Par foyer fiscal\n\n${tableau(["Foyer (membres)", "Parts", "Revenus encaissés", "Revenu imposable", "Impôt sur le revenu", "Prélèvements sociaux", "Imposition des dividendes", "Net après impôts"], lignes, [1, 2, 3, 4, 5, 7])}`
}

function sectionResultats(session: SimulationAnnuelle, report: SimulationReport | null): string {
  if (!report) return "## Résultats\n\nRésultats indisponibles : la simulation n'a pas pu être calculée."
  return `## Résultats ${report.annee} (règles fiscales ${report.anneeDesRegles})\n\nMontants annuels, avant les éventuelles dépenses personnelles.\n\n${[sousSectionBilan(report), sousSectionActivites(session, report), sousSectionFoyers(session, report)].join("\n\n")}`
}

// --- Comparateur ---

function totalDesFrais(options: ComparaisonOptions): string {
  const frais = options.fraisFonctionnement ?? defaultFraisFonctionnement()
  const postes = Object.keys(posteFraisLabels) as (keyof typeof posteFraisLabels)[]
  const libelles = { SASU: "SASU", EURL: "EURL", EI: "EI au réel", micro: "micro-entreprise" }
  return statutsFrais.map(statut => `${libelles[statut]} ${euros(postes.reduce((somme, poste) => somme + frais[statut][poste], 0))}`).join(", ")
}

/** La répartition choisie du bénéfice des sociétés, en une phrase. */
function descriptionRepartition(options: ComparaisonOptions): string {
  const { mode, partDistribuee } = options.repartition
  const remuneration = euros(options.remunerationNette)
  const descriptions: Record<ModeRepartition, string> = {
    dividendes: `rémunération nette de ${remuneration}, tout le bénéfice restant versé en dividendes`,
    remuneration: "la plus haute rémunération que la société peut verser, sans dividendes",
    personnalisee: `rémunération nette de ${remuneration}, ${pourcentage(partDistribuee)} du bénéfice distribuable versé en dividendes, le reste conservé dans la société`,
    grille: `rémunération nette de ${remuneration}, dividendes saisis dans la grille`
  }
  return `${libellesRepartition[mode]} (${descriptions[mode]})`
}

function reglagesUtilises(options: ComparaisonOptions): string {
  return [
    `- Bénéfice de la société en SASU et EURL : ${descriptionRepartition(options)}`,
    `- En micro-entreprise, part des prestations de services en BNC : ${pourcentage(options.partBncPrestations)} (le reste en BIC)`,
    `- Frais de fonctionnement annuels ajoutés aux charges : ${options.fraisFonctionnement ? totalDesFrais(options) : "aucun"}`
  ].join("\n")
}

function tableauDeComparaison(resultat: ComparaisonResult, nomActivite: string): string {
  const { scenarios } = resultat
  const actuel = scenarios.find(s => s.actuel)
  const entete = (s: ScenarioStatut) => {
    const mentions = [s.actuel ? "actuel" : null, s.statut === resultat.meilleur ? "meilleur net" : null].filter(Boolean)
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
  const intro = "L'activité est simulée dans chaque statut, le reste de la simulation restant identique. Les montants portent sur toute la simulation, sauf la ligne « Conservé », propre à l'activité. Comparaison calculée à l'export avec les réglages proposés par défaut :"
  const tableauOuAbsence = resultat.scenarios.length > 0 ? tableauDeComparaison(resultat, comparaison.nomActivite) + notesDeComparaison(resultat) : "Aucun statut comparé."
  return `${titre}\n\n${intro}\n\n${reglagesUtilises(options)}\n\n${tableauOuAbsence}${couplesEnUnionLibre(session, resultat)}`
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
export function rapportMarkdown({ session, report, comparaison, date }: DonneesDuRapport): string {
  const dateTexte = date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
  const regles = report ? `, année ${report.annee}, règles fiscales ${report.anneeDesRegles}` : `, année ${session.annee}`
  const entete = [
    `# Simulation « ${echapper(session.name)} »`,
    `Rapport exporté le ${dateTexte} depuis le Simulateur de revenus pour indépendants${regles}.`,
    "> Ce document décrit une simulation de revenus d'indépendants en France. Il se lit tel quel ou se confie à une IA (un assistant conversationnel) pour l'analyser : les montants sont annuels et en euros, sauf mention contraire.",
    `## Hypothèses et limites\n\n${LIMITES.map(l => `- ${l}`).join("\n")}`
  ]
  const sections = [sectionActeurs(session), sectionRelations(session), sectionFlux(session), sectionResultats(session, report), sectionComparateur(session, comparaison), sectionAvertissements(session, report, comparaison)]
  return `${[...entete, ...sections].join("\n\n")}\n`
}
