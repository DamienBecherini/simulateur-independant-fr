// src/backend/logic/calculs-du-pont.test.ts
// Les calculs communs aux deux ponts (Electron et démo web) : ce qui arrive de l'interface est revalidé avant calcul.

import { afterEach, describe, expect, it, vi } from "vitest"
import { grilleVide, SessionStateSchema, type SessionState, type StatutSociete } from "../../types.js"
import { calculsDuPont, sessionRevalidee } from "./calculs-du-pont.js"
import { EntreeIpcInvalide } from "./entrees-ipc.js"
import { comparerStatutsDeLAnnee, optimiserRemunerationDeLAnnee, simulerLesAnnees } from "./simulation-pluriannuelle.js"
import { comparerStrategiesDeDistribution } from "./strategies-de-distribution.js"
import { personne, relation, societe } from "./testing/session-de-test.js"

function grilleAvecCA(entityId: string, montant: number) {
  const grille = grilleVide()
  grille[0].flows.push({ id: `${entityId}-${montant}`, label: "CA", amount: montant, entityId, type: "ca_services" })
  return grille
}

/** Alice, présidente d'une SASU : 60 000 € de CA en 2026. */
const sasu: SessionState = {
  name: "SASU",
  entities: [personne("alice"), societe("s1")],
  relationships: [relation("alice", "s1", "Président")],
  annees: [{ annee: 2026, monthlyData: grilleAvecCA("s1", 60000) }]
}
const options = { activityId: "s1", remunerationNette: 0, repartition: { mode: "dividendes" as const, partDistribuee: 1 }, partBncPrestations: 1 }

afterEach(() => vi.restoreAllMocks())

describe("sessionRevalidee", () => {
  it("rend une session valide telle que le schéma la lit", () => {
    expect(sessionRevalidee(sasu, "test")).toEqual(SessionStateSchema.parse(sasu))
  })

  it("remplace une session invalide par la session par défaut, et le signale", () => {
    const avertir = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    expect(sessionRevalidee({ name: 42 }, "simulerLesAnnees")).toEqual(SessionStateSchema.parse({}))
    expect(avertir).toHaveBeenCalledWith("simulerLesAnnees : session invalide, utilisation des valeurs par défaut du schéma", expect.anything())
  })
})

describe("calculsDuPont", () => {
  it("calcule comme le moteur sur la session revalidée", () => {
    const lue = SessionStateSchema.parse(sasu)
    expect(calculsDuPont.simulerLesAnnees(sasu)).toEqual(simulerLesAnnees(lue))
    expect(calculsDuPont.compareStatuts(sasu, options, 2026)).toEqual(comparerStatutsDeLAnnee(lue, options, 2026))
    expect(calculsDuPont.optimiserRemuneration(sasu, options, "EURL", 2026)).toEqual(optimiserRemunerationDeLAnnee(lue, options, "EURL", 2026))
    expect(calculsDuPont.comparerStrategies(sasu, "s1")).toEqual(comparerStrategiesDeDistribution(lue, "s1", undefined))
  })

  it("optimise comme une SASU un statut qui n'est pas une société à l'IS", () => {
    const lue = SessionStateSchema.parse(sasu)
    expect(calculsDuPont.optimiserRemuneration(sasu, options, "EI" as StatutSociete, 2026)).toEqual(optimiserRemunerationDeLAnnee(lue, options, "SASU", 2026))
  })

  it("prend les réglages enregistrés de l'activité", () => {
    const avecReglages = { ...sasu, comparateur: { reglagesParActivite: { s1: { partMiseEnReserve: 0.5 } } } }
    const lue = SessionStateSchema.parse(avecReglages)
    expect(calculsDuPont.comparerStrategies(avecReglages, "s1")).toEqual(comparerStrategiesDeDistribution(lue, "s1", lue.comparateur?.reglagesParActivite.s1))
  })

  it("refuse des réglages, une année ou une activité invalides, dans les deux ponts", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const horsBornes = { ...options, partBncPrestations: 2 }
    expect(() => calculsDuPont.compareStatuts(sasu, horsBornes, 2026)).toThrow(EntreeIpcInvalide)
    expect(() => calculsDuPont.compareStatuts(sasu, options, 2026.5)).toThrow("compareStatuts : paramètres invalides.")
    expect(() => calculsDuPont.optimiserRemuneration(sasu, horsBornes, "SASU", 2026)).toThrow(EntreeIpcInvalide)
    expect(() => calculsDuPont.optimiserRemuneration(sasu, options, "SASU", "2026" as unknown as number)).toThrow(EntreeIpcInvalide)
    expect(() => calculsDuPont.comparerStrategies(sasu, 42 as unknown as string)).toThrow("comparerStrategies : paramètres invalides.")
  })
})
