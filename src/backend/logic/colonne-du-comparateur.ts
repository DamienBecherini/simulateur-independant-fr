// src/backend/logic/colonne-du-comparateur.ts

import { estSocieteIS, type ComparaisonOptions, type ConditionsPortageRetenues, type DetailPortage, type DonneesDeLAnnee, type MicroEntreprise, type ModeRepartition, type PartageDuBenefice, type RaisonPortageNonRetenu, type RemunerationPlafonnee, type ScenarioStatut, type SimulationReport, type StatutCompare } from "../../types.js"
import { depassePlafondMicro } from "./calculsAE.js"
import { estMicro, statutActuel, type Activite } from "./conversion-de-statut.js"
import { acreDeLAnnee, chiffreAffairesDeLaMicro, chiffreAffairesReuni, microsReunies, prorataDeLEntreprise } from "./dispositifs.js"
import { noteDuPortageEnZone } from "./exoneration-de-zone.js"
import { ecartDeFrais } from "./frais-de-fonctionnement.js"
import { beneficeGarde, perteDeLaSociete } from "./net-compare.js"
import { conditionsPortageParDefaut, LIBELLES_DES_CONDITIONS_PORTAGE } from "./options-du-comparateur.js"
import { euros, pourcent } from "./format.js"
import { professionDe, reglesDeLaMicro, retraiteMicroDeLaProfession } from "./professions.js"
import { evaluerProtectionSociale } from "./protection-sociale.js"
import { periodeDeLActivite, reglesDeLaPeriode } from "./annee-de-creation.js"
import type { ReglesFiscales } from "./regles.js"
import type { ContexteDeLAnnee } from "./simulation-engine.js"
import { LIBELLE_DU_PORTAGE, LIBELLES_DES_STATUTS } from "./statuts.js"

/*
 * Une colonne du comparateur : ce qu'elle étudie (`ColonneEtudiee` : l'année, l'activité, les réglages, les règles et le
 * contexte, que les fonctions du comparateur et de l'optimiseur se passent d'un bloc), et ce qu'elle affiche
 * (`ScenarioStatut`) d'après la simulation de l'activité dans un statut : montants du bilan, protection sociale du
 * dirigeant, plafonds de la micro-entreprise, notes de l'année.
 */

/** Ce qu'étudie une colonne, quel que soit son statut. */
export interface ColonneEtudiee {
  /** Les données de l'année, l'activité dans son statut actuel. */
  donnees: DonneesDeLAnnee
  /** L'activité comparée, telle que la décrivent ces données. */
  source: Activite
  options: ComparaisonOptions
  regles: ReglesFiscales
  contexte: ContexteDeLAnnee
}

/** L'activité simulée dans le statut de la colonne. */
export interface SimulationDeLaColonne {
  report: SimulationReport
  /** Les données simulées : l'activité convertie, avec sa rémunération, ses dividendes et ses frais. */
  session: DonneesDeLAnnee
  /** Dividendes calculés selon la répartition choisie ; `null` quand ce sont ceux de la grille. */
  dividendes: number | null
  /** La rémunération choisie dépassait ce que la société peut verser sans déficit : celle demandée, et celle simulée. */
  remunerationPlafonnee?: RemunerationPlafonnee
}

/** Titre de chaque colonne : le nom du statut au réel, les deux variantes de la micro-entreprise, le portage salarial. */
const LIBELLES: Record<StatutCompare, string> = {
  ...LIBELLES_DES_STATUTS,
  micro: "Micro-entreprise",
  "micro-vfl": "Micro + versement libératoire",
  portage: LIBELLE_DU_PORTAGE
}

/**
 * Colonne du statut actuel d'une société dont le partage du bénéfice ne suit pas la grille : ce n'est plus la situation
 * saisie, son titre dit selon quel partage elle est simulée.
 */
const PARTAGE_DE_LA_COLONNE: Record<Exclude<ModeRepartition, "grille">, string> = {
  meilleurNet: "rémunération optimisée",
  dividendes: "rémunération choisie",
  remuneration: "tout en rémunération",
  personnalisee: "répartition sur mesure"
}

/** Libellé d'un statut dans le comparateur : « Micro + versement libératoire », « EI au réel »… */
export function libelleDuStatut(statut: StatutCompare): string {
  return LIBELLES[statut]
}

/**
 * La colonne est-elle la situation telle que saisie ? Oui pour le statut actuel, sauf en société quand le partage du
 * bénéfice ne suit pas la grille : la rémunération et les dividendes y sont alors ceux du partage choisi.
 */
export function estTelleQueSaisie(statut: StatutCompare, source: Activite, options: ComparaisonOptions): boolean {
  return statut === statutActuel(source) && (!estSocieteIS(statut) || options.repartition.mode === "grille")
}

/**
 * Titre de la colonne : le statut, et pour le statut actuel simulé avec un autre partage que la grille, ce partage. Au
 * meilleur net, la colonne est simulée à la rémunération retenue (partage « dividendes ») : son titre se lit avec les
 * réglages du comparateur.
 */
export function libelleDeLaColonne(statut: StatutCompare, source: Activite, options: ComparaisonOptions): string {
  const { mode } = options.repartition
  if (mode === "grille" || statut !== statutActuel(source) || !estSocieteIS(statut)) return LIBELLES[statut]
  return `${LIBELLES[statut]}, ${PARTAGE_DE_LA_COLONNE[mode]}`
}

type ActiviteDuRapport =SimulationReport["activities"][number] | undefined

/**
 * Ce que la micro-entreprise de la colonne donne à la protection sociale : son ACRE (mois couverts si la date de
 * création est connue, toute l'année sinon), et si elle dépasse ses plafonds de l'année (au prorata l'année de création).
 * Les plafonds se jugent sur le chiffre d'affaires de toutes les micro-entreprises de son titulaire, qui ne forment
 * qu'une entreprise.
 */
function microDeLaColonne(simulation: SimulationDeLaColonne, activiteId: string, regles: ReglesFiscales, annee: number) {
  const micro = simulation.session.entities.find((e): e is MicroEntreprise => e.id === activiteId && e.type === "micro-entreprise")
  // Un micro-entrepreneur de la CIPAV a son taux global et sa part de retraite de base (ADR 015).
  const profession = micro ? professionDe(micro, regles) : null
  const reglesMicro = reglesDeLaMicro(regles, profession)
  const retraite = retraiteMicroDeLaProfession(regles, profession)
  const acre = micro ? acreDeLAnnee(micro, annee, simulation.session.monthlyData, reglesMicro) : null
  return {
    beneficieACRE: micro?.beneficieACRE ?? false,
    ...(acre ? { acre: { reduction: acre.reduction, chiffreAffaires: acre.chiffreAffaires } } : {}),
    ...(retraite ? { retraiteBnc: retraite } : {}),
    horsPlafond: micro ? plafondsDepasses(simulation, micro, regles, annee) : false,
    reglesMicro
  }
}

function plafondsDepasses(simulation: SimulationDeLaColonne, micro: MicroEntreprise, regles: ReglesFiscales, annee: number): boolean {
  const micros = microsReunies(simulation.session, micro.id).filter((e): e is MicroEntreprise => e.type === "micro-entreprise")
  return depassePlafondMicro(chiffreAffairesReuni(simulation.session.monthlyData, micros.map(m => m.id)), regles, prorataDeLEntreprise(micros, annee))
}

/** Colonne micro d'une activité sortie du régime micro cette année : le régime fermé et pourquoi, dans les notes. */
function regimeFerme(statut: StatutCompare, activiteId: string, contexte: ContexteDeLAnnee): Pick<ScenarioStatut, "regimeMicroFerme"> & { notes: string[] } {
  const sortie = estMicro(statut) ? contexte.regimeMicro?.sorties[activiteId] : undefined
  if (!sortie) return { notes: [] }
  return { regimeMicroFerme: sortie, notes: [`Régime micro fermé en ${contexte.annee ?? sortie.depuis} : chiffre d'affaires au-delà des plafonds en ${sortie.depassements[0]} et ${sortie.depassements[1]}, sortie au 1er janvier ${sortie.depuis}. Cette colonne n'est donnée qu'à titre de comparaison.`] }
}

/**
 * Ce sur quoi le dirigeant cotise dans la colonne : rémunération brute du président, assiette du travailleur non salarié
 * et, pour une profession libérale réglementée, sa caisse.
 */
function assiettesDeProtection(activite: ActiviteDuRapport) {
  const caisse = activite?.cotisationsTNS?.caisse?.caisse
  return { remunerationBrute: activite?.cotisationsPresident?.brut ?? 0, assietteTNS: activite?.cotisationsTNS?.assiette ?? 0, ...salaireDuPorte(activite), ...(caisse ? { caisse } : {}) }
}

/** Le salaire brut versé dans l'année au salarié porté, sur lequel il cotise à la retraite de base. */
function salaireDuPorte(activite: ActiviteDuRapport): { salaireBrutPorte?: number } {
  return activite?.portage ? { salaireBrutPorte: activite.portage.brutVerse } : {}
}

/**
 * Ce que la colonne du portage salarial dit de plus (voir l'ADR 016) : pourquoi elle n'est pas retenue (aucune
 * prestation de services à facturer, des frais supérieurs au chiffre d'affaires, des salariés qu'un salarié porté ne
 * peut pas avoir), les conditions de la société
 * prises à leur valeur typique, une exonération en zone franche qu'il n'y a plus, faute de bénéfice, une profession
 * réglementée qui perd sa caisse. Rien pour les autres colonnes.
 */
function colonneDuPortage(statut: StatutCompare, { source, regles }: Pick<ColonneEtudiee, "source" | "regles">, annee: number, simulation: SimulationDeLaColonne, activite: ActiviteDuRapport): Pick<ScenarioStatut, "portageNonRetenu"> & { notes: string[] } {
  if (statut !== "portage") return { notes: [] }
  const raison = raisonPortageNonRetenu(source.id, simulation.session, activite?.portage)
  const notes = raison ? [NOTE_PORTAGE_NON_RETENU[raison]] : []
  const typiques = activite?.portage?.valeursTypiques ?? []
  if (typiques.length > 0) notes.push(noteDesValeursTypiques(typiques))
  const zone = noteDuPortageEnZone(source, annee, regles)
  if (zone) notes.push(zone)
  if (professionDe(source, regles)) notes.push("Le salarié porté relève du régime général, sans la caisse de sa profession libérale ; ses prestations sont facturées à des entreprises clientes (code du travail, art. L1254-1) : vérifiez que votre profession et votre clientèle s'y prêtent.")
  return { ...(raison ? { portageNonRetenu: raison } : {}), notes }
}

/** Les conditions de la société de portage prises à leur valeur typique, toutes ou celles qui le sont. */
function noteDesValeursTypiques(typiques: (keyof ConditionsPortageRetenues)[]): string {
  if (typiques.length === Object.keys(LIBELLES_DES_CONDITIONS_PORTAGE).length) return `Conditions typiques d'une société de portage (frais de gestion de ${pourcent(conditionsPortageParDefaut().tauxFraisDeGestion)}, CDI) : à remplacer par celles de la vôtre.`
  return `Conditions de la société de portage à leur valeur typique (${typiques.map(cle => LIBELLES_DES_CONDITIONS_PORTAGE[cle]).join(", ")}) : à remplacer par celles de la vôtre.`
}

/** Ce que dit la colonne du portage salarial quand elle n'est pas retenue. */
const NOTE_PORTAGE_NON_RETENU: Record<RaisonPortageNonRetenu, string> = {
  sansPrestations: "Sans prestations de services, rien à facturer en portage salarial : cette colonne n'est pas retenue.",
  aDecouvert: "Une société de portage ne fait pas crédit : les frais de l'activité dépassent son chiffre d'affaires, et le compte d'activité serait à découvert. Cette colonne n'est pas retenue.",
  salaries: "Un salarié porté n'emploie personne : le coût des salariés de l'activité n'est pas compté dans cette colonne, qui n'est pas retenue."
}

/** Pourquoi l'activité convertie en portage ne peut pas tenir lieu de l'activité ; `null` si elle le peut. */
function raisonPortageNonRetenu(activiteId: string, session: DonneesDeLAnnee, portage: DetailPortage | undefined): RaisonPortageNonRetenu | null {
  const vente = session.monthlyData.some(mois => mois.flows.some(f => f.entityId === activiteId && f.type === "ca_vente" && f.amount > 0))
  if ((portage?.chiffreAffaires ?? 0) <= 0 && vente) return "sansPrestations"
  // Frais de gestion et frais professionnels au-delà du chiffre d'affaires : aucun salaire, et un compte à découvert.
  if (portage && portage.chiffreAffaires - portage.fraisDeGestion - portage.fraisProfessionnels < 0) return "aDecouvert"
  return session.relationships.some(rel => rel.type === "Salarié" && (rel.toId === activiteId || rel.fromId === activiteId)) ? "salaries" : null
}

/** Les montants du foyer et des prélèvements, d'après le bilan de toute la simulation. */
function montantsDuBilan({ totalNetApresImpots, bilan }: SimulationReport) {
  return {
    netApresImpots: totalNetApresImpots,
    revenusAvantPrelevements: bilan.revenusAvantPrelevements,
    totalPrelevements: bilan.totalPrelevements,
    cotisationsSociales: bilan.cotisationsSociales + bilan.cotisationsSalariales,
    impotSocietes: bilan.impotSocietes,
    impotSurLeRevenu: bilan.impotSurLeRevenu,
    prelevementsSociaux: bilan.prelevementsSociaux,
    resultatConserve: bilan.resultatConserve
  }
}

/** Ce que la colonne reprend de l'activité dans le rapport : bénéfice gardé, notes, partage et réserves. */
function detailsDeLActivite(activite: ActiviteDuRapport, notes: string[]) {
  return {
    resultatConserveActivite: Math.round(activite?.resultatConserve ?? 0),
    // Les dispositifs de l'année (sortie du régime micro, ACRE…) rejoignent les notes de la colonne.
    warnings: [...notes, ...(activite?.dispositifs ?? []), ...(activite?.warnings ?? [])],
    ...(activite?.partage ? { partage: activite.partage } : {}),
    ...(activite?.reserves ? { reserves: activite.reserves } : {})
  }
}

/** Ce que dit la colonne d'une société dont la rémunération choisie a été ramenée à ce qu'elle peut verser. */
function noteDuPlafond(statut: StatutCompare, plafond: RemunerationPlafonnee | undefined): string[] {
  if (!plafond) return []
  const demandee = euros(plafond.demandee)
  if (plafond.retenue <= 0) return [`Aucune rémunération retenue, au lieu des ${demandee} choisis : en ${LIBELLES[statut]}, l'activité ne dégage pas de bénéfice à verser.`]
  return [`Rémunération limitée à ${euros(plafond.retenue)} nets, au lieu des ${demandee} choisis : en ${LIBELLES[statut]}, la société ne peut pas verser davantage sans déficit.`]
}

/**
 * La société verse-t-elle une rémunération alors qu'elle est déficitaire ? Possible avec les montants de la grille
 * seulement : une rémunération choisie dans les réglages est ramenée à ce que la société peut verser.
 */
function remunerationNonCouverte(partage: PartageDuBenefice | undefined): boolean {
  return partage !== undefined && partage.remunerationNette > 0 && perteDeLaSociete(partage) > 0.5
}

/**
 * La perte de l'année que le net du foyer ne montre pas, en euros positifs : celle d'une société déficitaire, ou le
 * découvert du compte d'une activité en portage dont les frais dépassent le chiffre d'affaires (voir net-compare.ts).
 */
function perteConservee(statut: StatutCompare, activite: ActiviteDuRapport): number {
  if (statut === "portage") return Math.max(0, -(activite?.resultatConserve ?? 0))
  return perteDeLaSociete(activite?.partage)
}

/** La colonne du statut, d'après la simulation de l'activité dans ce statut. */
export function scenarioDeLaColonne({ source, options, regles, contexte }: ColonneEtudiee, statut: StatutCompare, simulation: SimulationDeLaColonne): ScenarioStatut {
  const activite = simulation.report.activities.find(a => a.entityId === source.id)
  const caMicro = chiffreAffairesDeLaMicro(simulation.session.monthlyData, source.id)
  const { horsPlafond, reglesMicro, ...acre } = microDeLaColonne(simulation, source.id, regles, contexte.annee ?? regles.annee)
  const { notes, ...ferme } = regimeFerme(statut, source.id, contexte)
  const { notes: notesDuPortage, ...portage } = colonneDuPortage(statut, { source, regles }, contexte.annee ?? regles.annee, simulation, activite)
  const { resultatConserveActivite, ...details } = detailsDeLActivite(activite, [...notes, ...notesDuPortage, ...noteDuPlafond(statut, simulation.remunerationPlafonnee)])
  return {
    statut,
    libelle: libelleDeLaColonne(statut, source, options),
    actuel: statut === statutActuel(source),
    telleQueSaisie: estTelleQueSaisie(statut, source, options),
    ecartDeFrais: ecartDeFrais(statut, statutActuel(source), options),
    // Au réel, les règles de la période de l'activité : sans minimum de retraite de base sous 90 jours d'activité (ADR 020).
    protectionSociale: evaluerProtectionSociale(statut, { ...assiettesDeProtection(activite), chiffreAffairesMicro: caMicro, ...acre }, estMicro(statut) ? reglesMicro : reglesDeLaPeriode(regles, periodeDeLActivite(source.dateDeCreation, contexte.annee ?? regles.annee))),
    ...montantsDuBilan(simulation.report),
    resultatConserveActivite,
    horsPlafond,
    ...ferme,
    ...portage,
    ...(simulation.remunerationPlafonnee ? { remunerationPlafonnee: simulation.remunerationPlafonnee } : {}),
    ...(remunerationNonCouverte(activite?.partage) ? { remunerationNonCouverte: true as const } : {}),
    ...(perteConservee(statut, activite) >= 0.5 ? { perteConservee: perteConservee(statut, activite) } : {}),
    ...(beneficeGarde(resultatConserveActivite) === undefined ? {} : { beneficeGarde: resultatConserveActivite }),
    ...details
  }
}
