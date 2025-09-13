// src/calculsIR.js - VERSION DÉFINITIVE ET ROBUSTE

const config = require("../config.json")

function calculerIR({ revenuNetGlobalImposable, partsFiscales }) {
  if (revenuNetGlobalImposable <= 0 || !partsFiscales || partsFiscales <= 0) {
    return 0
  }

  // 1. Calculer le revenu par part (quotient familial)
  const revenuParPart = revenuNetGlobalImposable / partsFiscales

  // 2. Déterminer la tranche d'imposition et appliquer la formule directe
  // La formule est : (revenuParPart * taux) - déduction
  let impotsPourUnePart
  const bareme = config.IR.bareme

  if (revenuParPart <= bareme[0].trancheJusqua) {
    // Tranche 1 (0%)
    impotsPourUnePart = 0
  } else if (revenuParPart <= bareme[1].trancheJusqua) {
    // Tranche 2 (11%)
    impotsPourUnePart = revenuParPart * 0.11 - 1242.34
  } else if (revenuParPart <= bareme[2].trancheJusqua) {
    // Tranche 3 (30%)
    impotsPourUnePart = revenuParPart * 0.3 - 6713.77
  } else if (revenuParPart <= bareme[3].trancheJusqua) {
    // Tranche 4 (41%)
    impotsPourUnePart = revenuParPart * 0.41 - 15772.28
  } else {
    // Tranche 5 (45%)
    impotsPourUnePart = revenuParPart * 0.45 - 22854.52
  }

  // 3. Remultiplier par le nombre de parts et arrondir
  const impotsTotal = impotsPourUnePart * partsFiscales

  // On ne retourne jamais un impôt négatif, et on arrondit
  return Math.round(Math.max(0, impotsTotal))
}

module.exports = { calculerIR }
