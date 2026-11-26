// src/backend/logic/champs-du-foyer.test.ts

import { describe, expect, it } from "vitest"
import type { FoyerFiscalResult } from "../../types.js"
import { CHAMPS_DU_FOYER, CHAMPS_DU_FOYER_POUR_LES_IA, champsDuFoyerMontres, nombreDuFoyer } from "./champs-du-foyer.js"
import { SANS_EPARGNE_RETRAITE } from "./testing/foyer-de-test.js"

const foyer = (autres: Partial<FoyerFiscalResult> = {}): FoyerFiscalResult => ({ personIds: ["p1"], totalParts: 1, revenusEncaisses: 30000, revenuImposableGlobal: 20000, revenuFiscalDeReference: 20000, impotSurLeRevenu: 1000, prelevementsSociaux: 0, optionDividendes: null, netApresImpots: 29000, revenusAvantPrelevements: 40000, totalPrelevements: 11000, resultatConserve: 0, depenses: 0, epargneRetraite: SANS_EPARGNE_RETRAITE, warnings: [], ...autres })

describe("champs d'un foyer dans les sorties", () => {
  it("chaque champ a un libellé, et le CSV, l'export complet, les montre tous", () => {
    const champs = Object.keys(CHAMPS_DU_FOYER)
    expect(Object.values(CHAMPS_DU_FOYER).every(champ => champ.libelle.trim().length > 0)).toBe(true)
    expect(new Set(Object.values(CHAMPS_DU_FOYER).map(champ => champ.libelle)).size).toBe(champs.length)
    expect(Object.values(CHAMPS_DU_FOYER).every(champ => champ.sorties.includes("csv"))).toBe(true)
  })

  it("un champ que la plupart des foyers n'ont pas n'est montré que si un foyer au moins l'a, à sa place : après le montant qui le contient", () => {
    expect(champsDuFoyerMontres("csv", [foyer()])).toEqual(["totalParts", "revenusEncaisses", "revenuImposableGlobal", "revenuFiscalDeReference", "impotSurLeRevenu", "prelevementsSociaux", "optionDividendes", "netApresImpots", "revenusAvantPrelevements", "totalPrelevements", "resultatConserve", "depenses"])
    const avec = champsDuFoyerMontres("csv", [foyer(), foyer({ versementLiberatoire: 792, beneficesExoneres: 12400 })])
    expect(avec.slice(3, 7)).toEqual(["revenuFiscalDeReference", "beneficesExoneres", "impotSurLeRevenu", "versementLiberatoire"])
    // Un montant nul reste un montant : le foyer l'a.
    expect(champsDuFoyerMontres("csv", [foyer({ versementLiberatoire: 0 })])).toContain("versementLiberatoire")
  })

  it("le rapport Markdown s'arrête au net ; la ligne de commande aussi, sans les parts, qu'elle écrit dans le titre du foyer", () => {
    expect(champsDuFoyerMontres("markdown", [foyer()])).toEqual(["totalParts", "revenusEncaisses", "revenuImposableGlobal", "revenuFiscalDeReference", "impotSurLeRevenu", "prelevementsSociaux", "optionDividendes", "netApresImpots"])
    expect(champsDuFoyerMontres("ligneDeCommande", [foyer()])).toEqual(["revenusEncaisses", "revenuImposableGlobal", "revenuFiscalDeReference", "impotSurLeRevenu", "prelevementsSociaux", "optionDividendes", "netApresImpots"])
  })

  it("un foyer qui n'a pas un champ y vaut 0", () => {
    expect(nombreDuFoyer(foyer(), "versementLiberatoire")).toBe(0)
    expect(nombreDuFoyer(foyer({ versementLiberatoire: 792 }), "versementLiberatoire")).toBe(792)
    expect(nombreDuFoyer(foyer(), "netApresImpots")).toBe(29000)
  })

  it("les clients d'IA reçoivent les mêmes champs, sous des noms sans doublon", () => {
    expect(new Set(CHAMPS_DU_FOYER_POUR_LES_IA).size).toBe(CHAMPS_DU_FOYER_POUR_LES_IA.length)
    expect(CHAMPS_DU_FOYER_POUR_LES_IA).toEqual(expect.arrayContaining(["versementLiberatoire", "beneficesExoneres", "netApresImpots"]))
  })
})
