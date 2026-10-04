// src/backend/logic/references/protection-sociale.reference.test.ts

import { expect, it } from "vitest"
import { evaluerProtectionSociale } from "../protection-sociale.js"
import { reglesEnVigueur } from "../regles.js"
import { casDeReference } from "../testing/cas-de-reference.js"

/*
 * Cas de référence 2026 : trimestres de retraite et cotisations minimales, avec les seuils officiels.
 * Un trimestre = 150 heures au SMIC horaire de 12,02 € = 1 803 € de revenu cotisé ; 4 trimestres = 7 212 €.
 * Sources : lassuranceretraite.fr (cotisation-carriere) ; service-public F23369 pour la micro-entreprise ;
 * urssaf.fr (taux-cotisations-ac-plnr) pour les cotisations minimales.
 */

const aucunCA = { caVente: 0, caServicesBic: 0, caServicesBnc: 0 }

casDeReference("Protection sociale et trimestres de retraite", () => {
  it("valeurs officielles 2026 utilisées par les dérivations", () => {
    expect(reglesEnVigueur.protectionSociale).toMatchObject({ revenuParTrimestre: 1803, tauxRetraiteDeBase: 0.1787, partRetraiteDeBaseMicro: { venteBic: 0.4345, servicesBic: 0.4345, servicesBnc: 0.464 } })
    // Cotisations minimales : 96 (IJ) + 967 (retraite de base) + 72 (invalidité-décès) + 120 (formation) = 1 255 €.
    expect(reglesEnVigueur.TNS.cotisationsMinimales).toBe(1255)
  })

  it("micro-entreprise BNC : 10 850 € de chiffre d'affaires valident 4 trimestres, 10 800 € seulement 3", () => {
    // 10 850 x 25,6 % x 46,40 % = 1 288,81 € pour la retraite de base, / 17,87 % = 7 212,1 € de revenu cotisé : 4 trimestres.
    // 10 800 € : 7 178,9 € de revenu cotisé, sous les 7 212 € : 3 trimestres.
    expect(evaluerProtectionSociale("micro", { remunerationNette: 0, cotisationsTNS: 0, chiffreAffairesMicro: { ...aucunCA, caServicesBnc: 10850 } }, reglesEnVigueur).trimestres).toBe(4)
    expect(evaluerProtectionSociale("micro", { remunerationNette: 0, cotisationsTNS: 0, chiffreAffairesMicro: { ...aucunCA, caServicesBnc: 10800 } }, reglesEnVigueur).trimestres).toBe(3)
  })

  it("micro-entreprise en prestations BIC : environ 14 000 € pour 4 trimestres", () => {
    // 14 000 x 21,2 % x 43,45 % = 1 289,60 €, / 17,87 % = 7 216,6 € : 4 trimestres. 13 900 € : 7 165,0 € : 3 trimestres.
    expect(evaluerProtectionSociale("micro", { remunerationNette: 0, cotisationsTNS: 0, chiffreAffairesMicro: { ...aucunCA, caServicesBic: 14000 } }, reglesEnVigueur).trimestres).toBe(4)
    expect(evaluerProtectionSociale("micro", { remunerationNette: 0, cotisationsTNS: 0, chiffreAffairesMicro: { ...aucunCA, caServicesBic: 13900 } }, reglesEnVigueur).trimestres).toBe(3)
  })

  it("président de SASU : 7 212 € bruts pour 4 trimestres, soit environ 5 625 € nets", () => {
    // Net / 78 % = brut. 5 630 € nets = 7 217,9 € bruts : 4 trimestres. 5 600 € nets = 7 179,5 € bruts : 3 trimestres.
    expect(evaluerProtectionSociale("SASU", { remunerationNette: 5630, cotisationsTNS: 0, chiffreAffairesMicro: aucunCA }, reglesEnVigueur)).toMatchObject({ trimestres: 4, etoiles: 4 })
    expect(evaluerProtectionSociale("SASU", { remunerationNette: 5600, cotisationsTNS: 0, chiffreAffairesMicro: aucunCA }, reglesEnVigueur)).toMatchObject({ trimestres: 3, etoiles: 3 })
  })

  it("travailleur non salarié : les cotisations minimales valident 3 trimestres", () => {
    // 1 255 € de cotisations minimales : 3 trimestres garantis, quelle que soit l'activité.
    expect(evaluerProtectionSociale("EI", { remunerationNette: 0, cotisationsTNS: 1255, chiffreAffairesMicro: aucunCA }, reglesEnVigueur).trimestres).toBe(3)
  })
})
