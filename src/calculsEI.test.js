// src/calculsEI.test.js
const { simulerEI } = require("./calculsEI.js")

describe("Calculs pour l'EI (Régime Réel)", () => {
  test("devrait simuler correctement un scénario de base", () => {
    const inputs = {
      chiffreAffaires: 80000,
      chargesDeductibles: 15000,
      autresRevenusImposablesFoyer: 0,
      partsFiscales: 1,
      ca_services: 80000,
      ca_vente: 0
    }

    const resultat = simulerEI(inputs)

    // 1. Bénéfice = 80000 - 15000 = 65000
    expect(resultat.revenuImposable).toBe(65000)

    // 2. Cotisations TNS = 65000 * 0.45 = 29250
    expect(resultat.cotisationsSociales).toBe(29250)

    // 3. IR sur 65000€ = 12786€ (CORRIGÉ)
    expect(resultat.surcoutIR).toBe(12786)

    // 4. Net = 65000 - 29250 - 12786 = 22964 (CORRIGÉ)
    expect(resultat.netDansLaPoche).toBe(22964)

    // 5. TVA
    expect(resultat.statutTVA).toBe("Assujetti (dépassement seuil majoré)")
  })
})
