// src/backend/logic/strategies-de-distribution.test.ts

import { describe, expect, it } from "vitest"
import { grilleVide, type Company, type FraisFonctionnement, type SessionState } from "../../types.js"
import { comparerStrategiesDeDistribution } from "./strategies-de-distribution.js"
import { micro, personne, relation, societe } from "./testing/session-de-test.js"

const sansFrais = Object.fromEntries(["SASU", "EURL", "EI", "micro"].map(statut => [statut, { expertComptable: 0, banque: 0, logiciel: 0, assurance: 0, cfe: 0 }])) as FraisFonctionnement

function grilleCA(entityId: string, montant: number, type: "ca_services" | "ca_micro_services_bnc" = "ca_services") {
  const grille = grilleVide()
  if (montant > 0) grille[0].flows.push({ id: `ca-${montant}`, label: "CA", amount: montant, entityId, type })
  return grille
}

function sessionSASU(chiffres: Record<number, number>, entreprise: Company = societe("s1")): SessionState {
  return {
    name: "Stratégies",
    entities: [personne("alice"), entreprise],
    relationships: [relation("alice", entreprise.id, "Président")],
    annees: Object.entries(chiffres).map(([annee, ca]) => ({ annee: Number(annee), monthlyData: grilleCA(entreprise.id, ca) }))
  }
}

const strategieDe = (resultat: ReturnType<typeof comparerStrategiesDeDistribution>, statut: "SASU" | "EURL", nom: string) => resultat.statuts.find(s => s.statut === statut)!.strategies.find(s => s.strategie === nom)!

describe("comparerStrategiesDeDistribution", () => {
  it("compare les trois stratégies en SASU et en EURL", () => {
    const resultat = comparerStrategiesDeDistribution(sessionSASU({ 2025: 60000, 2026: 60000 }), "s1", undefined)

    expect(resultat.statuts.map(s => s.statut)).toEqual(["SASU", "EURL"])
    resultat.statuts.forEach(s => expect(s.strategies.map(x => x.strategie)).toEqual(["toutDistribuer", "garderPuisDistribuer", "lisser"]))
  })

  it("garde la part choisie chaque année, puis distribue toutes les réserves la dernière", () => {
    const resultat = comparerStrategiesDeDistribution(sessionSASU({ 2025: 60000, 2026: 60000, 2027: 60000 }), "s1", { partMiseEnReserve: 0.3, fraisFonctionnement: sansFrais })
    const garder = strategieDe(resultat, "SASU", "garderPuisDistribuer")
    const tout = strategieDe(resultat, "SASU", "toutDistribuer")

    expect(garder.libelle).toBe("Garder 30 % et distribuer la dernière année")
    // Bénéfice distribuable de 49 250 € par an : 70 % distribués en 2025 et 2026, le reste avec 2027.
    expect(garder.annees.map(a => a.dividendes)).toEqual([34475, 34475, 49250 + 2 * 14775])
    expect(garder.reservesALaFin).toBe(0)
    expect(tout.annees.map(a => a.dividendes)).toEqual([49250, 49250, 49250])
  })

  it("lisse dans la limite de ce qui est disponible, et rattrape la dernière année", () => {
    // Rien en 2025 : les 24 625 € visés (49 250 / 2) ne sont pas disponibles ; 2026 verse tout.
    const resultat = comparerStrategiesDeDistribution(sessionSASU({ 2025: 0, 2026: 60000 }), "s1", { fraisFonctionnement: sansFrais })

    expect(strategieDe(resultat, "SASU", "lisser").annees.map(a => a.dividendes)).toEqual([0, 49250])
    expect(strategieDe(resultat, "SASU", "lisser").warnings).toEqual([])
  })

  it("distribue les réserves de départ dans « Garder » et « Lisser », pas dans « Tout distribuer »", () => {
    const resultat = comparerStrategiesDeDistribution(sessionSASU({ 2025: 0, 2026: 0 }, { ...societe("s1"), reservesInitiales: 10000 }), "s1", { fraisFonctionnement: sansFrais })

    expect(strategieDe(resultat, "SASU", "toutDistribuer")).toMatchObject({ reservesALaFin: 10000, annees: [{ dividendes: 0 }, { dividendes: 0 }] })
    expect(strategieDe(resultat, "SASU", "garderPuisDistribuer").annees.map(a => a.dividendes)).toEqual([0, 10000])
    expect(strategieDe(resultat, "SASU", "lisser").annees.map(a => a.dividendes)).toEqual([5000, 5000])
    // Les réserves suivent l'activité en EURL, entamées par les cotisations minimales du gérant (deux années déficitaires).
    const eurl = strategieDe(resultat, "EURL", "toutDistribuer").reservesALaFin
    expect(eurl).toBeGreaterThan(5000)
    expect(eurl).toBeLessThan(10000)
  })

  it("ne désigne aucune stratégie quand elles se valent", () => {
    const resultat = comparerStrategiesDeDistribution(sessionSASU({ 2025: 0, 2026: 0 }), "s1", { fraisFonctionnement: sansFrais })

    expect(resultat.statuts.map(s => s.meilleure)).toEqual([null, null])
  })

  it("convertit une micro-entreprise en société pour chaque année", () => {
    const session: SessionState = {
      name: "Micro",
      entities: [personne("alice"), micro("m1")],
      relationships: [relation("alice", "m1", "Titulaire")],
      annees: [
        { annee: 2025, monthlyData: grilleCA("m1", 60000, "ca_micro_services_bnc") },
        { annee: 2026, monthlyData: grilleCA("m1", 60000, "ca_micro_services_bnc") }
      ]
    }
    const resultat = comparerStrategiesDeDistribution(session, "m1", { fraisFonctionnement: sansFrais })

    expect(strategieDe(resultat, "SASU", "toutDistribuer").annees.map(a => a.dividendes)).toEqual([49250, 49250])
  })

  it("signale les années non simulées et celles qui reprennent les dernières règles connues", () => {
    const resultat = comparerStrategiesDeDistribution(sessionSASU({ 2023: 60000, 2026: 60000, 2027: 60000 }), "s1", undefined)

    expect(resultat.annees).toEqual([2026, 2027])
    expect(resultat.notes).toEqual([expect.stringMatching(/^2023 n'est pas comptée : /), "À partir de 2027, les années reprennent les règles de 2026, les dernières connues : le résultat n'est qu'une projection."])
  })
})
