// src/lib/preferences.test.ts

import { describe, expect, it } from "vitest"
import { NOMBRE_MAXIMAL_DE_SECTIONS, avecSauvegardeChargee, avecSectionOuverte, preferencesSynchronisees } from "./preferences"
import type { SaveSlot, UserPreferences } from "@/types"

const sauvegarde = (id: string): SaveSlot => ({ id, name: id, lastModified: 1, entities: [], relationships: [], annees: [] })

describe("preferencesSynchronisees", () => {
  it("retire de l'ordre les sauvegardes disparues et place en tête celles qui y manquaient", () => {
    expect(preferencesSynchronisees({ slotOrder: ["fantome", "b", "a"] }, [sauvegarde("a"), sauvegarde("b"), sauvegarde("c")])).toEqual({ slotOrder: ["c", "b", "a"] })
  })

  it("garde la sauvegarde chargée si elle existe toujours", () => {
    expect(preferencesSynchronisees({ slotOrder: ["a"], loadedSlotId: "a", zoom: 1.2 }, [sauvegarde("a")])).toEqual({ slotOrder: ["a"], loadedSlotId: "a", zoom: 1.2 })
  })

  it("oublie la sauvegarde chargée qui n'existe plus (supprimée, fichier des sauvegardes remplacé)", () => {
    expect(preferencesSynchronisees({ slotOrder: ["a"], loadedSlotId: "disparue" }, [sauvegarde("a")])).toEqual({ slotOrder: ["a"] })
  })
})

describe("avecSauvegardeChargee", () => {
  it("retient la sauvegarde chargée, ou l'oublie", () => {
    const chargee = avecSauvegardeChargee({ slotOrder: [] }, "a")
    expect(chargee).toEqual({ slotOrder: [], loadedSlotId: "a" })
    expect(avecSauvegardeChargee(chargee, null)).toEqual({ slotOrder: [] })
  })
})

describe("avecSectionOuverte", () => {
  it("retient l'état d'une section, ouverte comme fermée", () => {
    const ouverte = avecSectionOuverte({ slotOrder: [] }, "legende", true)
    expect(ouverte.sectionsOuvertes).toEqual({ legende: true })
    expect(avecSectionOuverte(ouverte, "detail", false).sectionsOuvertes).toEqual({ legende: true, detail: false })
  })

  it("rend les mêmes préférences si l'état ne change pas", () => {
    const preferences = { slotOrder: [], sectionsOuvertes: { legende: true } }
    expect(avecSectionOuverte(preferences, "legende", true)).toBe(preferences)
  })

  it("ne retient pas un identifiant trop long", () => {
    const preferences = { slotOrder: [] }
    expect(avecSectionOuverte(preferences, "x".repeat(201), true)).toBe(preferences)
  })

  it("oublie les sections les plus anciennes au-delà du nombre maximal", () => {
    let preferences: UserPreferences = { slotOrder: [] }
    for (let i = 0; i < NOMBRE_MAXIMAL_DE_SECTIONS + 5; i++) preferences = avecSectionOuverte(preferences, `section-${i}`, i % 2 === 0)
    // Les sections 0 à 4 sont oubliées ; la 5, la plus ancienne retenue, est rebasculée et repasse en dernier.
    expect(preferences.sectionsOuvertes).not.toHaveProperty("section-4")
    preferences = avecSectionOuverte(preferences, "section-5", true)
    const ids = Object.keys(preferences.sectionsOuvertes ?? {})
    expect(ids).toHaveLength(NOMBRE_MAXIMAL_DE_SECTIONS)
    expect(ids[0]).toBe("section-6")
    expect(ids[ids.length - 1]).toBe("section-5")
  })
})
