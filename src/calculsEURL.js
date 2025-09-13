// src/calculsEURL.js - VERSION PRO
const config = require("../config.json")
const { calculerIR } = require("./calculsIR.js")

function simulerEURL(inputs) {
  const { chiffreAffaires = 0, chargesDeductibles = 0, remunerationNetteVisee = 0, autresRevenusImposablesFoyer = 0, partsFiscales = 1 } = inputs

  // --- Rémunération (TNS) ---
  const cotisationsSocialesApprox = remunerationNetteVisee * config.EURL.cotisations_tns.taux_approx_sur_remuneration
  const remuBruteApprox = remunerationNetteVisee // En TNS, Net ≈ Brut (simplification)
  const coutTotalRemuneration = remunerationNetteVisee + cotisationsSocialesApprox

  // --- IS (identique SASU) ---
  const beneficeAvantIS = chiffreAffaires - chargesDeductibles - coutTotalRemuneration
  let impotSocietes = 0
  if (beneficeAvantIS > 0) {
    const beneficePartTauxReduit = Math.min(beneficeAvantIS, config.SASU.IS.plafond_reduit)
    const beneficePartTauxNormal = beneficeAvantIS - beneficePartTauxReduit
    impotSocietes = beneficePartTauxReduit * config.SASU.IS.taux_reduit + beneficePartTauxNormal * config.SASU.IS.taux_normal
  }
  const beneficeApresIS = beneficeAvantIS > 0 ? beneficeAvantIS - impotSocietes : 0

  // --- Dividendes (identique SASU pour la simulation) ---
  const dividendesBruts = beneficeApresIS
  const prelevementsSociauxDividendes = dividendesBruts * config.SASU.dividendes.pru_taux_ps
  const impotDividendesPFU = dividendesBruts * config.SASU.dividendes.pru_taux_ir
  const coutTotalDividendesPFU = prelevementsSociauxDividendes + impotDividendesPFU
  const dividendesNetsPFU = dividendesBruts - coutTotalDividendesPFU
  const dividendesImposablesBareme = dividendesBruts * 0.6
  const revenuGlobalBareme = remunerationNetteVisee + autresRevenusImposablesFoyer + dividendesImposablesBareme
  const irTotalOptionBareme = calculerIR({ revenuNetGlobalImposable: revenuGlobalBareme, partsFiscales })
  const irSansDividendes = calculerIR({ revenuNetGlobalImposable: remunerationNetteVisee + autresRevenusImposablesFoyer, partsFiscales })
  const surcoutIRDividendesBareme = irTotalOptionBareme - irSansDividendes
  const coutTotalDividendesBareme = prelevementsSociauxDividendes + surcoutIRDividendesBareme
  const dividendesNetsBareme = dividendesBruts - coutTotalDividendesBareme

  // --- IR sur la rémunération (identique SASU) ---
  const revenuImposableRemu = remunerationNetteVisee
  const irTotalRemu = calculerIR({ revenuNetGlobalImposable: revenuImposableRemu + autresRevenusImposablesFoyer, partsFiscales })
  const irSansActivite = calculerIR({ revenuNetGlobalImposable: autresRevenusImposablesFoyer, partsFiscales })
  const surcoutIRRemu = irTotalRemu - irSansActivite

  // --- TVA ---
  const { ca_services = 0, ca_vente = 0 } = inputs
  const totalCA = ca_services + ca_vente
  let statutTVA = "En franchise"
  const seuilsVente = config.TVA.vente
  const seuilsServices = config.TVA.services

  if (totalCA > seuilsVente.seuil_majore || ca_services > seuilsServices.seuil_majore) {
    statutTVA = "Assujetti (dépassement seuil majoré)"
  } else if (totalCA > seuilsVente.franchise_base || ca_services > seuilsServices.franchise_base) {
    statutTVA = "Seuil de base dépassé / Tolérance"
  }

  const meilleureOptionDividendes = Math.max(dividendesNetsPFU, dividendesNetsBareme)
  const netDansLaPoche = remunerationNetteVisee + meilleureOptionDividendes - surcoutIRRemu

  return {
    statut: "EURL (IS)",
    chiffreAffaires,
    chargesReelles: chargesDeductibles,
    remuneration: {
      net: remunerationNetteVisee,
      brut: remuBruteApprox,
      chargesSalariales: 0, // Pas de charges salariales en TNS
      chargesPatronales: cotisationsSocialesApprox,
      coutTotal: coutTotalRemuneration
    },
    impotSocietes: Math.round(impotSocietes),
    dividendes: {
      bruts: dividendesBruts,
      pfu: { net: Math.round(dividendesNetsPFU), cout: Math.round(coutTotalDividendesPFU) },
      bareme: { net: Math.round(dividendesNetsBareme), cout: Math.round(coutTotalDividendesBareme) }
    },
    revenuImposable: revenuImposableRemu,
    surcoutIR: Math.round(surcoutIRRemu),
    netDansLaPoche: Math.round(netDansLaPoche),
    statutTVA: statutTVA
  }
}

module.exports = { simulerEURL }
