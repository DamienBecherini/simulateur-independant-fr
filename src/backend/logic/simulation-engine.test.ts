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
      expect(simuler([])).toEqual({ annee: 2000, activities: [], persons: [], foyers: [], totalNetApresImpots: 0 })
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
      ["sasu", "director_remuneration", 30000],
      ["sasu", "dividends_payment", 20000]
    ]

    it("calcule le résultat de la société et ce qu'elle verse", () => {
      const report = simuler(entites, president, flux)

      expect(activite(report, "sasu")).toEqual({
        entityId: "sasu",
        name: "sasu",
        type: "company",
        statut: "SASU",
        chiffreAffaires: 100000,
        charges: 10000,
        cotisationsSociales: 24000,
        impotSocietes: 5400,
        revenuVerse: 50000,
        resultatConserve: 10600,
        warnings: []
      })
    })

    it("verse la rémunération et les dividendes au président, et impose le foyer une seule fois", () => {
      const report = simuler(entites, president, flux)

      expect(report.persons[0]).toMatchObject({ revenusDirects: 0, revenusActivites: 50000, detail: { salaires: 0, allocationsChomage: 0, autresRevenus: 0, remunerationsDirigeant: 30000, dividendes: 20000, benefices: 0 } })
      // Rémunération : 30 000 - 3 000 = 27 000 € imposables, soit 1 700 € d'impôt.
      // Dividendes au forfait : 20 000 x 12 % = 2 400 € (le barème donnerait 4 280 € au total).
      expect(foyerDe(report, "alice")).toEqual({
        personIds: ["alice"],
        totalParts: 1,
        revenusEncaisses: 50000,
        revenuImposableGlobal: 27000,
        impotSurLeRevenu: 4100,
        prelevementsSociaux: 3600,
        optionDividendes: "pfu",
        netApresImpots: 42300,
        depenses: 0,
        warnings: []
      })
      expect(report.totalNetApresImpots).toBe(42300)
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

      expect(report.persons[0].revenusActivites).toBe(50000)
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
        ["sasu", "director_remuneration", 30000]
      ])

      expect(activite(report, "sasu").warnings[0]).toContain("déficitaire")
      expect(activite(report, "sasu").resultatConserve).toBe(-34000)
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
          ["eurl", "director_remuneration", 30000],
          ["eurl", "dividends_payment", 20000]
        ]
      )

      // Dividendes : 1 000 € soumis aux prélèvements sociaux, 19 000 € soumis à 50 % de cotisations.
      expect(report.persons[0].detail).toMatchObject({ remunerationsDirigeant: 30000, dividendes: 10500 })
      expect(activite(report, "eurl")).toMatchObject({ statut: "EURL", cotisationsSociales: 24500, impotSocietes: 7250, revenuVerse: 40500, resultatConserve: 17750 })
      expect(foyerDe(report, "dan")).toMatchObject({ revenusEncaisses: 40500, revenuImposableGlobal: 27000, impotSurLeRevenu: 4100, prelevementsSociaux: 180, optionDividendes: "pfu", netApresImpots: 36220 })
    })
  })

  describe("entreprise individuelle au réel", () => {
    const flux: Flux[] = [
      ["ei", "ca_services", 60000],
      ["ei", "deductible_expense", 15000]
    ]

    it("attribue tout le bénéfice, net de cotisations, à l'entrepreneur", () => {
      const report = simuler([personne("carl"), societe("ei", "EI")], [relation("carl", "ei", "Titulaire")], flux)

      expect(activite(report, "ei")).toMatchObject({ statut: "EI au réel", chiffreAffaires: 60000, charges: 15000, cotisationsSociales: 15000, impotSocietes: 0, revenuVerse: 30000, resultatConserve: 0, warnings: [] })
      expect(foyerDe(report, "carl")).toMatchObject({ revenusEncaisses: 30000, revenuImposableGlobal: 30000, impotSurLeRevenu: 2000, netApresImpots: 28000 })
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
      expect(report.persons[0].revenusActivites).toBe(30000)
    })

    it("fait supporter le déficit à l'entrepreneur sans le rendre imposable", () => {
      const report = simuler(
        [personne("carl"), societe("ei", "EI")],
        [relation("carl", "ei", "Titulaire")],
        [
          ["carl", "salary", 20000],
          ["ei", "ca_services", 5000],
          ["ei", "deductible_expense", 8000]
        ]
      )

      expect(foyerDe(report, "carl")).toMatchObject({ revenusEncaisses: 17000, revenuImposableGlobal: 18000 })
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
        warnings: []
      })
      expect(report.persons[0].detail.benefices).toBe(28000)
      expect(foyerDe(report, "bob")).toMatchObject({ revenusEncaisses: 28000, revenuImposableGlobal: 28000, impotSurLeRevenu: 1800, netApresImpots: 26200 })
    })

    it("remplace l'impôt au barème par le versement libératoire quand l'option est prise", () => {
      const report = simuler([personne("bob"), micro("m1", { opteVFL: true })], [relation("bob", "m1", "Titulaire")], [["m1", "ca_micro_vente", 50000]])

      expect(foyerDe(report, "bob")).toMatchObject({ revenusEncaisses: 45000, revenuImposableGlobal: 0, impotSurLeRevenu: 500, netApresImpots: 44500 })
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
})
