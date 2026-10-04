// src/backend/logic/references/micro.reference.test.ts

import { expect, it } from "vitest"
import { activite, casDeReference, foyerDe, simuler, verifierIdentiteDuBilan } from "../testing/cas-de-reference.js"
import { micro, personne, relation, type Flux } from "../testing/session-de-test.js"
import type { MicroEntreprise } from "../../../types.js"

/*
 * Cas de référence 2026 : micro-entreprise seule, titulaire célibataire (1 part).
 *
 * Démarche : le moteur tourne avec les règles réelles de config.json, et chaque attendu est dérivé à la main
 * à partir des règles officielles 2026, sans lancer le moteur. En cas d'écart, c'est le moteur qui est suspect.
 *
 * Règles utilisées (sources dans config.json) :
 * - cotisations sur le CA : vente 12,3 %, prestations BIC 21,2 %, prestations BNC 25,6 % ; ACRE : - 50 % ;
 * - abattement forfaitaire : vente 71 %, BIC 50 %, BNC 34 %, au minimum 305 € par nature d'activité,
 *   sans pouvoir dépasser le chiffre d'affaires ;
 * - versement libératoire : vente 1 %, BIC 1,7 %, BNC 2,2 % du CA, si le RFR 2024 ne dépasse pas 29 315 € par part ;
 * - plafonds 2026 : 83 600 € de prestations de services, 203 100 € de chiffre d'affaires total ;
 * - barème 2026 pour une part : 0 % jusqu'à 11 600 €, 11 % jusqu'à 29 579 €, 30 % jusqu'à 84 577 €, 41 % jusqu'à
 *   181 917 €, 45 % au-delà ; impôt cumulé à 29 579 € : 17 979 x 11 % = 1 977,69 € ;
 * - décote d'un célibataire : 897 € - 45,25 % de l'impôt brut, si elle est positive.
 *
 * Les attendus sont les montants exacts arrondis à l'euro le plus proche, l'impôt sur le revenu étant lui-même
 * arrondi à l'euro (article 1657 du CGI) avant d'être retranché du net.
 */

const alice = personne("alice")
const titulaire = [relation("alice", "m1", "Titulaire")]

function simulerMicro(flux: Flux[], options: Partial<Pick<MicroEntreprise, "beneficieACRE" | "opteVFL" | "rfrN2">> = {}) {
  const entreprise: MicroEntreprise = { ...micro("m1"), ...options }
  return simuler([alice, entreprise], titulaire, flux)
}

casDeReference("Cas de référence 2026 : micro-entreprise", () => {
  it("prestations BNC seules, 40 000 €", () => {
    // Cotisations : 40 000 x 25,6 % = 10 240 €.
    // Revenu imposable : 40 000 - 34 % (13 600 €) = 26 400 €.
    // Impôt brut : (26 400 - 11 600) x 11 % = 1 628 € ; décote 897 - 45,25 % x 1 628 = 160,33 € ; impôt 1 467,67 €.
    // Net : 40 000 - 10 240 - 1 467,67 = 28 292,33 €.
    const report = simulerMicro([["m1", "ca_micro_services_bnc", 40000]])

    expect(activite(report, "m1")).toMatchObject({ chiffreAffaires: 40000, cotisationsSociales: 10240, revenuVerse: 29760, warnings: [] })
    expect(foyerDe(report, "alice")).toMatchObject({ totalParts: 1, revenuImposableGlobal: 26400, impotSurLeRevenu: 1468, prelevementsSociaux: 0, netApresImpots: 28292 })
    verifierIdentiteDuBilan(report)
  })

  it("vente seule, 100 000 €", () => {
    // Cotisations : 100 000 x 12,3 % = 12 300 €.
    // Revenu imposable : 100 000 - 71 % (71 000 €) = 29 000 €.
    // Impôt brut : (29 000 - 11 600) x 11 % = 1 914 € ; décote 897 - 866,085 = 30,915 € ; impôt 1 883,085 €.
    // Net : 100 000 - 12 300 - 1 883,085 = 85 816,915 €.
    const report = simulerMicro([["m1", "ca_micro_vente", 100000]])

    expect(activite(report, "m1").cotisationsSociales).toBe(12300)
    expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 29000, impotSurLeRevenu: 1883, netApresImpots: 85817 })
    verifierIdentiteDuBilan(report)
  })

  it("prestations BIC seules, 60 000 €, revenu imposable dans la tranche à 30 %", () => {
    // Cotisations : 60 000 x 21,2 % = 12 720 €.
    // Revenu imposable : 60 000 - 50 % = 30 000 €.
    // Impôt : 1 977,69 + (30 000 - 29 579) x 30 % = 1 977,69 + 126,30 = 2 103,99 € ; décote 897 - 952,06 < 0, nulle.
    // Net : 60 000 - 12 720 - 2 103,99 = 45 176,01 €.
    const report = simulerMicro([["m1", "ca_micro_services_bic", 60000]])

    expect(activite(report, "m1").cotisationsSociales).toBe(12720)
    expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 30000, impotSurLeRevenu: 2104, netApresImpots: 45176 })
    verifierIdentiteDuBilan(report)
  })

  it("activité mixte : vente 50 000 €, BIC 20 000 €, BNC 10 000 €", () => {
    // Plafonds respectés : 30 000 € de services (<= 83 600 €), 80 000 € au total (<= 203 100 €).
    // Cotisations : 50 000 x 12,3 % + 20 000 x 21,2 % + 10 000 x 25,6 % = 6 150 + 4 240 + 2 560 = 12 950 €.
    // Abattements : 35 500 + 10 000 + 3 400 = 48 900 € ; revenu imposable 80 000 - 48 900 = 31 100 €.
    // Impôt : 1 977,69 + (31 100 - 29 579) x 30 % = 1 977,69 + 456,30 = 2 433,99 € (pas de décote).
    // Net : 80 000 - 12 950 - 2 433,99 = 64 616,01 €.
    const report = simulerMicro([
      ["m1", "ca_micro_vente", 50000],
      ["m1", "ca_micro_services_bic", 20000],
      ["m1", "ca_micro_services_bnc", 10000]
    ])

    expect(activite(report, "m1")).toMatchObject({ chiffreAffaires: 80000, cotisationsSociales: 12950, warnings: [] })
    expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 31100, impotSurLeRevenu: 2434, netApresImpots: 64616 })
    verifierIdentiteDuBilan(report)
  })

  it("petit chiffre d'affaires BNC : l'abattement minimum de 305 € s'applique", () => {
    // Abattement : max(600 x 34 % = 204 €, 305 €) = 305 € ; revenu imposable 600 - 305 = 295 €.
    // Cotisations : 600 x 25,6 % = 153,60 € ; impôt nul (sous 11 600 €). Net : 600 - 153,60 = 446,40 €.
    const report = simulerMicro([["m1", "ca_micro_services_bnc", 600]])

    expect(activite(report, "m1").cotisationsSociales).toBe(154)
    expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 295, impotSurLeRevenu: 0, netApresImpots: 446 })
  })

  it("chiffre d'affaires inférieur à l'abattement minimum : revenu imposable nul, jamais négatif", () => {
    // L'abattement de 305 € ne peut pas dépasser le chiffre d'affaires de 250 € : revenu imposable 0 €.
    const report = simulerMicro([["m1", "ca_micro_services_bnc", 250]])

    expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 0, impotSurLeRevenu: 0 })
  })

  // Écart relevé : le moteur compare la somme des abattements au minimum global (305 € x 2 natures = 610 €),
  // au lieu d'appliquer le minimum à chaque catégorie de revenus (BIC d'un côté, BNC de l'autre, déclarés dans
  // des cases distinctes : 5KO pour la vente, 5HQ pour le BNC), chacun plafonné à son chiffre d'affaires.
  // Cause probable : calculerRevenuImposable, src/backend/logic/calculsAE.ts.
  it.fails("BNC 10 000 € et vente 300 € : le minimum de 305 € s'applique à chaque catégorie séparément", () => {
    // BNC : 10 000 - max(3 400, 305) = 6 600 €.
    // Vente : max(300 x 71 % = 213 €, 305 €) = 305 €, plafonné au CA de 300 € : revenu 0 €.
    // Revenu imposable officiel : 6 600 € (le moteur obtient 10 300 - max(3 613, 610) = 6 687 €).
    const report = simulerMicro([
      ["m1", "ca_micro_services_bnc", 10000],
      ["m1", "ca_micro_vente", 300]
    ])

    expect(foyerDe(report, "alice").revenuImposableGlobal).toBe(6600)
  })

  it("avec l'ACRE : cotisations réduites de moitié, impôt inchangé", () => {
    // Cotisations : 40 000 x 25,6 % x 50 % = 5 120 €. Impôt identique au cas BNC sans ACRE : 1 467,67 €.
    // Net : 40 000 - 5 120 - 1 467,67 = 33 412,33 €.
    const report = simulerMicro([["m1", "ca_micro_services_bnc", 40000]], { beneficieACRE: true })

    expect(activite(report, "m1").cotisationsSociales).toBe(5120)
    expect(foyerDe(report, "alice")).toMatchObject({ impotSurLeRevenu: 1468, netApresImpots: 33412 })
    verifierIdentiteDuBilan(report)
  })

  it("versement libératoire, RFR sous le seuil : 2,2 % du CA remplace le barème", () => {
    // Seuil pour 1 part : 29 315 € ; RFR 25 000 € : éligible.
    // Versement libératoire : 40 000 x 2,2 % = 880 € ; plus rien au barème (revenu imposable 0 €).
    // Net : 40 000 - 10 240 - 880 = 28 880 €.
    const report = simulerMicro([["m1", "ca_micro_services_bnc", 40000]], { opteVFL: true, rfrN2: 25000 })

    expect(activite(report, "m1")).toMatchObject({
      cotisationsSociales: 10240,
      versementLiberatoire: { plafondRfr: 29315, partsFiscales: 1, rfrN2: 25000, eligible: true, applique: true },
      warnings: []
    })
    expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 0, impotSurLeRevenu: 880, netApresImpots: 28880 })
    verifierIdentiteDuBilan(report)
  })

  it("versement libératoire, RFR égal au seuil : encore éligible", () => {
    // Le RFR ne doit pas dépasser 29 315 € : l'égalité ouvre droit à l'option.
    const report = simulerMicro([["m1", "ca_micro_services_bnc", 40000]], { opteVFL: true, rfrN2: 29315 })

    expect(activite(report, "m1").versementLiberatoire).toMatchObject({ eligible: true, applique: true })
    expect(foyerDe(report, "alice").impotSurLeRevenu).toBe(880)
  })

  it("versement libératoire, RFR au-dessus du seuil : retour au barème", () => {
    // RFR 30 000 € > 29 315 € : l'option est refusée, l'impôt est celui du cas BNC au barème (1 467,67 €).
    const report = simulerMicro([["m1", "ca_micro_services_bnc", 40000]], { opteVFL: true, rfrN2: 30000 })
    const resultat = activite(report, "m1")

    expect(resultat.versementLiberatoire).toMatchObject({ plafondRfr: 29315, eligible: false, applique: false })
    expect(resultat.warnings.some(w => w.startsWith("Versement libératoire impossible"))).toBe(true)
    expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 26400, impotSurLeRevenu: 1468, netApresImpots: 28292 })
  })

  it("versement libératoire, RFR non renseigné : appliqué, avec un rappel du seuil", () => {
    const report = simulerMicro([["m1", "ca_micro_services_bnc", 40000]], { opteVFL: true })
    const resultat = activite(report, "m1")

    expect(resultat.versementLiberatoire).toMatchObject({ rfrN2: null, eligible: null, applique: true })
    expect(resultat.warnings.some(w => /29\s315/.test(w))).toBe(true)
    expect(foyerDe(report, "alice")).toMatchObject({ impotSurLeRevenu: 880, netApresImpots: 28880 })
  })

  it("prestations BNC de 90 000 € : plafond des services dépassé", () => {
    // 90 000 € > 83 600 € : avertissement (le régime reste calculé, un dépassement isolé est toléré).
    // Cotisations : 90 000 x 25,6 % = 23 040 € ; revenu imposable 90 000 - 30 600 = 59 400 €.
    // Impôt : 1 977,69 + (59 400 - 29 579) x 30 % = 1 977,69 + 8 946,30 = 10 923,99 €.
    // Net : 90 000 - 23 040 - 10 923,99 = 56 036,01 €.
    const report = simulerMicro([["m1", "ca_micro_services_bnc", 90000]])
    const resultat = activite(report, "m1")

    expect(resultat.cotisationsSociales).toBe(23040)
    expect(resultat.warnings).toHaveLength(1)
    expect(resultat.warnings[0]).toContain("prestations de services")
    expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 59400, impotSurLeRevenu: 10924, netApresImpots: 56036 })
  })

  it("prestations BNC de 83 600 € : plafond atteint mais pas dépassé", () => {
    const report = simulerMicro([["m1", "ca_micro_services_bnc", 83600]])

    expect(activite(report, "m1").warnings).toEqual([])
  })

  it("activité mixte : vente 180 000 € et BIC 30 000 €, plafond total dépassé", () => {
    // Services 30 000 € (<= 83 600 €) mais total 210 000 € > 203 100 € : seul le plafond total est signalé.
    // Cotisations : 180 000 x 12,3 % + 30 000 x 21,2 % = 22 140 + 6 360 = 28 500 €.
    // Revenu imposable : 210 000 - (127 800 + 15 000) = 67 200 €.
    // Impôt : 1 977,69 + (67 200 - 29 579) x 30 % = 1 977,69 + 11 286,30 = 13 263,99 €.
    // Net : 210 000 - 28 500 - 13 263,99 = 168 236,01 €.
    const report = simulerMicro([
      ["m1", "ca_micro_vente", 180000],
      ["m1", "ca_micro_services_bic", 30000]
    ])
    const resultat = activite(report, "m1")

    expect(resultat.cotisationsSociales).toBe(28500)
    expect(resultat.warnings).toHaveLength(1)
    expect(resultat.warnings[0]).toContain("chiffre d'affaires total")
    expect(resultat.warnings[0]).not.toContain("prestations de services")
    expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 67200, impotSurLeRevenu: 13264, netApresImpots: 168236 })
  })

  it("dépenses saisies : elles ne changent ni les cotisations ni l'impôt, seulement le net", () => {
    // Au régime micro, les frais réels ne sont pas déductibles : cotisations 10 240 € et impôt 1 467,67 € inchangés.
    // Encaissé : 40 000 - 10 240 - 5 000 = 24 760 € ; net 24 760 - 1 467,67 = 23 292,33 €.
    // Bilan : revenus avant prélèvements 40 000 - 5 000 = 35 000 € = 11 708 € de prélèvements + 23 292 € de net.
    const report = simulerMicro([
      ["m1", "ca_micro_services_bnc", 40000],
      ["m1", "expense", 5000]
    ])

    expect(activite(report, "m1")).toMatchObject({ cotisationsSociales: 10240, charges: 5000, revenuVerse: 24760 })
    expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 26400, impotSurLeRevenu: 1468, netApresImpots: 23292 })
    expect(report.bilan).toMatchObject({ revenusAvantPrelevements: 35000, totalPrelevements: 11708 })
    verifierIdentiteDuBilan(report)
  })
})
