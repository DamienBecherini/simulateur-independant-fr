// src/backend/logic/outils/catalogue.test.ts
// Le catalogue des outils pour les clients d'IA : noms stables, descriptions en français, schémas JSON valides.
// Les outils eux-mêmes sont testés sur la simulation d'exemple (src/web/outils-ia-*.test.ts).

import { describe, expect, it } from "vitest"
import { z } from "zod"
import { catalogueDesOutils, OUTILS } from "./catalogue.js"
import { echantillon } from "./comparaison.js"
import { empreinte, enumerer } from "./commun.js"
import { texteSansControle } from "./limites.js"
import { libelleDesMois } from "./propositions.js"

describe("catalogue des outils", () => {
  it("garde des noms stables, que les clients d'IA et les conversations enregistrées reprennent", () => {
    expect(catalogueDesOutils().map(o => o.nom)).toEqual([
      "decrire_simulation",
      "lister_flux",
      "simuler",
      "synthese_des_annees",
      "expliquer_resultat",
      "comparer_statuts",
      "optimiser_remuneration",
      "regles_de_l_annee",
      "proposer_flux",
      "proposer_acteur",
      "proposer_relation",
      "proposer_modification",
      "proposer_suppression",
      "proposer_reglages_comparateur",
      "rafraichir_proposition",
      "appliquer_proposition"
    ])
  })

  it("décrit chaque outil en français, avec un titre, et dit lesquels ne modifient rien", () => {
    for (const outil of catalogueDesOutils()) {
      expect(outil.nom).toMatch(/^[a-z_]{1,64}$/)
      expect(outil.titre.length).toBeGreaterThan(5)
      expect(outil.description.length).toBeGreaterThan(150)
      expect(outil.description).toMatch(/[éèàêç]/)
      expect(outil.description).not.toMatch(/\b(the|returns|this tool)\b/i)
    }
    expect(catalogueDesOutils().filter(o => o.lecture).map(o => o.nom)).toHaveLength(8)
    expect(catalogueDesOutils().filter(o => !o.lecture).every(o => o.nom.startsWith("proposer_") || o.nom === "rafraichir_proposition" || o.nom === "appliquer_proposition")).toBe(true)
  })

  it("génère depuis Zod des schémas JSON d'objets, sérialisables, de taille raisonnable", () => {
    const catalogue = catalogueDesOutils()
    for (const outil of catalogue) {
      expect(outil.inputSchema).toMatchObject({ type: "object", additionalProperties: false })
      expect(outil.outputSchema).toMatchObject({ type: "object" })
      expect(outil.inputSchema).not.toHaveProperty("$schema")
      expect(JSON.parse(JSON.stringify(outil.inputSchema))).toEqual(outil.inputSchema)
    }
    // Le catalogue entier est envoyé au modèle à chaque échange : il doit rester léger.
    expect(JSON.stringify(catalogue.map(({ nom, description, inputSchema }) => ({ nom, description, inputSchema }))).length).toBeLessThan(40_000)
  })

  it("décrit les paramètres : unités, mois de 1 à 12, valeurs possibles", () => {
    const schemaDe = (nom: string) => JSON.stringify(catalogueDesOutils().find(o => o.nom === nom)!.inputSchema)
    expect(schemaDe("proposer_flux")).toContain("de 1 (janvier) à 12 (décembre)")
    expect(schemaDe("proposer_flux")).toContain('"maxItems":200')
    expect(schemaDe("proposer_flux")).toContain('"maxLength":80')
    expect(schemaDe("proposer_flux")).toContain('"maximum":10000000')
    expect(schemaDe("optimiser_remuneration")).toContain('"enum":["SASU","EURL"]')
  })

  it("valide les paramètres avec les mêmes schémas que ceux publiés", () => {
    for (const outil of OUTILS) expect(outil.parametres).toBeInstanceOf(z.ZodType)
  })
})

describe("utilitaires des outils", () => {
  it("refuse les caractères de contrôle et de mise en forme, accepte les accents et les espaces insécables", () => {
    expect(texteSansControle("Loyer de l'été 2026 – n° 3")).toBe(true)
    expect(texteSansControle("1 000 €")).toBe(true)
    // Saut de ligne, tabulation, caractère nul, NEL, séparateur de ligne, inversions de sens d'écriture.
    for (const code of [0x0a, 0x09, 0x00, 0x85, 0x2028, 0x202e, 0x2066]) expect(texteSansControle(`a${String.fromCodePoint(code)}b`)).toBe(false)
  })

  it("prend quelques points régulièrement espacés d'une courbe", () => {
    expect(echantillon([1, 2, 3], 11)).toEqual([1, 2, 3])
    expect(echantillon([...Array(101).keys()], 11)).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100])
  })

  it("calcule une empreinte stable, sensible au contenu et pas à l'ordre des clés", () => {
    expect(empreinte({ a: 1, b: [1, 2] })).toBe(empreinte({ b: [1, 2], a: 1 }))
    expect(empreinte({ a: 1, b: undefined })).toBe(empreinte({ a: 1 }))
    expect(empreinte({ a: 1 })).not.toBe(empreinte({ a: 2 }))
    expect(empreinte([1, 2])).not.toBe(empreinte([2, 1]))
    expect(empreinte(null)).toMatch(/^[0-9a-f]{16}$/)
  })

  it("énumère et nomme les mois en français", () => {
    expect(enumerer([])).toBe("")
    expect(enumerer(["Président", "Gérant"], "ou")).toBe("Président ou Gérant")
    expect(libelleDesMois([3, 1])).toBe("janvier et mars")
    expect(libelleDesMois(undefined)).toBe("toute l'année")
  })
})
