// src/lib/amount-utils.test.ts

import { describe, expect, it } from "vitest"
import { formatAmount, parseAmount } from "@/lib/amount-utils"

describe("parseAmount", () => {
  it("accepte la virgule ou le point comme séparateur décimal", () => {
    expect(parseAmount("1234,5")).toBe(1234.5)
    expect(parseAmount("1234.5")).toBe(1234.5)
    expect(parseAmount(",5")).toBe(0.5)
  })

  it("ignore les espaces de milliers et le symbole €", () => {
    expect(parseAmount("1 234,50 €")).toBe(1234.5)
    expect(parseAmount("12\u202f000")).toBe(12000)
  })

  it("accepte zéro", () => {
    expect(parseAmount("0")).toBe(0)
  })

  it("renvoie null pour une saisie vide, négative ou non numérique", () => {
    for (const saisie of ["", "   ", "-5", "abc", "12abc", "1,2,3", "1e3", ".", "1..2"]) {
      expect(parseAmount(saisie)).toBeNull()
    }
  })

  it("accepte un point final sans décimales, comme avant", () => {
    expect(parseAmount("12.")).toBe(12)
  })

  it("lit en temps linéaire une saisie très longue (expression sans retour arrière)", () => {
    // L'ancienne expression (\d+\.?\d*) essayait chaque découpage des chiffres avant d'échouer : quadratique.
    expect(parseAmount(`${"1".repeat(50_000)}x`)).toBeNull()
    expect(parseAmount(`${"1".repeat(50_000)}.${"2".repeat(50_000)}x`)).toBeNull()
  })
})

describe("formatAmount", () => {
  it("produit une saisie que parseAmount relit à l'identique", () => {
    for (const montant of [0, 5, 1234.5, 1000000, 0.07]) {
      expect(parseAmount(formatAmount(montant))).toBe(montant)
    }
  })

  it("utilise la virgule décimale", () => {
    expect(formatAmount(2.5)).toBe("2,5")
  })
})
