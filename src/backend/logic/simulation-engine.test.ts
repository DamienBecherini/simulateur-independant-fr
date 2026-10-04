// src/backend/logic/simulation-engine.test.ts

import { describe, expect, it } from "vitest"
import { runMetaSimulation } from "./simulation-engine.js"
import type { Company, Entity, FinancialFlow, MicroEntreprise, Person, Relationship, SessionState, SimulationReport } from "../../types.js"

/*
 * Ces tests ne couvrent que les comportements stables du moteur : agrégation annuelle des flux,
 * regroupement des foyers, routage de la rémunération du dirigeant et avertissements.
 * Les montants de « net dans la poche » et d'impôts des entités ne sont volontairement pas vérifiés ici.
 */

const avatar = { type: "initials", value: "AB", color: "#3b82f6" } as const

function personne(id: string, fiscalParts = 1): Person {
  return { id, type: "person", name: id, fiscalParts, avatar, locked: false }
}

function societe(id: string, legalStatus: Company["legalStatus"] = "SASU"): Company {
  return { id, type: "company", name: id, legalStatus, avatar, locked: false }
}

function micro(id: string, options: Partial<Pick<MicroEntreprise, "beneficieACRE" | "opteVFL">> = {}): MicroEntreprise {
  return { id, type: "micro-entreprise", name: id, beneficieACRE: false, opteVFL: false, avatar, locked: false, ...options }
}

function relation(fromId: string, toId: string, type: Relationship["type"]): Relationship {
  return { id: `${fromId}-${toId}-${type}`, fromId, toId, type }
}

type Flux = [mois: number, entityId: string, type: FinancialFlow["type"], amount: number]

function session(entities: Entity[], relationships: Relationship[] = [], flux: Flux[] = []): SessionState {
  const monthlyData: SessionState["monthlyData"] = Array.from({ length: 12 }, (_, month) => ({ month, flows: [] }))
  flux.forEach(([mois, entityId, type, amount], index) => {
    monthlyData[mois].flows.push({ id: `flux-${index}`, label: type, amount, entityId, type })
  })
  return { name: "Test", entities, relationships, monthlyData }
}

/** Le même flux répété sur les 12 mois de l'année. */
function chaqueMois(entityId: string, type: FinancialFlow["type"], amount: number): Flux[] {
  return Array.from({ length: 12 }, (_, mois): Flux => [mois, entityId, type, amount])
}

function resultat(report: SimulationReport, entityId: string) {
  const entite = report.entities.find(e => e.entityId === entityId)
  if (!entite) throw new Error(`Entité ${entityId} absente du rapport`)
  return entite
}

function foyerDe(report: SimulationReport, personId: string) {
  const foyer = report.foyers.find(f => f.personIds.includes(personId))
  if (!foyer) throw new Error(`Aucun foyer pour ${personId}`)
  return foyer
}

const AVERTISSEMENT_SANS_DIRIGEANT = "Rémunération dirigeant saisie sans relation Président/Gérant vers une personne : non routée vers un foyer."
const AVERTISSEMENT_PLUSIEURS_DIRIGEANTS = "Plusieurs dirigeants liés : la rémunération est attribuée au premier pour le routage fiscal simplifié."
const AVERTISSEMENT_DIVIDENDES = "Le flux « versement de dividendes » saisi sur la grille n'est pas encore pris en compte par le moteur (dividendes dérivés du bénéfice)."

describe("runMetaSimulation", () => {
  describe("structure du rapport", () => {
    it("renvoie un rapport vide pour une session vide", () => {
      expect(runMetaSimulation(session([]))).toEqual({ entities: [], foyers: [], globalNet: 0 })
    })

    it("produit une ligne par entité, dans l'ordre de la session", () => {
      const report = runMetaSimulation(session([societe("c1"), personne("p1"), micro("m1"), societe("c2", "EURL")]))

      expect(report.entities.map(e => [e.entityId, e.name, e.type])).toEqual([
        ["c1", "c1", "company"],
        ["p1", "p1", "person"],
        ["m1", "m1", "micro-entreprise"],
        ["c2", "c2", "company"]
      ])
    })

    it("ne crée aucun foyer quand la session ne contient aucune personne", () => {
      const report = runMetaSimulation(session([societe("c1"), micro("m1")], [], [[0, "c1", "ca_services", 1000]]))

      expect(report.foyers).toEqual([])
    })
  })

  describe("agrégation annuelle des flux", () => {
    it("additionne le chiffre d'affaires d'une société sur les 12 mois", () => {
      const report = runMetaSimulation(session([societe("c1")], [], chaqueMois("c1", "ca_services", 5000)))

      expect(resultat(report, "c1").chiffreAffaires).toBe(60_000)
    })

    it("cumule services et ventes, y compris plusieurs flux dans le même mois", () => {
      const report = runMetaSimulation(
        session(
          [societe("c1", "EURL")],
          [],
          [
            [0, "c1", "ca_services", 10_000],
            [0, "c1", "ca_services", 2500],
            [0, "c1", "ca_vente", 4000],
            [11, "c1", "ca_vente", 1500]
          ]
        )
      )

      expect(resultat(report, "c1").chiffreAffaires).toBe(18_000)
    })

    it("n'attribue à chaque entité que ses propres flux", () => {
      const report = runMetaSimulation(
        session(
          [societe("c1"), societe("c2"), micro("m1")],
          [],
          [
            [0, "c1", "ca_services", 10_000],
            [1, "c2", "ca_services", 20_000],
            [2, "m1", "ca_micro_services_bic", 3000],
            [3, "c1", "ca_vente", 5000]
          ]
        )
      )

      expect(resultat(report, "c1").chiffreAffaires).toBe(15_000)
      expect(resultat(report, "c2").chiffreAffaires).toBe(20_000)
      expect(resultat(report, "m1").chiffreAffaires).toBe(3000)
    })

    it("additionne les trois natures de chiffre d'affaires d'une micro-entreprise", () => {
      const report = runMetaSimulation(
        session(
          [micro("m1")],
          [],
          [
            [0, "m1", "ca_micro_services_bic", 1000],
            [4, "m1", "ca_micro_services_bnc", 2000],
            [8, "m1", "ca_micro_vente", 4000],
            [8, "m1", "ca_micro_vente", 500]
          ]
        )
      )

      expect(resultat(report, "m1").chiffreAffaires).toBe(7500)
    })

    it("ne compte pas les charges ni la rémunération dans le chiffre d'affaires", () => {
      const report = runMetaSimulation(
        session(
          [societe("c1")],
          [],
          [
            [0, "c1", "ca_services", 10_000],
            [0, "c1", "deductible_expense", 3000],
            [0, "c1", "director_remuneration", 2000]
          ]
        )
      )

      expect(resultat(report, "c1").chiffreAffaires).toBe(10_000)
    })

    it("cumule salaires, ARE et autres revenus imposables d'une personne dans le revenu du foyer", () => {
      const report = runMetaSimulation(
        session(
          [personne("p1")],
          [],
          [...chaqueMois("p1", "salary", 2000), [0, "p1", "are", 1200], [1, "p1", "are", 1200], [6, "p1", "other_taxable_income", 600]]
        )
      )

      expect(foyerDe(report, "p1").revenuImposableGlobal).toBe(27_000)
    })

    it("donne un revenu nul à une personne sans flux et un chiffre d'affaires nul à une société sans flux", () => {
      const report = runMetaSimulation(session([personne("p1"), societe("c1"), micro("m1")]))

      expect(foyerDe(report, "p1").revenuImposableGlobal).toBe(0)
      expect(resultat(report, "c1").chiffreAffaires).toBe(0)
      expect(resultat(report, "m1").chiffreAffaires).toBe(0)
    })
  })

  describe("regroupement des foyers fiscaux", () => {
    it("crée un foyer par personne isolée, avec ses propres parts", () => {
      const report = runMetaSimulation(session([personne("p1"), personne("p2", 1.5)]))

      expect(report.foyers.map(f => [f.personIds, f.totalParts])).toEqual([
        [["p1"], 1],
        [["p2"], 1.5]
      ])
    })

    it.each(["Marié(e)", "PACSé(e)"] as const)("réunit deux personnes liées par « %s » et additionne leurs parts", type => {
      const report = runMetaSimulation(session([personne("p1"), personne("p2")], [relation("p1", "p2", type)]))

      expect(report.foyers).toHaveLength(1)
      expect(report.foyers[0].personIds).toEqual(["p1", "p2"])
      expect(report.foyers[0].totalParts).toBe(2)
    })

    it("trie les membres du foyer par identifiant, quel que soit le sens de la relation", () => {
      const report = runMetaSimulation(session([personne("zoe"), personne("adam")], [relation("zoe", "adam", "Marié(e)")]))

      expect(report.foyers).toHaveLength(1)
      expect(report.foyers[0].personIds).toEqual(["adam", "zoe"])
    })

    it("additionne les revenus des deux membres du couple", () => {
      const report = runMetaSimulation(
        session([personne("p1"), personne("p2")], [relation("p2", "p1", "PACSé(e)")], [...chaqueMois("p1", "salary", 2000), ...chaqueMois("p2", "salary", 3000)])
      )

      expect(foyerDe(report, "p1")).toBe(foyerDe(report, "p2"))
      expect(foyerDe(report, "p1").revenuImposableGlobal).toBe(60_000)
    })

    it("laisse dans des foyers distincts deux couples sans lien entre eux", () => {
      const report = runMetaSimulation(
        session([personne("p1"), personne("p2"), personne("p3"), personne("p4")], [relation("p1", "p2", "Marié(e)"), relation("p4", "p3", "PACSé(e)")])
      )

      expect(report.foyers.map(f => f.personIds)).toEqual([
        ["p1", "p2"],
        ["p3", "p4"]
      ])
    })

    it("fusionne les regroupements de proche en proche", () => {
      const report = runMetaSimulation(
        session([personne("p1"), personne("p2"), personne("p3"), personne("p4")], [relation("p1", "p2", "Marié(e)"), relation("p3", "p4", "Marié(e)"), relation("p2", "p4", "PACSé(e)")])
      )

      expect(report.foyers).toHaveLength(1)
      expect(report.foyers[0].personIds).toEqual(["p1", "p2", "p3", "p4"])
      expect(report.foyers[0].totalParts).toBe(4)
    })

    it("ne regroupe pas une personne avec la société qu'elle dirige ou sa micro-entreprise", () => {
      const report = runMetaSimulation(
        session([personne("p1"), societe("c1"), micro("m1"), personne("p2")], [relation("p1", "c1", "Président"), relation("p1", "m1", "Titulaire"), relation("p1", "p2", "Associé")])
      )

      expect(report.foyers.map(f => [f.personIds, f.totalParts])).toEqual([
        [["p1"], 1],
        [["p2"], 1]
      ])
    })

    it("ignore une relation de couple dont une extrémité n'est pas une personne", () => {
      const report = runMetaSimulation(session([personne("p1"), societe("c1")], [relation("p1", "c1", "Marié(e)"), relation("p1", "fantome", "PACSé(e)")]))

      expect(report.foyers.map(f => [f.personIds, f.totalParts])).toEqual([[["p1"], 1]])
    })

    describe("enfants", () => {
      it("ajoute une demi-part au foyer du parent pour chaque enfant", () => {
        const report = runMetaSimulation(
          session([personne("parent"), personne("enfant1"), personne("enfant2")], [relation("parent", "enfant1", "Enfant"), relation("enfant2", "parent", "Enfant")])
        )

        expect(foyerDe(report, "parent").personIds).toEqual(["parent"])
        expect(foyerDe(report, "parent").totalParts).toBe(2)
      })

      it("ne compte qu'une fois l'enfant relié aux deux membres d'un couple", () => {
        const report = runMetaSimulation(
          session(
            [personne("p1"), personne("p2"), personne("enfant")],
            [relation("p1", "p2", "Marié(e)"), relation("p1", "enfant", "Enfant"), relation("p2", "enfant", "Enfant")]
          )
        )

        expect(foyerDe(report, "p1").personIds).toEqual(["p1", "p2"])
        expect(foyerDe(report, "p1").totalParts).toBe(2.5)
      })

      it("ne compte pas deux fois un enfant relié deux fois au même parent", () => {
        const report = runMetaSimulation(session([personne("parent"), personne("enfant")], [relation("parent", "enfant", "Enfant"), relation("enfant", "parent", "Enfant")]))

        expect(foyerDe(report, "parent").totalParts).toBe(1.5)
      })

      it("n'ajoute aucune part pour une relation « Enfant » entre les deux membres d'un couple", () => {
        const report = runMetaSimulation(session([personne("p1"), personne("p2")], [relation("p1", "p2", "PACSé(e)"), relation("p1", "p2", "Enfant")]))

        expect(report.foyers).toHaveLength(1)
        expect(report.foyers[0].totalParts).toBe(2)
      })

      it("n'ajoute aucune part pour une relation « Enfant » vers autre chose qu'une personne", () => {
        const report = runMetaSimulation(session([personne("parent"), societe("c1")], [relation("parent", "c1", "Enfant"), relation("parent", "fantome", "Enfant")]))

        expect(foyerDe(report, "parent").totalParts).toBe(1)
      })

      it("n'ajoute aucune part au foyer d'un tiers", () => {
        const report = runMetaSimulation(session([personne("parent"), personne("enfant"), personne("voisin")], [relation("parent", "enfant", "Enfant")]))

        expect(foyerDe(report, "voisin").totalParts).toBe(1)
      })

      it.todo("ne majore pas le foyer de l'enfant : la relation « Enfant » étant lue dans les deux sens, l'enfant reçoit lui aussi 0,5 part pour son parent, et reste un foyer distinct avec sa propre part")
      it.todo("compte une part entière à partir du troisième enfant")
    })
  })

  describe("routage de la rémunération du dirigeant", () => {
    it.each([
      ["Président", "SASU"],
      ["Gérant", "EURL"]
    ] as const)("ajoute la rémunération annuelle au revenu du foyer du %s", (type, statut) => {
      const report = runMetaSimulation(
        session([personne("p1"), societe("c1", statut)], [relation("p1", "c1", type)], [...chaqueMois("c1", "ca_services", 8000), ...chaqueMois("c1", "director_remuneration", 2500)])
      )

      expect(foyerDe(report, "p1").revenuImposableGlobal).toBe(30_000)
      expect(resultat(report, "c1").warnings).toEqual([])
    })

    it("route la rémunération quel que soit le sens de la relation", () => {
      const report = runMetaSimulation(session([societe("c1"), personne("p1")], [relation("c1", "p1", "Président")], [[0, "c1", "director_remuneration", 12_000]]))

      expect(foyerDe(report, "p1").revenuImposableGlobal).toBe(12_000)
    })

    it("s'ajoute aux revenus propres du dirigeant", () => {
      const report = runMetaSimulation(
        session([personne("p1"), societe("c1")], [relation("p1", "c1", "Président")], [...chaqueMois("p1", "are", 1000), ...chaqueMois("c1", "director_remuneration", 2000)])
      )

      expect(foyerDe(report, "p1").revenuImposableGlobal).toBe(36_000)
    })

    it("cumule les rémunérations de plusieurs sociétés dirigées par la même personne", () => {
      const report = runMetaSimulation(
        session(
          [personne("p1"), societe("c1"), societe("c2", "EURL")],
          [relation("p1", "c1", "Président"), relation("p1", "c2", "Gérant")],
          [
            [0, "c1", "director_remuneration", 10_000],
            [5, "c2", "director_remuneration", 7000]
          ]
        )
      )

      expect(foyerDe(report, "p1").revenuImposableGlobal).toBe(17_000)
    })

    it("profite au foyer du couple quand le dirigeant est marié", () => {
      const report = runMetaSimulation(
        session(
          [personne("p1"), personne("p2"), societe("c1")],
          [relation("p1", "p2", "Marié(e)"), relation("p2", "c1", "Président")],
          [...chaqueMois("p1", "salary", 1500), ...chaqueMois("c1", "director_remuneration", 2000)]
        )
      )

      expect(report.foyers).toHaveLength(1)
      expect(report.foyers[0].revenuImposableGlobal).toBe(42_000)
    })

    it("ne route rien vers un simple associé", () => {
      const report = runMetaSimulation(session([personne("p1"), societe("c1")], [relation("p1", "c1", "Associé")], [[0, "c1", "director_remuneration", 12_000]]))

      expect(foyerDe(report, "p1").revenuImposableGlobal).toBe(0)
      expect(resultat(report, "c1").warnings).toEqual([AVERTISSEMENT_SANS_DIRIGEANT])
    })

    it("ne route rien vers le dirigeant d'une autre société", () => {
      const report = runMetaSimulation(
        session([personne("p1"), personne("p2"), societe("c1"), societe("c2")], [relation("p1", "c1", "Président"), relation("p2", "c2", "Président")], [[0, "c1", "director_remuneration", 12_000]])
      )

      expect(foyerDe(report, "p1").revenuImposableGlobal).toBe(12_000)
      expect(foyerDe(report, "p2").revenuImposableGlobal).toBe(0)
    })
  })

  describe("avertissements", () => {
    it("ne signale rien pour une société correctement reliée", () => {
      const report = runMetaSimulation(
        session([personne("p1"), societe("c1")], [relation("p1", "c1", "Président")], [...chaqueMois("c1", "ca_services", 8000), ...chaqueMois("c1", "director_remuneration", 2000)])
      )

      expect(resultat(report, "c1").warnings).toEqual([])
      expect(resultat(report, "p1").warnings).toEqual([])
    })

    it("signale une rémunération saisie sans dirigeant", () => {
      const report = runMetaSimulation(session([personne("p1"), societe("c1")], [], [[0, "c1", "director_remuneration", 12_000]]))

      expect(resultat(report, "c1").warnings).toEqual([AVERTISSEMENT_SANS_DIRIGEANT])
      expect(foyerDe(report, "p1").revenuImposableGlobal).toBe(0)
    })

    it("signale une rémunération dont le « dirigeant » n'est pas une personne", () => {
      const report = runMetaSimulation(session([societe("c1"), societe("c2")], [relation("c2", "c1", "Président")], [[0, "c1", "director_remuneration", 12_000]]))

      expect(resultat(report, "c1").warnings).toEqual([AVERTISSEMENT_SANS_DIRIGEANT])
      expect(resultat(report, "c2").warnings).toEqual([])
    })

    it("ne signale pas l'absence de dirigeant tant qu'aucune rémunération n'est saisie", () => {
      const report = runMetaSimulation(session([societe("c1")], [], [[0, "c1", "ca_services", 12_000]]))

      expect(resultat(report, "c1").warnings).toEqual([])
    })

    it("signale plusieurs dirigeants et route la rémunération vers le premier", () => {
      const report = runMetaSimulation(
        session([personne("p1"), personne("p2"), societe("c1")], [relation("p2", "c1", "Gérant"), relation("p1", "c1", "Président")], [[0, "c1", "director_remuneration", 12_000]])
      )

      expect(resultat(report, "c1").warnings).toEqual([AVERTISSEMENT_PLUSIEURS_DIRIGEANTS])
      expect(foyerDe(report, "p2").revenuImposableGlobal).toBe(12_000)
      expect(foyerDe(report, "p1").revenuImposableGlobal).toBe(0)
    })

    it("ne signale pas plusieurs dirigeants tant qu'aucune rémunération n'est saisie", () => {
      const report = runMetaSimulation(session([personne("p1"), personne("p2"), societe("c1")], [relation("p1", "c1", "Président"), relation("p2", "c1", "Gérant")]))

      expect(resultat(report, "c1").warnings).toEqual([])
    })

    it("signale les dividendes saisis sur la grille", () => {
      const report = runMetaSimulation(
        session(
          [personne("p1"), societe("c1")],
          [relation("p1", "c1", "Président"), relation("p1", "c1", "Associé")],
          [
            [0, "c1", "ca_services", 50_000],
            [11, "c1", "dividends_payment", 5000]
          ]
        )
      )

      expect(resultat(report, "c1").warnings).toEqual([AVERTISSEMENT_DIVIDENDES])
    })

    it("cumule les avertissements d'une même société sans toucher aux autres entités", () => {
      const report = runMetaSimulation(
        session(
          [personne("p1"), societe("c1"), societe("c2")],
          [relation("p1", "c2", "Président")],
          [
            [0, "c1", "dividends_payment", 5000],
            [0, "c1", "director_remuneration", 12_000],
            [0, "c2", "director_remuneration", 6000]
          ]
        )
      )

      expect(resultat(report, "c1").warnings).toEqual([AVERTISSEMENT_DIVIDENDES, AVERTISSEMENT_SANS_DIRIGEANT])
      expect(resultat(report, "c2").warnings).toEqual([])
      expect(resultat(report, "p1").warnings).toEqual([])
    })

    it("ignore les flux de rémunération ou de dividendes rattachés à autre chose qu'une société", () => {
      const report = runMetaSimulation(
        session(
          [personne("p1"), micro("m1")],
          [relation("p1", "m1", "Titulaire")],
          [
            [0, "p1", "director_remuneration", 12_000],
            [0, "m1", "dividends_payment", 5000]
          ]
        )
      )

      expect(resultat(report, "p1").warnings).toEqual([])
      expect(resultat(report, "m1").warnings).toEqual([])
      expect(foyerDe(report, "p1").revenuImposableGlobal).toBe(0)
    })
  })
})
