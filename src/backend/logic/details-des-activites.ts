// src/backend/logic/details-des-activites.ts
// Ce que le calcul de toute activité (société, entreprise individuelle, micro-entreprise) traite de la même façon :
// coût de ses salariés, déplacements professionnels au barème kilométrique, profession réglementée, et les champs du
// résultat qui les décrivent.

import type { ActivityResult, Company, MicroEntreprise } from "../../types.js"
import { montantBaremeKilometrique } from "./frais-kilometriques.js"
import type { ProfessionReglementee, ReglesFiscales } from "./regles.js"
import { professionDeLActivite } from "./professions.js"
import { somme, type Contexte } from "./routage-des-flux.js"

/**
 * Masse salariale d'une activité : ses salariés, leurs salaires bruts (des charges) et les cotisations patronales
 * nettes de la réduction générale (des cotisations sociales), le tout déductible du résultat.
 */
export function masseSalariale(ctx: Contexte, activiteId: string) {
  const salaries = [...ctx.salaries.values()].filter(s => s.employeurId === activiteId).map(s => s.bulletin)
  const bruts = somme(salaries, s => s.brut)
  const patronales = somme(salaries, s => s.coutEmployeur - s.brut)
  return { salaries, bruts, patronales, cout: bruts + patronales }
}

/** Champs du résultat d'une activité qui décrivent ses salariés, s'il en a. */
export function detailSalaries(masse: ReturnType<typeof masseSalariale>): Pick<ActivityResult, "salaries"> {
  return masse.salaries.length > 0 ? { salaries: masse.salaries } : {}
}

/**
 * Déplacements professionnels d'une activité avec une voiture personnelle, au barème kilométrique de l'année : une charge
 * réelle. En société, ce sont les indemnités kilométriques remboursées au dirigeant : déductibles pour la société, ni
 * imposables ni soumises à cotisations pour lui (article 81, 1° du CGI), et neutres pour sa trésorerie, puisqu'elles
 * couvrent les frais de voiture qu'il a payés. En entreprise individuelle, une charge déductible (option des BNC pour le
 * barème ; en BIC, une approximation des frais réels de la voiture). En micro-entreprise, une dépense jamais déductible.
 */
export function deplacementsProfessionnels(ctx: Contexte, activite: Company | MicroEntreprise): number {
  const deplacements = activite.deplacementsProfessionnels
  return deplacements ? montantBaremeKilometrique(deplacements.kmParAn, deplacements, ctx.regles.baremeKilometrique) : 0
}

/** Champ du résultat d'une activité qui décrit ses déplacements professionnels, s'il y en a. */
export function detailDeplacements(activite: Company | MicroEntreprise, montant: number, deductible: boolean): Pick<ActivityResult, "fraisDeDeplacement"> {
  const kilometres = activite.deplacementsProfessionnels?.kmParAn ?? 0
  return montant > 0 ? { fraisDeDeplacement: { kilometres, montant: Math.round(montant), deductible } } : {}
}

/** Champ du résultat d'une activité qui décrit sa profession réglementée, si elle en a une. */
export function detailProfession(profession: ProfessionReglementee | null, regles: ReglesFiscales, enMicro: boolean): Pick<ActivityResult, "profession"> {
  const detail = professionDeLActivite(profession, regles, enMicro)
  return detail ? { profession: detail } : {}
}
