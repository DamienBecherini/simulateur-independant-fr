// src/backend/logic/cotisationsTNS.test.ts

import { describe, expect, it } from "vitest"
import { assietteSociale, avertissementCotisationsMinimales, calculerCotisationsTNS, revenuAvantCotisationsPourUnNet } from "./cotisationsTNS.js"
import { reglesEnVigueur } from "./regles.js"
import { reglesDeTest } from "./testing/regles-de-test.js"

/*
 * Règles de test (plafond de 40 000 €) : abattement de 25 % borné entre 800 € et 40 000 € ;
 * maladie progressive 0 % jusqu'à 20 000 €, 4 % à 40 000 €, 8 % à 80 000 €, puis 5 % sur le surplus ;
 * allocations familiales progressives de 0 % à 40 000 € à 4 % à 60 000 € ; indemnités journalières 1 % jusqu'à 80 000 € ;
 * retraite de base 20 % jusqu'à 40 000 €, 1 % au-delà ; complémentaire 8 % jusqu'à 40 000 €, 10 % jusqu'à 160 000 € ;
 * invalidité-décès 1 % jusqu'à 40 000 € ; CSG-CRDS 10 %, dont 7 % déductibles ; formation professionnelle 100 € ;
 * assiettes minimales : 16 000 € (indemnités journalières), 6 000 € (retraite de base), 4 000 € (invalidité-décès).
 */
const TNS = reglesDeTest.TNS
const cotisations = (revenu: number) => calculerCotisationsTNS(revenu, TNS)

/** Montants attendus, à l'arrondi des calculs en virgule flottante près. */
const environ = (montants: Record<string, number>) => Object.fromEntries(Object.entries(montants).map(([cle, montant]) => [cle, expect.closeTo(montant, 6)]))

describe("assietteSociale", () => {
  it("retire l'abattement de 25 % du revenu avant cotisations", () => {
    expect(assietteSociale(40000, TNS)).toBe(30000)
  })

  it("applique l'abattement minimum de 800 €", () => {
    expect(assietteSociale(2000, TNS)).toBe(1200)
  })

  it("plafonne l'abattement à 40 000 €", () => {
    expect(assietteSociale(200000, TNS)).toBe(160000)
  })

  it("n'est jamais négative, même en cas de déficit", () => {
    expect(assietteSociale(600, TNS)).toBe(0)
    expect(assietteSociale(-3000, TNS)).toBe(0)
  })
})

describe("calculerCotisationsTNS", () => {
  it("calcule chaque cotisation sur l'assiette, sous le plafond", () => {
    // Assiette 30 000 € : maladie au taux de 4 % x 10 000 / 20 000 = 2 %, allocations familiales nulles.
    const resultat = cotisations(40000)

    expect(resultat).toMatchObject({ revenuAvantCotisations: 40000, assiette: 30000, supplementMinimum: 0, minimumRetraiteApplique: false })
    expect(resultat.cotisations).toEqual({
      maladieMaternite: 600,
      indemnitesJournalieres: 300,
      retraiteDeBase: 6000,
      retraiteComplementaire: 2400,
      invaliditeDeces: 300,
      allocationsFamiliales: 0,
      csgDeductible: 2100,
      csgNonDeductibleEtCrds: 900,
      formationProfessionnelle: 100
    })
    expect(resultat.total).toBe(12700)
    expect(resultat.partNonDeductible).toBe(900)
  })

  it("interpole les taux progressifs et applique les tranches au-delà du plafond", () => {
    // Assiette 52 500 € (1,3125 plafond) : maladie 4 % + 4 % x 0,3125 = 5,25 % ; allocations familiales 4 % x 0,3125 / 0,5 = 2,5 %.
    // Retraite de base 8 000 + 1 % x 12 500 ; complémentaire 3 200 + 10 % x 12 500 ; invalidité-décès plafonnée à 400 €.
    const resultat = cotisations(70000)

    expect(resultat.assiette).toBe(52500)
    expect(resultat.cotisations).toMatchObject(environ({ maladieMaternite: 2756.25, allocationsFamiliales: 1312.5, indemnitesJournalieres: 525, retraiteDeBase: 8125, retraiteComplementaire: 4450, invaliditeDeces: 400 }))
    expect(resultat.total).toBeCloseTo(22918.75)
  })

  it("applique les taux au-delà du dernier point des barèmes progressifs, et les plafonds des tranches", () => {
    // Assiette 160 000 € (abattement plafonné) : maladie 8 % x 80 000 + 5 % x 80 000 ; allocations familiales 4 % de tout.
    // Indemnités journalières plafonnées à 80 000 € ; complémentaire 3 200 + 10 % x 120 000.
    const resultat = cotisations(200000)

    expect(resultat.cotisations).toMatchObject(environ({ maladieMaternite: 10400, allocationsFamiliales: 6400, indemnitesJournalieres: 800, retraiteDeBase: 9200, retraiteComplementaire: 15200, invaliditeDeces: 400, csgNonDeductibleEtCrds: 4800 }))
    expect(resultat.total).toBeCloseTo(58500)
  })

  it("calcule les cotisations à assiette minimale sur cette assiette quand le revenu est faible", () => {
    // Assiette 1 200 € : indemnités journalières sur 16 000 €, retraite de base sur 6 000 €, invalidité-décès sur 4 000 €.
    // Supplément : (160 - 12) + (1 200 - 240) + (40 - 12) = 1 136 €.
    const resultat = cotisations(2000)

    expect(resultat.cotisations).toMatchObject(environ({ maladieMaternite: 0, indemnitesJournalieres: 160, retraiteDeBase: 1200, retraiteComplementaire: 96, invaliditeDeces: 40, csgDeductible: 84, csgNonDeductibleEtCrds: 36 }))
    expect(resultat.total).toBeCloseTo(1716)
    expect(resultat.supplementMinimum).toBeCloseTo(1136)
    expect(resultat.minimumRetraiteApplique).toBe(true)
  })

  it("ne doit que les cotisations minimales en cas de déficit : 160 + 1 200 + 40 + 100 = 1 500 €", () => {
    const resultat = cotisations(-3000)

    expect(resultat.total).toBe(1500)
    expect(resultat.partNonDeductible).toBe(0)
    expect(resultat.supplementMinimum).toBe(1400)
  })

  it("n'applique plus le minimum de la retraite de base dès que l'assiette l'atteint", () => {
    // 8 000 € de revenu : assiette 6 000 €, juste à l'assiette minimale de la retraite de base.
    expect(cotisations(8000).minimumRetraiteApplique).toBe(false)
  })
})

describe("revenuAvantCotisationsPourUnNet", () => {
  it("retrouve le revenu dont le net est le reste après cotisations", () => {
    expect(revenuAvantCotisationsPourUnNet(27300, TNS)).toBeCloseTo(40000, 6)
    expect(revenuAvantCotisationsPourUnNet(141500, TNS)).toBeCloseTo(200000, 6)
  })

  it("inclut dans le revenu les cotisations minimales payées sans rémunération", () => {
    // Revenu R sous 3 200 € : assiette R - 800 ; cotisations 1 500 + 18 % x (R - 800) = 1 356 + 0,18 R = R, soit R = 1 356 / 0,82.
    expect(revenuAvantCotisationsPourUnNet(0, TNS)).toBeCloseTo(1356 / 0.82, 6)
  })

  it("accepte un net négatif", () => {
    // Revenu nul : 1 500 € de cotisations minimales, net de - 1 500 €.
    expect(revenuAvantCotisationsPourUnNet(-1500, TNS)).toBeCloseTo(0, 6)
  })

  it.each([0, 5000, 30000, 80000, 300000])("vérifie revenu - cotisations = net pour %i € avec les règles en vigueur", net => {
    const revenu = revenuAvantCotisationsPourUnNet(net, reglesEnVigueur.TNS)

    expect(revenu - calculerCotisationsTNS(revenu, reglesEnVigueur.TNS).total).toBeCloseTo(net, 6)
  })
})

describe("avertissementCotisationsMinimales", () => {
  it("prévient quand l'assiette minimale de la retraite de base s'applique, avec le supplément", () => {
    expect(avertissementCotisationsMinimales(cotisations(2000), "des indépendants")).toEqual([expect.stringMatching(/^Cotisations minimales des indépendants appliquées.*1\s136 € de plus/)])
  })

  it("ne dit rien au-delà", () => {
    expect(avertissementCotisationsMinimales(cotisations(40000), "du gérant")).toEqual([])
  })
})
