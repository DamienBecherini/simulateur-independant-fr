// src/calculsAE.test.js
const { simulerMicroEntreprise } = require('./calculsAE');

describe('Calculs pour la Micro-Entreprise', () => {

  test('devrait calculer correctement les cotisations et le revenu pour BNC', () => {
    const inputs = { ca_services: 50000, ca_vente: 0 };
    const resultat = simulerMicroEntreprise(inputs);

    expect(resultat.chiffreAffaires).toBe(50000);
    expect(resultat.cotisationsSociales).toBeCloseTo(50000 * 0.211);
    expect(resultat.revenuNetAvantIR).toBeCloseTo(50000 - (50000 * 0.211));
    expect(resultat.revenuImposable).toBeCloseTo(50000 * (1 - 0.34));
  });

  test('devrait gérer un CA nul', () => {
      const inputs = { ca_services: 0, ca_vente: 0 };
      const resultat = simulerMicroEntreprise(inputs);
      expect(resultat.chiffreAffaires).toBe(0);
      expect(resultat.cotisationsSociales).toBe(0);
      expect(resultat.revenuImposable).toBe(0);
  });
});
