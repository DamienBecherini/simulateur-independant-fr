// src/calculsIR.test.js
const { calculerIR } = require("./calculsIR")

describe("Calcul de l'Impôt sur le Revenu", () => {
  test("devrait retourner 0 pour un revenu nul ou négatif", () => {
    expect(calculerIR({ revenuNetGlobalImposable: 0, partsFiscales: 1 })).toBe(0)
    expect(calculerIR({ revenuNetGlobalImposable: -5000, partsFiscales: 2 })).toBe(0)
  })

  test("devrait calculer correctement l'impôt pour un célibataire (1 part)", () => {
    // Cas simple : 30 000€ de revenu imposable
    // Tranche 1 (jusqu'à 11294€) : 0€
    // Tranche 2 (de 11295€ à 28797€) : (28797 - 11294) * 11% = 1925.33€
    // Tranche 3 (de 28798€ à 30000€) : (30000 - 28797) * 30% = 360.9€
    // Total attendu : 1925.33 + 360.9 = 2286.23€ => Arrondi à 2286€
    expect(calculerIR({ revenuNetGlobalImposable: 30000, partsFiscales: 1 })).toBe(2286)
  })

  test("devrait calculer correctement l'impôt pour un couple (2 parts)", () => {
    // Cas : 60 000€ de revenu pour 2 parts.
    // 1. Quotient familial : 60000 / 2 = 30000€
    // 2. Impôt pour 1 part sur 30000€ : 2286€ (calculé ci-dessus)
    // 3. Impôt total : 2286 * 2 = 4572€
    expect(calculerIR({ revenuNetGlobalImposable: 60000, partsFiscales: 2 })).toBe(4572)
  })

  test("devrait gérer les revenus élevés sur plusieurs tranches", () => {
    // Cas : 90 000€ de revenu pour 1 part.
    // T1: 0
    // T2: (28797-11294)*0.11 = 1925.33
    // T3: (82341-28797)*0.30 = 16063.2
    // T4: (90000-82341)*0.41 = 3139.19
    // Total : 1925.33 + 16063.2 + 3139.19 = 21127.72 => 21128€
    expect(calculerIR({ revenuNetGlobalImposable: 90000, partsFiscales: 1 })).toBe(21128)
  })
})
