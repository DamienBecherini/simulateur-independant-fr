// src/backend/logic/references/protection-sociale.reference.test.ts

import { expect, it } from "vitest"
import { evaluerProtectionSociale } from "../protection-sociale.js"
import { reglesEnVigueur } from "../regles.js"
import { casDeReference } from "../testing/cas-de-reference.js"

/*
 * Cas de référence 2026 : trimestres de retraite et cotisations minimales, avec les seuils officiels.
 * Un trimestre = 150 heures au SMIC horaire de 12,02 € = 1 803 € de revenu cotisé ; 4 trimestres = 7 212 €.
 * Sources : lassuranceretraite.fr (cotisation-carriere) ; service-public F23369 pour la micro-entreprise ;
 * urssaf.fr (taux-cotisations-ac-plnr) pour l'assiette minimale de la retraite de base des indépendants.
 */

const aucunCA = { caVente: 0, caServicesBic: 0, caServicesBnc: 0 }

casDeReference("Protection sociale et trimestres de retraite", () => {
  it("valeurs officielles 2026 utilisées par les dérivations", () => {
    expect(reglesEnVigueur.protectionSociale).toMatchObject({ revenuParTrimestre: 1803, tauxRetraiteDeBase: 0.1787, partRetraiteDeBaseMicro: { venteBic: 0.4345, servicesBic: 0.4345, servicesBnc: 0.464 } })
    // Assiette minimale de la retraite de base des indépendants : 450 heures au SMIC horaire, 5 409 €.
    expect(reglesEnVigueur.TNS.cotisationsMinimales.retraiteDeBase).toBe(5409)
  })

  it("micro-entreprise BNC : 10 850 € de chiffre d'affaires valident 4 trimestres, 10 800 € seulement 3", () => {
    // 10 850 x 25,6 % x 46,40 % = 1 288,81 € pour la retraite de base, / 17,87 % = 7 212,1 € de revenu cotisé : 4 trimestres.
    // 10 800 € : 7 178,9 € de revenu cotisé, sous les 7 212 € : 3 trimestres.
    expect(evaluerProtectionSociale("micro", { remunerationNette: 0, assietteTNS: 0, chiffreAffairesMicro: { ...aucunCA, caServicesBnc: 10850 } }, reglesEnVigueur).trimestres).toBe(4)
    expect(evaluerProtectionSociale("micro", { remunerationNette: 0, assietteTNS: 0, chiffreAffairesMicro: { ...aucunCA, caServicesBnc: 10800 } }, reglesEnVigueur).trimestres).toBe(3)
  })

  it("micro-entreprise en prestations BIC : environ 14 000 € pour 4 trimestres", () => {
    // 14 000 x 21,2 % x 43,45 % = 1 289,60 €, / 17,87 % = 7 216,6 € : 4 trimestres. 13 900 € : 7 165,0 € : 3 trimestres.
    expect(evaluerProtectionSociale("micro", { remunerationNette: 0, assietteTNS: 0, chiffreAffairesMicro: { ...aucunCA, caServicesBic: 14000 } }, reglesEnVigueur).trimestres).toBe(4)
    expect(evaluerProtectionSociale("micro", { remunerationNette: 0, assietteTNS: 0, chiffreAffairesMicro: { ...aucunCA, caServicesBic: 13900 } }, reglesEnVigueur).trimestres).toBe(3)
  })

  it("président de SASU : 7 212 € bruts pour 4 trimestres, soit environ 5 625 € nets", () => {
    // Net / 78 % = brut. 5 630 € nets = 7 217,9 € bruts : 4 trimestres. 5 600 € nets = 7 179,5 € bruts : 3 trimestres.
    expect(evaluerProtectionSociale("SASU", { remunerationNette: 5630, assietteTNS: 0, chiffreAffairesMicro: aucunCA }, reglesEnVigueur)).toMatchObject({ trimestres: 4, etoiles: 4 })
    expect(evaluerProtectionSociale("SASU", { remunerationNette: 5600, assietteTNS: 0, chiffreAffairesMicro: aucunCA }, reglesEnVigueur)).toMatchObject({ trimestres: 3, etoiles: 3 })
  })

  it("travailleur non salarié : l'assiette minimale de la retraite de base valide 3 trimestres", () => {
    // Sans revenu, la retraite de base est cotisée sur 5 409 € = 3 x 1 803 € : 3 trimestres garantis.
    expect(evaluerProtectionSociale("EI", { remunerationNette: 0, assietteTNS: 0, chiffreAffairesMicro: aucunCA }, reglesEnVigueur).trimestres).toBe(3)
  })

  it("travailleur non salarié : 7 212 € d'assiette sociale pour 4 trimestres", () => {
    // 4 x 1 803 = 7 212 € ; avec l'abattement de 26 %, environ 9 746 € de bénéfice avant cotisations (7 212 / 0,74).
    expect(evaluerProtectionSociale("EURL", { remunerationNette: 0, assietteTNS: 7212, chiffreAffairesMicro: aucunCA }, reglesEnVigueur).trimestres).toBe(4)
    expect(evaluerProtectionSociale("EURL", { remunerationNette: 0, assietteTNS: 7211, chiffreAffairesMicro: aucunCA }, reglesEnVigueur).trimestres).toBe(3)
  })
})
