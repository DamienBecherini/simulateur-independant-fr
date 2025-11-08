// src/electron/logic/calculsSASU.ts

// MODIFIÉ : Syntaxe d'import avec 'with'
import config from "../config.json" assert { type: "json" }
import { calculerIR } from "./calculsIR.js"
import type { SimulationInputs } from "@/types.js"

export function simulerSASU(inputs: SimulationInputs) {
  const { chiffreAffaires = 0, chargesDeductibles = 0, remunerationNetteVisee = 0, autresRevenusImposablesFoyer = 0, partsFiscales = 1 } = inputs

  const coutTotalRemuneration = remunerationNetteVisee * config.SASU.cotisations_asssimile_salarie.ratio_cout_total_sur_net
  const beneficeAvantIS = chiffreAffaires - chargesDeductibles - coutTotalRemuneration
  let impotSocietes = 0
  if (beneficeAvantIS > 0) {
    const beneficePartTauxReduit = Math.min(beneficeAvantIS, config.SASU.IS.plafond_reduit)
    const beneficePartTauxNormal = beneficeAvantIS - beneficePartTauxReduit
    impotSocietes = beneficePartTauxReduit * config.SASU.IS.taux_reduit + beneficePartTauxNormal * config.SASU.IS.taux_normal
  }
  const beneficeApresIS = beneficeAvantIS > 0 ? beneficeAvantIS - impotSocietes : 0
  const dividendesBruts = beneficeApresIS
  const prelevementsSociauxDividendes = dividendesBruts * config.SASU.dividendes.pru_taux_ps
  const impotDividendesPFU = dividendesBruts * config.SASU.dividendes.pru_taux_ir
  const coutTotalDividendesPFU = prelevementsSociauxDividendes + impotDividendesPFU
  const dividendesNetsPFU = dividendesBruts - coutTotalDividendesPFU
  const dividendesImposablesBareme = dividendesBruts * 0.6
  const revenuGlobalBareme = remunerationNetteVisee + autresRevenusImposablesFoyer + dividendesImposablesBareme
  const irTotalOptionBareme = calculerIR({ revenuNetGlobalImposable: revenuGlobalBareme, partsFiscales: partsFiscales })
  const irSansDividendes = calculerIR({ revenuNetGlobalImposable: remunerationNetteVisee + autresRevenusImposablesFoyer, partsFiscales: partsFiscales })
  const surcoutIRDividendesBareme = irTotalOptionBareme - irSansDividendes
  const coutTotalDividendesBareme = prelevementsSociauxDividendes + surcoutIRDividendesBareme
  const dividendesNetsBareme = dividendesBruts - coutTotalDividendesBareme
  const revenuImposableRemu = remunerationNetteVisee
  const irTotalRemu = calculerIR({ revenuNetGlobalImposable: revenuImposableRemu + autresRevenusImposablesFoyer, partsFiscales: partsFiscales })
  const irSansActivite = calculerIR({ revenuNetGlobalImposable: autresRevenusImposablesFoyer, partsFiscales: partsFiscales })
  const surcoutIRRemu = irTotalRemu - irSansActivite
  const meilleureOptionDividendes = Math.max(dividendesNetsPFU, dividendesNetsBareme)
  const netDansLaPoche = remunerationNetteVisee + meilleureOptionDividendes - surcoutIRRemu

  return {
    statut: "SASU (IS)",
    chiffreAffaires,
    netDansLaPoche: Math.round(netDansLaPoche)
  }
}
