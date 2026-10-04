// src/lib/csv.test.ts

import { describe, expect, it } from "vitest"
import { BOM, celluleCsv, documentCsv, montant, nombreCsv, texteCsv } from "./csv"

describe("nombreCsv", () => {
  it("écrit une virgule décimale, sans séparateur de milliers", () => {
    expect(nombreCsv(1234567.5)).toBe("1234567,5")
    expect(nombreCsv(4)).toBe("4")
    expect(nombreCsv(-12.25)).toBe("-12,25")
  })

  it("arrondit au centime et n'écrit jamais « -0 »", () => {
    expect(nombreCsv(10.006)).toBe("10,01")
    expect(nombreCsv(-0.001)).toBe("0")
    expect(nombreCsv(-0.001, 2)).toBe("0,00")
  })

  it("garde un nombre fixe de décimales quand on le demande", () => {
    expect(nombreCsv(1000, 2)).toBe("1000,00")
    expect(nombreCsv(1234.5, 2)).toBe("1234,50")
  })

  it("laisse vide une valeur qui n'est pas un nombre fini", () => {
    expect(nombreCsv(Number.NaN)).toBe("")
    expect(nombreCsv(Number.POSITIVE_INFINITY, 2)).toBe("")
  })
})

describe("texteCsv", () => {
  it("laisse tel quel un texte sans caractère spécial", () => {
    expect(texteCsv("Rémunération de dirigeant")).toBe("Rémunération de dirigeant")
  })

  it("met entre guillemets un texte qui contient un point-virgule, un guillemet ou un retour à la ligne", () => {
    expect(texteCsv("Martin; Dupont")).toBe('"Martin; Dupont"')
    expect(texteCsv('La "petite" SASU')).toBe('"La ""petite"" SASU"')
    expect(texteCsv("ligne 1\nligne 2")).toBe('"ligne 1\nligne 2"')
    expect(texteCsv("ligne 1\r\nligne 2")).toBe('"ligne 1\r\nligne 2"')
  })

  it("neutralise un texte qui commence comme une formule de tableur", () => {
    expect(texteCsv("=SOMME(A1:A2)")).toBe("'=SOMME(A1:A2)")
    expect(texteCsv("+33 6")).toBe("'+33 6")
    expect(texteCsv("-moi")).toBe("'-moi")
    expect(texteCsv("@cible")).toBe("'@cible")
    expect(texteCsv("=A1;B1")).toBe(`"'=A1;B1"`)
  })
})

describe("celluleCsv", () => {
  it("écrit une cellule selon sa nature", () => {
    expect(celluleCsv(null)).toBe("")
    expect(celluleCsv(undefined)).toBe("")
    expect(celluleCsv(1.5)).toBe("1,5")
    expect(celluleCsv(montant(1.5))).toBe("1,50")
    expect(celluleCsv(montant(-250))).toBe("-250,00")
    expect(celluleCsv("Alice")).toBe("Alice")
  })
})

describe("documentCsv", () => {
  it("commence par le BOM, sépare les colonnes par des points-virgules et termine chaque ligne par CRLF", () => {
    const csv = documentCsv([
      ["Acteur", "Montant"],
      ["Alice; Bob", montant(1000)],
      [],
      ["Total", 2.5]
    ])
    expect(csv.startsWith(BOM)).toBe(true)
    expect(csv).toBe('\uFEFFActeur;Montant\r\n"Alice; Bob";1000,00\r\n\r\nTotal;2,5\r\n')
  })

  it("renvoie le seul BOM pour un document vide", () => {
    expect(documentCsv([])).toBe(BOM)
  })
})
