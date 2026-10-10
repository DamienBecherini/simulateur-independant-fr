// src/backend/logic/bilan-de-la-simulation.ts
// Bilan d'une année : ce que produisent les activités et les revenus directs, et ce qui part en prélèvements, additionné
// sur les résultats déjà arrondis des activités, des personnes et des foyers.

import type { ActivityResult, FoyerFiscalResult, PersonResult, SimulationBilan } from "../../types.js"
import { somme, type Contexte } from "./routage-des-flux.js"

/** Vue d'ensemble : ce que produisent les activités et les revenus directs, et ce qui part en prélèvements. */
export function calculerBilan(ctx: Contexte, activities: ActivityResult[], persons: PersonResult[], foyers: FoyerFiscalResult[]): SimulationBilan {
  const chiffreAffaires = somme(activities, a => a.chiffreAffaires)
  const charges = somme(activities, a => a.charges)
  const revenusDirects = somme(persons, p => p.revenusDirects)
  const cotisationsSalariales = somme(persons, p => p.cotisationsSalariales)
  const cotisationsSociales = somme(activities, a => a.cotisationsSociales)
  const impotSocietes = somme(activities, a => a.impotSocietes)
  const impotSurLeRevenu = somme(foyers, f => f.impotSurLeRevenu)
  const prelevementsSociaux = somme(foyers, f => f.prelevementsSociaux)

  return {
    chiffreAffaires,
    charges,
    revenusDirects,
    cotisationsSalariales,
    revenusAvantPrelevements: chiffreAffaires - charges + revenusDirects + cotisationsSalariales,
    cotisationsSociales,
    impotSocietes,
    impotSurLeRevenu,
    prelevementsSociaux,
    totalPrelevements: cotisationsSociales + cotisationsSalariales + impotSocietes + impotSurLeRevenu + prelevementsSociaux,
    resultatConserve: somme(activities, a => a.resultatConserve),
    nonRattache: Math.round(ctx.nonRattache)
  }
}
