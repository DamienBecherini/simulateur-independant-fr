// src/calculsEI.js
const config = require("../config.json")
const { calculerIR } = require("./calculsIR.js")

function simulerEI(inputs) {
  const { chiffreAffaires = 0, chargesDeductibles = 0, autresRevenusImposablesFoyer = 0, partsFiscales = 1 } = inputs

  // 1. Calcul du bénéfice (qui est le revenu imposable)
  const benefice = chiffreAffaires - chargesDeductibles
  const revenuImposable = benefice > 0 ? benefice : 0

  // 2. Calcul des cotisations TNS (sur la base du bénéfice)
  const cotisationsSociales = revenuImposable * config.EURL.cotisations_tns.taux_approx_sur_remuneration

  // 3. Calcul de l'impact de l'IR
  const revenuNetGlobalImposableFoyer = revenuImposable + autresRevenusImposablesFoyer
  const impotRevenuTotal = calculerIR({ revenuNetGlobalImposable: revenuNetGlobalImposableFoyer, partsFiscales })
  const irSansActivite = calculerIR({ revenuNetGlobalImposable: autresRevenusImposablesFoyer, partsFiscales })
  const surcoutIR = impotRevenuTotal - irSansActivite

  // 4. Calcul du Net dans la poche
  const netDansLaPoche = benefice - cotisationsSociales - surcoutIR

  // 5. Statut TVA
  let statutTVA = "En franchise" // Identique aux autres statuts
  const { ca_services = 0 } = inputs
  if (chiffreAffaires > config.TVA.vente.seuil_majore || ca_services > config.TVA.services.seuil_majore) {
    statutTVA = "Assujetti (dépassement seuil majoré)"
  } else if (chiffreAffaires > config.TVA.vente.franchise_base || ca_services > config.TVA.services.franchise_base) {
    statutTVA = "Seuil de base dépassé / Tolérance"
  }

  return {
    statut: "EI (Régime Réel)",
    chiffreAffaires,
    chargesReelles: chargesDeductibles,
    cotisationsSociales: Math.round(cotisationsSociales),
    revenuImposable: Math.round(revenuImposable),
    surcoutIR: Math.round(surcoutIR),
    netDansLaPoche: Math.round(netDansLaPoche),
    statutTVA: statutTVA
  }
}

module.exports = { simulerEI }
