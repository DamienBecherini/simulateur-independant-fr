// src/lib/salary-utils.test.ts

import { describe, expect, it } from "vitest"
import { brutPourUnNet, calculerCotisationsSalarie } from "@/backend/logic/cotisationsSalarie"
import { reglesPubliees } from "@/backend/logic/regles"
import { reglesDeTest } from "@/backend/logic/testing/regles-de-test"
import { brutCalcule, formatPercent, grossFromNet, netCalcule, netFromGross, netRatio, parsePercent } from "@/lib/salary-utils"

describe("conversion brut / net", () => {
  it("calcule le net à partir du brut et du ratio, au centime", () => {
    expect(netFromGross(3000, 0.78)).toBe(2340)
    expect(netFromGross(2512.37, 0.785)).toBe(1972.21)
  })

  it("calcule le brut à partir du net et du ratio, au centime", () => {
    expect(grossFromNet(2340, 0.78)).toBe(3000)
    expect(grossFromNet(2000, 0.78)).toBe(2564.1)
  })
})

describe("brut et net calculés avec les cotisations de l'année", () => {
  it("passe par le bulletin annuel du régime général, douze mois identiques", () => {
    // Règles de test : sous le plafond, 10 % de cotisations salariales et 9 % de CSG-CRDS, soit un net de 81 % du brut.
    expect(brutCalcule(810, reglesDeTest)).toBe(1000)
    expect(netCalcule(1000, reglesDeTest)).toBe(810)
  })

  it("prend les cotisations de l'année des règles", () => {
    const regles2026 = reglesPubliees(2026)
    expect(brutCalcule(2000, regles2026)).toBe(Math.round((brutPourUnNet(24000, "salarie", regles2026.regimeGeneral) / 12) * 100) / 100)
    expect(netCalcule(3000, regles2026)).toBe(Math.round((calculerCotisationsSalarie(36000, "salarie", regles2026.regimeGeneral).net / 12) * 100) / 100)
    // Ordre de grandeur d'un salarié non cadre : environ 78 % du brut en net.
    expect(netCalcule(3000, regles2026) / 3000).toBeGreaterThan(0.75)
    expect(netCalcule(3000, regles2026) / 3000).toBeLessThan(0.82)
  })

  it("relit le net d'un brut calculé, au centime près", () => {
    const regles2026 = reglesPubliees(2026)
    for (const net of [1500, 2200, 4000, 9000]) expect(Math.abs(netCalcule(brutCalcule(net, regles2026), regles2026) - net)).toBeLessThanOrEqual(0.01)
  })

  it("ne donne ni brut ni net pour un montant nul", () => {
    expect(brutCalcule(0, reglesDeTest)).toBe(0)
    expect(netCalcule(0, reglesDeTest)).toBe(0)
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
    for (const saisie of ["", "abc", "0", "-5", "101", "7 8 a", ".", "7..8"]) {
      expect(parsePercent(saisie)).toBeNull()
    }
  })

  it("lit en temps linéaire une saisie très longue (expression sans retour arrière)", () => {
    expect(parsePercent(`${"7".repeat(50_000)}x`)).toBeNull()
    expect(parsePercent(`${"0".repeat(50_000)}78`)).toBeCloseTo(0.78)
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
