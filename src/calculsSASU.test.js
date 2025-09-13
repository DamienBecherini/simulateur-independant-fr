// src/calculsSASU.test.js - CORRIGÉ
const { simulerSASU } = require("./calculsSASU")

describe("Calculs pour la SASU (IS)", () => {
  test("devrait simuler correctement un scénario mixte", () => {
    const inputs = {
      chiffreAffaires: 100000,
      chargesDeductibles: 10000,
      remunerationNetteVisee: 30000,
      autresRevenusImposablesFoyer: 20000,
      partsFiscales: 1
    }
    const resultat = simulerSASU(inputs)

    // On vérifie quelques points clés de la nouvelle structure
    expect(resultat.remuneration.net).toBe(30000)
    expect(Math.round(resultat.remuneration.coutTotal)).toBe(54000) // 30000 * 1.8
    expect(resultat.impotSocietes).toBe(5400)
    expect(Math.round(resultat.dividendes.bruts)).toBe(30600)

    // Net div PFU = 30600 * 0.7 = 21420
    expect(resultat.dividendes.pfu.net).toBe(21420)

    // Pour le barème, c'est plus complexe. On vérifie juste le net final.
    expect(resultat.netDansLaPoche).toBe(44092) // 30000 (rem) + 21420 (div) - 7328 (IR)
  })
})
