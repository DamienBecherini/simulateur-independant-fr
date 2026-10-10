// src/backend/logic/format.test.ts

import { describe, expect, it } from "vitest"
import { ecartSigne, ESPACE_INSECABLE, euros, eurosEnTexteBrut, pourcent, pourcentDeNombre } from "./format.js"

/** Le séparateur de milliers de `toLocaleString("fr-FR")` est une espace insécable : on la ramène à une espace ordinaire. */
const espaces = (texte: string) => texte.replace(/\s/g, " ")

describe("mise en forme des montants", () => {
  it("arrondit à l'euro, avec le séparateur de milliers français", () => {
    expect(espaces(euros(1234567.4))).toBe("1 234 567 €")
    expect(espaces(euros(-2500))).toBe("-2 500 €")
    expect(espaces(euros(12.5))).toBe("13 €")
  })

  it("n'écrit jamais « -0 € »", () => {
    expect(espaces(euros(-0.2))).toBe("0 €")
    expect(espaces(euros(0))).toBe("0 €")
  })

  it("en texte brut, aucune espace insécable", () => {
    expect(eurosEnTexteBrut(1234567.4)).toBe("1 234 567 €")
    expect(eurosEnTexteBrut(9600)).toBe("9 600 €")
  })

  it("un écart porte son signe, un vrai signe moins pour une baisse", () => {
    expect(espaces(ecartSigne(1234))).toBe("+1 234 €")
    expect(espaces(ecartSigne(-850))).toBe("−850 €")
    expect(espaces(ecartSigne(0))).toBe("0 €")
  })
})

describe("mise en forme des taux", () => {
  it("en pourcentage, à deux décimales au plus", () => {
    expect(espaces(pourcent(0.256))).toBe("25,6 %")
    expect(espaces(pourcent(0.1))).toBe("10 %")
    expect(espaces(pourcent(0.12345))).toBe("12,35 %")
    expect(espaces(pourcentDeNombre(71))).toBe("71 %")
    expect(espaces(pourcentDeNombre(23.25, 1))).toBe("23,3 %")
  })
})

describe("espace insécable avant « € » et « % »", () => {
  it("le signe ne peut pas passer seul à la ligne : l'espace est insécable", () => {
    expect(euros(1500)).toMatch(new RegExp(`${ESPACE_INSECABLE}€$`))
    expect(ecartSigne(-850)).toContain(`${ESPACE_INSECABLE}€`)
    expect(pourcent(0.71)).toBe(`71${ESPACE_INSECABLE}%`)
    expect(pourcentDeNombre(80)).toBe(`80${ESPACE_INSECABLE}%`)
  })

  it("la même espace que `Intl.NumberFormat` en français", () => {
    expect(new Intl.NumberFormat("fr-FR", { style: "percent" }).format(0.71)).toBe(pourcent(0.71))
    expect(new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(15)).toBe(euros(15))
  })

  it("en texte brut, plus aucune espace insécable ni fine", () => {
    expect(eurosEnTexteBrut(1500)).not.toMatch(/[\u00A0\u202F]/)
  })
})
