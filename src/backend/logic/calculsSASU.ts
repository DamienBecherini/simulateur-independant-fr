// src/electron/logic/calculsSASU.ts

import config from "../config.json" with { type: "json" }
import type { SimulationInputs, CompanyISResult } from "@/types.js"

export function simulerSASU(inputs: SimulationInputs): CompanyISResult {
  const { chiffreAffaires = 0, chargesDeductibles = 0, remunerationNetteVisee = 0 } = inputs

  // Coût de la rémunération pour la société
  const coutTotalRemuneration = remunerationNetteVisee * config.SASU.cotisations_asssimile_salarie.ratio_cout_total_sur_net

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
  // Pour la SASU, les dividendes ne sont soumis qu'aux prélèvements sociaux (part de la "flat tax")
  // CORRECTION: 'dividendes' au lieu de 'dividends'
  const prelevementsSociauxDividendes = dividendesBruts * config.SASU.dividendes.pru_taux_ps

  // Le net versé est le brut moins les PS. L'IR est payé par la personne ensuite.
  const dividendesNetsVerses = dividendesBruts - prelevementsSociauxDividendes

  return {
    turnover: chiffreAffaires,
    deductibleExpenses: chargesDeductibles,
    directorRemunerationCost: coutTotalRemuneration,
    taxableProfit: Math.max(0, beneficeAvantIS),
    corporateTax: impotSocietes,
    netProfitAfterCorpTax: beneficeApresIS,
    distributableDividends: dividendesBruts,
    dividendsSocialContributions: prelevementsSociauxDividendes,
    netDividendsPaidToDirector: dividendesNetsVerses
  }
}