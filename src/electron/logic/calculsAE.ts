// src/electron/logic/calculsAE.ts

// MODIFIÉ : Syntaxe d'import avec 'with'
import config from '../config.json' with { type: 'json' };
import { calculerIR } from "./calculsIR.js";
import type { SimulationInputs } from "../../types.js"

export function simulerMicroEntreprise(inputs: SimulationInputs) {
  const { ca_services_bic = 0, ca_services_bnc = 0, ca_vente = 0, chargesDeductibles = 0, autresRevenusImposablesFoyer = 0, partsFiscales = 1, beneficieACRE = false, opteVFL = false } = inputs;
  const totalCA = ca_services_bic + ca_services_bnc + ca_vente;
  const plafond = ca_vente > ca_services_bic + ca_services_bnc ? config.microEntreprise.plafonds.vente : config.microEntreprise.plafonds.services;

  if (totalCA > plafond) {
    return {
      statut: "Micro-Entreprise",
      chiffreAffaires: totalCA,
      netDansLaPoche: 0,
      warning: `Plafond de ${plafond.toLocaleString("fr-FR")} € dépassé ! Le régime micro n'est plus applicable.`
    };
  }

  const tauxCotisations = beneficieACRE ? config.microEntreprise.ACRE : config.microEntreprise.cotisations;
  const cotisationsSociales = ca_vente * tauxCotisations.vente_bic + ca_services_bic * tauxCotisations.services_bic + ca_services_bnc * tauxCotisations.services_bnc_regime_general;
  const revenuNetApresCotisations = totalCA - cotisationsSociales;
  let revenuImposable = 0;
  let surcoutIR = 0;

  if (opteVFL) {
    const impotLiberatoire = ca_vente * config.microEntreprise.VFL.taux.vente_bic + ca_services_bic * config.microEntreprise.VFL.taux.services_bic + ca_services_bnc * config.microEntreprise.VFL.taux.services_bnc;
    surcoutIR = impotLiberatoire;
    revenuImposable = 0;
  } else {
    const ca_imposable_vente = ca_vente * (1 - config.microEntreprise.abattement.vente_bic);
    const ca_imposable_services_bic = ca_services_bic * (1 - config.microEntreprise.abattement.services_bic);
    const ca_imposable_services_bnc = ca_services_bnc * (1 - config.microEntreprise.abattement.services_bnc);
    revenuImposable = Math.max(ca_imposable_vente + ca_imposable_services_bic + ca_imposable_services_bnc, totalCA > 0 ? config.microEntreprise.abattement.minimum : 0);
    const revenuNetGlobalImposableFoyer = revenuImposable + autresRevenusImposablesFoyer;
    const impotRevenuTotal = calculerIR({ revenuNetGlobalImposable: revenuNetGlobalImposableFoyer, partsFiscales: partsFiscales });
    const irSansActivite = calculerIR({ revenuNetGlobalImposable: autresRevenusImposablesFoyer, partsFiscales: partsFiscales });
    surcoutIR = impotRevenuTotal - irSansActivite;
  }

  const netDansLaPoche = revenuNetApresCotisations - chargesDeductibles - surcoutIR;

  return {
    statut: "Micro-Entreprise",
    chiffreAffaires: totalCA,
    netDansLaPoche: Math.round(netDansLaPoche),
  };
}