// src/calculsSASU.js
const config = require("../config.json")
const { calculerIR } = require("./calculsIR.js")

/**
 * Simule le statut de SASU à l'IS.
 * @param {object} inputs Les données d'entrée.
 * @param {number} inputs.chiffreAffaires
 * @param {number} inputs.chargesDeductibles
 * @param {number} inputs.remunerationNetteVisee La rémunération nette que le président souhaite se verser.
 * @param {number} inputs.autresRevenusImposablesFoyer Revenus du foyer hors activité (salaire conjoint, etc.).
 * @param {number} inputs.partsFiscales
 * @returns {object} Un objet détaillé avec tous les résultats de la simulation.
 */
function simulerSASU(inputs) {
  const { chiffreAffaires = 0, chargesDeductibles = 0, remunerationNetteVisee = 0, autresRevenusImposablesFoyer = 0, partsFiscales = 1 } = inputs

  // 1. Calcul de la rémunération et des cotisations (Approximation)
  // On part du net visé pour estimer le coût total pour l'entreprise.
  const coutTotalRemuneration = remunerationNetteVisee * config.SASU.cotisations_asssimile_salarie.ratio_cout_total_sur_net
  const cotisationsSociales = coutTotalRemuneration - remunerationNetteVisee

  // 2. Calcul du bénéfice et de l'Impôt sur les Sociétés (IS)
  const beneficeAvantIS = chiffreAffaires - chargesDeductibles - coutTotalRemuneration
  let impotSocietes = 0
  if (beneficeAvantIS > 0) {
    const beneficePartTauxReduit = Math.min(beneficeAvantIS, config.SASU.IS.plafond_reduit)
    const beneficePartTauxNormal = beneficeAvantIS - beneficePartTauxReduit
    impotSocietes = beneficePartTauxReduit * config.SASU.IS.taux_reduit + beneficePartTauxNormal * config.SASU.IS.taux_normal
  }
  const beneficeApresIS = beneficeAvantIS > 0 ? beneficeAvantIS - impotSocietes : 0

  // 3. Calcul des dividendes et de leur imposition (Flat Tax par défaut)
  // On suppose que tout le bénéfice après IS est distribué en dividendes.
  const dividendesBruts = beneficeApresIS
  const impositionDividendes = dividendesBruts * config.SASU.dividendes.pru_taux_global
  const dividendesNets = dividendesBruts - impositionDividendes

  // 4. Calcul de l'Impôt sur le Revenu (IR)
  // Le revenu imposable de l'activité est la rémunération nette (les dividendes sont déjà taxés via la Flat Tax).
  const revenuNetGlobalImposableFoyer = remunerationNetteVisee + autresRevenusImposablesFoyer
  const impotRevenuTotal = calculerIR({ revenuNetGlobalImposable: revenuNetGlobalImposableFoyer, partsFiscales })

  // Pour isoler l'impact de l'activité, on calcule l'IR qu'aurait payé le foyer sans cette activité.
  const irSansActivite = calculerIR({ revenuNetGlobalImposable: autresRevenusImposablesFoyer, partsFiscales })
  const surcoutIR = impotRevenuTotal - irSansActivite

  // 5. Calcul du "Net dans la poche" final
  // C'est la somme de ce que le dirigeant touche (rémunération + dividendes) moins le surcoût d'IR.
  const netDansLaPoche = remunerationNetteVisee + dividendesNets - surcoutIR

  return {
    statut: "SASU (IS)",
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

module.exports = { simulerSASU }
