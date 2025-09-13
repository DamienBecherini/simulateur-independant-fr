// src/calculsAE.js - VERSION DÉFINITIVE AVEC SORTIE ANTICIPÉE
const config = require("../config.json")
const { calculerIR } = require("./calculsIR.js")

function simulerMicroEntreprise(inputs) {
  const { ca_services = 0, ca_vente = 0, chargesDeductibles = 0, autresRevenusImposablesFoyer = 0, partsFiscales = 1 } = inputs
  const totalCA = ca_services + ca_vente

  const plafond = ca_vente > ca_services ? config.microEntreprise.plafonds.vente : config.microEntreprise.plafonds.services

  // --- CLAUSE DE GARDE POUR LE DÉPASSEMENT ---
  // Si on dépasse, on retourne immédiatement l'objet d'avertissement et la fonction s'arrête ici.
  if (totalCA > plafond) {
    return {
      statut: "Micro-Entreprise",
      chiffreAffaires: totalCA,
      netDansLaPoche: 0,
      revenuImposable: 0,
      cotisationsSociales: 0,
      revenuNetApresCotisations: 0,
      surcoutIR: 0,
      statutTVA: "Assujetti (dépassement)",
      warning: `Plafond de ${plafond.toLocaleString("fr-FR")} € dépassé ! Le régime micro n'est plus applicable. Référez-vous à la simulation EI (Régime Réel).`
    }
  }

  // --- LE RESTE DU CODE NE S'EXÉCUTE QUE SI LE PLAFOND EST RESPECTÉ ---
  const cotisationsSociales = ca_services * config.microEntreprise.cotisations.services_bnc_regime_general + ca_vente * config.microEntreprise.cotisations.vente_bic
  const revenuNetApresCotisations = totalCA - cotisationsSociales
  const ca_imposable_services = ca_services * (1 - config.microEntreprise.abattement.services_bnc)
  const ca_imposable_vente = ca_vente * (1 - config.microEntreprise.abattement.vente_bic)
  const revenuImposable = Math.max(ca_imposable_services + ca_imposable_vente, totalCA > 0 ? config.microEntreprise.abattement.minimum : 0)
  const revenuNetGlobalImposableFoyer = revenuImposable + autresRevenusImposablesFoyer
  const impotRevenuTotal = calculerIR({ revenuNetGlobalImposable: revenuNetGlobalImposableFoyer, partsFiscales })
  const irSansActivite = calculerIR({ revenuNetGlobalImposable: autresRevenusImposablesFoyer, partsFiscales })
  const surcoutIR = impotRevenuTotal - irSansActivite
  const netDansLaPoche = revenuNetApresCotisations - chargesDeductibles - surcoutIR

  let statutTVA = "En franchise"
  if (totalCA > config.TVA.vente.seuil_majore || ca_services > config.TVA.services.seuil_majore) {
    statutTVA = "Assujetti (dépassement seuil majoré)"
  } else if (totalCA > config.TVA.vente.franchise_base || ca_services > config.TVA.services.franchise_base) {
    statutTVA = "Seuil de base dépassé / Tolérance"
  }

  return {
    statut: "Micro-Entreprise",
    chiffreAffaires: totalCA,
    chargesReelles: chargesDeductibles,
    cotisationsSociales: Math.round(cotisationsSociales),
    revenuNetApresCotisations: Math.round(revenuNetApresCotisations),
    revenuImposable: Math.round(revenuImposable),
    surcoutIR: Math.round(surcoutIR),
    netDansLaPoche: Math.round(netDansLaPoche),
    statutTVA: statutTVA
  }
}

module.exports = { simulerMicroEntreprise }
