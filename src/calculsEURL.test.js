// src/calculsEURL.test.js
const { simulerEURL } = require("./calculsEURL")

describe("Calculs pour l'EURL (IS)", () => {
  test("devrait simuler correctement un scénario mixte rémunération/dividendes", () => {
    const inputs = {
      chiffreAffaires: 100000,
      chargesDeductibles: 10000,
      remunerationNetteVisee: 30000,
      autresRevenusImposablesFoyer: 20000,
      partsFiscales: 1
    }

    const resultat = simulerEURL(inputs)

    // Étape 1: Rémunération & Cotisations (TNS)
    // Cotisations = 30000 * 0.45 = 13500
    expect(resultat.cotisationsSociales).toBe(13500)

    // Étape 2: Bénéfice & IS
    // Coût total rem = 30000 + 13500 = 43500
    // Bénéfice avant IS = 100000 - 10000 - 43500 = 46500
    // IS = 42500 * 15% + (46500-42500) * 25% = 6375 + 1000 = 7375
    expect(resultat.beneficeAvantIS).toBe(46500)
    expect(resultat.impotSocietes).toBe(7375)

    // Étape 3: Dividendes
    // Dividendes bruts = 46500 - 7375 = 39125
    // Dividendes nets = 39125 * (1 - 0.30) = 27387.5 => 27388
    expect(resultat.dividendesBruts).toBe(39125)
    expect(resultat.dividendesNets).toBe(27388)

    // Étape 4: Impact IR (identique à la SASU car même rémunération nette et mêmes autres revenus)
    expect(resultat.surcoutIR).toBe(7328)

    // Étape 5: Net final
    // Net = 30000 (rem) + 27388 (div) - 7328 (surcoût IR) = 50060
    expect(resultat.netDansLaPoche).toBe(50060)
  })
})
