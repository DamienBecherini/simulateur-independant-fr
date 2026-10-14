// src/lib/combien-facturer.test.ts

import { describe, expect, it } from "vitest"
import { CHIFFRE_D_AFFAIRES_MAXIMAL } from "@/backend/logic/options-du-comparateur"
import { euros } from "@/backend/logic/format"
import type { ChiffreDAffairesDUnStatut, ChiffreDAffairesPourUnNet, StatutCompare } from "@/types"
import { ecartAvecLeChiffreDAffairesSaisi, lireLeNetVise, parMois, phraseDuCalculALEnvers, raisonHorsDePortee } from "./combien-facturer"

const espaces = (texte: string) => texte.replace(/\s/g, " ")

const colonne = (statut: StatutCompare, libelle: string, chiffreDAffaires: number | null, autres: Partial<ChiffreDAffairesDUnStatut> = {}): ChiffreDAffairesDUnStatut => ({ statut, libelle, telleQueSaisie: false, chiffreDAffaires, netApresImpots: chiffreDAffaires === null ? null : 30000, ...autres })

const resultat = (colonnes: ChiffreDAffairesDUnStatut[]): ChiffreDAffairesPourUnNet => ({ netVise: 30000, chiffreDAffairesSaisi: 40000, colonnes, warnings: [] })

describe("lireLeNetVise", () => {
  it("lit un montant positif, arrondi à l'euro", () => {
    expect(lireLeNetVise("30000")).toBe(30000)
    expect(lireLeNetVise(" 2500.6 ")).toBe(2501)
  })

  it("ne lit rien d'un champ vide, nul, négatif, invalide ou au-delà de la borne du calcul", () => {
    for (const saisie of ["", "  ", "0", "-100", "abc", String(CHIFFRE_D_AFFAIRES_MAXIMAL + 1)]) expect(lireLeNetVise(saisie), saisie).toBeNull()
    expect(lireLeNetVise(String(CHIFFRE_D_AFFAIRES_MAXIMAL))).toBe(CHIFFRE_D_AFFAIRES_MAXIMAL)
  })
})

describe("textes de chaque statut", () => {
  it("dit pourquoi un statut est hors de portée", () => {
    expect(raisonHorsDePortee(colonne("micro", "Micro-entreprise", null, { horsDePortee: "plafondMicro" }))).toBe("hors de portée : plafond dépassé")
    expect(raisonHorsDePortee(colonne("micro", "Micro-entreprise", null, { horsDePortee: "regimeMicroFerme" }))).toBe("hors de portée : régime micro fermé")
    expect(raisonHorsDePortee(colonne("SASU", "SASU", null, { horsDePortee: "partageSelonLaGrille" }))).toBe("hors de portée : rémunération et dividendes fixés par la grille")
    expect(raisonHorsDePortee(colonne("EI", "EI au réel", null, { horsDePortee: "auDelaDeLaBorne" }))).toBe(`hors de portée : plus de ${euros(CHIFFRE_D_AFFAIRES_MAXIMAL)} de chiffre d'affaires`)
    expect(raisonHorsDePortee(colonne("EI", "EI au réel", 45000))).toBeNull()
  })

  it("donne le chiffre d'affaires mensuel et l'écart avec celui saisi", () => {
    expect(parMois(45000)).toBe(3750)
    expect(parMois(40001)).toBe(3333)
    expect(ecartAvecLeChiffreDAffairesSaisi(colonne("EI", "EI au réel", 45000), 40000)).toBe(5000)
    expect(ecartAvecLeChiffreDAffairesSaisi(colonne("micro", "Micro-entreprise", 38000), 40000)).toBe(-2000)
    expect(ecartAvecLeChiffreDAffairesSaisi(colonne("EI", "EI au réel", 45000), 0)).toBeNull()
    expect(ecartAvecLeChiffreDAffairesSaisi(colonne("micro", "Micro-entreprise", null, { horsDePortee: "plafondMicro" }), 40000)).toBeNull()
  })
})

describe("phraseDuCalculALEnvers", () => {
  it("nomme le statut qui demande le moins de chiffre d'affaires", () => {
    const phrase = phraseDuCalculALEnvers(resultat([colonne("EI", "EI au réel", 48000), colonne("micro-vfl", "Micro + versement libératoire", 39000), colonne("micro", "Micro-entreprise", null, { horsDePortee: "plafondMicro" })]))
    expect(espaces(phrase)).toBe("Pour 30 000 € nets par an, il faut au moins 39 000 € de chiffre d'affaires par an (3 250 € par mois), en Micro + versement libératoire.")
  })

  it("dit le net déjà atteint, ou qu'aucun statut ne l'atteint", () => {
    expect(espaces(phraseDuCalculALEnvers(resultat([colonne("EI", "EI au réel", 0), colonne("SASU", "SASU", 0)])))).toBe("Le foyer atteint déjà 30 000 € nets par an sans chiffre d'affaires de cette activité.")
    expect(espaces(phraseDuCalculALEnvers(resultat([colonne("micro", "Micro-entreprise", null, { horsDePortee: "plafondMicro" })])))).toBe("Aucun statut n'atteint 30 000 € nets par an.")
  })
})
