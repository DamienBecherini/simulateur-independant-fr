// src/backend/logic/calculsEURL.ts

import { calculerResultatSociete, type EntreesSociete, type ResultatSociete } from "./calculsSociete.js"
import { avertissementCotisationsMinimales, calculerCotisationsTNS, revenuAvantCotisationsPourUnNet } from "./cotisationsTNS.js"
import { reglesEnVigueur, type ReglesFiscales } from "./regles.js"

export interface EntreesEURL extends EntreesSociete {
  capitalSocial: number
}

/**
 * EURL à l'IS : le gérant associé unique est travailleur non salarié (TNS).
 *
 * La rémunération saisie est nette : la société paie en plus les cotisations du gérant, qui font partie de son
 * revenu soumis à cotisations. On retrouve donc le revenu avant cotisations dont la rémunération nette est le
 * reste, et le coût pour la société est la rémunération nette plus ces cotisations (au moins les cotisations
 * minimales, même sans rémunération).
 *
 * La part des dividendes qui dépasse 10 % du capital social s'ajoute au revenu soumis à cotisations, au lieu
 * de supporter les prélèvements sociaux. Les cotisations supplémentaires qu'elle entraîne (différence entre
 * les cotisations sur la rémunération et les dividendes, et celles sur la rémunération seule) sont payées
 * par le gérant sur ces dividendes. Le seuil s'apprécie l'année où les dividendes sont versés, qu'ils viennent du
 * bénéfice de l'année ou des réserves des années précédentes.
 *
 * La rémunération est imposée comme un salaire ; la CSG non déductible et la CRDS, payées par la société,
 * s'ajoutent à la rémunération nette imposable.
 */
export function calculerEURL(entrees: EntreesEURL, regles: ReglesFiscales = reglesEnVigueur): ResultatSociete {
  const surRemuneration = calculerCotisationsTNS(revenuAvantCotisationsPourUnNet(entrees.remunerationNette, regles.TNS), regles.TNS)
  const resultat = calculerResultatSociete(entrees, surRemuneration.total, regles)

  const seuil = entrees.capitalSocial * regles.EURL.seuilDividendesPartDuCapital
  const dividendesSoumisPS = Math.min(resultat.dividendesVerses, seuil)
  const dividendesSoumisCotisations = resultat.dividendesVerses - dividendesSoumisPS
  const cotisationsTNS = calculerCotisationsTNS(surRemuneration.revenuAvantCotisations + dividendesSoumisCotisations, regles.TNS)
  const cotisationsSurDividendes = cotisationsTNS.total - surRemuneration.total

  return {
    ...resultat,
    remunerationImposable: entrees.remunerationNette + surRemuneration.partNonDeductible,
    dividendesSoumisPS,
    cotisationsSurDividendes,
    cotisationsSociales: cotisationsTNS.total,
    cotisationsTNS,
    warnings: [...resultat.warnings, ...avertissementCotisationsMinimales(cotisationsTNS, "du gérant")]
  }
}
