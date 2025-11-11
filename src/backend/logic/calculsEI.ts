// src/electron/logic/calculsEI.ts

// MODIFIÉ : Syntaxe d'import avec 'with'
import config from "../config.json" with { type: "json" }
import { calculerIR } from "./calculsIR.js"
import type { SimulationInputs } from "@/types.js"

export function simulerEI(inputs: SimulationInputs) {
  const { chiffreAffaires = 0, chargesDeductibles = 0, autresRevenusImposablesFoyer = 0, partsFiscales = 1 } = inputs

  const benefice = chiffreAffaires - chargesDeductibles
  const revenuImposable = benefice > 0 ? benefice : 0
  const cotisationsSociales = revenuImposable * config.EURL.cotisations_tns.taux_approx_sur_remuneration
  const revenuNetGlobalImposableFoyer = revenuImposable + autresRevenusImposablesFoyer
  const impotRevenuTotal = calculerIR({ revenuNetGlobalImposable: revenuNetGlobalImposableFoyer, partsFiscales: partsFiscales })
  const irSansActivite = calculerIR({ revenuNetGlobalImposable: autresRevenusImposablesFoyer, partsFiscales: partsFiscales })
  const surcoutIR = impotRevenuTotal - irSansActivite
  const netDansLaPoche = benefice - cotisationsSociales - surcoutIR

  return {
    statut: "EI (Régime Réel)",
    chiffreAffaires,
    netDansLaPoche: Math.round(netDansLaPoche)
  }
}
