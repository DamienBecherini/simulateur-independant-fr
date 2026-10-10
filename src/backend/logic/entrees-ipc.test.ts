// src/backend/logic/entrees-ipc.test.ts
// Paramètres des canaux IPC : ceux que l'interface envoie passent, le reste est refusé avant tout usage.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { defaultFraisFonctionnement } from "./options-du-comparateur.js"
import { AnneeSchema, ComparaisonOptionsSchema, EntreeIpcInvalide, FichierTexteAEnregistrerSchema, FichierTexteAOuvrirSchema, OptionsDesSauvegardesSchema, SimulationRecueSchema, entreeValide } from "./entrees-ipc.js"

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

const options = { activityId: "a", remunerationNette: 30000, repartition: { mode: "meilleurNet", partDistribuee: 1, avecRetraite: true }, partBncPrestations: 0.5, fraisFonctionnement: defaultFraisFonctionnement() }

describe("réglages du comparateur et de l'optimiseur", () => {
  it("acceptent ceux de l'interface", () => {
    expect(entreeValide(ComparaisonOptionsSchema, options, "compareStatuts")).toEqual(options)
    const sansFrais = { activityId: "", remunerationNette: 0, repartition: { mode: "dividendes", partDistribuee: 1 }, partBncPrestations: 1 }
    expect(entreeValide(ComparaisonOptionsSchema, sansFrais, "compareStatuts")).toEqual(sansFrais)
  })

  it("retirent un champ inconnu", () => {
    expect(entreeValide(ComparaisonOptionsSchema, { ...options, inconnu: true }, "compareStatuts")).toEqual(options)
  })

  it.each([
    ["absents", undefined],
    ["sans activité", { ...options, activityId: undefined }],
    ["avec une rémunération qui n'est pas un nombre", { ...options, remunerationNette: "30000" }],
    ["avec une rémunération infinie", { ...options, remunerationNette: Infinity }],
    ["avec un mode de répartition inconnu", { ...options, repartition: { mode: "tout", partDistribuee: 1 } }],
    ["avec une part BNC hors de 0 à 1", { ...options, partBncPrestations: 2 }],
    ["avec des frais négatifs", { ...options, fraisFonctionnement: { ...options.fraisFonctionnement, SASU: { ...options.fraisFonctionnement.SASU, banque: -1 } } }]
  ])("sont refusés %s", (_cas, valeur) => {
    expect(() => entreeValide(ComparaisonOptionsSchema, valeur, "compareStatuts")).toThrow(EntreeIpcInvalide)
    expect(() => entreeValide(ComparaisonOptionsSchema, valeur, "compareStatuts")).toThrow("compareStatuts : paramètres invalides.")
  })
})

describe("année demandée", () => {
  it("est un entier", () => {
    expect(entreeValide(AnneeSchema, 2026, "compareStatuts")).toBe(2026)
    for (const annee of ["2026", 2026.5, NaN, null]) expect(() => entreeValide(AnneeSchema, annee, "compareStatuts")).toThrow(EntreeIpcInvalide)
  })
})

describe("fichiers texte", () => {
  it("n'acceptent que les formats prévus", () => {
    for (const format of ["csv", "markdown", "json"]) {
      expect(entreeValide(FichierTexteAEnregistrerSchema, { defaultName: "export", content: "a;b", format }, "saveTextFile").format).toBe(format)
      expect(entreeValide(FichierTexteAOuvrirSchema, { title: "Importer", format }, "openTextFile").format).toBe(format)
    }
    expect(() => entreeValide(FichierTexteAEnregistrerSchema, { defaultName: "export", content: "a", format: "exe" }, "saveTextFile")).toThrow(EntreeIpcInvalide)
    expect(() => entreeValide(FichierTexteAOuvrirSchema, { title: "Importer", format: "toString" }, "openTextFile")).toThrow(EntreeIpcInvalide)
  })

  it("exigent un nom et un contenu textes", () => {
    expect(() => entreeValide(FichierTexteAEnregistrerSchema, { defaultName: 1, content: "a", format: "csv" }, "saveTextFile")).toThrow(EntreeIpcInvalide)
    expect(() => entreeValide(FichierTexteAEnregistrerSchema, { defaultName: "a", content: { texte: "a" }, format: "csv" }, "saveTextFile")).toThrow(EntreeIpcInvalide)
    expect(() => entreeValide(FichierTexteAOuvrirSchema, null, "openTextFile")).toThrow(EntreeIpcInvalide)
  })
})

describe("simulation reçue (session, export)", () => {
  const simulation = { name: "Essai", entities: [], relationships: [], annees: [{ annee: 2026 }], simulation: null }

  it("a ses acteurs, ses relations et au moins une année ; le reste est vérifié à part", () => {
    expect(SimulationRecueSchema.safeParse(simulation).success).toBe(true)
    for (const valeur of [null, "simulation", { ...simulation, annees: [] }, { ...simulation, entities: undefined }, { ...simulation, relationships: {} }]) {
      expect(SimulationRecueSchema.safeParse(valeur).success).toBe(false)
    }
  })
})

describe("options des sauvegardes", () => {
  it("sont facultatives, et `silencieux` est un booléen", () => {
    expect(entreeValide(OptionsDesSauvegardesSchema, undefined, "saveSlots")).toBeUndefined()
    expect(entreeValide(OptionsDesSauvegardesSchema, { silencieux: true }, "saveSlots")).toEqual({ silencieux: true })
    expect(() => entreeValide(OptionsDesSauvegardesSchema, { silencieux: "oui" }, "saveSlots")).toThrow(EntreeIpcInvalide)
  })
})
