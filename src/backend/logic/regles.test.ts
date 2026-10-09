// src/backend/logic/regles.test.ts

import { describe, expect, it } from "vitest"
import config from "../config.json" with { type: "json" }
import fichier2024 from "../regles/2024.json" with { type: "json" }
import fichier2025 from "../regles/2025.json" with { type: "json" }
import { DERNIERE_ANNEE_DES_REGLES, PREMIERE_ANNEE_DES_REGLES, reglesDeLAnnee, reglesEnVigueur, reglesPubliees } from "./regles.js"

describe("reglesDeLAnnee", () => {
  it("connaît les règles de 2024 à 2026", () => {
    expect([PREMIERE_ANNEE_DES_REGLES, DERNIERE_ANNEE_DES_REGLES]).toEqual([2024, 2026])
  })

  it.each([
    [2024, fichier2024],
    [2025, fichier2025],
    [2026, config]
  ])("donne le fichier de %i, sans avertissement", (annee, fichier) => {
    const resultat = reglesDeLAnnee(annee)

    expect(resultat).toEqual({ regles: fichier, avertissement: null })
    expect(resultat.regles?.annee).toBe(annee)
  })

  it("reprend les dernières règles connues pour une année plus récente, avec un avertissement", () => {
    const resultat = reglesDeLAnnee(2028)

    expect(resultat.regles).toBe(reglesEnVigueur)
    expect("avertissement" in resultat && resultat.avertissement).toMatch(/^Les règles de 2028 ne sont pas encore connues : 2028 est simulée avec celles de 2026/)
  })

  it.each([2024, 2025, 2026])("%i : formation professionnelle des micro-entrepreneurs de 0,1 %, 0,3 % et 0,2 % du chiffre d'affaires (article L6331-48 du code du travail)", annee => {
    expect(reglesDeLAnnee(annee).regles?.microEntreprise.formationProfessionnelle).toMatchObject({ venteBic: 0.001, servicesBic: 0.003, servicesBnc: 0.002 })
  })

  it("refuse une année antérieure aux premières règles connues", () => {
    expect(reglesDeLAnnee(2023)).toEqual({ regles: null, erreur: "Le simulateur ne connaît pas les règles d'avant 2024 : l'année 2023 n'est pas simulée." })
  })
})

describe("reglesPubliees", () => {
  it("donne le fichier de l'année", () => {
    expect(reglesPubliees(2025)).toBe(fichier2025)
  })

  it("refuse une année sans fichier, au lieu de reprendre les dernières règles connues", () => {
    expect(() => reglesPubliees(2028)).toThrow("Aucun fichier de règles pour l'année 2028.")
  })
})
