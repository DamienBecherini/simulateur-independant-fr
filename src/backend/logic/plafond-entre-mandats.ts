// src/backend/logic/plafond-entre-mandats.ts
// Le plafond de la sécurité sociale d'un président rémunéré par plusieurs SASU : chacune n'en applique que sa part, au
// prorata des rémunérations qu'elle verse (article L242-3 du code de la sécurité sociale ; BOSS, « Assiette générale »,
// § 960 et 1130, qui l'étend aux mandataires sociaux et au cumul de plusieurs mandats). La répartition vaut aussi pour
// les tranches de l'Agirc-Arrco (la tranche 2 va jusqu'à huit fois le plafond réparti).

import { brutPourUnNet } from "./cotisationsSalarie.js"
import type { ReglesRegimeGeneral } from "./regles.js"

/** Règles du régime général d'une société qui n'applique que cette part du plafond. */
export function avecUnePartDuPlafond(regles: ReglesRegimeGeneral, part: number): ReglesRegimeGeneral {
  return part >= 1 ? regles : { ...regles, plafondSecuriteSociale: regles.plafondSecuriteSociale * part }
}

/** Parts du plafond au prorata des bruts ; 1 pour chacun sans rémunération ailleurs. */
function partsDesBruts(bruts: number[]): number[] {
  const total = bruts.reduce((somme, brut) => somme + brut, 0)
  const remuneres = bruts.filter(brut => brut > 0).length
  return bruts.map(brut => (remuneres < 2 || brut <= 0 ? 1 : brut / total))
}

/**
 * La part du plafond de chacun des mandats, d'après les rémunérations nettes versées par chaque société (dans le même
 * ordre). Le prorata porte sur les bruts, qui dépendent eux-mêmes du plafond : ceux d'un plafond entier donnent une
 * première répartition, que deux passes ajustent (l'écart restant est de l'ordre de l'euro). Un seul mandat rémunéré
 * garde tout le plafond.
 */
export function partsDuPlafond(remunerationsNettes: number[], regles: ReglesRegimeGeneral): number[] {
  let parts = partsDesBruts(remunerationsNettes.map(net => brutPourUnNet(net, "president", regles)))
  for (let passe = 0; passe < 2; passe++) {
    parts = partsDesBruts(remunerationsNettes.map((net, rang) => brutPourUnNet(net, "president", avecUnePartDuPlafond(regles, parts[rang]))))
  }
  return parts
}
