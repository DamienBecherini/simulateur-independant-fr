// src/backend/logic/optimisation-remuneration.test.ts

import { describe, expect, it } from "vitest"
import { activiteComparee, beneficeAvantDividendes, comparerStatuts } from "./comparateur.js"
import { optimiserRemuneration } from "./optimisation-remuneration.js"
import { reglesDeTest } from "./testing/regles-de-test.js"
import { micro, personne, relation, session, societe, type Flux } from "./testing/session-de-test.js"
import type { ComparaisonOptions, SimulationAnnuelle, StatutSociete } from "../../types.js"

const options = (activityId: string): ComparaisonOptions => ({ activityId, remunerationNette: 0, distribuerToutLeBenefice: true, partBncPrestations: 1 })

/** Alice, présidente d'une SASU (ou gérante d'une EURL) qui facture 100 000 € de prestations. */
function societeDAlice(statut: StatutSociete, flux: Flux[] = [["s1", "ca_services", 100000]]): SimulationAnnuelle {
  return session([personne("alice"), societe("s1", statut)], [relation("alice", "s1", statut === "SASU" ? "Président" : "Gérant")], flux)
}

describe("optimiserRemuneration", () => {
  describe.each(["SASU", "EURL"] as const)("%s", statut => {
    const s = societeDAlice(statut)
    const resultat = optimiserRemuneration(s, options("s1"), statut, reglesDeTest)
    const { points } = resultat

    it("parcourt les rémunérations de zéro à ce que la société peut verser, par ordre croissant", () => {
      expect(points.length).toBeGreaterThan(50)
      expect(points[0].remunerationNette).toBe(0)
      expect(points.at(-1)!.remunerationNette).toBe(resultat.remunerationMaximale)
      expect(points.map(p => p.remunerationNette)).toEqual([...points.map(p => p.remunerationNette)].sort((a, b) => a - b))
      expect(resultat.warnings).toEqual([])
    })

    it("s'arrête à la rémunération la plus haute qui laisse un bénéfice, à 100 € près", () => {
      const benefice = (remunerationNette: number) => beneficeAvantDividendes(s, activiteComparee(s, "s1")!, statut, { ...options("s1"), remunerationNette }, reglesDeTest)
      expect(benefice(resultat.remunerationMaximale)).toBeGreaterThanOrEqual(0)
      expect(benefice(resultat.remunerationMaximale + 100)).toBeLessThan(0)
    })

    it("chaque point est la colonne du comparateur pour cette rémunération, tout le reste étant distribué", () => {
      for (const point of [points[0], points[Math.floor(points.length / 2)], points.at(-1)!]) {
        const colonne = comparerStatuts(s, { ...options("s1"), remunerationNette: point.remunerationNette }, reglesDeTest).scenarios.find(c => c.statut === statut)!
        expect(point.netApresImpots).toBe(Math.round(colonne.netApresImpots))
        expect(point.trimestres).toBe(colonne.protectionSociale.trimestres)
      }
    })

    it("désigne le meilleur net, à 100 € près", () => {
      const { meilleur } = resultat
      expect(Math.max(...points.map(p => p.netApresImpots))).toBe(meilleur!.netApresImpots)
      // Les voisins immédiats du meilleur point ont été calculés : il n'est pas un simple point de la grille.
      const voisins = points.filter(p => Math.abs(p.remunerationNette - meilleur!.remunerationNette) === 100)
      expect(voisins.length).toBeGreaterThan(0)
    })

    it("désigne le meilleur net parmi les rémunérations qui valident 4 trimestres de retraite", () => {
      const avecRetraite = points.filter(p => p.trimestres >= 4)
      expect(resultat.meilleurAvecRetraite!.trimestres).toBe(4)
      expect(resultat.meilleurAvecRetraite!.netApresImpots).toBe(Math.max(...avecRetraite.map(p => p.netApresImpots)))
    })
  })

  it("en SASU, cherche à 100 € près la plus petite rémunération qui valide 4 trimestres", () => {
    const { points } = optimiserRemuneration(societeDAlice("SASU"), options("s1"), "SASU", reglesDeTest)
    const premier = points.find(p => p.trimestres >= 4)!
    expect(points.find(p => p.remunerationNette === premier.remunerationNette - 100)?.trimestres).toBeLessThan(4)
  })

  it("verse en dividendes ce que la rémunération ne prend pas", () => {
    const { points } = optimiserRemuneration(societeDAlice("SASU"), options("s1"), "SASU", reglesDeTest)
    expect(points[0].dividendes).toBeGreaterThan(points.at(-1)!.dividendes)
    expect(points.at(-1)!.dividendes).toBeLessThan(100)
  })

  it("ne propose aucune rémunération avec retraite quand la société ne peut pas verser de quoi valider 4 trimestres", () => {
    // Règles de test : 4 trimestres demandent 8 000 € de revenu cotisé ; 6 000 € de chiffre d'affaires n'y suffisent pas.
    const resultat = optimiserRemuneration(societeDAlice("SASU", [["s1", "ca_services", 6000]]), options("s1"), "SASU", reglesDeTest)
    expect(resultat.meilleur).not.toBeNull()
    expect(resultat.points.every(p => p.trimestres < 4)).toBe(true)
    expect(resultat.meilleurAvecRetraite).toBeNull()
  })

  it("optimise aussi une micro-entreprise convertie en société", () => {
    const s = session([personne("alice"), micro("m1")], [relation("alice", "m1", "Titulaire")], [["m1", "ca_micro_services_bnc", 80000]])
    const resultat = optimiserRemuneration(s, options("m1"), "SASU", reglesDeTest)
    expect(resultat.points.length).toBeGreaterThan(0)
    expect(resultat.meilleur).not.toBeNull()
  })

  it("n'a rien à optimiser quand la société ne dégage aucun bénéfice", () => {
    const deficitaire = societeDAlice("SASU", [["s1", "ca_services", 10000], ["s1", "deductible_expense", 20000]])
    expect(optimiserRemuneration(deficitaire, options("s1"), "SASU", reglesDeTest)).toMatchObject({ points: [], meilleur: null, meilleurAvecRetraite: null, warnings: [expect.stringContaining("aucun bénéfice")] })
  })

  it("n'a rien à optimiser quand le bénéfice est tout juste nul", () => {
    // 20 000 € de chiffre d'affaires et autant de charges : bénéfice de 0 € sans rémunération, rien à partager.
    const aZero = societeDAlice("SASU", [["s1", "ca_services", 20000], ["s1", "deductible_expense", 20000]])
    expect(optimiserRemuneration(aZero, options("s1"), "SASU", reglesDeTest)).toMatchObject({ remunerationMaximale: 0, points: [], meilleur: null, warnings: [expect.stringContaining("aucun bénéfice en SASU")] })
  })

  it("en EURL, n'a rien à optimiser quand les cotisations minimales du gérant absorbent un petit bénéfice", () => {
    // 1 000 € de bénéfice avant rémunération, mais au moins 1 500 € de cotisations minimales (règles de test) : déficit.
    const petite = societeDAlice("EURL", [["s1", "ca_services", 1000]])
    expect(optimiserRemuneration(petite, options("s1"), "EURL", reglesDeTest)).toMatchObject({ points: [], meilleur: null, meilleurAvecRetraite: null, warnings: [expect.stringContaining("aucun bénéfice en EURL")] })
  })

  it("en SASU, propose au moins un point quand le bénéfice ne permet que 100 € de rémunération", () => {
    // 200 € de bénéfice. Règles de test : brut = net / 0,81 et 34 % de patronales, la société paie 1,654 fois le net ;
    // le net ne peut dépasser 200 / 1,654 = 120,90 €, soit 100 € à 100 € près. Deux points : 0 et 100 €.
    const resultat = optimiserRemuneration(societeDAlice("SASU", [["s1", "ca_services", 200]]), options("s1"), "SASU", reglesDeTest)
    expect(resultat.remunerationMaximale).toBe(100)
    expect(resultat.points.map(p => p.remunerationNette)).toEqual([0, 100])
    expect(resultat.meilleur).not.toBeNull()
  })

  it("demande de choisir une activité quand l'identifiant ne correspond à aucune", () => {
    expect(optimiserRemuneration(societeDAlice("SASU"), options("inconnue"), "SASU", reglesDeTest).warnings).toEqual(["Choisissez une activité à comparer."])
  })
})
