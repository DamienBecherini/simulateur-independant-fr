// src/calculsAE.test.js - VERSION FINALE CORRIGÉE
const { simulerMicroEntreprise } = require("./calculsAE")

describe("Calculs pour la Micro-Entreprise", () => {
  test("devrait calculer correctement tous les indicateurs", () => {
    const inputs = {
      ca_services: 50000,
      ca_vente: 0,
      chargesDeductibles: 5000,
      autresRevenusImposablesFoyer: 0,
      partsFiscales: 1
    }
    const resultat = simulerMicroEntreprise(inputs)

    // Assertions mises à jour
    expect(resultat.chiffreAffaires).toBe(50000)
    expect(resultat.cotisationsSociales).toBeCloseTo(10550)
    expect(resultat.revenuImposable).toBeCloseTo(33000)
    expect(resultat.surcoutIR).toBe(3186)

    // Le test attend maintenant la bonne valeur pour la TVA.
    expect(resultat.statutTVA).toBe("Assujetti (dépassement seuil majoré)")

    expect(resultat.netDansLaPoche).toBe(31264)
  })

  test("devrait gérer un CA nul", () => {
    const inputs = { ca_services: 0, ca_vente: 0 }
    const resultat = simulerMicroEntreprise(inputs)
    expect(resultat.netDansLaPoche).toBe(0)
    expect(resultat.statutTVA).toBe("En franchise")
  })
})
