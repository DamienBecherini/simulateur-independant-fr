// src/backend/logic/references/creation-en-cours-d-annee.reference.test.ts

import { describe, expect, it } from "vitest"
import type { Company, Entity, MicroEntreprise, Relationship } from "../../../types.js"
import { runMetaSimulation } from "../simulation-engine.js"
import { activite, casDeReference, REGLES_DES_CAS, verifierIdentiteDuBilan } from "../testing/cas-de-reference.js"
import { exercant, micro, personne, relation, session, societe, type Flux } from "../testing/session-de-test.js"

/*
 * Cas de référence 2026 d'une activité créée en cours d'année (voir l'ADR 020 et la section 12 de
 * documentation/recherche/creation-en-cours-d-annee.md). Chaque attendu vient d'une réimplémentation des formules, faite
 * à part du code du simulateur à partir des barèmes de 2026.json :
 * - indépendants : plafond de la sécurité sociale (PASS, 48 060 €) réduit aux mois d'activité (article R613-17 du code
 *   de la sécurité sociale) pour les tranches, les barèmes progressifs et les bornes de l'abattement de 26 % ; minimum
 *   d'invalidité-décès réduit de même (11,5 % du PASS au prorata, hypothèse) ; minimum des indemnités journalières
 *   (19 224 €) et formation professionnelle (120,15 €) entiers (Urssaf) ; minimum de retraite de base (5 409 €) entier,
 *   sauf moins de 90 jours d'activité dans l'année (article D633-2) ;
 * - président de SASU : un plafond mensuel (4 005 €) par mois depuis la création (article R242-2) ;
 * - impôt sur les sociétés : limite du taux réduit de 42 500 € multipliée par les mois de l'exercice sur 12 (article
 *   219 I b du CGI) ;
 * - franchise de TVA de la micro-entreprise : seuils multipliés par les jours d'activité sur 365 (BOI-TVA-DECLA-40-10-10).
 * Les montants sont saisis dans le mois de création, sauf quand le cas porte sur des montants saisis avant.
 */

const alice = personne("alice")

/** Lance le moteur sur 2026 ; les flux sont saisis dans le mois `mois` (0 pour janvier). */
function simulerEn(mois: number, entities: Entity[], relationships: Relationship[], flux: Flux[]) {
  const donnees = session(entities, relationships, flux)
  donnees.monthlyData[mois].flows = donnees.monthlyData[0].flows
  if (mois !== 0) donnees.monthlyData[0].flows = []
  return runMetaSimulation(donnees, REGLES_DES_CAS, { annee: 2026 })
}

const AVRIL = 3
const SEPTEMBRE = 8
const OCTOBRE = 9
const NOVEMBRE = 10

const ei = (dateDeCreation?: string): Company => ({ ...societe("e1", "EI"), ...(dateDeCreation ? { dateDeCreation } : {}) })

casDeReference("Cas de référence 2026 : activité créée en cours d'année", () => {
  describe("cas 1 : EI au réel créée en avril, 30 000 € de bénéfice avant cotisations", () => {
    // PASS au prorata : 48 060 x 9/12 = 36 045 €. Abattement 26 % x 30 000 = 7 800 € (entre 1,76 % et 130 % du PASS
    // réduit) : assiette 22 200 €, comme en année pleine. Elle pèse 61,6 % du PASS réduit au lieu de 46,2 % : le taux
    // progressif de la maladie monte de 2,27 % à 4,08 %. Les autres lignes ne changent pas (assiette sous le PASS réduit).
    const flux: Flux[] = [
      ["e1", "ca_services", 40000],
      ["e1", "deductible_expense", 10000]
    ]
    const creee = activite(simulerEn(AVRIL, [alice, ei("2026-04")], exercant("alice", "e1", "EI"), flux), "e1")
    const pleine = activite(simulerEn(AVRIL, [alice, ei()], exercant("alice", "e1", "EI"), flux), "e1")

    it("cotisations ligne à ligne", () => {
      // CSG-CRDS : 22 200 x 9,7 % = 2 153,40 €, dont 6,8 % déductibles (1 509,60 €).
      expect(creee.cotisationsTNS).toMatchObject({
        assiette: expect.closeTo(22200, 2),
        total: expect.closeTo(9344.14, 2),
        cotisations: {
          maladieMaternite: expect.closeTo(905.65, 2),
          indemnitesJournalieres: expect.closeTo(111, 2),
          retraiteDeBase: expect.closeTo(3967.14, 2),
          retraiteComplementaire: expect.closeTo(1798.2, 2),
          invaliditeDeces: expect.closeTo(288.6, 2),
          allocationsFamiliales: expect.closeTo(0, 2),
          csgDeductible: expect.closeTo(1509.6, 2),
          csgNonDeductibleEtCrds: expect.closeTo(643.8, 2),
          formationProfessionnelle: expect.closeTo(120.15, 2)
        }
      })
    })

    it("en année pleine, 401 € de moins : la note le dit", () => {
      expect(pleine.cotisationsTNS?.total).toBeCloseTo(8943.33, 2)
      expect(pleine.dispositifs).toBeUndefined()
      const note = creee.dispositifs?.[0].replace(/\s/g, " ")
      expect(note).toMatch(/^Année de création \(avril 2026, 9 mois d'activité\) : .* réduit aux mois d'activité, 36 045 €\. Elles coûtent 401 € de plus qu'en année pleine/)
      expect(creee.warnings).toEqual([])
    })
  })

  describe("cas 2 : sans revenu, les minimums", () => {
    // EI sans chiffre d'affaires : assiette nulle, seuls les minimums. Indemnités journalières : 19 224 x 0,50 % =
    // 96,12 € ; retraite de base : 5 409 x 17,87 % = 966,59 € ; invalidité-décès : 5 527 x mois/12 x 1,30 % ; formation
    // professionnelle : 120,15 €.
    const simulerEI = (dateDeCreation: string, mois: number) => activite(simulerEn(mois, [alice, ei(dateDeCreation)], exercant("alice", "e1", "EI"), []), "e1")

    it("créée en octobre (3 mois, 92 jours) : minimum de retraite de base dû", () => {
      const r = simulerEI("2026-10", OCTOBRE)
      expect(r.cotisationsTNS?.cotisations).toMatchObject({ indemnitesJournalieres: expect.closeTo(96.12, 2), retraiteDeBase: expect.closeTo(966.59, 2), invaliditeDeces: expect.closeTo(17.96, 2), formationProfessionnelle: expect.closeTo(120.15, 2) })
      expect(r.cotisationsTNS?.total).toBeCloseTo(1200.82, 2)
    })

    it("créée en novembre (2 mois, 61 jours) : moins de 90 jours, pas de minimum de retraite de base", () => {
      const r = simulerEI("2026-11", NOVEMBRE)
      expect(r.cotisationsTNS?.cotisations).toMatchObject({ indemnitesJournalieres: expect.closeTo(96.12, 2), retraiteDeBase: 0, invaliditeDeces: expect.closeTo(11.98, 2) })
      expect(r.cotisationsTNS?.total).toBeCloseTo(228.25, 2)
      expect(r.dispositifs?.[0]).toContain("Moins de 90 jours d'activité en 2026 : pas de cotisation minimale de retraite de base.")
    })

    it("EURL sans rémunération : la société paie les minimums, qui font partie du revenu du gérant", () => {
      // Revenu avant cotisations R tel que R - cotisations(R) = 0, trouvé à part par dichotomie : 1 382,99 € créée en
      // octobre (assiette 1 023,41 €), 276,63 € créée en novembre (assiette 135,66 €, retraite de base sur l'assiette).
      const eurl = (dateDeCreation: string): Company => ({ ...societe("u1", "EURL"), dateDeCreation })
      const enOctobre = activite(simulerEn(OCTOBRE, [alice, eurl("2026-10")], exercant("alice", "u1", "EURL"), []), "u1")
      const enNovembre = activite(simulerEn(NOVEMBRE, [alice, eurl("2026-11")], exercant("alice", "u1", "EURL"), []), "u1")
      expect(enOctobre.cotisationsTNS?.total).toBeCloseTo(1382.99, 1)
      expect(enNovembre.cotisationsTNS?.total).toBeCloseTo(276.63, 1)
      expect(enNovembre.dispositifs?.[0].replace(/\s/g, " ")).toContain("Société : taux réduit d'impôt sur les sociétés (15 %) jusqu'à 7 083 € de bénéfice (42 500 € réduits à 2 mois).")
    })
  })

  describe("cas 3 : SASU créée en avril, président payé 45 000 € bruts", () => {
    // Plafond : 9 x 4 005 = 36 045 €. La part du brut au-delà (8 955 €) passe en tranche 2 et sort de la vieillesse
    // plafonnée : salariales 9 334,55 €, patronales 16 821,94 €, net 35 665,45 € (année pleine : 35 621,89 €).
    const sasu: Company = { ...societe("s1", "SASU"), dateDeCreation: "2026-04" }
    const report = simulerEn(AVRIL, [alice, sasu], [relation("alice", "s1", "Président")], [
      ["s1", "ca_services", 100000],
      ["s1", "director_remuneration", 35665.45]
    ])
    const s1 = activite(report, "s1")

    it("bulletin du président", () => {
      expect(s1.cotisationsPresident?.brut).toBeCloseTo(45000, 0)
      expect(s1.cotisationsPresident?.totalSalarial).toBeCloseTo(9334.55, 0)
      expect(s1.cotisationsPresident?.totalPatronal).toBeCloseTo(16821.94, 0)
    })

    it("la note donne le plafond et la limite de l'impôt sur les sociétés", () => {
      expect(s1.dispositifs?.[0].replace(/\s/g, " ")).toBe(
        "Année de création (avril 2026, 9 mois d'activité) : plafond de la sécurité sociale du président de 36 045 € (4 005 € × 9 mois de mandat) ; taux réduit d'impôt sur les sociétés (15 %) jusqu'à 31 875 € de bénéfice (42 500 € réduits à 9 mois). Le premier exercice est compté sur l'année civile ; une société peut aussi clore son premier exercice l'année suivante, ce que le simulateur ne modélise pas."
      )
      verifierIdentiteDuBilan(report)
    })
  })

  it("cas 4 : SASU créée en septembre, 40 000 € de bénéfice : 8 583,33 € d'impôt sur les sociétés", () => {
    // Limite du taux réduit : 42 500 x 4/12 = 14 166,67 €. IS : 14 166,67 x 15 % + 25 833,33 x 25 % = 8 583,33 € (6 000 €
    // avec la limite entière).
    const sasu: Company = { ...societe("s1", "SASU"), dateDeCreation: "2026-09" }
    const report = simulerEn(SEPTEMBRE, [alice, sasu], exercant("alice", "s1", "SASU"), [["s1", "ca_services", 40000]])
    // Le moteur arrondit l'impôt de l'activité à l'euro.
    expect(activite(report, "s1").impotSocietes).toBe(8583)
  })

  describe("cas 5 : micro-entreprise de services créée le 1er septembre, 15 000 € de chiffre d'affaires", () => {
    // 122 jours d'activité. Seuil majoré de l'année : 41 250 x 122/365 = 13 787,67 €, dépassé : TVA due dès le
    // dépassement. Seuil de base : 37 500 x 122/365 = 12 534,25 €.
    const avecCA = (montant: number) => {
      const m: MicroEntreprise = { ...micro("m1"), dateDeCreation: "2026-09" }
      return activite(simulerEn(SEPTEMBRE, [alice, m], exercant("alice", "m1", "micro"), [["m1", "ca_micro_services_bnc", montant]]), "m1")
    }

    it("au-delà du seuil majoré réduit : franchise perdue", () => {
      const tva = avecCA(15000).warnings.find(w => w.includes("TVA"))?.replace(/\s/g, " ")
      expect(tva).toBe("Franchise en base de TVA perdue (prestations de services 15 000 € pour un seuil de 13 788 €) : la TVA est due dès le jour du dépassement. Année de création : seuils réduits au prorata des jours d'activité. Le simulateur ne calcule pas la TVA : il considère les montants saisis comme hors taxe.")
    })

    it("entre les deux seuils réduits : franchise perdue au 1er janvier suivant", () => {
      const tva = avecCA(13000).warnings.find(w => w.includes("TVA"))?.replace(/\s/g, " ")
      expect(tva).toMatch(/^Seuil de franchise en base de TVA dépassé \(prestations de services 13 000 € pour un seuil de 12 534 €\) : la TVA sera due à partir du 1er janvier suivant\./)
    })
  })

  it("cas 6 : montants saisis avant la création, comptés avec un avertissement", () => {
    // Micro-entreprise créée en mars, 2 000 € de chiffre d'affaires saisis en janvier et en février.
    const m: MicroEntreprise = { ...micro("m1"), dateDeCreation: "2026-03" }
    const donnees = session([alice, m], exercant("alice", "m1", "micro"))
    for (const mois of [0, 1]) donnees.monthlyData[mois].flows.push({ id: `ca-${mois}`, label: "ca", amount: 2000, entityId: "m1", type: "ca_micro_services_bnc" })
    const r = activite(runMetaSimulation(donnees, REGLES_DES_CAS, { annee: 2026 }), "m1")
    expect(r.chiffreAffaires).toBe(4000)
    expect(r.warnings.map(w => w.replace(/\s/g, " "))).toContain("Activité créée en mars 2026 : 4 000 € de chiffre d'affaires saisis avant la création (janvier, février 2026), comptés quand même. Corrigez la date de création, ou déplacez ces montants.")
  })

  it("une année avant la création : ni minimums ni forfait", () => {
    // EURL créée en mars 2027, simulée en 2026 sans rien saisir : elle n'est pas affiliée.
    const eurl: Company = { ...societe("u1", "EURL"), dateDeCreation: "2027-03" }
    const u1 = activite(simulerEn(0, [alice, eurl], exercant("alice", "u1", "EURL"), []), "u1")
    expect(u1.cotisationsSociales).toBe(0)
    expect(u1.dispositifs).toEqual(["Activité créée en mars 2027 : en 2026, elle n'est pas encore affiliée, et ne doit ni cotisation minimale ni forfait."])
  })

  it("un salarié d'une société créée en septembre : plafond et SMIC de la réduction générale sur 4 mois", () => {
    // 2 500 € bruts par mois de septembre à décembre, 10 000 € en tout. SMIC de quatre mois : 21 876,40 x 4/12 =
    // 7 292,13 € ; plafond de la réduction : 3 SMIC, 21 876,40 €. Coefficient : 0,02 + 0,3781 x ((21 876,40 / 10 000 -
    // 1) / 2)^1,75 = 0,02 + 0,3781 x 0,59382^1,75 = 0,02 + 0,3781 x 0,40172 = 0,1719 (arrondi à 4 décimales) : 1 719 €.
    // Avec le SMIC annuel entier, 10 000 € seraient sous le SMIC : coefficient maximal 0,3981, 3 981 €.
    const sasu: Company = { ...societe("s1", "SASU"), dateDeCreation: "2026-09" }
    const bob = personne("bob")
    const donnees = session([alice, bob, sasu], [...exercant("alice", "s1", "SASU"), relation("bob", "s1", "Salarié")])
    for (const mois of [8, 9, 10, 11]) donnees.monthlyData[mois].flows.push({ id: `sal-${mois}`, label: "salaire", amount: 1950, grossAmount: 2500, entityId: "bob", type: "salary" })
    const bulletin = activite(runMetaSimulation(donnees, REGLES_DES_CAS, { annee: 2026 }), "s1").salaries?.[0]
    expect(bulletin?.brut).toBe(10000)
    expect(bulletin?.reductionGenerale).toBeCloseTo(1719, 2)
  })
})
