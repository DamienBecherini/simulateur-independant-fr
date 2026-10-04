// src/lib/notes.test.ts

import { describe, expect, it } from "vitest"
import { numeroterNotes } from "./notes"

describe("numeroterNotes", () => {
  it("numérote les avertissements dans l'ordre du tableau, et donne à chaque colonne ses renvois", () => {
    const { notes, renvois } = numeroterNotes([
      { id: "SASU", libelle: "SASU", avertissements: [] },
      { id: "micro", libelle: "Micro-entreprise", avertissements: ["TVA due."] },
      { id: "micro-vfl", libelle: "Micro + versement libératoire", avertissements: ["TVA due.", "Seuil de revenu à vérifier."] }
    ])

    expect(notes).toEqual([
      { numero: 1, texte: "TVA due.", colonnes: ["Micro-entreprise", "Micro + versement libératoire"] },
      { numero: 2, texte: "Seuil de revenu à vérifier.", colonnes: ["Micro + versement libératoire"] }
    ])
    expect(renvois.get("SASU")).toEqual([])
    expect(renvois.get("micro")).toEqual([1])
    expect(renvois.get("micro-vfl")).toEqual([1, 2])
  })

  it("ne renvoie qu'une fois à un avertissement répété dans la même colonne", () => {
    const { notes, renvois } = numeroterNotes([{ id: "EI", libelle: "EI au réel", avertissements: ["Déficit.", "Déficit."] }])
    expect(notes).toEqual([{ numero: 1, texte: "Déficit.", colonnes: ["EI au réel"] }])
    expect(renvois.get("EI")).toEqual([1])
  })

  it("n'a aucune note sans avertissement", () => {
    expect(numeroterNotes([{ id: "SASU", libelle: "SASU", avertissements: [] }]).notes).toEqual([])
  })
})
