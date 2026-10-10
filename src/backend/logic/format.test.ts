// src/backend/logic/format.test.ts

import { describe, expect, it } from "vitest"
import { ecartSigne, euros, eurosEnTexteBrut, pourcent } from "./format.js"

/** Le séparateur de milliers de `toLocaleString("fr-FR")` est une espace insécable : on la ramène à une espace ordinaire. */
const espaces = (texte: string) => texte.replace(/\s/g, " ")

describe("mise en forme des montants", () => {
  it("arrondit à l'euro, avec le séparateur de milliers français", () => {
    expect(espaces(euros(1234567.4))).toBe("1 234 567 €")
    expect(espaces(euros(-2500))).toBe("-2 500 €")
    expect(euros(12.5)).toBe("13 €")
  })

  it("n'écrit jamais « -0 € »", () => {
    expect(euros(-0.2)).toBe("0 €")
    expect(euros(0)).toBe("0 €")
  })

  it("en texte brut, aucune espace insécable", () => {
    expect(eurosEnTexteBrut(1234567.4)).toBe("1 234 567 €")
    expect(eurosEnTexteBrut(9600)).toBe("9 600 €")
  })

  it("un écart porte son signe, un vrai signe moins pour une baisse", () => {
    expect(espaces(ecartSigne(1234))).toBe("+1 234 €")
    expect(espaces(ecartSigne(-850))).toBe("−850 €")
    expect(ecartSigne(0)).toBe("0 €")
  })
})

describe("mise en forme des taux", () => {
  it("en pourcentage, à deux décimales au plus", () => {
    expect(pourcent(0.256)).toBe("25,6 %")
    expect(pourcent(0.1)).toBe("10 %")
    expect(pourcent(0.12345)).toBe("12,35 %")
  })
})
