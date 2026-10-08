// src/backend/logic/strategies-de-distribution.ts

/*
 * « Sur toutes les années » (voir l'ADR 012) : pour l'activité comparée, devenue SASU puis EURL, quelques façons de
 * distribuer le bénéfice au fil des années de la session, comparées sur le net cumulé de tous les foyers :
 * - tout distribuer chaque année : le bénéfice distribuable de l'année, comme le comparateur d'une année ;
 * - garder une part du bénéfice distribuable chaque année, et distribuer toutes les réserves la dernière ;
 * - lisser : le même montant chaque année, de sorte que tout soit distribué à la fin.
 *
 * Aucune règle n'est refaite ici : chaque stratégie fixe seulement les dividendes de chaque année, puis toutes les
 * années sont simulées par le moteur, réserves reportées d'une année à l'autre (simulation-pluriannuelle.ts).
 * Le bénéfice d'une année ne dépend pas des dividendes (l'IS, la réserve légale et les cotisations de la société n'en
 * dépendent pas, sauf la réserve légale après une perte) : une première simulation sans dividendes donne donc ce que
 * chaque année ajoute aux réserves, et ce qui reste disponible avant chaque distribution se calcule sans relancer le
 * moteur. Dans le cas rare où le moteur verse moins que prévu, la stratégie le signale.
 */

import type { AnneeDUneStrategie, ReglagesComparateur, ResultatDUneStrategie, SessionState, SimulationReport, StatutSociete, StrategieDeDistribution, StrategiesDeDistribution, StrategiesDUnStatut } from "../../types.js"
import { vueDeLAnnee } from "./annees.js"
import { activiteComparee, avecLaCFEDeLAnnee, sessionConvertie } from "./comparateur.js"
import { optionsDuComparateur, PART_MISE_EN_RESERVE_PAR_DEFAUT } from "./options-du-comparateur.js"
import { simulerLesAnnees, type AnneePreparee } from "./simulation-pluriannuelle.js"

/** Dividendes de chaque année, par année. */
type Plan = Map<number, number>

/** Les années simulées de la session pour l'activité dans ce statut, avec ces dividendes ; `null` : aucun dividende. */
function simulerAvec(session: SessionState, activityId: string, reglages: ReglagesComparateur | undefined, statut: StatutSociete, plan: Plan | null) {
  return simulerLesAnnees(session, ({ donnees, regles, contexte }: AnneePreparee) => {
    const source = activiteComparee(donnees, activityId)
    if (!source) return donnees
    const annee = contexte.annee ?? regles.annee
    // Les réglages de l'année : la rémunération saisie pour elle (sinon celle de sa grille), les frais avec sa CFE.
    const options = avecLaCFEDeLAnnee(optionsDuComparateur(vueDeLAnnee(session, annee), activityId, reglages), source, annee, regles).options
    return sessionConvertie(donnees, source, statut, options, plan?.get(annee) ?? 0)
  }).annees
}

/**
 * Ce que la société a de réserves au 1er janvier de la première année simulée, et ce que chaque année y ajoute sans
 * dividendes : son bénéfice après IS et réserve légale, ou sa perte (négatif).
 */
function capacites(rapports: SimulationReport[], activityId: string) {
  const reservesDe = (r: SimulationReport) => r.activities.find(a => a.entityId === activityId)?.reserves
  return {
    reservesDeDepart: reservesDe(rapports[0])?.auDebut.reserves ?? 0,
    parAnnee: rapports.map(r => {
      const reserves = reservesDe(r)
      return { annee: r.annee, benefice: reserves ? reserves.aLaFin.reserves - reserves.auDebut.reserves : 0 }
    })
  }
}

/**
 * Les dividendes de chaque année selon la stratégie. Chacun reste dans ce qui est disponible cette année-là : réserves
 * au 1er janvier et bénéfice de l'année, une perte de l'année les diminuant.
 */
function planifier(strategie: StrategieDeDistribution, partMiseEnReserve: number, { reservesDeDepart, parAnnee }: ReturnType<typeof capacites>): Plan {
  const plan: Plan = new Map()
  const n = parAnnee.length
  const total = reservesDeDepart + parAnnee.reduce((somme, a) => somme + a.benefice, 0)
  let reserves = reservesDeDepart
  parAnnee.forEach(({ annee, benefice }, i) => {
    const disponible = reserves + benefice
    const derniere = i === n - 1
    const voulus = { toutDistribuer: benefice, garderPuisDistribuer: derniere ? disponible : benefice * (1 - partMiseEnReserve), lisser: derniere ? disponible : total / n }[strategie]
    const dividendes = Math.max(0, Math.min(disponible, voulus))
    plan.set(annee, dividendes)
    reserves = disponible - dividendes
  })
  return plan
}

function libelle(strategie: StrategieDeDistribution, partMiseEnReserve: number): string {
  const pourcentage = `${Math.round(partMiseEnReserve * 100)} %`
  return { toutDistribuer: "Tout distribuer chaque année", garderPuisDistribuer: `Garder ${pourcentage} et distribuer la dernière année`, lisser: "Lisser les dividendes" }[strategie]
}

function resultatDeLaStrategie(strategie: StrategieDeDistribution, partMiseEnReserve: number, rapports: SimulationReport[], activityId: string): ResultatDUneStrategie {
  const annees: AnneeDUneStrategie[] = rapports.map(r => {
    const activite = r.activities.find(a => a.entityId === activityId)
    const partage = activite?.partage
    return {
      annee: r.annee,
      dividendes: Math.round(partage ? partage.dividendesNets + partage.cotisationsSurDividendes : 0),
      netApresImpots: r.totalNetApresImpots,
      totalPrelevements: r.bilan.totalPrelevements,
      reservesALaFin: Math.round(activite?.reserves?.aLaFin.reserves ?? 0)
    }
  })
  const warnings = rapports.flatMap(r => (r.activities.find(a => a.entityId === activityId)?.warnings ?? []).filter(w => w.startsWith("Dividendes saisis")).map(w => `${r.annee} : ${w}`))
  return {
    strategie,
    libelle: libelle(strategie, partMiseEnReserve),
    netCumule: annees.reduce((somme, a) => somme + a.netApresImpots, 0),
    prelevementsCumules: annees.reduce((somme, a) => somme + a.totalPrelevements, 0),
    reservesALaFin: annees[annees.length - 1]?.reservesALaFin ?? 0,
    annees,
    warnings
  }
}

/** La stratégie au meilleur net cumulé ; `null` quand toutes se valent à l'euro près. */
function meilleure(strategies: ResultatDUneStrategie[]): StrategieDeDistribution | null {
  const nets = strategies.map(s => s.netCumule)
  if (Math.max(...nets) - Math.min(...nets) < 1) return null
  return strategies.reduce((a, b) => (b.netCumule > a.netCumule ? b : a)).strategie
}

function strategiesDuStatut(session: SessionState, activityId: string, reglages: ReglagesComparateur | undefined, statut: StatutSociete, partMiseEnReserve: number): StrategiesDUnStatut {
  const rapportsDe = (plan: Plan | null) => simulerAvec(session, activityId, reglages, statut, plan).flatMap(a => (a.report ? [a.report] : []))
  const capacite = capacites(rapportsDe(null), activityId)
  const strategies = (["toutDistribuer", "garderPuisDistribuer", "lisser"] as const).map(strategie => resultatDeLaStrategie(strategie, partMiseEnReserve, rapportsDe(planifier(strategie, partMiseEnReserve, capacite)), activityId))
  return { statut, strategies, meilleure: meilleure(strategies) }
}

/**
 * Compare les stratégies de distribution de l'activité, en SASU et en EURL, sur toutes les années de la session. Les
 * années sans règles connues ne sont pas simulées ; une année au-delà des dernières règles reprend celles-ci.
 */
export function comparerStrategiesDeDistribution(session: SessionState, activityId: string, reglages: ReglagesComparateur | undefined): StrategiesDeDistribution {
  const partMiseEnReserve = Math.min(1, Math.max(0, reglages?.partMiseEnReserve ?? PART_MISE_EN_RESERVE_PAR_DEFAUT))
  const simulees = simulerLesAnnees(session).annees
  const notes = simulees.filter(a => a.erreur !== null).map(a => `${a.annee} n'est pas comptée : ${a.erreur}`)
  const derniereRegle = simulees.flatMap(a => (a.report ? [a.report] : [])).find(r => r.anneeDesRegles !== r.annee)
  if (derniereRegle) notes.push(`À partir de ${derniereRegle.annee}, les années reprennent les règles de ${derniereRegle.anneeDesRegles}, les dernières connues : le résultat n'est qu'une projection.`)
  return {
    annees: simulees.filter(a => a.report !== null).map(a => a.annee),
    partMiseEnReserve,
    statuts: (["SASU", "EURL"] as const).map(statut => strategiesDuStatut(session, activityId, reglages, statut, partMiseEnReserve)),
    notes
  }
}
