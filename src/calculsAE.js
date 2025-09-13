// src/calculsAE.js
const config = require('../config.json');

function simulerMicroEntreprise(inputs) {
  const { ca_services = 0, ca_vente = 0 } = inputs;
  const totalCA = ca_services + ca_vente;

  const cotisations = (ca_services * config.microEntreprise.cotisations.services_bnc_regime_general) +
                      (ca_vente * config.microEntreprise.cotisations.vente_bic);

  const revenuNetAvantIR = totalCA - cotisations;

  const ca_imposable_services = ca_services * (1 - config.microEntreprise.abattement.services_bnc);
  const ca_imposable_vente = ca_vente * (1 - config.microEntreprise.abattement.vente_bic);
  const revenuImposable = Math.max(
    ca_imposable_services + ca_imposable_vente,
    (totalCA > 0 ? config.microEntreprise.abattement.minimum : 0)
  );

  const depassementPlafond = totalCA > config.microEntreprise.plafonds.services; // Simplifié

  return {
    statut: "Micro-Entreprise",
    chiffreAffaires: totalCA,
    cotisationsSociales: cotisations,
    revenuNetAvantIR: revenuNetAvantIR,
    revenuImposable: revenuImposable,
    depassementPlafond: depassementPlafond
  };
}

module.exports = { simulerMicroEntreprise };
