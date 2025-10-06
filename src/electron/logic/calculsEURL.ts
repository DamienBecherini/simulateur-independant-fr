// src/electron/logic/calculsEURL.ts

// MODIFIÉ : Syntaxe d'import avec 'with'
import config from '../config.json' with { type: 'json' };
import { calculerIR } from "./calculsIR.js";
import type { SimulationInputs } from '@/types.js';

export function simulerEURL(inputs: SimulationInputs) {
  const { chiffreAffaires = 0, chargesDeductibles = 0, remunerationNetteVisee = 0, autresRevenusImposablesFoyer = 0, partsFiscales = 1, capitalSocial = 0 } = inputs;

  const cotisationsSocialesRemu = remunerationNetteVisee * config.EURL.cotisations_tns.taux_approx_sur_remuneration;
  const coutTotalRemuneration = remunerationNetteVisee + cotisationsSocialesRemu;
  const beneficeAvantIS = chiffreAffaires - chargesDeductibles - coutTotalRemuneration;
  let impotSocietes = 0;
  if (beneficeAvantIS > 0) {
    const beneficePartTauxReduit = Math.min(beneficeAvantIS, config.SASU.IS.plafond_reduit);
    const beneficePartTauxNormal = beneficeAvantIS - beneficePartTauxReduit;
    impotSocietes = beneficePartTauxReduit * config.SASU.IS.taux_reduit + beneficePartTauxNormal * config.SASU.IS.taux_normal;
  }
  const beneficeApresIS = beneficeAvantIS > 0 ? beneficeAvantIS - impotSocietes : 0;
  const dividendesBruts = beneficeApresIS;
  const seuilDividendesSoumisPS = capitalSocial * 0.1;
  const partDividendesPourPS = Math.min(dividendesBruts, seuilDividendesSoumisPS);
  const partDividendesPourTNS = dividendesBruts - partDividendesPourPS;
  const cotisationsTNSsurDividendes = partDividendesPourTNS * config.EURL.cotisations_tns.taux_approx_sur_remuneration;
  const dividendesNetsPartTNS = partDividendesPourTNS - cotisationsTNSsurDividendes;
  const prelevementsSociaux = partDividendesPourPS * config.SASU.dividendes.pru_taux_ps;
  const impotDividendesPFU = partDividendesPourPS * config.SASU.dividendes.pru_taux_ir;
  const dividendesNetsPartPS_PFU = partDividendesPourPS - prelevementsSociaux - impotDividendesPFU;
  const dividendesImposablesBareme = partDividendesPourPS * 0.6;
  const revenuImposableBase = remunerationNetteVisee + autresRevenusImposablesFoyer + dividendesNetsPartTNS;
  const irTotalOptionBareme = calculerIR({ revenuNetGlobalImposable: revenuImposableBase + dividendesImposablesBareme, partsFiscales: partsFiscales });
  const irSansDividendesPartPS = calculerIR({ revenuNetGlobalImposable: revenuImposableBase, partsFiscales: partsFiscales });
  const surcoutIRDividendesBareme = irTotalOptionBareme - irSansDividendesPartPS;
  const dividendesNetsPartPS_Bareme = partDividendesPourPS - prelevementsSociaux - surcoutIRDividendesBareme;
  const meilleureOptionDividendesPartPS = Math.max(dividendesNetsPartPS_PFU, dividendesNetsPartPS_Bareme);
  const dividendesNetsTotal = dividendesNetsPartTNS + meilleureOptionDividendesPartPS;
  const revenuImposableTotalActivite = remunerationNetteVisee + dividendesNetsPartTNS;
  const irTotalRemuEtDivTNS = calculerIR({ revenuNetGlobalImposable: revenuImposableTotalActivite + autresRevenusImposablesFoyer, partsFiscales: partsFiscales });
  const irSansActivite = calculerIR({ revenuNetGlobalImposable: autresRevenusImposablesFoyer, partsFiscales: partsFiscales });
  const surcoutIRRemu = irTotalRemuEtDivTNS - irSansActivite;
  const netDansLaPoche = remunerationNetteVisee + dividendesNetsTotal - surcoutIRRemu;

  return {
    statut: "EURL (IS)",
    chiffreAffaires,
    netDansLaPoche: Math.round(netDansLaPoche),
  };
}