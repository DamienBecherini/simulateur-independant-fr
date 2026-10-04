// src/backend/logic/calculsEURL.ts

import { calculerResultatSociete, type EntreesSociete, type ResultatSociete } from "./calculsSociete.js"
import { euros } from "./format.js"
import { reglesEnVigueur, type ReglesFiscales } from "./regles.js"

export interface EntreesEURL extends EntreesSociete {
  capitalSocial: number
}

/**
 * EURL à l'IS : le gérant associé unique est travailleur non salarié (TNS).
 * Ses cotisations sont approchées par un taux sur la rémunération nette. La part des dividendes
 * qui dépasse 10 % du capital social supporte ces mêmes cotisations au lieu des prélèvements sociaux.
 * Le gérant doit au moins les cotisations minimales des indépendants, même sans revenu.
 */
export function calculerEURL(entrees: EntreesEURL, regles: ReglesFiscales = reglesEnVigueur): ResultatSociete {
  const tauxTNS = regles.TNS.tauxCotisationsSurRevenuNet
  const minimum = regles.TNS.cotisationsMinimales
  const sansMinimum = calculerAvecCotisations(entrees, entrees.remunerationNette * tauxTNS, regles)
  if (sansMinimum.cotisationsSociales >= minimum) return sansMinimum

  // Le gérant doit au moins les cotisations minimales : le complément est une charge de la société.
  // (Approximation : si ce complément réduit les dividendes, les cotisations sur dividendes ne sont pas recalculées.)
  const complement = minimum - sansMinimum.cotisationsSociales
  const resultat = calculerAvecCotisations(entrees, entrees.remunerationNette * tauxTNS + complement, regles)
  return { ...resultat, warnings: [...resultat.warnings, `Cotisations minimales du gérant appliquées (${euros(minimum)} par an) : elles sont dues même sans revenu, et valident 3 trimestres de retraite.`] }
}

function calculerAvecCotisations(entrees: EntreesEURL, cotisationsRemuneration: number, regles: ReglesFiscales): ResultatSociete {
  const resultat = calculerResultatSociete(entrees, cotisationsRemuneration, regles.IS)
  const seuil = entrees.capitalSocial * regles.EURL.seuilDividendesPartDuCapital
  const dividendesSoumisPS = Math.min(resultat.dividendesVerses, seuil)
  const cotisationsSurDividendes = (resultat.dividendesVerses - dividendesSoumisPS) * regles.TNS.tauxCotisationsSurRevenuNet

  return {
    ...resultat,
    dividendesSoumisPS,
    cotisationsSurDividendes,
    cotisationsSociales: resultat.cotisationsSociales + cotisationsSurDividendes
  }
}
