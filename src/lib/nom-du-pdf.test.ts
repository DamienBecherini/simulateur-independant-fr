// src/lib/nom-du-pdf.test.ts

import { describe, expect, it } from "vitest"
import { nomDuPdf } from "./nom-du-pdf"

describe("nomDuPdf", () => {
  it("met le nom de la simulation en minuscules, sans accents ni ponctuation, suivi de l'année", () => {
    expect(nomDuPdf("Famille Martin", 2026)).toBe("famille-martin-2026.pdf")
    expect(nomDuPdf("  Société « Éléphant » & Cie !", 2026)).toBe("societe-elephant-cie-2026.pdf")
  })

  it("ne répète pas l'année quand le nom la contient déjà", () => {
    expect(nomDuPdf("Famille Martin, simulation 2026", 2026)).toBe("famille-martin-simulation-2026.pdf")
    expect(nomDuPdf("2026 : scénario prudent", 2026)).toBe("2026-scenario-prudent.pdf")
  })

  it("ajoute l'année quand le nom ne contient qu'un nombre qui lui ressemble", () => {
    expect(nomDuPdf("Projet 20265", 2026)).toBe("projet-20265-2026.pdf")
    expect(nomDuPdf("Simulation 2025", 2026)).toBe("simulation-2025-2026.pdf")
  })

  it("se rabat sur « simulation » quand le nom ne contient aucune lettre ni aucun chiffre", () => {
    expect(nomDuPdf("", 2026)).toBe("simulation-2026.pdf")
    expect(nomDuPdf(" ★ — ", 2026)).toBe("simulation-2026.pdf")
  })
})
