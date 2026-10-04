// src/lib/contraste.test.ts

import { describe, expect, it } from "vitest"
import { couleurDeTexteSur, luminanceRelative, rapportDeContraste } from "./contraste"

describe("luminanceRelative", () => {
  it("va de 0 pour le noir à 1 pour le blanc, en notation courte ou longue", () => {
    expect(luminanceRelative("#000000")).toBe(0)
    expect(luminanceRelative("#fff")).toBe(1)
    expect(luminanceRelative("#FFFFFF")).toBe(1)
  })

  it("renvoie null pour une couleur illisible", () => {
    expect(luminanceRelative("bleu")).toBeNull()
    expect(luminanceRelative("#12345")).toBeNull()
  })
})

describe("rapportDeContraste", () => {
  it("vaut 21 entre le noir et le blanc, 1 entre deux couleurs identiques", () => {
    expect(rapportDeContraste("#000", "#fff")).toBe(21)
    expect(rapportDeContraste("#3b82f6", "#3b82f6")).toBe(1)
  })

  it("ne dépend pas de l'ordre des couleurs", () => {
    expect(rapportDeContraste("#ffffff", "#3b82f6")).toBeCloseTo(3.68, 2)
    expect(rapportDeContraste("#3b82f6", "#ffffff")).toBeCloseTo(3.68, 2)
  })

  it("renvoie null si une couleur est illisible", () => {
    expect(rapportDeContraste("#fff", "transparent")).toBeNull()
  })
})

describe("couleurDeTexteSur", () => {
  it("écrit en blanc sur un fond sombre", () => {
    expect(couleurDeTexteSur("#1e3a8a")).toBe("#ffffff")
    expect(couleurDeTexteSur("#b91c1c")).toBe("#ffffff")
  })

  it("écrit en sombre sur un fond clair, où le blanc n'atteint pas 4,5:1", () => {
    expect(couleurDeTexteSur("#f59e0b")).toBe("#0f172a")
    expect(couleurDeTexteSur("#22c55e")).toBe("#0f172a")
    expect(couleurDeTexteSur("#3b82f6")).toBe("#0f172a")
  })

  it("garde le blanc si le fond est illisible", () => {
    expect(couleurDeTexteSur("rouge")).toBe("#ffffff")
  })
})
