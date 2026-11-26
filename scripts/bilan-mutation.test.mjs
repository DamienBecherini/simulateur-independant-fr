// scripts/bilan-mutation.test.mjs

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { bilanEnMarkdown, compterLesStatuts, lireLaCommande, lireLesRapports, scoreDeMutation, seuilAtteint } from "./bilan-mutation.mjs"

const rapport = (...statuts) => ({ files: { "src/backend/logic/module.ts": { mutants: statuts.map((status) => ({ status })) } } })

const LOT_1 = rapport("Killed", "Killed", "Killed", "Survived", "Timeout")
const LOT_2 = {
  files: {
    "src/backend/logic/a.ts": { mutants: [{ status: "Killed" }, { status: "NoCoverage" }] },
    "src/backend/logic/b.ts": { mutants: [{ status: "Ignored" }, { status: "RuntimeError" }, { status: "Survived" }] }
  }
}

describe("compterLesStatuts", () => {
  it("additionne les mutants de tous les fichiers de tous les lots, par statut", () => {
    expect(compterLesStatuts([LOT_1, LOT_2])).toEqual({ Killed: 4, Survived: 2, Timeout: 1, NoCoverage: 1, Ignored: 1, RuntimeError: 1 })
    expect(compterLesStatuts([])).toEqual({})
  })
})

describe("scoreDeMutation", () => {
  it("rapporte les mutants tués ou arrêtés par un délai aux mutants valides", () => {
    // 4 tués + 1 délai, sur 4 + 1 + 2 survivants + 1 sans couverture ; ni l'ignoré ni l'erreur ne comptent.
    expect(scoreDeMutation(compterLesStatuts([LOT_1, LOT_2]))).toBeCloseTo(62.5, 10)
    expect(scoreDeMutation({ Killed: 3 })).toBe(100)
    expect(scoreDeMutation({ Survived: 2, NoCoverage: 1 })).toBe(0)
  })

  it("ne donne pas de score sans mutant valide", () => {
    expect(scoreDeMutation({})).toBeNull()
    expect(scoreDeMutation({ Ignored: 4 })).toBeNull()
  })
})

describe("bilanEnMarkdown", () => {
  it("écrit le score d'ensemble, le nombre de mutants et de lots, et le détail par statut", () => {
    expect(bilanEnMarkdown([LOT_1, LOT_2])).toBe(
      [
        "## Tests de mutation du moteur fiscal",
        "",
        "Score : **62,50 %** (10 mutants, 2 lots).",
        "",
        "| Tués | Délai dépassé | Survivants | Sans couverture |",
        "| ---: | ---: | ---: | ---: |",
        "| 4 | 1 | 2 | 1 |",
        ""
      ].join("\n")
    )
  })

  it("signale un bilan partiel", () => {
    const bilan = bilanEnMarkdown([LOT_1], { partiel: true })
    expect(bilan).toContain("Score : **80,00 %** (5 mutants, 1 lot).")
    expect(bilan).toContain("**Bilan partiel : un lot au moins n'a pas abouti.**")
    expect(bilanEnMarkdown([LOT_1])).not.toContain("partiel")
  })

  it("le dit quand aucun rapport n'est arrivé", () => {
    expect(bilanEnMarkdown([], { partiel: true })).toContain("Score : **aucun mutant valide** (0 mutants, 0 lot).")
  })

  it("dit si le seuil exigé est atteint, juste après le score, et n'en parle pas sans seuil", () => {
    // LOT_1 : 80 % exactement.
    expect(bilanEnMarkdown([LOT_1], { seuil: 80 })).toContain("Score : **80,00 %** (5 mutants, 1 lot).\n\nSeuil de 80 % atteint.\n\n| Tués |")
    expect(bilanEnMarkdown([LOT_1], { seuil: 80.5 })).toContain("\n\n**Seuil de 80,5 % non atteint : le run échoue.**\n\n| Tués |")
    expect(bilanEnMarkdown([], { seuil: 0 })).toContain("**Seuil de 0 % non atteint : le run échoue.**")
    expect(bilanEnMarkdown([LOT_1])).not.toContain("Seuil")
  })
})

describe("seuilAtteint", () => {
  it("compare le score au seuil, bornes comprises", () => {
    expect(seuilAtteint(83.56, 80)).toBe(true)
    expect(seuilAtteint(80, 80)).toBe(true)
    expect(seuilAtteint(79.99, 80)).toBe(false)
  })

  it("n'est jamais atteint sans mutant valide : rien n'a été mesuré", () => {
    expect(seuilAtteint(null, 0)).toBe(false)
  })
})

describe("lireLaCommande", () => {
  it("lit le dossier, « --partiel » et « --seuil », dans n'importe quel ordre", () => {
    expect(lireLaCommande(["rapports", "--seuil", "80", "--partiel"])).toEqual({ dossier: "rapports", partiel: true, seuil: 80 })
    expect(lireLaCommande(["--seuil", "82.5", "rapports"])).toEqual({ dossier: "rapports", partiel: false, seuil: 82.5 })
    expect(lireLaCommande(["rapports", "--partiel"])).toEqual({ dossier: "rapports", partiel: true, seuil: undefined })
  })

  it("prend reports/mutation sans dossier, et ne confond pas la valeur du seuil avec lui", () => {
    expect(lireLaCommande([])).toEqual({ dossier: "reports/mutation", partiel: false, seuil: undefined })
    expect(lireLaCommande(["--seuil", "80"])).toEqual({ dossier: "reports/mutation", partiel: false, seuil: 80 })
  })

  it("refuse un seuil absent, illisible ou hors de 0 à 100", () => {
    expect(() => lireLaCommande(["rapports", "--seuil"])).toThrow("« --seuil » attend un nombre de 0 à 100, reçu : undefined")
    expect(() => lireLaCommande(["--seuil", "--partiel"])).toThrow("reçu : --partiel")
    expect(() => lireLaCommande(["--seuil", "120"])).toThrow("reçu : 120")
    expect(() => lireLaCommande(["--seuil", "-1"])).toThrow("reçu : -1")
  })
})

describe("lireLesRapports", () => {
  let dossier

  afterEach(() => {
    if (dossier) rmSync(dossier, { recursive: true, force: true })
    dossier = undefined
  })

  it("lit le mutation.json de chaque lot, dans l'ordre des lots, et ignore un lot sans rapport", () => {
    dossier = mkdtempSync(join(tmpdir(), "bilan-mutation-"))
    for (const [lot, contenu] of [["rapport-mutation-lot-2", LOT_2], ["rapport-mutation-lot-1", LOT_1]]) {
      mkdirSync(join(dossier, lot))
      writeFileSync(join(dossier, lot, "mutation.json"), JSON.stringify(contenu), "utf-8")
    }
    mkdirSync(join(dossier, "rapport-mutation-lot-3"))

    expect(lireLesRapports(dossier)).toEqual([LOT_1, LOT_2])
  })

  it("ne lit rien dans un dossier absent", () => {
    expect(lireLesRapports(join(tmpdir(), "bilan-mutation-absent"))).toEqual([])
  })
})
