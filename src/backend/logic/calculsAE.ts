// src/electron/logic/calculsAE.ts

import config from "../config.json" with { type: "json" }
import type { SimulationInputs, MicroEntrepriseResult } from "@/types.js"

/**
 * Calcule les résultats détaillés pour une micro-entreprise.
 * Sépare la trésorerie réelle du revenu fiscal.
 */
export function simulerMicroEntreprise(inputs: SimulationInputs): MicroEntrepriseResult {
  const { ca_services_bic = 0, ca_services_bnc = 0, ca_vente = 0, depensesReelles = 0, beneficieACRE = false, opteVFL = false } = inputs

  const totalCA = ca_services_bic + ca_services_bnc + ca_vente
  const plafondServices = config.microEntreprise.plafonds.services
  const plafondVente = config.microEntreprise.plafonds.vente

  let warning: string | undefined
  // Vérification simple des plafonds
  if (ca_services_bic + ca_services_bnc > plafondServices || ca_vente > plafondVente || totalCA > Math.max(plafondServices, plafondVente)) {
    warning = `Plafond de CA potentiellement dépassé. Le régime micro pourrait ne plus être applicable.`
  }

  // 1. Calcul des cotisations sociales
  const tauxCotisations = beneficieACRE ? config.microEntreprise.ACRE : config.microEntreprise.cotisations
  const cotisationsVente = ca_vente * tauxCotisations.vente_bic
  const cotisationsServicesBic = ca_services_bic * tauxCotisations.services_bic
  const cotisationsServicesBnc = ca_services_bnc * tauxCotisations.services_bnc_regime_general
  const totalCotisations = cotisationsVente + cotisationsServicesBic + cotisationsServicesBnc

  // 2. Calcul du revenu imposable (pour l'IR)
  let revenuImposable = 0
  let impotLiberatoire = 0

  if (opteVFL) {
    // Si option VFL, l'impôt est payé directement, et le revenu n'est pas ajouté à l'IR.
    impotLiberatoire += ca_vente * config.microEntreprise.VFL.taux.vente_bic
    impotLiberatoire += ca_services_bic * config.microEntreprise.VFL.taux.services_bic
    impotLiberatoire += ca_services_bnc * config.microEntreprise.VFL.taux.services_bnc
    revenuImposable = 0 // Pas de revenu à ajouter au barème de l'IR
  } else {
    // Calcul classique avec abattement forfaitaire.
    const revenuImposableVente = ca_vente * (1 - config.microEntreprise.abattement.vente_bic)
    const revenuImposableServicesBic = ca_services_bic * (1 - config.microEntreprise.abattement.services_bic)
    const revenuImposableServicesBnc = ca_services_bnc * (1 - config.microEntreprise.abattement.services_bnc)
    const totalRevenuApresAbattement = revenuImposableVente + revenuImposableServicesBic + revenuImposableServicesBnc
    // L'abattement ne peut être inférieur à 305€.
    revenuImposable = totalCA > 0 ? Math.max(totalRevenuApresAbattement, config.microEntreprise.abattement.minimum) : 0
  }

  // 3. Calcul du flux de trésorerie net (ce qu'il reste vraiment)
  const netCashFlow = totalCA - totalCotisations - depensesReelles - impotLiberatoire

  return {
    turnover: {
      total: totalCA,
      servicesBic: ca_services_bic,
      servicesBnc: ca_services_bnc,
      sales: ca_vente
    },
    socialContributions: {
      total: totalCotisations,
      servicesBic: cotisationsServicesBic,
      servicesBnc: cotisationsServicesBnc,
      sales: cotisationsVente
    },
    realExpenses: depensesReelles,
    taxableIncomeAfterAbattement: revenuImposable,
    netCashFlow: netCashFlow,
    vflTax: impotLiberatoire,
    warning: warning
  }
}