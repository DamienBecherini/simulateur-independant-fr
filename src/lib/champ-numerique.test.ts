// src/lib/champ-numerique.test.ts

import { describe, expect, it } from "vitest"
import { pasDuChamp, valeurApresUnPas } from "./champ-numerique"

describe("pasDuChamp", () => {
  it("prend le pas de l'attribut step quand c'est un nombre positif", () => {
    expect(pasDuChamp("50", 1)).toBe(50)
    expect(pasDuChamp(0.5, 1)).toBe(0.5)
  })

  it("prend le pas par défaut pour « any », rien ou un pas nul", () => {
    expect(pasDuChamp("any", 10)).toBe(10)
    expect(pasDuChamp(undefined, 1)).toBe(1)
    expect(pasDuChamp("0", 5)).toBe(5)
  })
})

describe("valeurApresUnPas", () => {
  it("ajoute ou retire un pas", () => {
    expect(valeurApresUnPas(2000, 50, 1)).toBe(2050)
    expect(valeurApresUnPas(2000, 50, -1)).toBe(1950)
  })

  it("ne laisse pas de décimales parasites", () => {
    expect(valeurApresUnPas(0.1, 0.2, 1)).toBe(0.3)
    expect(valeurApresUnPas(1.5, 0.5, 1)).toBe(2)
  })

  it("respecte le minimum et le maximum", () => {
    expect(valeurApresUnPas(20, 50, -1, 0)).toBe(0)
    expect(valeurApresUnPas(360, 10, 1, 0, 366)).toBe(366)
  })

  it("part de zéro quand le champ est vide", () => {
    expect(valeurApresUnPas(Number.NaN, 100, 1)).toBe(100)
  })
})
