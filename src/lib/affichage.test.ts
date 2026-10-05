// src/lib/affichage.test.ts

import { describe, expect, it } from "vitest"
import { UserPreferencesSchema } from "@/types"
import { AFFICHAGE_PAR_DEFAUT, AFFICHAGES, affichageApplicable, avecResume, avecVues, libelleDeLAffichage } from "./affichage"

describe("affichages de la bêta", () => {
  it("propose trois affichages, « Résumé » d'abord, qui est l'affichage par défaut", () => {
    expect(AFFICHAGES.map(a => a.valeur)).toEqual(["resume", "classique", "vues"])
    expect(AFFICHAGE_PAR_DEFAUT).toBe("resume")
  })

  it("l'affichage « Trois vues » reprend le résumé et le détail replié de l'affichage « Résumé »", () => {
    expect(AFFICHAGES.map(a => [a.valeur, avecResume(a.valeur), avecVues(a.valeur)])).toEqual([
      ["resume", true, false],
      ["classique", false, false],
      ["vues", true, true]
    ])
  })

  it("applique l'affichage des préférences s'il existe encore, l'affichage « Résumé » sinon", () => {
    expect(affichageApplicable("resume")).toBe("resume")
    expect(affichageApplicable("classique")).toBe("classique")
    expect(affichageApplicable("vues")).toBe("vues")
    expect(affichageApplicable(undefined)).toBe("resume")
    expect(affichageApplicable("inconnu")).toBe("resume")
    // L'affichage « Panneaux », retiré après l'essai, laisse place à l'affichage par défaut.
    expect(affichageApplicable("panneaux")).toBe("resume")
  })

  it("nomme chaque affichage", () => {
    expect(libelleDeLAffichage("resume")).toBe("Résumé")
    expect(libelleDeLAffichage("classique")).toBe("Classique")
    expect(libelleDeLAffichage("vues")).toBe("Trois vues")
  })
})

describe("préférence d'affichage dans les préférences de l'utilisateur", () => {
  it("est retenue telle quelle", () => {
    expect(UserPreferencesSchema.parse({ slotOrder: ["a"], affichage: "classique" })).toEqual({ slotOrder: ["a"], affichage: "classique" })
  })

  it("est facultative, et une valeur inconnue est ignorée sans perdre les autres préférences", () => {
    expect(UserPreferencesSchema.parse({ slotOrder: [] }).affichage).toBeUndefined()
    const resultat = UserPreferencesSchema.safeParse({ slotOrder: ["a"], flowTypeColors: { salary: "#123456" }, affichage: "affichage-retire" })
    expect(resultat.success).toBe(true)
    expect(resultat.data).toEqual({ slotOrder: ["a"], flowTypeColors: { salary: "#123456" }, affichage: undefined })
  })

  it("l'affichage « Panneaux » retenu par une version précédente est écarté seul, les autres préférences restent", () => {
    const resultat = UserPreferencesSchema.parse({ slotOrder: ["a", "b"], zoom: 1.2, affichage: "panneaux" })
    expect(resultat).toEqual({ slotOrder: ["a", "b"], zoom: 1.2, affichage: undefined })
    expect(affichageApplicable(resultat.affichage)).toBe("resume")
  })
})
