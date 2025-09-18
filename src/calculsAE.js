// src/calculsAE.js - VERSION DÉFINITIVE AVEC SORTIE ANTICIPÉE
const config = require("../config.json")
const { calculerIR } = require("./calculsIR.js")

function simulerMicroEntreprise(inputs) {
  const { ca_services_bic = 0, ca_services_bnc = 0, ca_vente = 0, chargesDeductibles = 0, autresRevenusImposablesFoyer = 0, partsFiscales = 1, beneficieACRE = false, opteVFL = false } = inputs
  const totalCA = ca_services_bic + ca_services_bnc + ca_vente

  const plafond = ca_vente > ca_services_bic + ca_services_bnc ? config.microEntreprise.plafonds.vente : config.microEntreprise.plafonds.services

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

  // On choisit le bon objet de taux en fonction de l'option ACRE
  const tauxCotisations = beneficieACRE ? config.microEntreprise.ACRE : config.microEntreprise.cotisations

  const cotisationsSociales = ca_vente * tauxCotisations.vente_bic + ca_services_bic * tauxCotisations.services_bic + ca_services_bnc * tauxCotisations.services_bnc_regime_general

  const revenuNetApresCotisations = totalCA - cotisationsSociales

  let revenuImposable = 0
  let surcoutIR = 0

  if (opteVFL) {
    // Calcul du VFL par type d'activité
    // Si VFL, l'impôt est un pourcentage du CA.
    const impotLiberatoire = ca_vente * config.microEntreprise.VFL.taux.vente_bic + ca_services_bic * config.microEntreprise.VFL.taux.services_bic + ca_services_bnc * config.microEntreprise.VFL.taux.services_bnc

    surcoutIR = impotLiberatoire
    revenuImposable = 0
  } else {
    // Calcul de l'abattement par type d'activité
    const ca_imposable_vente = ca_vente * (1 - config.microEntreprise.abattement.vente_bic)
    const ca_imposable_services_bic = ca_services_bic * (1 - config.microEntreprise.abattement.services_bic)
    const ca_imposable_services_bnc = ca_services_bnc * (1 - config.microEntreprise.abattement.services_bnc)

    revenuImposable = Math.max(ca_imposable_vente + ca_imposable_services_bic + ca_imposable_services_bnc, totalCA > 0 ? config.microEntreprise.abattement.minimum : 0)

    const revenuNetGlobalImposableFoyer = revenuImposable + autresRevenusImposablesFoyer
    const impotRevenuTotal = calculerIR({ revenuNetGlobalImposable: revenuNetGlobalImposableFoyer, partsFiscales })
    const irSansActivite = calculerIR({ revenuNetGlobalImposable: autresRevenusImposablesFoyer, partsFiscales })
    surcoutIR = impotRevenuTotal - irSansActivite
  }

  const netDansLaPoche = revenuNetApresCotisations - chargesDeductibles - surcoutIR

  // Pour le calcul de la TVA
  const ca_services = ca_services_bic + ca_services_bnc

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
