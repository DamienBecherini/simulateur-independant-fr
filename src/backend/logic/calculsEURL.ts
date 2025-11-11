// src/electron/logic/calculsEURL.ts

// MODIFIÉ : Syntaxe d'import avec 'with'
import config from "../config.json" with { type: "json" }
import { calculerIR } from "./calculsIR.js"
import type { SimulationInputs, CompanyISResult } from "@/types.js"

export function simulerEURL(inputs: SimulationInputs): CompanyISResult {
  const { chiffreAffaires = 0, chargesDeductibles = 0, remunerationNetteVisee = 0, capitalSocial = 1 } = inputs // capitalSocial à 1 pour éviter division par 0

  // Coût de la rémunération pour la société
  const cotisationsSocialesRemu = remunerationNetteVisee * config.EURL.cotisations_tns.taux_approx_sur_remuneration
  const coutTotalRemuneration = remunerationNetteVisee + cotisationsSocialesRemu

  // Calcul du bénéfice et de l'IS
  const beneficeAvantIS = chiffreAffaires - chargesDeductibles - coutTotalRemuneration
  let impotSocietes = 0
  if (beneficeAvantIS > 0) {
    const beneficePartTauxReduit = Math.min(beneficeAvantIS, config.SASU.IS.plafond_reduit)
    const beneficePartTauxNormal = beneficeAvantIS - beneficePartTauxReduit
    impotSocietes = beneficePartTauxReduit * config.SASU.IS.taux_reduit + beneficePartTauxNormal * config.SASU.IS.taux_normal
  }
  const beneficeApresIS = beneficeAvantIS > 0 ? beneficeAvantIS - impotSocietes : 0

  // Dividendes
  const dividendesBruts = beneficeApresIS
  const seuilDividendesSoumisTNS = capitalSocial * 0.1
  const partDividendesSoumisPS = Math.min(dividendesBruts, seuilDividendesSoumisTNS)
  const partDividendesSoumisTNS = dividendesBruts - partDividendesSoumisPS

  // Calcul des cotisations sur les dividendes
  const cotisationsTNSsurDividendes = partDividendesSoumisTNS * config.EURL.dividendes_ps_sur_part_sup_10_capital.taux_approx
  const prelevementsSociauxSurDividendes = partDividendesSoumisPS * config.SASU.dividendes.pru_taux_ps
  const totalCotisationsDividendes = cotisationsTNSsurDividendes + prelevementsSociauxSurDividendes

  // Calcul des dividendes nets (ce qui est versé à la personne avant son IR personnel)
  const dividendesNetsVerses = dividendesBruts - totalCotisationsDividendes

  return {
    turnover: chiffreAffaires,
    deductibleExpenses: chargesDeductibles,
    directorRemunerationCost: coutTotalRemuneration,
    taxableProfit: Math.max(0, beneficeAvantIS),
    corporateTax: impotSocietes,
    netProfitAfterCorpTax: beneficeApresIS,
    distributableDividends: dividendesBruts,
    dividendsSocialContributions: totalCotisationsDividendes,
    netDividendsPaidToDirector: dividendesNetsVerses
  }
}