// src/backend/logic/protection-sociale.test.ts

import { describe, expect, it } from "vitest"
import { evaluerProtectionSociale, type DonneesProtection } from "./protection-sociale.js"
import { reglesDeTest } from "./testing/regles-de-test.js"

// Règles de test : un trimestre pour 2 000 € de revenu cotisé ; net = 80 % du brut ; TNS à 50 % du revenu net ;
// micro : cotisations 10 % / 20 % / 25 %, dont 40 % / 40 % / 50 % pour la retraite de base, au taux de 20 %.
const donnees = (autres: Partial<DonneesProtection> = {}): DonneesProtection => ({ remunerationNette: 0, cotisationsTNS: 0, chiffreAffairesMicro: { caVente: 0, caServicesBic: 0, caServicesBnc: 0 }, ...autres })

describe("evaluerProtectionSociale", () => {
  describe("président de SASU", () => {
    it("n'a aucune couverture liée au mandat sans rémunération", () => {
      expect(evaluerProtectionSociale("SASU", donnees(), reglesDeTest)).toMatchObject({ etoiles: 1, trimestres: 0 })
    })

    it("valide des trimestres selon son salaire brut", () => {
      // 4 000 € nets = 5 000 € bruts : 2 trimestres.
      expect(evaluerProtectionSociale("SASU", donnees({ remunerationNette: 4000 }), reglesDeTest)).toMatchObject({ etoiles: 3, trimestres: 2 })
    })

    it("obtient la meilleure note avec 4 trimestres, sans atteindre 5 faute d'assurance chômage", () => {
      // 6 400 € nets = 8 000 € bruts : 4 trimestres.
      const note = evaluerProtectionSociale("SASU", donnees({ remunerationNette: 6400 }), reglesDeTest)

      expect(note).toMatchObject({ etoiles: 4, trimestres: 4 })
      expect(note.resume).toContain("pas d'assurance chômage")
    })
  })

  describe("travailleur non salarié", () => {
    it.each(["EURL", "EI"] as const)("garantit 3 trimestres en %s grâce aux cotisations minimales", statut => {
      expect(evaluerProtectionSociale(statut, donnees({ cotisationsTNS: 1000 }), reglesDeTest)).toMatchObject({ etoiles: 3, trimestres: 3 })
    })

    it("valide 4 trimestres avec un revenu suffisant", () => {
      // 5 000 € de cotisations à 50 % : 10 000 € de revenu cotisé.
      expect(evaluerProtectionSociale("EI", donnees({ cotisationsTNS: 5000 }), reglesDeTest).trimestres).toBe(4)
    })
  })

  describe("micro-entrepreneur", () => {
    it("valide des trimestres au prorata du chiffre d'affaires, sans minimum", () => {
      // 20 000 € de BNC : 20 000 x 25 % x 50 % = 2 500 € pour la retraite de base, soit 12 500 € de revenu cotisé.
      expect(evaluerProtectionSociale("micro", donnees({ chiffreAffairesMicro: { caVente: 0, caServicesBic: 0, caServicesBnc: 20000 } }), reglesDeTest)).toMatchObject({ etoiles: 2, trimestres: 4 })
    })

    it("tombe à une étoile sans 4 trimestres", () => {
      // 10 000 € de vente : 10 000 x 10 % x 40 % = 400 €, soit 2 000 € de revenu cotisé : 1 trimestre.
      expect(evaluerProtectionSociale("micro-vfl", donnees({ chiffreAffairesMicro: { caVente: 10000, caServicesBic: 0, caServicesBnc: 0 } }), reglesDeTest)).toMatchObject({ etoiles: 1, trimestres: 1 })
    })

    it("n'a aucun trimestre sans chiffre d'affaires", () => {
      expect(evaluerProtectionSociale("micro", donnees(), reglesDeTest).trimestres).toBe(0)
    })
  })
})
