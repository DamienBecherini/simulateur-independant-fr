// src/backend/logic/simulation-engine.ts
// Point d'entrée du moteur pour une année (`runMetaSimulation`) : il enchaîne les étapes, écrites dans des modules à
// part : routage-des-flux.ts (contexte, totaux, versements aux personnes), simulation-au-reel.ts (sociétés à l'IS,
// entreprise individuelle), simulation-micro.ts (micro-entreprise), simulation-portage.ts (portage salarial), details-des-activites.ts (ce qui est commun aux
// activités), impot-du-foyer.ts (personnes, frais professionnels, impôt du foyer), bilan-de-la-simulation.ts (bilan).

import type { ActivityResult, Company, DonneesDeLAnnee, MicroEntreprise, Person, Portage, SimulationReport } from "../../types.js"
import { buildFoyers } from "./foyers.js"
import type { ReglesFiscales } from "./regles.js"
import { aggregateAnnualFlowsByEntity, anneeSimulee, bulletinsDesSalaries, cotisationsSalarialesParPersonne, somme, type Contexte, type ContexteDeLAnnee } from "./routage-des-flux.js"
import { anneeDeCreation } from "./annee-de-creation.js"
import { ecrireMois } from "./dispositifs.js"
import { SIMULATION_PAR_STATUT } from "./simulation-au-reel.js"
import { simulerMicroEntreprise } from "./simulation-micro.js"
import { simulerPortage } from "./simulation-portage.js"
import { calculerFoyer, deductionsDuRevenuProfessionnel, resultatPersonne } from "./impot-du-foyer.js"
import { calculerBilan } from "./bilan-de-la-simulation.js"
import type { DeductionDuRevenuProfessionnel } from "../../types.js"

export type { ContexteDeLAnnee } from "./routage-des-flux.js"

/*
 * Le calcul va dans un seul sens :
 *   1. chaque activité calcule son résultat annuel et ce qu'elle verse aux personnes ;
 *   2. ces versements sont inscrits sur le compte de chaque personne ;
 *   3. l'impôt sur le revenu est calculé une seule fois par foyer, sur l'ensemble de ses revenus.
 * Une exception, l'épargne retraite (ADR 021) : ce qui dépasse les plafonds du revenu global d'une personne se déduit
 * du bénéfice de son entreprise individuelle au réel ou de sa rémunération de gérant d'EURL, dans une limite calculée sur
 * ce bénéfice ou cette rémunération. Un premier calcul des activités les mesure ; s'il y a une déduction, les activités
 * sont calculées une seconde fois avec elle. Elle ne change ni les cotisations ni ce qui est versé, seulement le revenu
 * imposable : le second calcul ne déplace donc pas la limite.
 */

function simulerActivite(ctx: Contexte, activite: Company | MicroEntreprise | Portage): ActivityResult {
  if (activite.type === "micro-entreprise") return avecLAnneeDeCreation(simulerMicroEntreprise(ctx, activite), activite.dateDeCreation, anneeSimulee(ctx))
  if (activite.type === "portage") return simulerPortage(ctx, activite)
  return avecLAnneeDeCreation(SIMULATION_PAR_STATUT[activite.legalStatus](ctx, activite), activite.dateDeCreation, anneeSimulee(ctx))
}

/**
 * Le résultat d'une activité, avec son année de création quand l'année simulée l'est (ADR 020). Les limites réduites,
 * propres au statut, sont celles que le calcul de l'activité y a déjà mises (simulation-au-reel.ts).
 */
function avecLAnneeDeCreation(resultat: ActivityResult, dateDeCreation: string | undefined, annee: number): ActivityResult {
  const creation = anneeDeCreation(dateDeCreation, annee)
  return creation ? { ...resultat, anneeDeCreation: { ...resultat.anneeDeCreation, creation: ecrireMois(creation.creation), mois: creation.mois } } : resultat
}

function arrondirActivite(activite: ActivityResult): ActivityResult {
  return {
    ...activite,
    chiffreAffaires: Math.round(activite.chiffreAffaires),
    charges: Math.round(activite.charges),
    cotisationsSociales: Math.round(activite.cotisationsSociales),
    impotSocietes: Math.round(activite.impotSocietes),
    revenuVerse: Math.round(activite.revenuVerse),
    resultatConserve: Math.round(activite.resultatConserve)
  }
}

/** Le calcul de chaque activité de la session, qui inscrit sur le compte des personnes ce qu'elle leur verse. */
function simulerLesActivites(ctx: Contexte): ActivityResult[] {
  return ctx.session.entities.filter((e): e is Company | MicroEntreprise | Portage => e.type !== "person").map(activite => arrondirActivite(simulerActivite(ctx, activite)))
}

export function runMetaSimulation(session: DonneesDeLAnnee, regles: ReglesFiscales, contexte: ContexteDeLAnnee = {}): SimulationReport {
  const foyersFiscaux = buildFoyers(session, regles.IR.partsParEnfant)
  const flux = aggregateAnnualFlowsByEntity(session)
  const salaries = bulletinsDesSalaries(session, flux, regles, contexte.annee ?? regles.annee)
  const cotisationsSalariales = cotisationsSalarialesParPersonne(session, flux, salaries)
  /** Un contexte neuf, aucun revenu encore inscrit, pour un calcul des activités avec ces déductions d'épargne retraite. */
  const nouveauContexte = (deductionsDuRevenuProfessionnel: ReadonlyMap<string, DeductionDuRevenuProfessionnel>): Contexte => ({ session, regles, annee: contexte, foyers: foyersFiscaux, flux, cotisationsSalariales, salaries, revenus: new Map(), nonRattache: 0, deductionsDuRevenuProfessionnel, revenusProfessionnelsDeductibles: [] })

  // Les activités d'abord : elles alimentent les revenus des personnes, dont dépend l'impôt des foyers.
  const sansDeduction = nouveauContexte(new Map())
  const calculees = simulerLesActivites(sansDeduction)
  // Puis, s'il y a lieu, une seconde fois avec ce qui se déduit du bénéfice ou de la rémunération (voir plus haut).
  const deductions = deductionsDuRevenuProfessionnel(sansDeduction)
  const ctx = deductions.size > 0 ? nouveauContexte(deductions) : sansDeduction
  const activities = ctx === sansDeduction ? calculees : simulerLesActivites(ctx)
  const persons = session.entities.filter((e): e is Person => e.type === "person").map(personne => resultatPersonne(ctx, personne))
  const foyers = foyersFiscaux.map(foyer => calculerFoyer(ctx, foyer, sansDeduction))

  return {
    annee: contexte.annee ?? regles.annee,
    anneeDesRegles: regles.annee,
    avertissements: contexte.avertissements ?? [],
    bilan: calculerBilan(ctx, activities, persons, foyers),
    activities,
    persons,
    foyers,
    totalNetApresImpots: somme(foyers, f => f.netApresImpots)
  }
}
