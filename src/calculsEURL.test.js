// src/calculsEURL.test.js - CORRIGÉ
const { simulerEURL } = require("./calculsEURL")

describe("Calculs pour l'EURL (IS)", () => {
  test("devrait simuler correctement un scénario mixte", () => {
    const inputs = {
      chiffreAffaires: 100000,
      chargesDeductibles: 10000,
      remunerationNetteVisee: 30000,
      autresRevenusImposablesFoyer: 20000,
      partsFiscales: 1
    }
    const resultat = simulerEURL(inputs)

    expect(resultat.remuneration.net).toBe(30000)
    expect(Math.round(resultat.remuneration.coutTotal)).toBe(43500) // 30000 * 1.45
    expect(resultat.impotSocietes).toBe(7375)
    expect(Math.round(resultat.dividendes.bruts)).toBe(39125)
    expect(resultat.netDansLaPoche).toBe(50060) // 30000 + (39125 * 0.7) - 7328
  })
})
