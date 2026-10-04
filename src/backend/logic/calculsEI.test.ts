// src/backend/logic/calculsEI.test.ts

import { describe, expect, it } from "vitest"
import { simulerEI } from "./calculsEI.js"

// Cotisations TNS approchées : 45 % du bénéfice (config.json).
describe("simulerEI", () => {
  it("renvoie un net nul quand aucune donnée n'est fournie", () => {
    expect(simulerEI({})).toEqual({ statut: "EI (Régime Réel)", chiffreAffaires: 0, netDansLaPoche: 0 })
  })

  it("cas nominal : bénéfice - cotisations - IR", () => {
    // Bénéfice : 60 000 - 10 000 = 50 000 ; cotisations : 22 500 ; IR sur 50 000 € : 8 286
    const resultat = simulerEI({ chiffreAffaires: 60_000, chargesDeductibles: 10_000 })
    expect(resultat.chiffreAffaires).toBe(60_000)
    expect(resultat.netDansLaPoche).toBe(19_214)
  })

  it("ne compte que le surcoût d'IR quand le foyer a d'autres revenus", () => {
    // IR sur 70 000 € : 14 286 ; IR sur 20 000 € : 958 -> surcoût 13 328
    const resultat = simulerEI({ chiffreAffaires: 60_000, chargesDeductibles: 10_000, autresRevenusImposablesFoyer: 20_000 })
    expect(resultat.netDansLaPoche).toBe(14_172)
  })

  it("tient compte du nombre de parts fiscales", () => {
    // 25 000 € par part -> 1 507,66 par part, soit 3 015 € d'IR
    const resultat = simulerEI({ chiffreAffaires: 50_000, partsFiscales: 2 })
    expect(resultat.netDansLaPoche).toBe(24_485)
  })

  it("restitue un déficit sans cotisations ni impôt", () => {
    const resultat = simulerEI({ chiffreAffaires: 0, chargesDeductibles: 5000 })
    expect(resultat.netDansLaPoche).toBe(-5000)
  })
})
