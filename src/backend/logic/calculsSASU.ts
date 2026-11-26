// src/backend/logic/calculsSASU.ts

import { calculerResultatSociete, type EntreesSociete, type ResultatSociete } from "./calculsSociete.js"
import { brutPourUnNet, calculerCotisationsSalarie } from "./cotisationsSalarie.js"
import { avecUnePartDuPlafond } from "./plafond-entre-mandats.js"
import type { ReglesApplicables } from "./regles.js"

/**
 * SASU à l'IS : le président est assimilé salarié. Sa rémunération saisie est nette : on retrouve le brut dont elle
 * est le net, puis ses cotisations salariales et patronales, ligne à ligne (sans assurance chômage ni réduction
 * générale). La société paie le brut et les cotisations patronales : ses cotisations sociales sont ce coût moins le
 * net versé. Le net, augmenté de la CSG non déductible et de la CRDS, est imposé comme un salaire.
 * Les dividendes supportent les prélèvements sociaux, jamais de cotisations. Un président rémunéré par plusieurs SASU
 * n'a, dans chacune, que sa part du plafond de la sécurité sociale (`partDuPlafond`).
 */
export function calculerSASU(entrees: EntreesSociete, regles: ReglesApplicables): ResultatSociete {
  const regimeGeneral = avecUnePartDuPlafond(regles.regimeGeneral, entrees.partDuPlafond ?? 1)
  const president = calculerCotisationsSalarie(brutPourUnNet(entrees.remunerationNette, "president", regimeGeneral), "president", regimeGeneral)
  const resultat = calculerResultatSociete(entrees, president.coutEmployeur - president.net, regles)
  return { ...resultat, remunerationImposable: resultat.remunerationNette + president.partNonDeductible, cotisationsPresident: president }
}
