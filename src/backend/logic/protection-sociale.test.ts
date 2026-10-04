// src/backend/logic/protection-sociale.test.ts

import { describe, expect, it } from "vitest"
import { evaluerProtectionSociale, type DonneesProtection } from "./protection-sociale.js"
import { reglesDeTest } from "./testing/regles-de-test.js"

// Règles de test : un trimestre pour 2 000 € de revenu cotisé (le brut pour un président de SASU) ; retraite de base des TNS au moins sur 6 000 € ;
// micro : cotisations 10 % / 20 % / 25 %, dont 40 % / 40 % / 50 % pour la retraite de base, au taux de 20 %.
const donnees = (autres: Partial<DonneesProtection> = {}): DonneesProtection => ({ remunerationBrute: 0, assietteTNS: 0, chiffreAffairesMicro: { caVente: 0, caServicesBic: 0, caServicesBnc: 0 }, ...autres })

describe("evaluerProtectionSociale", () => {
  describe("président de SASU", () => {
    it("n'a aucune couverture liée au mandat sans rémunération", () => {
      expect(evaluerProtectionSociale("SASU", donnees(), reglesDeTest)).toMatchObject({ etoiles: 1, trimestres: 0 })
    })

    it("valide des trimestres selon son salaire brut", () => {
      // 5 000 € bruts : 2 trimestres.
      expect(evaluerProtectionSociale("SASU", donnees({ remunerationBrute: 5000 }), reglesDeTest)).toMatchObject({ etoiles: 3, trimestres: 2 })
    })

    it("accorde le texte au nombre de trimestres", () => {
      // 2 000 € bruts : 1 trimestre ; 5 000 € bruts : 2 trimestres.
      expect(evaluerProtectionSociale("SASU", donnees({ remunerationBrute: 2000 }), reglesDeTest).resume).toContain(" 1 trimestre de retraite validé sur 4.")
      expect(evaluerProtectionSociale("SASU", donnees({ remunerationBrute: 5000 }), reglesDeTest).resume).toContain(" 2 trimestres de retraite validés sur 4.")
    })

    it("obtient la meilleure note avec 4 trimestres, sans atteindre 5 faute d'assurance chômage", () => {
      // 8 000 € bruts : 4 trimestres.
      const note = evaluerProtectionSociale("SASU", donnees({ remunerationBrute: 8000 }), reglesDeTest)

      expect(note).toMatchObject({ etoiles: 4, trimestres: 4 })
      expect(note.resume).toContain("pas d'assurance chômage")
    })
  })

  describe("travailleur non salarié", () => {
    it.each(["EURL", "EI"] as const)("garantit 3 trimestres en %s grâce à l'assiette minimale de la retraite de base", statut => {
      // Sans revenu, la retraite de base est cotisée sur 6 000 € : 3 trimestres.
      const note = evaluerProtectionSociale(statut, donnees(), reglesDeTest)

      expect(note).toMatchObject({ etoiles: 3, trimestres: 3 })
      expect(note.resume).toContain("3 au minimum")
    })

    it("compte les trimestres sur l'assiette sociale", () => {
      // 7 999 € : encore 3 trimestres ; 8 000 € : 4.
      expect(evaluerProtectionSociale("EI", donnees({ assietteTNS: 7999 }), reglesDeTest).trimestres).toBe(3)
      expect(evaluerProtectionSociale("EI", donnees({ assietteTNS: 8000 }), reglesDeTest).trimestres).toBe(4)
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

    it("valide moins de trimestres avec l'ACRE, les cotisations étant réduites de moitié", () => {
      // 20 000 € de BNC : 2 500 € pour la retraite de base, réduits à 1 250 € : 6 250 € de revenu cotisé, 3 trimestres.
      const note = evaluerProtectionSociale("micro", donnees({ chiffreAffairesMicro: { caVente: 0, caServicesBic: 0, caServicesBnc: 20000 }, beneficieACRE: true }), reglesDeTest)

      expect(note).toMatchObject({ trimestres: 3, etoiles: 1 })
      expect(note.resume).toContain("ACRE")
    })

    it("n'a aucun trimestre sans chiffre d'affaires", () => {
      expect(evaluerProtectionSociale("micro", donnees(), reglesDeTest).trimestres).toBe(0)
    })
  })
})
