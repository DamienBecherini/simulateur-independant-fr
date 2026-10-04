// src/lib/contraste.test.ts

import { describe, expect, it } from "vitest"
import { CONTRASTE_TEXTE, couleurDeTexteSur, fondPourTexteBlanc, luminanceRelative, rapportDeContraste } from "./contraste"

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

describe("fondPourTexteBlanc", () => {
  it("garde une couleur assez sombre pour du texte blanc", () => {
    expect(fondPourTexteBlanc("#1e3a8a")).toBe("#1e3a8a")
    expect(fondPourTexteBlanc("#b91c1c")).toBe("#b91c1c")
  })

  it("assombrit une couleur vive juste assez pour atteindre 4,5:1 avec le blanc", () => {
    for (const couleur of ["#3b82f6", "#22c55e", "#f97316", "#f59e0b", "#ef4444", "#ffff00"]) {
      const fond = fondPourTexteBlanc(couleur)
      expect(fond).not.toBe(couleur)
      expect(rapportDeContraste(fond, "#ffffff")).toBeGreaterThanOrEqual(CONTRASTE_TEXTE)
    }
  })

  it("garde la teinte : seule la luminosité baisse", () => {
    // Bleu #3b82f6 (59, 130, 246) : les trois composantes baissent dans la même proportion.
    const [r, g, b] = [1, 3, 5].map(i => parseInt(fondPourTexteBlanc("#3b82f6").slice(i, i + 2), 16))
    expect(r / b).toBeCloseTo(59 / 246, 1)
    expect(g / b).toBeCloseTo(130 / 246, 1)
  })

  it("n'assombrit pas plus que nécessaire", () => {
    const fond = fondPourTexteBlanc("#3b82f6")
    expect(rapportDeContraste(fond, "#ffffff")).toBeLessThan(CONTRASTE_TEXTE + 0.5)
  })

  it("accepte un autre seuil, et laisse une couleur illisible telle quelle", () => {
    expect(fondPourTexteBlanc("#3b82f6", 3)).toBe("#3b82f6")
    expect(fondPourTexteBlanc("rouge")).toBe("rouge")
  })
})

describe("couleurDeTexteSur", () => {
  it("écrit en blanc sur un fond sombre, en foncé sur un fond clair", () => {
    expect(couleurDeTexteSur("#1d4ed8")).toBe("#ffffff")
    expect(couleurDeTexteSur("#facc15")).toBe("#0f172a")
    expect(couleurDeTexteSur("#22d3ee")).toBe("#0f172a")
  })

  it("garde le blanc si le fond est illisible", () => {
    expect(couleurDeTexteSur("rouge")).toBe("#ffffff")
  })
})
