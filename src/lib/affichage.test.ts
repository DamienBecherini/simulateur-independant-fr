// src/lib/affichage.test.ts

import { describe, expect, it } from "vitest"
import { UserPreferencesSchema } from "@/types"
import { AFFICHAGE_PAR_DEFAUT, AFFICHAGES, affichageApplicable, avecPanneaux, avecResume, libelleDeLAffichage } from "./affichage"

describe("affichages de la bêta", () => {
  it("propose quatre affichages, l'original d'abord, puis A, C et B ; seul Trois vues est encore à venir", () => {
    expect(AFFICHAGES.map(a => a.valeur)).toEqual(["classique", "resume", "panneaux", "vues"])
    expect(AFFICHAGES.filter(a => a.disponible).map(a => a.valeur)).toEqual(["classique", "resume", "panneaux"])
    expect(AFFICHAGE_PAR_DEFAUT).toBe("classique")
  })

  it("l'affichage « Panneaux » reprend le résumé et le détail replié de l'affichage « Résumé »", () => {
    expect(AFFICHAGES.map(a => [a.valeur, avecResume(a.valeur), avecPanneaux(a.valeur)])).toEqual([
      ["classique", false, false],
      ["resume", true, false],
      ["panneaux", true, true],
      ["vues", false, false]
    ])
  })

  it("applique l'affichage des préférences s'il est disponible, l'affichage classique sinon", () => {
    expect(affichageApplicable("resume")).toBe("resume")
    expect(affichageApplicable("panneaux")).toBe("panneaux")
    expect(affichageApplicable("classique")).toBe("classique")
    expect(affichageApplicable("vues")).toBe("classique")
    expect(affichageApplicable(undefined)).toBe("classique")
    expect(affichageApplicable("inconnu")).toBe("classique")
  })

  it("nomme chaque affichage", () => {
    expect(libelleDeLAffichage("resume")).toBe("Résumé")
    expect(libelleDeLAffichage("panneaux")).toBe("Panneaux")
  })
})

describe("préférence d'affichage dans les préférences de l'utilisateur", () => {
  it("est retenue telle quelle", () => {
    expect(UserPreferencesSchema.parse({ slotOrder: ["a"], affichage: "resume" })).toEqual({ slotOrder: ["a"], affichage: "resume" })
  })

  it("est facultative, et une valeur inconnue est ignorée sans perdre les autres préférences", () => {
    expect(UserPreferencesSchema.parse({ slotOrder: [] }).affichage).toBeUndefined()
    const resultat = UserPreferencesSchema.safeParse({ slotOrder: ["a"], flowTypeColors: { salary: "#123456" }, affichage: "affichage-retire" })
    expect(resultat.success).toBe(true)
    expect(resultat.data).toEqual({ slotOrder: ["a"], flowTypeColors: { salary: "#123456" }, affichage: undefined })
  })
})
