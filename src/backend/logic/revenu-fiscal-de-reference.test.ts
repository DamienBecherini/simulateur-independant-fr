// src/backend/logic/revenu-fiscal-de-reference.test.ts
// Revenu fiscal de référence de chaque foyer, et son usage pour le versement libératoire de l'année N + 2.
// Règles fictives aux chiffres ronds (testing/regles-de-test.ts) : abattement de 10 % sur les salaires, 30 % sur le
// chiffre d'affaires BNC d'une micro-entreprise, seuil du versement libératoire de 28 000 € par part.

import { describe, expect, it } from "vitest"
import type { ActivityResult, SimulationReport } from "../../types.js"
import { runMetaSimulation, type ContexteDeLAnnee } from "./simulation-engine.js"
import { reglesDeTest } from "./testing/regles-de-test.js"
import { micro, personne, relation, session, societe, type Flux } from "./testing/session-de-test.js"

const rfrDe = (report: SimulationReport, personId: string) => report.foyers.find(f => f.personIds.includes(personId))!.revenuFiscalDeReference
const activite = (report: SimulationReport, id: string): ActivityResult => report.activities.find(a => a.entityId === id)!
/** Les montants en euros sont écrits avec des espaces insécables : on les compare avec des espaces simples. */
const espacesSimples = (textes: string[]) => textes.map(texte => texte.replace(/\s/g, " "))

describe("revenu fiscal de référence d'un foyer", () => {
  it("vaut le revenu imposable au barème pour des salaires", () => {
    // 30 000 € de salaires, moins 10 % : 27 000 €.
    const report = runMetaSimulation(session([personne("alice")], [], [["alice", "salary", 30000]]), reglesDeTest)

    expect(rfrDe(report, "alice")).toBe(27000)
  })

  it("ajoute les dividendes bruts imposés au prélèvement forfaitaire", () => {
    // Salaire de 100 000 € (90 000 € imposables, tranche à 40 %) : 10 000 € de dividendes au forfait de 12 %,
    // plus favorable que le barème. Revenu fiscal de référence : 90 000 + 10 000 = 100 000 €.
    const flux: Flux[] = [
      ["alice", "salary", 100000],
      ["s1", "ca_services", 50000],
      ["s1", "dividends_payment", 10000]
    ]
    const report = runMetaSimulation(session([personne("alice"), societe("s1")], [relation("alice", "s1", "Président")], flux), reglesDeTest)

    expect(report.foyers[0].optionDividendes).toBe("pfu")
    expect(report.foyers[0].revenuImposableGlobal).toBe(90000)
    expect(rfrDe(report, "alice")).toBe(100000)
  })

  it.each([
    ["avec", true],
    ["sans", false]
  ])("compte le chiffre d'affaires après abattement d'une micro-entreprise, %s versement libératoire", (_cas, opteVFL) => {
    // 40 000 € de prestations BNC, moins 30 % : 28 000 €, au barème ou au versement libératoire.
    const entites = [personne("alice"), { ...micro("m1", { opteVFL }), rfrN2: 10000 }]
    const report = runMetaSimulation(session(entites, [relation("alice", "m1", "Titulaire")], [["m1", "ca_micro_services_bnc", 40000]]), reglesDeTest)

    expect(activite(report, "m1").versementLiberatoire?.applique).toBe(opteVFL)
    expect(report.foyers[0].revenuImposableGlobal).toBe(opteVFL ? 0 : 28000)
    expect(rfrDe(report, "alice")).toBe(28000)
  })

  it("est commun aux membres d'un foyer, et ne descend pas sous zéro", () => {
    const report = runMetaSimulation(session([personne("alice"), personne("bob")], [relation("alice", "bob", "Marié(e)")], [["bob", "salary", 20000]]), reglesDeTest)

    expect(rfrDe(report, "alice")).toBe(18000)
    expect(rfrDe(report, "bob")).toBe(18000)
  })
})

describe("versement libératoire de l'année N, d'après le revenu fiscal de référence calculé pour N-2", () => {
  /** Alice, titulaire d'une micro-entreprise BNC qui demande le versement libératoire et dont le RFR saisi est de 10 000 €. */
  const microDAlice = () => session([personne("alice"), { ...micro("m1", { opteVFL: true }), rfrN2: 10000 }], [relation("alice", "m1", "Titulaire")], [["m1", "ca_micro_services_bnc", 40000]])
  const en2026 = (parPersonne: Record<string, number>): ContexteDeLAnnee => ({ annee: 2026, rfrN2: { annee: 2024, parPersonne } })

  it("retient le revenu calculé pour N-2 plutôt que celui saisi, et le dit", () => {
    // 30 000 € calculés pour 2024 : au-dessus du seuil de 28 000 €, le versement libératoire est refusé.
    const vfl = activite(runMetaSimulation(microDAlice(), reglesDeTest, en2026({ alice: 30000 })), "m1")

    expect(vfl.versementLiberatoire).toEqual({ plafondRfr: 28000, partsFiscales: 1, rfrN2: 30000, anneeRfr: 2024, origineRfr: "calcule", eligible: false, applique: false })
    expect(espacesSimples(vfl.warnings)).toContain("Versement libératoire impossible : le revenu fiscal de référence 2024 (30 000 €, calculé par la simulation) dépasse le seuil de 28 000 € pour 1 part(s). L'impôt est calculé au barème.")
  })

  it("garde le revenu saisi quand N-2 ne donne rien pour le titulaire", () => {
    const vfl = activite(runMetaSimulation(microDAlice(), reglesDeTest, en2026({ bob: 30000 })), "m1").versementLiberatoire

    expect(vfl).toMatchObject({ rfrN2: 10000, anneeRfr: 2024, origineRfr: "saisi", eligible: true, applique: true })
  })

  it("le dit aussi quand le revenu saisi dépasse le seuil", () => {
    const entites = [personne("alice"), { ...micro("m1", { opteVFL: true }), rfrN2: 50000 }]
    const report = runMetaSimulation(session(entites, [relation("alice", "m1", "Titulaire")], [["m1", "ca_micro_services_bnc", 40000]]), reglesDeTest, { annee: 2026 })

    expect(espacesSimples(activite(report, "m1").warnings)).toContain("Versement libératoire impossible : le revenu fiscal de référence 2024 (50 000 €, saisi dans la fiche) dépasse le seuil de 28 000 € pour 1 part(s). L'impôt est calculé au barème.")
  })

  it("invite à ajouter l'année N-2 quand aucun revenu n'est connu", () => {
    const sansRfr = session([personne("alice"), micro("m1", { opteVFL: true })], [relation("alice", "m1", "Titulaire")], [["m1", "ca_micro_services_bnc", 40000]])

    expect(activite(runMetaSimulation(sansRfr, reglesDeTest, { annee: 2026 }), "m1").warnings).toContainEqual(expect.stringContaining("Ajoutez l'année 2024 à la simulation pour qu'il soit calculé"))
  })
})
