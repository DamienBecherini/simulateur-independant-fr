// src/backend/logic/fichiers-de-donnees.test.ts

import { describe, expect, it } from "vitest"
import { avecVersionDeLApplication, contenuDuFichier, lireLesPreferences, lireUneSimulationImportee, preferencesParDefaut, preferencesValides } from "./fichiers-de-donnees.js"
import { FORMAT_VERSION_ACTUEL } from "./migrations.js"

const grille = () => Array.from({ length: 12 }, (_, month) => ({ month, flows: [] }))
const simulation = { name: "Essai", entities: [], relationships: [], annees: [{ annee: 2026, monthlyData: grille() }] }

describe("version de l'application dans les fichiers", () => {
  it("marque un fichier de la version qui l'écrit, en remplaçant celle qu'il portait", () => {
    expect(avecVersionDeLApplication({ appVersion: "0.8.0", name: "Essai" }, "0.9.0")).toEqual({ appVersion: "0.9.0", name: "Essai" })
    expect(JSON.parse(contenuDuFichier(simulation, "0.9.0"))).toMatchObject({ appVersion: "0.9.0", formatVersion: FORMAT_VERSION_ACTUEL })
  })

  it("laisse le fichier tel quel sans version donnée", () => {
    const donnees = { appVersion: "0.8.0" }
    expect(avecVersionDeLApplication(donnees)).toBe(donnees)
    expect(JSON.parse(contenuDuFichier(simulation))).not.toHaveProperty("appVersion")
  })

  it("garde à l'import la version qui a écrit le fichier, et n'en invente pas", () => {
    expect(lireUneSimulationImportee(contenuDuFichier(simulation, "0.8.0")).data.appVersion).toBe("0.8.0")
    expect(lireUneSimulationImportee(contenuDuFichier(simulation)).data).not.toHaveProperty("appVersion")
  })
})

describe("préférences", () => {
  it("gardent chaque champ valide", () => {
    const preferences = { slotOrder: ["a"], flowTypeColors: { salary: "#123456" }, affichage: "vues", loadedSlotId: "a", zoom: 1.2, sectionsOuvertes: { legende: true, detail: false } }
    expect(preferencesValides(preferences)).toEqual(preferences)
  })

  it("écartent un champ invalide seul, sans perdre les autres", () => {
    const abimees = { slotOrder: [1, 2], flowTypeColors: "rouge", affichage: "inconnu", loadedSlotId: 42, zoom: 3, sectionsOuvertes: { legende: "oui" } }
    expect(preferencesValides({ ...abimees, loadedSlotId: "a" })).toEqual({ slotOrder: [], loadedSlotId: "a" })
    expect(preferencesValides(abimees)).toEqual({ slotOrder: [] })
  })

  it("écartent un identifiant de section trop long", () => {
    expect(preferencesValides({ slotOrder: [], sectionsOuvertes: { ["x".repeat(201)]: true } })).toEqual({ slotOrder: [] })
  })

  it("reviennent aux valeurs par défaut si le fichier ne contient pas d'objet", () => {
    for (const brut of [null, [1, 2], "texte", 3]) expect(preferencesValides(brut)).toEqual(preferencesParDefaut())
  })

  it("se lisent depuis le texte du fichier, qui doit être du JSON", () => {
    expect(lireLesPreferences('{"slotOrder":["a"],"zoom":0.8}')).toEqual({ slotOrder: ["a"], zoom: 0.8 })
    expect(() => lireLesPreferences("{pas du json")).toThrow()
  })
})
