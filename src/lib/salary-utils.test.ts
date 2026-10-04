// src/lib/salary-utils.test.ts

import { describe, expect, it } from "vitest"
import { DEFAULT_NET_RATIO, formatPercent, grossFromNet, netFromGross, netRatio, parsePercent } from "@/lib/salary-utils"

describe("conversion brut / net", () => {
  it("calcule le net à partir du brut et du ratio, au centime", () => {
    expect(netFromGross(3000, 0.78)).toBe(2340)
    expect(netFromGross(2512.37, 0.785)).toBe(1972.21)
  })

  it("calcule le brut à partir du net et du ratio, au centime", () => {
    expect(grossFromNet(2340, 0.78)).toBe(3000)
    expect(grossFromNet(2000, 0.78)).toBe(2564.1)
  })

  it("propose un ratio par défaut plausible", () => {
    expect(DEFAULT_NET_RATIO).toBeGreaterThan(0.7)
    expect(DEFAULT_NET_RATIO).toBeLessThan(0.85)
  })
})

describe("netRatio", () => {
  it("donne le ratio net / brut", () => {
    expect(netRatio(2340, 3000)).toBeCloseTo(0.78)
  })

  it("est indéfini sans brut exploitable", () => {
    expect(netRatio(2340, undefined)).toBeNull()
    expect(netRatio(2340, 0)).toBeNull()
  })
})

describe("parsePercent", () => {
  it("accepte un nombre, une virgule décimale et le signe %", () => {
    expect(parsePercent("78")).toBeCloseTo(0.78)
    expect(parsePercent("78,5")).toBeCloseTo(0.785)
    expect(parsePercent(" 78.5 % ")).toBeCloseTo(0.785)
    expect(parsePercent("100")).toBe(1)
  })

  it("refuse une saisie vide, non numérique ou hors de ]0 ; 100]", () => {
    for (const saisie of ["", "abc", "0", "-5", "101", "7 8 a"]) {
      expect(parsePercent(saisie)).toBeNull()
    }
  })
})

describe("formatPercent", () => {
  it("affiche au plus une décimale, avec une virgule", () => {
    expect(formatPercent(0.78)).toBe("78")
    expect(formatPercent(0.7851)).toBe("78,5")
  })

  it("produit une saisie que parsePercent relit", () => {
    expect(parsePercent(formatPercent(0.785))).toBeCloseTo(0.785)
  })
})
