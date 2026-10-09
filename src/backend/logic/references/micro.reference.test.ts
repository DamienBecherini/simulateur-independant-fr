// src/backend/logic/references/micro.reference.test.ts

import { describe, expect, it } from "vitest"
import { activite, casDeReference, foyerDe, simuler, verifierIdentiteDuBilan } from "../testing/cas-de-reference.js"
import { micro, personne, relation, type Flux } from "../testing/session-de-test.js"
import type { MicroEntreprise } from "../../../types.js"

/*
 * Cas de référence 2026 : micro-entreprise seule, titulaire célibataire (1 part).
 *
 * Démarche : le moteur tourne avec les règles réelles de 2026 (REGLES_DES_CAS), et chaque attendu est dérivé à la main
 * à partir des règles officielles 2026, sans lancer le moteur. En cas d'écart, c'est le moteur qui est suspect.
 *
 * Règles utilisées (sources dans le fichier des règles de 2026) :
 * - cotisations sur le CA : vente 12,3 %, prestations BIC 21,2 %, prestations BNC 25,6 % ; ACRE : - 50 % ;
 * - contribution à la formation professionnelle, en plus (article L6331-48 du code du travail) : vente 0,1 %,
 *   prestations BNC 0,2 %, prestations BIC 0,3 % (taux des artisans, le simulateur ne distinguant pas le commerçant,
 *   à 0,2 %) ; l'ACRE ne la réduit pas ;
 * - abattement forfaitaire : vente 71 %, BIC 50 %, BNC 34 %, au minimum 305 € par nature d'activité,
 *   sans pouvoir dépasser le chiffre d'affaires ;
 * - versement libératoire : vente 1 %, BIC 1,7 %, BNC 2,2 % du CA, si le RFR 2024 ne dépasse pas 29 315 € par part ;
 * - plafonds 2026 : 83 600 € de prestations de services, 203 100 € de chiffre d'affaires total ;
 * - franchise en base de TVA : 37 500 € de prestations (seuil majoré 41 250 €), 85 000 € au total (93 500 €) ;
 * - barème 2026 pour une part : 0 % jusqu'à 11 600 €, 11 % jusqu'à 29 579 €, 30 % jusqu'à 84 577 €, 41 % jusqu'à
 *   181 917 €, 45 % au-delà ; impôt cumulé à 29 579 € : 17 979 x 11 % = 1 977,69 € ;
 * - décote d'un célibataire : 897 € - 45,25 % de l'impôt brut, si elle est positive.
 *
 * Les attendus sont les montants exacts arrondis à l'euro le plus proche, l'impôt sur le revenu étant lui-même
 * arrondi à l'euro (article 1657 du CGI) avant d'être retranché du net.
 */

const alice = personne("alice")
const titulaire = [relation("alice", "m1", "Titulaire")]

/** Avertissements sur les plafonds du régime, sans ceux de la franchise de TVA. */
const plafonds = (warnings: string[]) => warnings.filter(w => w.startsWith("Plafond"))
/** 40 000 € de prestations : au-dessus du seuil de franchise de TVA (37 500 €), sous le seuil majoré (41 250 €). */
const tvaAnneeSuivante = expect.stringMatching(/^Seuil de franchise en base de TVA dépassé \(prestations de services 40\s000 € pour un seuil de 37\s500 €\)/)

function simulerMicro(flux: Flux[], options: Partial<Pick<MicroEntreprise, "beneficieACRE" | "opteVFL" | "rfrN2">> = {}) {
  const entreprise: MicroEntreprise = { ...micro("m1"), ...options }
  return simuler([alice, entreprise], titulaire, flux)
}

casDeReference("Cas de référence 2026 : micro-entreprise", () => {
  it("prestations BNC seules, 40 000 €", () => {
    // Cotisations : 40 000 x 25,6 % = 10 240 €, plus 40 000 x 0,2 % = 80 € de formation professionnelle : 10 320 €.
    // Revenu imposable : 40 000 - 34 % (13 600 €) = 26 400 €.
    // Impôt brut : (26 400 - 11 600) x 11 % = 1 628 € ; décote 897 - 45,25 % x 1 628 = 160,33 € ; impôt 1 467,67 €.
    // Net : 40 000 - 10 320 - 1 467,67 = 28 212,33 €.
    const report = simulerMicro([["m1", "ca_micro_services_bnc", 40000]])

    expect(activite(report, "m1")).toMatchObject({ chiffreAffaires: 40000, cotisationsSociales: 10320, formationProfessionnelle: 80, revenuVerse: 29680, warnings: [tvaAnneeSuivante] })
    expect(foyerDe(report, "alice")).toMatchObject({ totalParts: 1, revenuImposableGlobal: 26400, impotSurLeRevenu: 1468, prelevementsSociaux: 0, netApresImpots: 28212 })
    verifierIdentiteDuBilan(report)
  })

  it("vente seule, 100 000 €", () => {
    // Cotisations : 100 000 x 12,3 % = 12 300 €, plus 100 000 x 0,1 % = 100 € de formation professionnelle : 12 400 €.
    // Revenu imposable : 100 000 - 71 % (71 000 €) = 29 000 €.
    // Impôt brut : (29 000 - 11 600) x 11 % = 1 914 € ; décote 897 - 866,085 = 30,915 € ; impôt 1 883,085 €.
    // Net : 100 000 - 12 400 - 1 883,085 = 85 716,915 €.
    const report = simulerMicro([["m1", "ca_micro_vente", 100000]])

    expect(activite(report, "m1").cotisationsSociales).toBe(12400)
    expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 29000, impotSurLeRevenu: 1883, netApresImpots: 85717 })
    verifierIdentiteDuBilan(report)
  })

  it("prestations BIC seules, 60 000 €, revenu imposable dans la tranche à 30 %", () => {
    // Cotisations : 60 000 x 21,2 % = 12 720 €, plus 60 000 x 0,3 % = 180 € de formation professionnelle : 12 900 €.
    // Revenu imposable : 60 000 - 50 % = 30 000 €.
    // Impôt : 1 977,69 + (30 000 - 29 579) x 30 % = 1 977,69 + 126,30 = 2 103,99 € ; décote 897 - 952,06 < 0, nulle.
    // Net : 60 000 - 12 900 - 2 103,99 = 44 996,01 €.
    const report = simulerMicro([["m1", "ca_micro_services_bic", 60000]])

    expect(activite(report, "m1").cotisationsSociales).toBe(12900)
    expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 30000, impotSurLeRevenu: 2104, netApresImpots: 44996 })
    verifierIdentiteDuBilan(report)
  })

  it("activité mixte : vente 50 000 €, BIC 20 000 €, BNC 10 000 €", () => {
    // Plafonds respectés : 30 000 € de services (<= 83 600 €), 80 000 € au total (<= 203 100 €).
    // Cotisations : 50 000 x 12,3 % + 20 000 x 21,2 % + 10 000 x 25,6 % = 6 150 + 4 240 + 2 560 = 12 950 € ; formation
    // professionnelle : 50 + 60 + 20 = 130 € ; total 13 080 €.
    // Abattements : 35 500 + 10 000 + 3 400 = 48 900 € ; revenu imposable 80 000 - 48 900 = 31 100 €.
    // Impôt : 1 977,69 + (31 100 - 29 579) x 30 % = 1 977,69 + 456,30 = 2 433,99 € (pas de décote).
    // Net : 80 000 - 13 080 - 2 433,99 = 64 486,01 €.
    const report = simulerMicro([
      ["m1", "ca_micro_vente", 50000],
      ["m1", "ca_micro_services_bic", 20000],
      ["m1", "ca_micro_services_bnc", 10000]
    ])

    expect(activite(report, "m1")).toMatchObject({ chiffreAffaires: 80000, cotisationsSociales: 13080, formationProfessionnelle: 130, warnings: [] })
    expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 31100, impotSurLeRevenu: 2434, netApresImpots: 64486 })
    verifierIdentiteDuBilan(report)
  })

  it("petit chiffre d'affaires BNC : l'abattement minimum de 305 € s'applique", () => {
    // Abattement : max(600 x 34 % = 204 €, 305 €) = 305 € ; revenu imposable 600 - 305 = 295 €.
    // Cotisations : 600 x 25,6 % = 153,60 €, plus 600 x 0,2 % = 1,20 € de formation professionnelle : 154,80 € ;
    // impôt nul (sous 11 600 €). Net : 600 - 154,80 = 445,20 €.
    const report = simulerMicro([["m1", "ca_micro_services_bnc", 600]])

    expect(activite(report, "m1").cotisationsSociales).toBe(155)
    expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 295, impotSurLeRevenu: 0, netApresImpots: 445 })
  })

  it("chiffre d'affaires inférieur à l'abattement minimum : revenu imposable nul, jamais négatif", () => {
    // L'abattement de 305 € ne peut pas dépasser le chiffre d'affaires de 250 € : revenu imposable 0 €.
    const report = simulerMicro([["m1", "ca_micro_services_bnc", 250]])

    expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 0, impotSurLeRevenu: 0 })
  })

  // Le minimum de 305 € s'applique à chaque catégorie de revenus (déclarées dans des cases distinctes : 5KO pour
  // la vente, 5HQ pour le BNC), chacun plafonné à son chiffre d'affaires. Ce cas a révélé une erreur du moteur,
  // qui comparait la somme des abattements à un minimum global (305 € x 2 natures).
  it("BNC 10 000 € et vente 300 € : le minimum de 305 € s'applique à chaque catégorie séparément", () => {
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
    // Cotisations : 40 000 x 25,6 % x 50 % = 5 120 €, plus 80 € de formation professionnelle, que l'ACRE ne réduit pas :
    // 5 200 €. Impôt identique au cas BNC sans ACRE : 1 467,67 €. Net : 40 000 - 5 200 - 1 467,67 = 33 332,33 €.
    const report = simulerMicro([["m1", "ca_micro_services_bnc", 40000]], { beneficieACRE: true })

    expect(activite(report, "m1")).toMatchObject({ cotisationsSociales: 5200, formationProfessionnelle: 80 })
    expect(foyerDe(report, "alice")).toMatchObject({ impotSurLeRevenu: 1468, netApresImpots: 33332 })
    verifierIdentiteDuBilan(report)
  })

  it("versement libératoire, RFR sous le seuil : 2,2 % du CA remplace le barème", () => {
    // Seuil pour 1 part : 29 315 € ; RFR 25 000 € : éligible.
    // Versement libératoire : 40 000 x 2,2 % = 880 € ; plus rien au barème (revenu imposable 0 €).
    // Net : 40 000 - 10 320 - 880 = 28 800 €.
    const report = simulerMicro([["m1", "ca_micro_services_bnc", 40000]], { opteVFL: true, rfrN2: 25000 })

    expect(activite(report, "m1")).toMatchObject({
      cotisationsSociales: 10320,
      versementLiberatoire: { plafondRfr: 29315, partsFiscales: 1, rfrN2: 25000, eligible: true, applique: true },
      warnings: [tvaAnneeSuivante]
    })
    expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 0, impotSurLeRevenu: 880, netApresImpots: 28800 })
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
    expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 26400, impotSurLeRevenu: 1468, netApresImpots: 28212 })
  })

  it("versement libératoire, RFR non renseigné : appliqué, avec un rappel du seuil", () => {
    const report = simulerMicro([["m1", "ca_micro_services_bnc", 40000]], { opteVFL: true })
    const resultat = activite(report, "m1")

    expect(resultat.versementLiberatoire).toMatchObject({ rfrN2: null, eligible: null, applique: true })
    expect(resultat.warnings.some(w => /29\s315/.test(w))).toBe(true)
    expect(foyerDe(report, "alice")).toMatchObject({ impotSurLeRevenu: 880, netApresImpots: 28800 })
  })

  it("prestations BNC de 90 000 € : plafond des services dépassé", () => {
    // 90 000 € > 83 600 € : avertissement (le régime reste calculé, un dépassement isolé est toléré).
    // Cotisations : 90 000 x 25,6 % = 23 040 €, plus 180 € de formation professionnelle : 23 220 € ;
    // revenu imposable 90 000 - 30 600 = 59 400 €.
    // Impôt : 1 977,69 + (59 400 - 29 579) x 30 % = 1 977,69 + 8 946,30 = 10 923,99 €.
    // Net : 90 000 - 23 220 - 10 923,99 = 55 856,01 €.
    const report = simulerMicro([["m1", "ca_micro_services_bnc", 90000]])
    const resultat = activite(report, "m1")

    expect(resultat.cotisationsSociales).toBe(23220)
    expect(plafonds(resultat.warnings)).toEqual([expect.stringContaining("prestations de services")])
    expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 59400, impotSurLeRevenu: 10924, netApresImpots: 55856 })
  })

  it("prestations BNC de 83 600 € : plafond atteint mais pas dépassé", () => {
    const report = simulerMicro([["m1", "ca_micro_services_bnc", 83600]])

    expect(plafonds(activite(report, "m1").warnings)).toEqual([])
  })

  it("franchise en base de TVA : 37 500 € de prestations restent en franchise, 41 300 € la font perdre aussitôt", () => {
    const tva = (ca: number) => activite(simulerMicro([["m1", "ca_micro_services_bnc", ca]]), "m1").warnings.filter(w => w.includes("TVA"))

    expect(tva(37500)).toEqual([])
    expect(tva(37600)).toEqual([expect.stringMatching(/^Seuil de franchise .*37\s500 €.*1er janvier suivant/)])
    expect(tva(41300)).toEqual([expect.stringMatching(/^Franchise en base de TVA perdue .*41\s250 €.*dès le jour du dépassement/)])
  })

  it("franchise en base de TVA : 93 600 € de vente dépassent le seuil majoré de 93 500 €", () => {
    const report = simulerMicro([["m1", "ca_micro_vente", 93600]])
    expect(activite(report, "m1").warnings).toEqual([expect.stringMatching(/^Franchise en base de TVA perdue \(chiffre d'affaires total 93\s600 € pour un seuil de 93\s500 €\)/)])
  })

  it("activité mixte : vente 180 000 € et BIC 30 000 €, plafond total dépassé", () => {
    // Services 30 000 € (<= 83 600 €) mais total 210 000 € > 203 100 € : seul le plafond total est signalé.
    // Cotisations : 180 000 x 12,3 % + 30 000 x 21,2 % = 22 140 + 6 360 = 28 500 €, plus 180 + 90 = 270 € de formation
    // professionnelle : 28 770 €.
    // Revenu imposable : 210 000 - (127 800 + 15 000) = 67 200 €.
    // Impôt : 1 977,69 + (67 200 - 29 579) x 30 % = 1 977,69 + 11 286,30 = 13 263,99 €.
    // Net : 210 000 - 28 770 - 13 263,99 = 167 966,01 €.
    const report = simulerMicro([
      ["m1", "ca_micro_vente", 180000],
      ["m1", "ca_micro_services_bic", 30000]
    ])
    const resultat = activite(report, "m1")

    expect(resultat.cotisationsSociales).toBe(28770)
    const [plafond, ...autres] = plafonds(resultat.warnings)
    expect(autres).toEqual([])
    expect(plafond).toContain("chiffre d'affaires total")
    expect(plafond).not.toContain("prestations de services")
    expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 67200, impotSurLeRevenu: 13264, netApresImpots: 167966 })
  })

  describe("plafonds du régime, à l'euro près : le plafond peut être atteint, pas dépassé", () => {
    const plafondsDe = (flux: Flux[]) => plafonds(activite(simulerMicro(flux), "m1").warnings)

    it.each<[string, Flux[], string[]]>([
      ["prestations BNC 83 600 €", [["m1", "ca_micro_services_bnc", 83600]], []],
      ["prestations BNC 83 601 €", [["m1", "ca_micro_services_bnc", 83601]], ["prestations de services 83 601 € pour un plafond de 83 600 €"]],
      ["prestations BIC 83 601 €", [["m1", "ca_micro_services_bic", 83601]], ["prestations de services 83 601 € pour un plafond de 83 600 €"]],
      // BIC et BNC s'additionnent : 40 000 + 43 601 = 83 601 €.
      ["BIC 40 000 € et BNC 43 601 €", [["m1", "ca_micro_services_bic", 40000], ["m1", "ca_micro_services_bnc", 43601]], ["prestations de services 83 601 € pour un plafond de 83 600 €"]],
      ["vente 203 100 €", [["m1", "ca_micro_vente", 203100]], []],
      ["vente 203 101 €", [["m1", "ca_micro_vente", 203101]], ["chiffre d'affaires total 203 101 € pour un plafond de 203 100 €"]],
      // Activité mixte : prestations 83 600 € (au plafond) et total 119 500 + 83 600 = 203 100 € (au plafond) : rien.
      ["vente 119 500 € et BIC 83 600 €", [["m1", "ca_micro_vente", 119500], ["m1", "ca_micro_services_bic", 83600]], []],
      // Prestations 53 101 € sous leur plafond, mais total 150 000 + 53 101 = 203 101 € : seul le total dépasse.
      ["vente 150 000 € et BIC 53 101 €", [["m1", "ca_micro_vente", 150000], ["m1", "ca_micro_services_bic", 53101]], ["chiffre d'affaires total 203 101 € pour un plafond de 203 100 €"]],
      // Les deux plafonds dépassés : 83 601 € de prestations, 120 000 + 83 601 = 203 601 € au total.
      ["vente 120 000 € et BNC 83 601 €", [["m1", "ca_micro_vente", 120000], ["m1", "ca_micro_services_bnc", 83601]], ["prestations de services 83 601 € pour un plafond de 83 600 €", "chiffre d'affaires total 203 601 € pour un plafond de 203 100 €"]]
    ])("%s", (_cas, flux, depassements) => {
      const avertissements = plafondsDe(flux).map(w => w.replace(/\s/g, " "))

      if (depassements.length === 0) expect(avertissements).toEqual([])
      else expect(avertissements).toEqual([`Plafond du régime micro dépassé (${depassements.join(" ; ")}) : le régime n'est conservé que si le dépassement ne se répète pas deux années de suite.`])
    })
  })

  describe("franchise en base de TVA, à l'euro près : seuil de base pour l'année suivante, seuil majoré aussitôt", () => {
    /** Avertissement de TVA : aucun, seuil de base (« suivant ») ou seuil majoré (« perdue »), avec ce qui dépasse. */
    function tva(flux: Flux[]): string {
      const avertissement = activite(simulerMicro(flux), "m1").warnings.find(w => w.includes("TVA"))?.replace(/\s/g, " ")
      if (!avertissement) return "aucun"
      const detail = /\((.*)\)/.exec(avertissement)?.[1]
      return `${avertissement.startsWith("Franchise en base de TVA perdue") ? "perdue" : "suivant"} : ${detail}`
    }

    it.each<[string, Flux[], string]>([
      ["prestations 37 500 €", [["m1", "ca_micro_services_bnc", 37500]], "aucun"],
      ["prestations 37 501 €", [["m1", "ca_micro_services_bnc", 37501]], "suivant : prestations de services 37 501 € pour un seuil de 37 500 €"],
      // 41 250 € : au-delà du seuil de base, mais le seuil majoré n'est pas dépassé.
      ["prestations 41 250 €", [["m1", "ca_micro_services_bic", 41250]], "suivant : prestations de services 41 250 € pour un seuil de 37 500 €"],
      ["prestations 41 251 €", [["m1", "ca_micro_services_bic", 41251]], "perdue : prestations de services 41 251 € pour un seuil de 41 250 €"],
      ["vente 85 000 €", [["m1", "ca_micro_vente", 85000]], "aucun"],
      ["vente 85 001 €", [["m1", "ca_micro_vente", 85001]], "suivant : chiffre d'affaires total 85 001 € pour un seuil de 85 000 €"],
      ["vente 93 500 €", [["m1", "ca_micro_vente", 93500]], "suivant : chiffre d'affaires total 93 500 € pour un seuil de 85 000 €"],
      ["vente 93 501 €", [["m1", "ca_micro_vente", 93501]], "perdue : chiffre d'affaires total 93 501 € pour un seuil de 93 500 €"],
      // Activité mixte : prestations 37 500 € (au seuil), mais total 50 000 + 37 500 = 87 500 € au-delà de 85 000 €.
      ["vente 50 000 € et BNC 37 500 €", [["m1", "ca_micro_vente", 50000], ["m1", "ca_micro_services_bnc", 37500]], "suivant : chiffre d'affaires total 87 500 € pour un seuil de 85 000 €"],
      // Prestations 41 251 € au-delà du seuil majoré : la franchise est perdue même si le total (91 251 €) reste sous 93 500 €.
      ["vente 50 000 € et BNC 41 251 €", [["m1", "ca_micro_vente", 50000], ["m1", "ca_micro_services_bnc", 41251]], "perdue : prestations de services 41 251 € pour un seuil de 41 250 €"]
    ])("%s", (_cas, flux, attendu) => {
      expect(tva(flux)).toBe(attendu)
    })
  })

  it("versement libératoire, RFR un euro au-dessus du seuil : refusé", () => {
    // 29 316 € > 29 315 € : l'option est refusée, l'impôt est celui du barème (1 467,67 €, voir le cas BNC de 40 000 €).
    const report = simulerMicro([["m1", "ca_micro_services_bnc", 40000]], { opteVFL: true, rfrN2: 29316 })

    expect(activite(report, "m1").versementLiberatoire).toMatchObject({ plafondRfr: 29315, eligible: false, applique: false })
    expect(foyerDe(report, "alice").impotSurLeRevenu).toBe(1468)
  })

  it("dépenses saisies : elles ne changent ni les cotisations ni l'impôt, seulement le net", () => {
    // Au régime micro, les frais réels ne sont pas déductibles : cotisations 10 320 € (formation professionnelle comprise)
    // et impôt 1 467,67 € inchangés.
    // Encaissé : 40 000 - 10 320 - 5 000 = 24 680 € ; net 24 680 - 1 467,67 = 23 212,33 €.
    // Bilan : revenus avant prélèvements 40 000 - 5 000 = 35 000 € = 11 788 € de prélèvements + 23 212 € de net.
    const report = simulerMicro([
      ["m1", "ca_micro_services_bnc", 40000],
      ["m1", "expense", 5000]
    ])

    expect(activite(report, "m1")).toMatchObject({ cotisationsSociales: 10320, charges: 5000, revenuVerse: 24680 })
    expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 26400, impotSurLeRevenu: 1468, netApresImpots: 23212 })
    expect(report.bilan).toMatchObject({ revenusAvantPrelevements: 35000, totalPrelevements: 11788 })
    verifierIdentiteDuBilan(report)
  })
})
