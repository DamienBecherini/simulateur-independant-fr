// src/backend/logic/calculsIR.ts

// MODIFIÉ : Syntaxe d'import avec 'with' au lieu de 'assert'
import config from "../config.json" with { type: "json" }

export function calculerIR({ revenuNetGlobalImposable, partsFiscales }: { revenuNetGlobalImposable: number; partsFiscales: number }): number {
  if (revenuNetGlobalImposable <= 0 || !partsFiscales || partsFiscales <= 0) {
    return 0
  }

  const revenuParPart = revenuNetGlobalImposable / partsFiscales
  const bareme = config.IR.bareme
  let impotsPourUnePart: number

  // Plus aucune erreur ici car trancheJusqua est toujours un nombre
  if (revenuParPart <= bareme[0].trancheJusqua) {
    impotsPourUnePart = 0
  } else if (revenuParPart <= bareme[1].trancheJusqua) {
    impotsPourUnePart = revenuParPart * 0.11 - 1242.34
  } else if (revenuParPart <= bareme[2].trancheJusqua) {
    impotsPourUnePart = revenuParPart * 0.3 - 6713.77
  } else if (revenuParPart <= bareme[3].trancheJusqua) {
    impotsPourUnePart = revenuParPart * 0.41 - 15772.28
  } else {
    impotsPourUnePart = revenuParPart * 0.45 - 22854.52
  }

  const impotsTotal = impotsPourUnePart * partsFiscales
  return Math.round(Math.max(0, impotsTotal))
}
