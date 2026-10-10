// src/backend/logic/colonne-du-comparateur.ts

import type { ComparaisonOptions, DonneesDeLAnnee, MicroEntreprise, ScenarioStatut, SimulationReport, StatutCompare } from "../../types.js"
import { depassePlafondMicro } from "./calculsAE.js"
import { estMicro, statutActuel, type Activite } from "./conversion-de-statut.js"
import { acreDeLAnnee, chiffreAffairesDeLaMicro, lireMois, prorataDesPlafonds } from "./dispositifs.js"
import { fraisDuStatut } from "./frais-de-fonctionnement.js"
import { professionDe, reglesDeLaMicro, retraiteMicroDeLaProfession } from "./professions.js"
import { evaluerProtectionSociale } from "./protection-sociale.js"
import type { ReglesFiscales } from "./regles.js"
import type { ContexteDeLAnnee } from "./simulation-engine.js"
import { LIBELLES_DES_STATUTS } from "./statuts.js"

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
}

/** Titre de chaque colonne : le nom du statut au réel, et les deux variantes de la micro-entreprise. */
const LIBELLES: Record<StatutCompare, string> = {
  ...LIBELLES_DES_STATUTS,
  micro: "Micro-entreprise",
  "micro-vfl": "Micro + versement libératoire"
}

type ActiviteDuRapport = SimulationReport["activities"][number] | undefined

/**
 * Ce que la micro-entreprise de la colonne donne à la protection sociale : son ACRE (mois couverts si la date de
 * création est connue, toute l'année sinon) et ses plafonds de l'année (au prorata l'année de création).
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
    prorata: prorataDesPlafonds(lireMois(micro?.dateDeCreation), annee),
    reglesMicro
  }
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
  return { remunerationBrute: activite?.cotisationsPresident?.brut ?? 0, assietteTNS: activite?.cotisationsTNS?.assiette ?? 0, ...(caisse ? { caisse } : {}) }
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

/** La colonne du statut, d'après la simulation de l'activité dans ce statut. */
export function scenarioDeLaColonne({ source, options, regles, contexte }: ColonneEtudiee, statut: StatutCompare, simulation: SimulationDeLaColonne): ScenarioStatut {
  const activite = simulation.report.activities.find(a => a.entityId === source.id)
  const caMicro = chiffreAffairesDeLaMicro(simulation.session.monthlyData, source.id)
  const { prorata, reglesMicro, ...acre } = microDeLaColonne(simulation, source.id, regles, contexte.annee ?? regles.annee)
  const { notes, ...ferme } = regimeFerme(statut, source.id, contexte)
  const { resultatConserveActivite, ...details } = detailsDeLActivite(activite, notes)
  return {
    statut,
    libelle: LIBELLES[statut],
    actuel: statut === statutActuel(source),
    fraisFonctionnement: fraisDuStatut(statut, options),
    protectionSociale: evaluerProtectionSociale(statut, { ...assiettesDeProtection(activite), chiffreAffairesMicro: caMicro, ...acre }, estMicro(statut) ? reglesMicro : regles),
    ...montantsDuBilan(simulation.report),
    resultatConserveActivite,
    horsPlafond: estMicro(statut) && depassePlafondMicro(caMicro, regles, prorata),
    ...ferme,
    ...details
  }
}
