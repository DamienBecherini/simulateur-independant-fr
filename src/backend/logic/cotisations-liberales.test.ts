// src/backend/logic/cotisations-liberales.test.ts

import { describe, expect, it } from "vitest"
import { asv, complementaireCarpimko, cotisationsDeLaCaisse, curps, invaliditeDecesLiberale, maladieAuxiliaire } from "./cotisations-liberales.js"
import { calculerCotisationsTNS, revenuAvantCotisationsPourUnNet } from "./cotisationsTNS.js"
import { parametresDeLaCaisse } from "./professions.js"
import { reglesPubliees } from "./regles.js"

/*
 * Barèmes des caisses de libéraux réglementés (voir l'ADR 015). Les montants attendus se recalculent de tête à partir
 * des règles de 2026 (regles/2026.json) et de 2025 (regles/2025.json) ; les cas complets sont dans
 * references/liberaux.reference.test.ts.
 */

const regles2026 = reglesPubliees(2026)
const regles2025 = reglesPubliees(2025)
const pass = regles2026.TNS.plafondSecuriteSociale
const { CIPAV: cipav, CARPIMKO: carpimko, commun } = regles2026.liberauxReglementes

describe("invalidité-décès des libéraux", () => {
  it("CIPAV : 0,5 % de l'assiette, au moins 89 € (37 % du PASS) et au plus 445 € (185 % du PASS)", () => {
    expect(invaliditeDecesLiberale(0, cipav.invaliditeDeces, pass)).toBeCloseTo(88.91, 2)
    expect(invaliditeDecesLiberale(30000, cipav.invaliditeDeces, pass)).toBeCloseTo(150, 6)
    expect(invaliditeDecesLiberale(500000, cipav.invaliditeDeces, pass)).toBeCloseTo(444.56, 2)
  })

  it("CARPIMKO : forfait de 1 022 €, quel que soit le revenu", () => {
    expect(invaliditeDecesLiberale(0, carpimko.invaliditeDeces, pass)).toBe(1022)
    expect(invaliditeDecesLiberale(300000, carpimko.invaliditeDeces, pass)).toBe(1022)
  })
})

describe("retraite complémentaire de la CARPIMKO", () => {
  it("2026 : 8,70 % de l'assiette bornée entre 0,5 et 3 PASS (2 090,61 € à 12 543,66 €)", () => {
    expect(complementaireCarpimko(0, carpimko.retraiteComplementaire)).toBeCloseTo(2090.61, 2)
    expect(complementaireCarpimko(50000, carpimko.retraiteComplementaire)).toBeCloseTo(4350, 6)
    expect(complementaireCarpimko(1e6, carpimko.retraiteComplementaire)).toBeCloseTo(12543.66, 2)
  })

  it("2025 : 2 312 € plus 3 % de la part de l'assiette comprise entre 25 246 € et 237 179 €", () => {
    const bareme = regles2025.liberauxReglementes.CARPIMKO.retraiteComplementaire
    expect(complementaireCarpimko(20000, bareme)).toBe(2312)
    expect(complementaireCarpimko(35246, bareme)).toBeCloseTo(2612, 6)
    expect(complementaireCarpimko(300000, bareme)).toBeCloseTo(2312 + 0.03 * (237179 - 25246), 6)
  })
})

describe("CURPS et ASV", () => {
  it("CURPS : 0,10 % de l'assiette, au plus 240 € en 2026 (0,5 % du PASS)", () => {
    expect(curps(100000, commun.curps, pass)).toBeCloseTo(100, 6)
    expect(curps(400000, commun.curps, pass)).toBeCloseTo(240.3, 6)
  })

  it("ASV : 224 € + 0,16 % pour le praticien, 447 € + 0,24 % pour l'Assurance maladie, dans la limite de 5 PASS ; rien sans revenus conventionnés", () => {
    expect(asv(50000, 1, carpimko.asv, pass)).toEqual({ praticien: 224 + 80, assuranceMaladie: 447 + 120 })
    expect(asv(1e6, 1, carpimko.asv, pass).praticien).toBeCloseTo(224 + 0.0016 * 5 * pass, 6)
    expect(asv(50000, 0, carpimko.asv, pass)).toEqual({ praticien: 0, assuranceMaladie: 0 })
  })
})

describe("maladie d'un auxiliaire médical", () => {
  const prise = carpimko.priseEnChargeMaladie

  it("conventionné à 100 % : 0,10 % de l'assiette reste au praticien, le reste est pris en charge", () => {
    expect(maladieAuxiliaire(40000, 2000, 1, prise)).toEqual({ praticien: 40, priseEnCharge: 1960 })
  })

  it("sous 20 % du PASS, sans cotisation, rien n'est pris en charge ni dû", () => {
    expect(maladieAuxiliaire(5000, 0, 1, prise)).toEqual({ praticien: 0, priseEnCharge: 0 })
  })

  it("non conventionné : le barème majoré de 3,25 points, sans prise en charge", () => {
    const { praticien, priseEnCharge } = maladieAuxiliaire(40000, 2000, 0, prise)
    expect(praticien).toBeCloseTo(2000 + 1300, 6)
    expect(priseEnCharge).toBe(0)
  })

  it("conventionné à 75 % : prise en charge sur les trois quarts, majoration sur le quart restant", () => {
    const { praticien, priseEnCharge } = maladieAuxiliaire(40000, 2000, 0.75, prise)
    expect(priseEnCharge).toBeCloseTo(0.75 * 2000 - 0.75 * 40, 6)
    expect(praticien).toBeCloseTo(30 + 0.25 * (2000 + 1300), 6)
  })
})

describe("cotisations d'un libéral réglementé au réel", () => {
  const kine = { profession: "masseur-kinesitherapeute" }

  it("CARPIMKO, part conventionnée de 60 % : ASV sur 60 % de l'assiette, prise en charge sur 60 % de la maladie", () => {
    const caisse = parametresDeLaCaisse({ ...kine, partConventionnee: 0.6 }, regles2026, 2026)!
    const { detail } = cotisationsDeLaCaisse(44400, pass, caisse)
    expect(detail.partConventionnee).toBe(0.6)
    expect(detail.asv).toBeCloseTo(224 + 0.0016 * 44400 * 0.6, 6)
    expect(detail.priseEnCharge.asv).toBeCloseTo(447 + 0.0024 * 44400 * 0.6, 6)
  })

  it("CARPIMKO : complémentaire et ASV sur l'assiette de l'année précédente quand elle est connue, la retraite de base sur l'année", () => {
    const avec = parametresDeLaCaisse(kine, regles2026, 2026, 29600)!
    const { lignes, detail } = cotisationsDeLaCaisse(44400, pass, avec)
    expect(lignes.retraiteComplementaire).toBeCloseTo(0.087 * 29600, 6)
    expect(detail.asv).toBeCloseTo(224 + 0.0016 * 29600, 6)
    expect(lignes.retraiteDeBase).toBeCloseTo(0.106 * 44400, 6)
    expect(detail.baseDesCotisationsDeLAnneePrecedente).toEqual({ annee: 2025, assiette: 29600, anneePrecedenteConnue: true })
  })

  it("CIPAV : l'assiette de l'année précédente est ignorée, tout porte sur l'année", () => {
    const caisse = parametresDeLaCaisse({ profession: "psychologue" }, regles2026, 2026, 10000)!
    expect(caisse.anneePrecedente).toBeUndefined()
    expect(cotisationsDeLaCaisse(18500, pass, caisse).detail.baseDesCotisationsDeLAnneePrecedente).toBeUndefined()
  })

  it("sans revenu : minimums de la CNAVPL (indemnités journalières, retraite de base) et de la caisse, signalés", () => {
    const tns = calculerCotisationsTNS(0, regles2026.TNS, parametresDeLaCaisse({ profession: "osteopathe" }, regles2026, 2026))
    expect(tns.cotisations.retraiteDeBase).toBeCloseTo(0.106 * 5409, 6)
    expect(tns.cotisations.indemnitesJournalieres).toBeCloseTo(0.003 * 19224, 6)
    expect(tns.cotisations.invaliditeDeces).toBeCloseTo(0.005 * 0.37 * pass, 6)
    expect(tns.minimumRetraiteApplique).toBe(true)
    expect(tns.supplementMinimum).toBeCloseTo(tns.cotisations.retraiteDeBase + tns.cotisations.indemnitesJournalieres + tns.cotisations.invaliditeDeces, 6)
  })

  it("2024 : barème maladie propre aux libéraux réglementés (6,5 % au-delà de 110 % du PASS)", () => {
    const regles2024 = reglesPubliees(2024)
    const tns = calculerCotisationsTNS(100000, regles2024.TNS, parametresDeLaCaisse({ profession: "architecte" }, regles2024, 2024))
    expect(tns.cotisations.maladieMaternite).toBeCloseTo(0.065 * tns.assiette, 6)
    expect(tns.cotisations.retraiteComplementaire).toBeCloseTo(0.09 * 46368 + 0.22 * (tns.assiette - 46368), 6)
  })

  it("le revenu avant cotisations d'un gérant libéral redonne le net demandé", () => {
    const caisse = parametresDeLaCaisse(kine, regles2026, 2026)
    const brut = revenuAvantCotisationsPourUnNet(30000, regles2026.TNS, caisse)
    expect(brut - calculerCotisationsTNS(brut, regles2026.TNS, caisse).total).toBeCloseTo(30000, 4)
  })
})
