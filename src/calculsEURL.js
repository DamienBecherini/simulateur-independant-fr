// src/calculsEURL.js
const config = require("../config.json")
const { calculerIR } = require("./calculsIR.js")

/**
 * Simule le statut de EURL à l'IS.
 * @param {object} inputs Les données d'entrée.
 * @param {number} inputs.chiffreAffaires
 * @param {number} inputs.chargesDeductibles
 * @param {number} inputs.remunerationNetteVisee La rémunération nette que le gérant souhaite se verser.
 * @param {number} inputs.autresRevenusImposablesFoyer
 * @param {number} inputs.partsFiscales
 * @returns {object} Un objet détaillé avec tous les résultats de la simulation.
 */
function simulerEURL(inputs) {
  const { chiffreAffaires = 0, chargesDeductibles = 0, remunerationNetteVisee = 0, autresRevenusImposablesFoyer = 0, partsFiscales = 1 } = inputs

  // 1. Calcul des cotisations sociales (TNS - Travailleur Non Salarié)
  // Approximation : on applique un taux sur la rémunération nette.
  const cotisationsSociales = remunerationNetteVisee * config.EURL.cotisations_tns.taux_approx_sur_remuneration
  const coutTotalRemuneration = remunerationNetteVisee + cotisationsSociales

  // 2. Calcul du bénéfice et de l'Impôt sur les Sociétés (IS) - IDENTIQUE À LA SASU
  const beneficeAvantIS = chiffreAffaires - chargesDeductibles - coutTotalRemuneration
  let impotSocietes = 0
  if (beneficeAvantIS > 0) {
    const beneficePartTauxReduit = Math.min(beneficeAvantIS, config.SASU.IS.plafond_reduit)
    const beneficePartTauxNormal = beneficeAvantIS - beneficePartTauxReduit
    impotSocietes = beneficePartTauxReduit * config.SASU.IS.taux_reduit + beneficePartTauxNormal * config.SASU.IS.taux_normal
  }
  const beneficeApresIS = beneficeAvantIS > 0 ? beneficeAvantIS - impotSocietes : 0

  // 3. Calcul des dividendes et de leur imposition - IDENTIQUE À LA SASU (pour cette simulation MVP)
  // NOTE: En réalité, les dividendes en EURL sont soumis aux cotisations sociales TNS au-delà de 10% du capital.
  // Pour le MVP, nous appliquons la Flat Tax comme en SASU pour simplifier, mais c'est un point à affiner plus tard.
  const dividendesBruts = beneficeApresIS
  const impositionDividendes = dividendesBruts * config.SASU.dividendes.pru_taux_global
  const dividendesNets = dividendesBruts - impositionDividendes

  // 4. Calcul de l'Impôt sur le Revenu (IR) - IDENTIQUE À LA SASU
  const revenuNetGlobalImposableFoyer = remunerationNetteVisee + autresRevenusImposablesFoyer
  const impotRevenuTotal = calculerIR({ revenuNetGlobalImposable: revenuNetGlobalImposableFoyer, partsFiscales })
  const irSansActivite = calculerIR({ revenuNetGlobalImposable: autresRevenusImposablesFoyer, partsFiscales })
  const surcoutIR = impotRevenuTotal - irSansActivite

  // 5. Calcul du "Net dans la poche" final - IDENTIQUE À LA SASU
  const netDansLaPoche = remunerationNetteVisee + dividendesNets - surcoutIR

  return {
    statut: "EURL (IS)",
    chiffreAffaires,
    remunerationNette: remunerationNetteVisee,
    cotisationsSociales: Math.round(cotisationsSociales),
    beneficeAvantIS: Math.round(beneficeAvantIS),
    impotSocietes: Math.round(impotSocietes),
    dividendesBruts: Math.round(dividendesBruts),
    dividendesNets: Math.round(dividendesNets),
    surcoutIR: Math.round(surcoutIR),
    netDansLaPoche: Math.round(netDansLaPoche)
  }
}

module.exports = { simulerEURL }
