// src/backend/logic/references/strategies-de-distribution.reference.test.ts

import { describe, expect, it } from "vitest"
import { grilleVide, type FraisFonctionnement, type SessionState } from "../../../types.js"
import { comparerStrategiesDeDistribution } from "../strategies-de-distribution.js"
import { personne, relation, societe } from "../testing/session-de-test.js"

/*
 * Cas de référence de « Sur toutes les années » (voir l'ADR 012), avec les règles réelles de 2025 et 2026 : le cas de
 * reserves.reference.test.ts, vu par le comparateur. Alice, célibataire, préside une SASU sans rémunération ; la
 * société facture 60 000 € en 2025 et rien en 2026. Sans frais de fonctionnement, pour rester sur les mêmes chiffres.
 *
 * - Tout distribuer chaque année : 49 250 € de dividendes en 2025 (bénéfice après IS de 10 750 €), rien en 2026.
 *   Net 2025 : 39 343,12 € ; prélèvements : IS 10 750 + IR 1 436 + prélèvements sociaux 8 471 = 20 657 €.
 * - Garder 50 % et distribuer la dernière année : 24 625 € en 2025, les 24 625 € de réserves en 2026.
 *   Net : 20 389,50 (2025) + 20 044,75 (2026), soit 20 390 + 20 045 = 40 435 € une fois chaque année arrondie ;
 *   prélèvements : 10 750 + 4 236 + 4 580 = 19 566 €.
 * - Lisser : 49 250 / 2 = 24 625 € chaque année, la même chose ici.
 * Garder puis distribuer rapporte 1 092 € de plus : l'impôt progressif ne porte jamais sur 49 250 € en une fois.
 */

const sansFrais = Object.fromEntries(["SASU", "EURL", "EI", "micro"].map(statut => [statut, { expertComptable: 0, banque: 0, logiciel: 0, assurance: 0, cfe: 0 }])) as FraisFonctionnement

function session(): SessionState {
  const en2025 = grilleVide()
  en2025[0].flows.push({ id: "ca", label: "Prestations", amount: 60000, entityId: "sasu", type: "ca_services" })
  return {
    name: "Stratégies",
    entities: [personne("alice"), societe("sasu")],
    relationships: [relation("alice", "sasu", "Président")],
    annees: [
      { annee: 2025, monthlyData: en2025 },
      { annee: 2026, monthlyData: grilleVide() }
    ]
  }
}

describe("stratégies de distribution d'une SASU sur 2025 et 2026 (règles réelles)", () => {
  const resultat = comparerStrategiesDeDistribution(session(), "sasu", { fraisFonctionnement: sansFrais })
  const sasu = resultat.statuts.find(s => s.statut === "SASU")!
  const strategie = (nom: string) => sasu.strategies.find(s => s.strategie === nom)!

  it("tout distribuer chaque année", () => {
    expect(strategie("toutDistribuer")).toMatchObject({ libelle: "Tout distribuer chaque année", netCumule: 39343, prelevementsCumules: 20657, reservesALaFin: 0 })
    expect(strategie("toutDistribuer").annees.map(a => a.dividendes)).toEqual([49250, 0])
  })

  it("garder 50 % et distribuer la dernière année", () => {
    expect(strategie("garderPuisDistribuer")).toMatchObject({ libelle: "Garder 50 % et distribuer la dernière année", netCumule: 40435, prelevementsCumules: 19566, reservesALaFin: 0, warnings: [] })
    expect(strategie("garderPuisDistribuer").annees).toEqual([
      { annee: 2025, dividendes: 24625, netApresImpots: 20390, totalPrelevements: 14986, reservesALaFin: 24625 },
      { annee: 2026, dividendes: 24625, netApresImpots: 20045, totalPrelevements: 4580, reservesALaFin: 0 }
    ])
  })

  it("lisser : 24 625 € chaque année", () => {
    expect(strategie("lisser").annees.map(a => a.dividendes)).toEqual([24625, 24625])
    expect(strategie("lisser").netCumule).toBe(40435)
  })

  it("désigne la meilleure, et compte les deux années", () => {
    expect(sasu.meilleure).toBe("garderPuisDistribuer")
    expect(resultat).toMatchObject({ annees: [2025, 2026], partMiseEnReserve: 0.5, notes: [] })
  })
})
