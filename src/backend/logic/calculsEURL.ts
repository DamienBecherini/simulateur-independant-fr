// src/backend/logic/calculsEURL.ts

import { calculerResultatSociete, type EntreesSociete, type ResultatSociete } from "./calculsSociete.js"
import { reglesEnVigueur, type ReglesFiscales } from "./regles.js"

export interface EntreesEURL extends EntreesSociete {
  capitalSocial: number
}

/**
 * EURL à l'IS : le gérant associé unique est travailleur non salarié (TNS).
 * Ses cotisations sont approchées par un taux sur la rémunération nette. La part des dividendes
 * qui dépasse 10 % du capital social supporte ces mêmes cotisations au lieu des prélèvements sociaux.
 */
export function calculerEURL(entrees: EntreesEURL, regles: ReglesFiscales = reglesEnVigueur): ResultatSociete {
  const tauxTNS = regles.TNS.tauxCotisationsSurRevenuNet
  const resultat = calculerResultatSociete(entrees, entrees.remunerationNette * tauxTNS, regles.IS)

  const seuil = entrees.capitalSocial * regles.EURL.seuilDividendesPartDuCapital
  const dividendesSoumisPS = Math.min(resultat.dividendesVerses, seuil)
  const cotisationsSurDividendes = (resultat.dividendesVerses - dividendesSoumisPS) * tauxTNS

  return {
    ...resultat,
    dividendesSoumisPS,
    cotisationsSurDividendes,
    cotisationsSociales: resultat.cotisationsSociales + cotisationsSurDividendes
  }
}
