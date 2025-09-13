// src/calculsSASU.test.js
const { simulerSASU } = require("./calculsSASU")

describe("Calculs pour la SASU (IS)", () => {
  test("devrait simuler correctement un scénario mixte rémunération/dividendes", () => {
    const inputs = {
      chiffreAffaires: 100000,
      chargesDeductibles: 10000,
      remunerationNetteVisee: 30000,
      autresRevenusImposablesFoyer: 20000,
      partsFiscales: 1
    }

    const resultat = simulerSASU(inputs)

    // Étape 1: Rémunération & Cotisations
    // Coût total = 30000 * 1.8 = 54000. Cotisations = 54000 - 30000 = 24000
    expect(resultat.cotisationsSociales).toBe(24000)

    // Étape 2: Bénéfice & IS
    // Bénéfice avant IS = 100000 - 10000 (charges) - 54000 (coût rem) = 36000
    // IS = 36000 * 15% = 5400
    expect(resultat.beneficeAvantIS).toBe(36000)
    expect(resultat.impotSocietes).toBe(5400)

    // Étape 3: Dividendes
    // Dividendes bruts = 36000 - 5400 = 30600
    // Dividendes nets = 30600 * (1 - 0.30) = 21420
    expect(resultat.dividendesBruts).toBe(30600)
    expect(resultat.dividendesNets).toBe(21420)

    // Étape 4: Impact IR
    // IR Foyer = IR sur (30000 rem + 20000 autres) = IR(50000) = 8286€
    // IR Sans activité = IR sur (20000 autres) = 958€
    // Surcoût IR = 8286 - 958 = 7328€
    expect(resultat.surcoutIR).toBe(7328)

    // Étape 5: Net final
    // Net = 30000 (rem) + 21420 (div) - 7328 (surcoût IR) = 44092€
    expect(resultat.netDansLaPoche).toBe(44092)
  })

  test('devrait gérer un scénario "tout dividendes" (sans rémunération)', () => {
    const inputs = {
      chiffreAffaires: 80000,
      chargesDeductibles: 5000,
      remunerationNetteVisee: 0,
      autresRevenusImposablesFoyer: 0,
      partsFiscales: 1
    }

    const resultat = simulerSASU(inputs)

    expect(resultat.cotisationsSociales).toBe(0)
    // Bénéfice = 80000 - 5000 = 75000
    // IS = (42500 * 0.15) + ((75000 - 42500) * 0.25) = 6375 + 8125 = 14500
    expect(resultat.impotSocietes).toBe(14500)
    // Dividendes bruts = 75000 - 14500 = 60500
    expect(resultat.dividendesBruts).toBe(60500)
    // Surcoût IR = 0 (car pas de rémunération, et dividendes taxés à la source)
    expect(resultat.surcoutIR).toBe(0)
    // Net = 0 (rem) + (60500 * 0.7) (div) - 0 (IR) = 42350
    expect(resultat.netDansLaPoche).toBe(42350)
  })
})
