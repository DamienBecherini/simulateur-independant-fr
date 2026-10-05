// src/backend/logic/deplacements-professionnels.test.ts

import { describe, expect, it } from "vitest"
import type { ActivityResult, Company, ComparaisonOptions, DeplacementsProfessionnels, Entity, MicroEntreprise } from "../../types.js"
import { comparerStatuts } from "./comparateur.js"
import { runMetaSimulation } from "./simulation-engine.js"
import { reglesDeTest } from "./testing/regles-de-test.js"
import { micro, personne, relation, session, societe, type Flux } from "./testing/session-de-test.js"

/*
 * Déplacements professionnels d'une activité, avec les règles de test : 10 000 km en 5 CV font 10 000 x 0,4 + 1 000 =
 * 5 000 € au barème. Ils doivent peser exactement comme 5 000 € de charges saisies : déductibles en société et en
 * entreprise individuelle, simple dépense en micro-entreprise.
 */

const dixMilleKm: DeplacementsProfessionnels = { kmParAn: 10000, puissanceFiscale: "5", electrique: false }

function avecDeplacements<T extends Company | MicroEntreprise>(activite: T, deplacements = dixMilleKm): T {
  return { ...activite, deplacementsProfessionnels: deplacements }
}

const simuler = (entities: Entity[], flux: Flux[], lien: "Titulaire" | "Président" | "Gérant") => runMetaSimulation(session(entities, [relation("alice", "a", lien)], flux), reglesDeTest)

/** Le rapport sans le détail des déplacements, pour le comparer à celui d'une charge saisie du même montant. */
function sansDetail(report: ReturnType<typeof runMetaSimulation>) {
  return { ...report, activities: report.activities.map((resultat): ActivityResult => ({ ...resultat, fraisDeDeplacement: undefined })) }
}

describe("déplacements professionnels d'une activité", () => {
  it("en micro-entreprise : une dépense, qui ne réduit ni les cotisations ni l'impôt", () => {
    const flux: Flux[] = [["a", "ca_micro_services_bnc", 40000]]
    const sans = simuler([personne("alice"), micro("a")], flux, "Titulaire")
    const avec = simuler([personne("alice"), avecDeplacements(micro("a"))], flux, "Titulaire")

    expect(avec.activities[0]).toMatchObject({ charges: 5000, revenuVerse: sans.activities[0].revenuVerse - 5000, cotisationsSociales: sans.activities[0].cotisationsSociales, fraisDeDeplacement: { kilometres: 10000, montant: 5000, deductible: false } })
    expect(avec.foyers[0].impotSurLeRevenu).toBe(sans.foyers[0].impotSurLeRevenu)
    expect(sansDetail(avec)).toEqual(sansDetail(simuler([personne("alice"), micro("a")], [...flux, ["a", "expense", 5000]], "Titulaire")))
  })

  it.each([
    ["EI" as const, "Titulaire" as const],
    ["SASU" as const, "Président" as const],
    ["EURL" as const, "Gérant" as const]
  ])("en %s : une charge déductible, comme 5 000 € de charges saisies", (statut, lien) => {
    const flux: Flux[] = [
      ["a", "ca_services", 60000],
      ["a", "director_remuneration", statut === "EI" ? 0 : 20000],
      ["a", "dividends_payment", statut === "EI" ? 0 : 10000]
    ]
    const avec = simuler([personne("alice"), avecDeplacements(societe("a", statut))], flux, lien)
    const charge = simuler([personne("alice"), societe("a", statut)], [...flux, ["a", "deductible_expense", 5000]], lien)

    expect(avec.activities[0].fraisDeDeplacement).toEqual({ kilometres: 10000, montant: 5000, deductible: true })
    // En société, les indemnités remboursées au dirigeant ne sont ni un revenu ni une base de cotisations pour lui.
    expect(sansDetail(avec)).toEqual(sansDetail(charge))
  })

  it("majore de 20 % les kilomètres en voiture électrique, et n'affiche rien sans kilomètres", () => {
    const electrique = simuler([personne("alice"), avecDeplacements(societe("a", "EI"), { ...dixMilleKm, electrique: true })], [["a", "ca_services", 60000]], "Titulaire")
    expect(electrique.activities[0].fraisDeDeplacement?.montant).toBe(6000)

    const zero = simuler([personne("alice"), avecDeplacements(societe("a", "EI"), { ...dixMilleKm, kmParAn: 0 })], [["a", "ca_services", 60000]], "Titulaire")
    expect(zero.activities[0].fraisDeDeplacement).toBeUndefined()
  })

  it("au comparateur : chaque colonne convertit les kilomètres comme une charge, déductible sauf en micro-entreprise", () => {
    const options: ComparaisonOptions = { activityId: "a", remunerationNette: 10000, distribuerToutLeBenefice: true, partBncPrestations: 1 }
    const comparer = (activite: MicroEntreprise, flux: Flux[]) => comparerStatuts(session([personne("alice"), activite], [relation("alice", "a", "Titulaire")], [["a", "ca_micro_services_bnc", 50000], ...flux]), options, reglesDeTest)

    const avec = comparer(avecDeplacements(micro("a")), [])
    // Une dépense saisie en micro devient une charge déductible dans les statuts au réel.
    const depense = comparer(micro("a"), [["a", "expense", 5000]])
    expect(avec.scenarios).toEqual(depense.scenarios)

    const sans = comparer(micro("a"), [])
    const net = (resultat: typeof avec, statut: string) => resultat.scenarios.find(s => s.statut === statut)!.netApresImpots
    // En micro, les 5 000 € sont payés sans rien réduire ; au réel, ils réduisent les prélèvements.
    expect(net(sans, "micro") - net(avec, "micro")).toBe(5000)
    expect(net(sans, "EI") - net(avec, "EI")).toBeLessThan(5000)
  })
})
