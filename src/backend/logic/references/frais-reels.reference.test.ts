// src/backend/logic/references/frais-reels.reference.test.ts

import { expect, it } from "vitest"
import type { FraisReels, Person } from "../../../types.js"
import { montantBaremeKilometrique } from "../frais-kilometriques.js"
import { reglesEnVigueur } from "../regles.js"
import { casDeReference, foyerDe, simuler, verifierIdentiteDuBilan } from "../testing/cas-de-reference.js"
import { personne } from "../testing/session-de-test.js"

/*
 * Cas de référence 2026 : frais réels d'un salarié, au barème kilométrique.
 *
 * Démarche : le moteur tourne avec les règles réelles de config.json, et chaque attendu est dérivé à la main.
 * Barème kilométrique des revenus de 2025, repris pour 2026 (service-public.gouv.fr, actualité A14686), 5 CV :
 * de 5 001 à 20 000 km, d x 0,357 + 1 395 €. Déduction de 10 % : au moins 509 €, au plus 14 555 €.
 * Barème de l'impôt (loi de finances pour 2026) : 0 % jusqu'à 11 600 €, 11 % jusqu'à 29 579 € ; décote d'une personne
 * seule : 897 € - 45,25 % de l'impôt.
 *
 * Trajets : 20 km par aller simple, 218 jours travaillés, un aller-retour par jour : 20 x 2 x 218 = 8 720 km.
 * Montant : 8 720 x 0,357 + 1 395 = 3 113,04 + 1 395 = 4 508,04 €.
 */

const trajets: FraisReels = { kmParTrajet: 20, joursTravailles: 218, puissanceFiscale: "5", electrique: false, distanceJustifiee: false, autresFrais: 0 }

const salarie = (frais?: FraisReels): Person => ({ ...personne("alice"), ...(frais ? { fraisReels: frais } : {}) })

casDeReference("Cas de référence 2026 : frais réels d'un salarié", () => {
  it("20 km par trajet, 218 jours, 5 CV : 8 720 km, 4 508,04 €", () => {
    expect(montantBaremeKilometrique(8720, trajets, reglesEnVigueur.baremeKilometrique)).toBeCloseTo(4508.04, 6)
    // Électrique : 4 508,04 x 1,2 = 5 409,648 €.
    expect(montantBaremeKilometrique(8720, { ...trajets, electrique: true }, reglesEnVigueur.baremeKilometrique)).toBeCloseTo(5409.648, 6)
  })

  it("30 000 € nets de salaire, personne seule : les frais réels (4 508 €) battent la déduction de 10 % (3 000 €)", () => {
    // Frais réels : imposable 30 000 - 4 508,04 = 25 491,96 € ; impôt (25 491,96 - 11 600) x 11 % = 1 528,12 € ;
    // décote 897 - 45,25 % x 1 528,12 = 205,53 € ; impôt 1 322,59 €, arrondi à 1 323 €.
    const report = simuler([salarie(trajets)], [], [["alice", "salary", 30000]])
    expect(report.persons[0].fraisProfessionnels).toEqual({ revenusSalariaux: 30000, deductionForfaitaire: 3000, fraisReels: 4508, fraisDeTrajet: 4508, distanceRetenue: 8720, retenue: "reels", deduction: 4508 })
    expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 25492, impotSurLeRevenu: 1323, netApresImpots: 30000 - 1323 })
    verifierIdentiteDuBilan(report)
  })

  it("le même salarié avec la déduction de 10 % : 27 000 € imposables, 1 564 € d'impôt, 241 € de plus", () => {
    // Impôt (27 000 - 11 600) x 11 % = 1 694 € ; décote 897 - 45,25 % x 1 694 = 130,47 € ; impôt 1 563,54 €, arrondi à 1 564 €.
    const report = simuler([salarie()], [], [["alice", "salary", 30000]])
    expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 27000, impotSurLeRevenu: 1564 })
  })
})
