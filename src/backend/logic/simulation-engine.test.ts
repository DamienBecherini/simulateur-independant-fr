// src/backend/logic/simulation-engine.test.ts

import { describe, expect, it } from "vitest"
import { reglesEnVigueur } from "./regles.js"
import { runMetaSimulation } from "./simulation-engine.js"
import { reglesDeTest } from "./testing/regles-de-test.js"
import { micro, personne, relation, session, societe, type Flux } from "./testing/session-de-test.js"
import type { Entity, Relationship, SimulationReport } from "../../types.js"

/*
 * Tous les montants attendus sont calculés à la main avec les règles de test (chiffres ronds) :
 * barème à 0 / 10 / 30 / 40 % (seuils 10 000, 30 000, 80 000 €), décote 800 € - 50 % de l'impôt,
 * abattement de 10 % sur les salaires, dividendes à 12 % d'IR forfaitaire et 18 % de prélèvements sociaux.
 */

const simuler = (entities: Entity[], relationships: Relationship[] = [], flux: Flux[] = []) => runMetaSimulation(session(entities, relationships, flux), reglesDeTest)

function activite(report: SimulationReport, entityId: string) {
  const resultat = report.activities.find(a => a.entityId === entityId)
  if (!resultat) throw new Error(`Activité ${entityId} absente du rapport`)
  return resultat
}

function foyerDe(report: SimulationReport, personId: string) {
  const foyer = report.foyers.find(f => f.personIds.includes(personId))
  if (!foyer) throw new Error(`Aucun foyer pour ${personId}`)
  return foyer
}

describe("runMetaSimulation", () => {
  describe("structure du rapport", () => {
    it("renvoie un rapport vide pour une session vide", () => {
      const bilanVide = { chiffreAffaires: 0, charges: 0, revenusDirects: 0, cotisationsSalariales: 0, revenusAvantPrelevements: 0, cotisationsSociales: 0, impotSocietes: 0, impotSurLeRevenu: 0, prelevementsSociaux: 0, totalPrelevements: 0, resultatConserve: 0, nonRattache: 0 }

      expect(simuler([])).toEqual({ annee: 2000, bilan: bilanVide, activities: [], persons: [], foyers: [], totalNetApresImpots: 0 })
    })

    it("sépare les activités des personnes, dans l'ordre de la session", () => {
      const report = simuler([societe("s1"), personne("alice"), micro("m1"), personne("bob")])

      expect(report.activities.map(a => a.entityId)).toEqual(["s1", "m1"])
      expect(report.persons.map(p => p.entityId)).toEqual(["alice", "bob"])
      expect(report.foyers).toHaveLength(2)
    })

    it("applique par défaut les règles en vigueur", () => {
      expect(runMetaSimulation(session([personne("alice")])).annee).toBe(reglesEnVigueur.annee)
    })
  })

  describe("bilan", () => {
    it("répartit les revenus avant prélèvements entre prélèvements, résultat conservé et net", () => {
      const report = simuler(
        [personne("alice"), societe("sasu")],
        [relation("alice", "sasu", "Président")],
        [
          ["alice", "salary", 10000],
          ["sasu", "ca_services", 100000],
          ["sasu", "deductible_expense", 10000],
          ["sasu", "director_remuneration", 24300],
          ["sasu", "dividends_payment", 20000]
        ]
      )

      // Rémunération de 24 300 € nets : 30 000 € bruts, 15 900 € de cotisations ; bénéfice 49 800 €, IS 8 450 €, 21 350 € conservés.
      // Salaire et rémunération : 10 000 + 24 300 + 810 (CSG non déductible et CRDS) = 35 110 €, 31 599 € après 10 %,
      // soit 2 000 + 1 599 x 30 % = 2 479,70 € ; dividendes au forfait : 2 400 €.
      expect(report.bilan).toEqual({
        chiffreAffaires: 100000,
        charges: 10000,
        revenusDirects: 10000,
        cotisationsSalariales: 0,
        revenusAvantPrelevements: 100000,
        cotisationsSociales: 15900,
        impotSocietes: 8450,
        impotSurLeRevenu: 4880,
        prelevementsSociaux: 3600,
        totalPrelevements: 32830,
        resultatConserve: 21350,
        nonRattache: 0
      })
      expect(report.bilan.totalPrelevements + report.bilan.resultatConserve + report.totalNetApresImpots).toBe(report.bilan.revenusAvantPrelevements)
    })

    it("isole les revenus d'une activité qui n'est rattachée à personne", () => {
      const report = simuler([personne("bob"), micro("m1")], [], [["m1", "ca_micro_vente", 50000]])

      expect(report.bilan).toMatchObject({ revenusAvantPrelevements: 50000, cotisationsSociales: 5000, totalPrelevements: 5000, nonRattache: 45000 })
      expect(report.totalNetApresImpots).toBe(0)
    })

    it("compte comme non rattachés une rémunération, des dividendes ou un bénéfice sans bénéficiaire", () => {
      const sansDirigeant = simuler(
        [societe("sasu")],
        [],
        [
          ["sasu", "ca_services", 100000],
          ["sasu", "director_remuneration", 30000],
          ["sasu", "dividends_payment", 20000]
        ]
      )
      // Entreprise individuelle : 40 000 € de bénéfice, 12 700 € de cotisations (voir cotisationsTNS.test.ts).
      const sansTitulaire = simuler([societe("ei", "EI")], [], [["ei", "ca_services", 40000]])

      expect(sansDirigeant.bilan.nonRattache).toBe(50000)
      expect(sansTitulaire.bilan.nonRattache).toBe(27300)
    })
  })

  describe("agrégation annuelle des flux", () => {
    it("additionne les flux des douze mois, par entité et par type", () => {
      const donnees = session([personne("alice"), personne("bob")])
      donnees.monthlyData.forEach(mois => {
        mois.flows.push({ id: `a-${mois.month}`, label: "Salaire", amount: 2000, entityId: "alice", type: "salary" })
        mois.flows.push({ id: `b-${mois.month}`, label: "Chômage", amount: 1000, entityId: "bob", type: "are" })
      })
      donnees.monthlyData[5].flows.push({ id: "prime", label: "Prime", amount: 500, entityId: "alice", type: "salary" })

      const report = runMetaSimulation(donnees, reglesDeTest)

      expect(report.persons.map(p => p.revenusDirects)).toEqual([24500, 12000])
    })

    it("ignore les flux d'une entité absente de la session", () => {
      const report = simuler([personne("alice")], [], [["fantome", "salary", 50000]])

      expect(report.persons[0].revenusDirects).toBe(0)
    })
  })

  describe("personne salariée", () => {
    it("impose les salaires et allocations après abattement de 10 %", () => {
      const report = simuler(
        [personne("alice")],
        [],
        [
          ["alice", "salary", 30000],
          ["alice", "are", 10000],
          ["alice", "other_taxable_income", 4000]
        ]
      )

      // Base : 40 000 - 4 000 + 4 000 = 40 000 € ; impôt : 2 000 + 10 000 x 30 % = 5 000 €.
      expect(report.persons[0].detail).toEqual({ salaires: 30000, allocationsChomage: 10000, autresRevenus: 4000, remunerationsDirigeant: 0, dividendes: 0, benefices: 0 })
      expect(foyerDe(report, "alice")).toMatchObject({ revenusEncaisses: 44000, revenuImposableGlobal: 40000, impotSurLeRevenu: 5000, prelevementsSociaux: 0, optionDividendes: null, netApresImpots: 39000 })
    })

    it("compte l'écart entre brut et net comme cotisations salariales, sans changer l'impôt", () => {
      const donnees = session([personne("alice")], [], [["alice", "salary", 30000]])
      donnees.monthlyData[0].flows[0].grossAmount = 40000
      donnees.monthlyData[1].flows.push({ id: "sans-brut", label: "Prime", amount: 2000, entityId: "alice", type: "salary" })
      donnees.monthlyData[2].flows.push({ id: "incoherent", label: "Erreur", amount: 1000, grossAmount: 500, entityId: "alice", type: "salary" })

      const report = runMetaSimulation(donnees, reglesDeTest)

      // Net : 33 000 €, imposable après abattement : 29 700 €, soit 1 970 € d'impôt. Un brut inférieur au net est ignoré.
      expect(report.persons[0]).toMatchObject({ revenusDirects: 33000, cotisationsSalariales: 10000 })
      expect(foyerDe(report, "alice")).toMatchObject({ revenusEncaisses: 33000, impotSurLeRevenu: 1970, netApresImpots: 31030, revenusAvantPrelevements: 43000, totalPrelevements: 11970 })
      expect(report.bilan).toMatchObject({ revenusDirects: 33000, cotisationsSalariales: 10000, revenusAvantPrelevements: 43000, cotisationsSociales: 0, totalPrelevements: 11970 })
    })

    it("applique le minimum et le maximum de l'abattement", () => {
      expect(foyerDe(simuler([personne("alice")], [], [["alice", "salary", 3000]]), "alice").revenuImposableGlobal).toBe(2500)
      expect(foyerDe(simuler([personne("alice")], [], [["alice", "salary", 200000]]), "alice").revenuImposableGlobal).toBe(186000)
      expect(foyerDe(simuler([personne("alice")], [], [["alice", "salary", 200]]), "alice").revenuImposableGlobal).toBe(0)
    })

    it("rapporte les dépenses personnelles sans les déduire de l'impôt ni du net", () => {
      const report = simuler(
        [personne("alice")],
        [],
        [
          ["alice", "salary", 40000],
          ["alice", "expense", 12000]
        ]
      )

      expect(report.persons[0].depenses).toBe(12000)
      expect(foyerDe(report, "alice")).toMatchObject({ depenses: 12000, revenuImposableGlobal: 36000, netApresImpots: 40000 - 3800 })
    })
  })

  describe("SASU", () => {
    const entites = [personne("alice"), societe("sasu")]
    const president = [relation("alice", "sasu", "Président")]
    const flux: Flux[] = [
      ["sasu", "ca_services", 90000],
      ["sasu", "ca_vente", 10000],
      ["sasu", "deductible_expense", 10000],
      ["sasu", "director_remuneration", 24300],
      ["sasu", "dividends_payment", 20000]
    ]

    it("calcule le résultat de la société et ce qu'elle verse", () => {
      // 24 300 € nets = 30 000 € bruts : 5 700 € de cotisations salariales et 10 200 € de patronales, soit 15 900 €.
      // Bénéfice 100 000 - 10 000 - 24 300 - 15 900 = 49 800 € ; IS 6 000 + 9 800 x 25 % = 8 450 € ; conservé 21 350 €.
      const report = simuler(entites, president, flux)

      expect(activite(report, "sasu")).toEqual({
        entityId: "sasu",
        name: "sasu",
        type: "company",
        statut: "SASU",
        chiffreAffaires: 100000,
        charges: 10000,
        cotisationsSociales: 15900,
        impotSocietes: 8450,
        revenuVerse: 44300,
        resultatConserve: 21350,
        beneficiaireIds: ["alice"],
        cotisationsPresident: expect.objectContaining({ statut: "president", brut: expect.closeTo(30000, 6), coutEmployeur: expect.closeTo(40200, 6) }),
        warnings: []
      })
    })

    it("verse la rémunération et les dividendes au président, et impose le foyer une seule fois", () => {
      const report = simuler(entites, president, flux)

      expect(report.persons[0]).toMatchObject({ revenusDirects: 0, revenusActivites: 44300, detail: { salaires: 0, allocationsChomage: 0, autresRevenus: 0, remunerationsDirigeant: 24300, dividendes: 20000, benefices: 0 } })
      // Rémunération : 24 300 + 810 (CSG non déductible et CRDS) = 25 110 €, 22 599 € imposables après 10 %.
      // Forfait : 1 259,90 € d'impôt, moins 170,05 € de décote, plus 20 000 x 12 % = 3 489,85 €.
      // Barème : 22 599 + 12 000 - 1 400 = 33 199 €, soit 2 959,70 €, retenu.
      expect(foyerDe(report, "alice")).toEqual({
        personIds: ["alice"],
        totalParts: 1,
        revenusEncaisses: 44300,
        revenuImposableGlobal: 33199,
        impotSurLeRevenu: 2960,
        prelevementsSociaux: 3600,
        optionDividendes: "bareme",
        netApresImpots: 37740,
        revenusAvantPrelevements: 90000,
        totalPrelevements: 30910,
        resultatConserve: 21350,
        depenses: 0,
        warnings: []
      })
      expect(report.totalNetApresImpots).toBe(37740)
    })

    it("retient l'option pour le barème quand elle coûte moins que le forfait", () => {
      const report = simuler(entites, president, [
        ["sasu", "ca_services", 30000],
        ["sasu", "dividends_payment", 20000]
      ])

      // Base au barème : 20 000 x 60 % - 20 000 x 7 % = 10 600 €, impôt effacé par la décote.
      expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 10600, impotSurLeRevenu: 0, prelevementsSociaux: 3600, optionDividendes: "bareme", netApresImpots: 16400 })
    })

    it("reconnaît le dirigeant quel que soit le sens de la relation", () => {
      const report = simuler(entites, [relation("sasu", "alice", "Président")], flux)

      expect(report.persons[0].revenusActivites).toBe(44300)
    })

    it("signale une rémunération sans dirigeant et ne la rattache à aucun foyer", () => {
      const report = simuler(entites, [], [["sasu", "director_remuneration", 30000]])

      expect(activite(report, "sasu").warnings).toContain("Rémunération dirigeant saisie sans relation Président/Gérant vers une personne : non routée vers un foyer.")
      expect(report.persons[0].revenusActivites).toBe(0)
    })

    it("verse la rémunération au premier dirigeant quand il y en a plusieurs, et le signale", () => {
      const report = simuler(
        [personne("alice"), personne("bob"), societe("sasu")],
        [relation("alice", "sasu", "Président"), relation("bob", "sasu", "Gérant")],
        [
          ["sasu", "ca_services", 100000],
          ["sasu", "director_remuneration", 30000]
        ]
      )

      expect(activite(report, "sasu").warnings).toEqual(["Plusieurs dirigeants liés : la rémunération est attribuée au premier pour le routage fiscal simplifié."])
      expect(report.persons.map(p => p.revenusActivites)).toEqual([30000, 0])
    })

    it("partage les dividendes à parts égales entre dirigeant et associés, et le signale", () => {
      const report = simuler(
        [personne("alice"), personne("bob"), societe("sasu")],
        [relation("alice", "sasu", "Président"), relation("bob", "sasu", "Associé")],
        [
          ["sasu", "ca_services", 100000],
          ["sasu", "dividends_payment", 20000]
        ]
      )

      expect(activite(report, "sasu").warnings).toEqual(["Dividendes répartis à parts égales entre les 2 personnes liées : la répartition du capital n'est pas modélisée."])
      expect(report.persons.map(p => p.revenusActivites)).toEqual([10000, 10000])
      expect(activite(report, "sasu").beneficiaireIds).toEqual(["alice", "bob"])
      expect(report.foyers.map(f => f.prelevementsSociaux)).toEqual([1800, 1800])
    })

    it("signale des dividendes sans bénéficiaire", () => {
      const report = simuler(
        [societe("sasu")],
        [],
        [
          ["sasu", "ca_services", 100000],
          ["sasu", "dividends_payment", 20000]
        ]
      )

      expect(activite(report, "sasu").warnings).toEqual(["Dividendes versés sans relation Président, Gérant ou Associé vers une personne : non routés vers un foyer."])
    })

    it("remonte les avertissements du calcul de la société", () => {
      const report = simuler(entites, president, [
        ["sasu", "ca_services", 20000],
        ["sasu", "director_remuneration", 24300]
      ])

      expect(activite(report, "sasu").warnings[0]).toContain("déficitaire")
      expect(activite(report, "sasu").resultatConserve).toBe(-20200)
    })
  })

  describe("EURL", () => {
    it("retire des revenus du gérant les cotisations dues sur ses dividendes", () => {
      const report = simuler(
        [personne("dan"), societe("eurl", "EURL", 10000)],
        [relation("dan", "eurl", "Gérant")],
        [
          ["eurl", "ca_services", 100000],
          ["eurl", "deductible_expense", 10000],
          ["eurl", "director_remuneration", 27300],
          ["eurl", "dividends_payment", 41000]
        ]
      )

      // Rémunération nette 27 300 € : 12 700 € de cotisations pour la société ; bénéfice 50 000 €, IS 8 500 €, conservé 500 €
      // (voir calculsSociete.test.ts). Dividendes : 1 000 € soumis aux prélèvements sociaux (180 €), 40 000 € ajoutés au revenu
      // soumis à cotisations, qui coûtent 13 800 € de plus au gérant : dividendes encaissés 27 200 €.
      // Rémunération imposable 27 300 + 900 = 28 200 €, moins 10 % : 25 380 € ; impôt 1 538 €, décote 800 - 769 = 31 €, 1 507 €.
      // Forfait : 1 507 + 41 000 x 12 % = 6 427 €. Barème : 25 380 + 24 600 - 70 = 49 910 €, 7 973 €. Forfait retenu.
      expect(report.persons[0].detail).toMatchObject({ remunerationsDirigeant: 27300, dividendes: 27200 })
      expect(activite(report, "eurl")).toMatchObject({ statut: "EURL", cotisationsSociales: 26500, impotSocietes: 8500, revenuVerse: 54500, resultatConserve: 500 })
      expect(activite(report, "eurl").cotisationsTNS?.assiette).toBeCloseTo(60000)
      expect(foyerDe(report, "dan")).toMatchObject({ revenusEncaisses: 54500, revenuImposableGlobal: 25380, impotSurLeRevenu: 6427, prelevementsSociaux: 180, optionDividendes: "pfu", netApresImpots: 47893 })
    })
  })

  describe("entreprise individuelle au réel", () => {
    // 40 000 € de bénéfice avant cotisations : 12 700 € de cotisations, dont 900 € non déductibles (voir cotisationsTNS.test.ts).
    const flux: Flux[] = [
      ["ei", "ca_services", 60000],
      ["ei", "deductible_expense", 20000]
    ]

    it("attribue tout le bénéfice, net de cotisations, à l'entrepreneur, imposé sans la part déductible des cotisations", () => {
      const report = simuler([personne("carl"), societe("ei", "EI")], [relation("carl", "ei", "Titulaire")], flux)

      // Encaissé 27 300 € ; imposable 27 300 + 900 = 28 200 € ; impôt 18 200 x 10 % = 1 820 €, sans décote.
      expect(activite(report, "ei")).toMatchObject({ statut: "EI au réel", chiffreAffaires: 60000, charges: 20000, cotisationsSociales: 12700, impotSocietes: 0, revenuVerse: 27300, resultatConserve: 0, warnings: [] })
      expect(activite(report, "ei").cotisationsTNS?.assiette).toBe(30000)
      expect(foyerDe(report, "carl")).toMatchObject({ revenusEncaisses: 27300, revenuImposableGlobal: 28200, impotSurLeRevenu: 1820, netApresImpots: 25480 })
    })

    it("signale une entreprise sans titulaire", () => {
      const report = simuler([personne("carl"), societe("ei", "EI")], [], flux)

      expect(activite(report, "ei").warnings).toEqual(["Aucune relation « Titulaire » vers une personne : le bénéfice de cette entreprise n'est rattaché à aucun foyer."])
      expect(report.persons[0].revenusActivites).toBe(0)
    })

    it("ignore, en le signalant, la rémunération et les dividendes saisis", () => {
      const report = simuler([personne("carl"), societe("ei", "EI")], [relation("carl", "ei", "Titulaire")], [...flux, ["ei", "director_remuneration", 10000]])

      expect(activite(report, "ei").warnings).toHaveLength(1)
      expect(activite(report, "ei").warnings[0]).toContain("ni rémunération de dirigeant ni dividendes")
      expect(report.persons[0].revenusActivites).toBe(27300)
    })

    it("impute le déficit sur les autres revenus du foyer", () => {
      const report = simuler(
        [personne("carl"), societe("ei", "EI")],
        [relation("carl", "ei", "Titulaire")],
        [
          ["carl", "salary", 20000],
          ["ei", "ca_services", 5000],
          ["ei", "deductible_expense", 8000]
        ]
      )

      // Déficit de 3 000 €, creusé à 4 500 € par les cotisations minimales (1 500 €, sans CSG-CRDS).
      // Salaire : 20 000 - 2 000 = 18 000 € imposables, moins le déficit de 4 500 €.
      expect(foyerDe(report, "carl")).toMatchObject({ revenusEncaisses: 15500, revenuImposableGlobal: 13500 })
    })
  })

  describe("micro-entreprise", () => {
    it("impose le chiffre d'affaires après abattement et verse le reste au titulaire", () => {
      const report = simuler(
        [personne("bob"), micro("m1")],
        [relation("bob", "m1", "Titulaire")],
        [
          ["m1", "ca_micro_services_bnc", 40000],
          ["m1", "expense", 2000]
        ]
      )

      // Les dépenses réduisent la trésorerie, pas le revenu imposable (40 000 x 70 % = 28 000 €).
      expect(activite(report, "m1")).toEqual({
        entityId: "m1",
        name: "m1",
        type: "micro-entreprise",
        statut: "Micro-entreprise",
        chiffreAffaires: 40000,
        charges: 2000,
        cotisationsSociales: 10000,
        impotSocietes: 0,
        revenuVerse: 28000,
        resultatConserve: 0,
        beneficiaireIds: ["bob"],
        versementLiberatoire: { plafondRfr: 28000, partsFiscales: 1, rfrN2: null, eligible: null, applique: false },
        warnings: []
      })
      expect(report.persons[0].detail.benefices).toBe(28000)
      expect(foyerDe(report, "bob")).toMatchObject({ revenusEncaisses: 28000, revenuImposableGlobal: 28000, impotSurLeRevenu: 1800, netApresImpots: 26200 })
    })

    it("remplace l'impôt au barème par le versement libératoire quand l'option est prise", () => {
      const report = simuler([personne("bob"), micro("m1", { opteVFL: true })], [relation("bob", "m1", "Titulaire")], [["m1", "ca_micro_vente", 50000]])

      expect(foyerDe(report, "bob")).toMatchObject({ revenusEncaisses: 45000, revenuImposableGlobal: 0, impotSurLeRevenu: 500, netApresImpots: 44500 })
    })

    describe("versement libératoire", () => {
      const avecVFL = (rfrN2?: number) => ({ ...micro("m1", { opteVFL: true }), ...(rfrN2 !== undefined ? { rfrN2 } : {}) })
      const flux: Flux[] = [["m1", "ca_micro_vente", 50000]]

      it("l'applique quand le revenu fiscal de référence est sous le seuil", () => {
        const report = simuler([personne("bob"), avecVFL(20000)], [relation("bob", "m1", "Titulaire")], flux)

        expect(activite(report, "m1").versementLiberatoire).toEqual({ plafondRfr: 28000, partsFiscales: 1, rfrN2: 20000, eligible: true, applique: true })
        expect(activite(report, "m1").warnings).toEqual([])
        expect(foyerDe(report, "bob")).toMatchObject({ impotSurLeRevenu: 500 })
      })

      it("calcule l'impôt au barème quand le revenu fiscal de référence dépasse le seuil, et le signale", () => {
        const report = simuler([personne("bob"), avecVFL(30000)], [relation("bob", "m1", "Titulaire")], flux)

        expect(activite(report, "m1").versementLiberatoire).toMatchObject({ eligible: false, applique: false })
        expect(activite(report, "m1").warnings).toEqual([expect.stringContaining("Versement libératoire impossible")])
        // 50 000 x 30 % = 15 000 € imposables au barème : 500 € d'impôt brut, effacé par la décote.
        expect(foyerDe(report, "bob")).toMatchObject({ revenuImposableGlobal: 15000, impotSurLeRevenu: 0 })
      })

      it("proportionne le seuil au nombre de parts du foyer du titulaire", () => {
        const report = simuler(
          [personne("alice"), personne("bob"), personne("enfant"), avecVFL(65000)],
          [relation("alice", "bob", "Marié(e)"), relation("alice", "enfant", "Enfant"), relation("bob", "m1", "Titulaire")],
          flux
        )

        expect(activite(report, "m1").versementLiberatoire).toEqual({ plafondRfr: 70000, partsFiscales: 2.5, rfrN2: 65000, eligible: true, applique: true })
      })

      it("l'applique en le signalant quand le revenu fiscal de référence n'est pas renseigné", () => {
        const report = simuler([personne("bob"), avecVFL()], [relation("bob", "m1", "Titulaire")], flux)

        expect(activite(report, "m1").versementLiberatoire).toMatchObject({ eligible: null, applique: true })
        expect(activite(report, "m1").warnings).toEqual([expect.stringMatching(/28\s000 € pour 1 part\(s\)/)])
      })
    })

    it("signale une micro-entreprise sans titulaire", () => {
      const report = simuler([personne("bob"), micro("m1")], [], [["m1", "ca_micro_vente", 50000]])

      expect(activite(report, "m1").warnings).toEqual(["Aucune relation « Titulaire » vers une personne : les revenus de cette micro-entreprise ne sont rattachés à aucun foyer."])
      expect(report.persons[0].revenusActivites).toBe(0)
    })
  })

  describe("foyers", () => {
    it("impose ensemble les revenus d'un couple, sur deux parts", () => {
      const report = simuler(
        [personne("alice"), personne("bob"), micro("m1")],
        [relation("alice", "bob", "Marié(e)"), relation("bob", "m1", "Titulaire")],
        [
          ["alice", "salary", 36000],
          ["m1", "ca_micro_services_bnc", 40000]
        ]
      )

      // Base : 32 400 + 28 000 = 60 400 €, soit 30 200 € par part : 2 x 2 060 € d'impôt.
      expect(report.foyers).toHaveLength(1)
      expect(report.foyers[0]).toMatchObject({ personIds: ["alice", "bob"], totalParts: 2, revenusEncaisses: 66000, revenuImposableGlobal: 60400, impotSurLeRevenu: 4120, netApresImpots: 61880 })
    })

    it("ajoute les revenus d'un enfant rattaché à ceux de son parent, avec plafonnement du quotient familial", () => {
      const report = simuler(
        [personne("parent"), personne("enfant")],
        [relation("parent", "enfant", "Enfant")],
        [
          ["parent", "salary", 40000],
          ["enfant", "salary", 5000]
        ]
      )

      // Base : 36 000 + 4 500 = 40 500 € pour 1,5 part ; l'avantage de la demi-part est plafonné à 1 500 €.
      expect(report.foyers).toHaveLength(1)
      expect(report.foyers[0]).toMatchObject({ personIds: ["parent", "enfant"], totalParts: 1.5, revenuImposableGlobal: 40500, impotSurLeRevenu: 3650 })
    })

    it("attribue à chaque foyer sa part des prélèvements et du bénéfice conservé d'une société partagée", () => {
      const report = simuler(
        [personne("alice"), personne("bob"), societe("sasu")],
        [relation("alice", "sasu", "Président"), relation("bob", "sasu", "Associé")],
        [
          ["sasu", "ca_services", 100000],
          ["sasu", "director_remuneration", 24300],
          ["sasu", "dividends_payment", 20000]
        ]
      )

      // Société : 24 300 € nets (30 000 € bruts), 15 900 € de cotisations ; bénéfice 59 800 €, IS 10 950 €, 20 000 € de dividendes, 28 850 € conservés.
      // Alice : 22 599 € imposables et 10 000 € de dividendes, barème (27 899 €, 1 789,90 €) plutôt que forfait (2 289,85 €).
      // Alice reçoit la rémunération et ses cotisations, puis la moitié du reste ; Bob l'autre moitié.
      expect(foyerDe(report, "alice")).toMatchObject({ revenusAvantPrelevements: 70100, totalPrelevements: 24965, resultatConserve: 14425, netApresImpots: 30710, optionDividendes: "bareme" })
      expect(foyerDe(report, "bob")).toMatchObject({ revenusAvantPrelevements: 29900, totalPrelevements: 7275, resultatConserve: 14425, netApresImpots: 8200 })
      for (const foyer of report.foyers) {
        expect(foyer.totalPrelevements + foyer.resultatConserve + foyer.netApresImpots).toBe(foyer.revenusAvantPrelevements)
      }
      expect(report.foyers[0].revenusAvantPrelevements + report.foyers[1].revenusAvantPrelevements).toBe(report.bilan.revenusAvantPrelevements)
    })

    it("mesure les prélèvements d'une micro-entreprise et d'une entreprise individuelle dans le foyer du titulaire", () => {
      const report = simuler(
        [personne("bob"), micro("m1"), societe("ei", "EI")],
        [relation("bob", "m1", "Titulaire"), relation("bob", "ei", "Titulaire")],
        [
          ["m1", "ca_micro_vente", 20000],
          ["ei", "ca_services", 60000],
          ["ei", "deductible_expense", 20000]
        ]
      )

      // Cotisations : 2 000 € (micro) + 12 700 € (EI). Base imposable : 6 000 + 28 200 = 34 200 €, soit 2 000 + 4 200 x 30 % = 3 260 € d'impôt.
      expect(foyerDe(report, "bob")).toMatchObject({ revenusAvantPrelevements: 60000, totalPrelevements: 17960, resultatConserve: 0, netApresImpots: 42040 })
    })

    it("additionne les nets de tous les foyers", () => {
      const report = simuler(
        [personne("alice"), personne("bob")],
        [],
        [
          ["alice", "salary", 10000],
          ["bob", "salary", 20000]
        ]
      )

      expect(report.totalNetApresImpots).toBe(report.foyers[0].netApresImpots + report.foyers[1].netApresImpots)
      expect(report.totalNetApresImpots).toBe(10000 + 20000 - 400)
    })

    it("remonte les avertissements du regroupement des foyers", () => {
      const report = simuler([personne("alice"), personne("bob"), personne("enfant")], [relation("alice", "enfant", "Enfant"), relation("bob", "enfant", "Enfant")])

      expect(foyerDe(report, "alice").warnings).toHaveLength(1)
    })
  })

  describe("salarié d'une activité de la simulation", () => {
    // Bob touche 24 300 € nets : 30 000 € bruts (net = 81 % du brut), 5 700 € de cotisations salariales.
    // Patronales d'un salarié : 39 % = 11 700 € ; réduction générale 2 % + 38 % x (60 000 / 30 000 - 1) / 2 = 21 %, 6 300 € ;
    // coût employeur 30 000 + 11 700 - 6 300 = 35 400 €. CSG non déductible et CRDS : 3 % de 27 000 = 810 €.
    const entites = [personne("alice"), personne("bob"), societe("sasu")]
    const relations = [relation("alice", "sasu", "Président"), relation("bob", "sasu", "Salarié")]
    const flux: Flux[] = [
      ["sasu", "ca_services", 100000],
      ["bob", "salary", 24300]
    ]

    it("fait supporter à la société le coût employeur, déductible avant l'IS", () => {
      // Bénéfice 100 000 - 35 400 = 64 600 € ; IS 6 000 + 24 600 x 25 % = 12 150 € ; conservé 52 450 €.
      const report = simuler(entites, relations, flux)

      expect(activite(report, "sasu")).toMatchObject({ charges: 30000, cotisationsSociales: 5400, impotSocietes: 12150, resultatConserve: 52450, revenuVerse: 0 })
      expect(activite(report, "sasu").salaries).toEqual([expect.objectContaining({ personId: "bob", statut: "salarie", brut: expect.closeTo(30000, 6), reductionGenerale: expect.closeTo(6300, 6), coutEmployeur: expect.closeTo(35400, 6) })])
    })

    it("impose le salarié sur son net augmenté de la CSG non déductible, et compte ses cotisations dans son foyer", () => {
      // Imposable : 24 300 + 810 = 25 110 €, 22 599 € après 10 % ; impôt 1 259,90 € moins 170,05 € de décote = 1 089,85 €.
      // Prélèvements du foyer : 5 700 (salariales) + 5 400 (patronales) + 1 089,85 = 12 189,85 € ; revenus avant prélèvements 35 400 €.
      const report = simuler(entites, relations, flux)

      expect(report.persons.find(p => p.entityId === "bob")).toMatchObject({ revenusDirects: 24300, cotisationsSalariales: 5700 })
      expect(foyerDe(report, "bob")).toMatchObject({ revenuImposableGlobal: 22599, impotSurLeRevenu: 1090, revenusAvantPrelevements: 35400, totalPrelevements: 12190, netApresImpots: 23210 })
      expect(foyerDe(report, "alice")).toMatchObject({ revenusAvantPrelevements: 64600, totalPrelevements: 12150, resultatConserve: 52450 })
      expect(report.bilan).toMatchObject({ revenusAvantPrelevements: 100000, charges: 30000, cotisationsSalariales: 5700, cotisationsSociales: 5400 })
      expect(report.bilan.totalPrelevements + report.bilan.resultatConserve + report.totalNetApresImpots).toBe(100000)
    })

    it("reconnaît la relation créée depuis la société", () => {
      const report = simuler(entites, [relation("alice", "sasu", "Président"), relation("sasu", "bob", "Salarié")], flux)

      expect(activite(report, "sasu").salaries?.[0].personId).toBe("bob")
    })

    it("retient le brut saisi sur chaque salaire", () => {
      const donnees = session(entites, relations, [["sasu", "ca_services", 100000]])
      donnees.monthlyData[0].flows.push({ id: "paie", label: "Salaire", amount: 24000, grossAmount: 30000, entityId: "bob", type: "salary" })
      const report = runMetaSimulation(donnees, reglesDeTest)

      expect(activite(report, "sasu")).toMatchObject({ charges: 30000, cotisationsSociales: 5400 })
      expect(report.persons.find(p => p.entityId === "bob")?.cotisationsSalariales).toBe(6000)
    })

    it("déduit le coût employeur du bénéfice d'une entreprise individuelle au réel", () => {
      // Bénéfice avant cotisations 60 000 - 35 400 = 24 600 € ; assiette 18 450 € : IJ 184,50, retraite de base 3 690,
      // complémentaire 1 476, invalidité-décès 184,50, CSG-CRDS 1 845, formation 100 ; total 7 480 €.
      const report = simuler([personne("carl"), personne("bob"), societe("ei", "EI")], [relation("carl", "ei", "Titulaire"), relation("bob", "ei", "Salarié")], [
        ["ei", "ca_services", 60000],
        ["bob", "salary", 24300]
      ])

      expect(activite(report, "ei")).toMatchObject({ charges: 30000, cotisationsSociales: 12880, revenuVerse: 17120 })
    })

    it("retire le coût employeur de ce que laisse une micro-entreprise, sans réduire ses cotisations", () => {
      // 100 000 € de ventes : 10 000 € de cotisations ; reste 100 000 - 10 000 - 35 400 = 54 600 €.
      const report = simuler([personne("carl"), personne("bob"), micro("m1")], [relation("carl", "m1", "Titulaire"), relation("bob", "m1", "Salarié")], [
        ["m1", "ca_micro_vente", 100000],
        ["bob", "salary", 24300]
      ])

      expect(activite(report, "m1")).toMatchObject({ charges: 30000, cotisationsSociales: 15400, revenuVerse: 54600 })
    })

    it("ne retient qu'un employeur, et ignore une relation sans salaire ou vers autre chose qu'une activité", () => {
      const report = simuler(
        [...entites, societe("autre"), personne("carl")],
        [...relations, relation("bob", "autre", "Salarié"), relation("carl", "sasu", "Salarié"), relation("alice", "bob", "Salarié"), relation("bob", "fantome", "Salarié")],
        flux
      )

      expect(activite(report, "sasu").salaries?.map(s => s.personId)).toEqual(["bob"])
      expect(activite(report, "autre").salaries).toBeUndefined()
    })

    it("sans relation, le salaire reste un revenu venu de l'extérieur", () => {
      const report = simuler(entites, [relation("alice", "sasu", "Président")], flux)

      expect(activite(report, "sasu")).toMatchObject({ charges: 0, cotisationsSociales: 0 })
      expect(activite(report, "sasu").salaries).toBeUndefined()
      expect(report.persons.find(p => p.entityId === "bob")?.cotisationsSalariales).toBe(0)
    })
  })
})
