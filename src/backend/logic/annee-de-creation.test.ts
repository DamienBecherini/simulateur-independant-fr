// src/backend/logic/annee-de-creation.test.ts

import { describe, expect, it } from "vitest"
import { anneeDeCreation, periodeDeLActivite, reglesDeLaPeriode, reglesDeLAnneeDeCreation, type AnneeDeCreation } from "./annee-de-creation.js"
import { calculerCotisationsTNS } from "./cotisationsTNS.js"
import { reglesDeLAnneeEntiere, type ReglesDeLaPeriode, type ReglesFiscales } from "./regles.js"
import { reglesDeTest } from "./testing/regles-de-test.js"

/*
 * Règles de test (année 2000) : plafond de la sécurité sociale de 40 000 € pour les indépendants comme pour le régime
 * général, SMIC annuel de 20 000 €, taux réduit d'impôt sur les sociétés jusqu'à 40 000 €, formation professionnelle
 * de 0,25 % du plafond (100 €), minimum d'invalidité-décès sur 4 000 €, de retraite de base sur 6 000 € après 90 jours.
 */

/** L'année de création d'une activité créée ce mois de 2000 (jamais janvier). */
function creeeEn(mois: string): AnneeDeCreation {
  const creation = anneeDeCreation(`2000-${mois}`, 2000)
  if (!creation) throw new Error(`2000-${mois} n'est pas une année de création`)
  return creation
}

describe("periodeDeLActivite", () => {
  it("distingue l'année entière, l'année de création et une année avant la création", () => {
    expect(periodeDeLActivite(undefined, 2000)).toEqual({ cas: "entiere" })
    expect(periodeDeLActivite("1998-06", 2000)).toEqual({ cas: "entiere" })
    // Créée en janvier : douze mois d'activité, une année entière.
    expect(periodeDeLActivite("2000-01", 2000)).toEqual({ cas: "entiere" })
    expect(periodeDeLActivite("2000-07", 2000)).toEqual({ cas: "creation", creation: { annee: 2000, mois: 7 }, mois: 6, jours: 184 })
    expect(periodeDeLActivite("2001-03", 2000)).toEqual({ cas: "avant", creation: { annee: 2001, mois: 3 } })
  })
})

describe("reglesDeLAnneeDeCreation", () => {
  const reduites = reglesDeLAnneeDeCreation(reglesDeTest, creeeEn("07"))

  it("réduit aux six mois d'activité les plafonds, le SMIC de la réduction générale et la limite du taux réduit", () => {
    expect(reduites.TNS.plafondSecuriteSociale).toBe(20000)
    expect(reduites.regimeGeneral.plafondSecuriteSociale).toBe(20000)
    expect(reduites.regimeGeneral.reductionGenerale.smicAnnuel).toBe(10000)
    expect(reduites.IS.plafondTauxReduit).toBe(20000)
    expect(reduites.TNS.cotisationsMinimales.invaliditeDeces).toBe(2000)
  })

  it("garde entiers le minimum des indemnités journalières et, après 90 jours d'activité, celui de la retraite de base", () => {
    expect(reduites.TNS.cotisationsMinimales.indemnitesJournalieres).toBe(16000)
    expect(reduites.TNS.cotisationsMinimales.retraiteDeBase).toBe(6000)
    expect(reduites.liberauxReglementes.commun.cotisationsMinimales.retraiteDeBase).toBe(reglesDeTest.liberauxReglementes.commun.cotisationsMinimales.retraiteDeBase)
  })

  it("retire le minimum de retraite de base sous 90 jours d'activité : créée en novembre, 61 jours", () => {
    const enNovembre = reglesDeLAnneeDeCreation(reglesDeTest, creeeEn("11"))
    expect(enNovembre.TNS.cotisationsMinimales.retraiteDeBase).toBe(0)
    expect(enNovembre.liberauxReglementes.commun.cotisationsMinimales.retraiteDeBase).toBe(0)
    // Créée en octobre, 92 jours : le minimum est dû.
    expect(reglesDeLAnneeDeCreation(reglesDeTest, creeeEn("10")).TNS.cotisationsMinimales.retraiteDeBase).toBe(6000)
  })

  it("ne touche pas aux règles de l'année, et les garde sous la main", () => {
    expect(reglesDeTest.TNS.plafondSecuriteSociale).toBe(40000)
    expect(reduites.anneeEntiere).toBe(reglesDeTest)
    expect(reglesDeLAnneeEntiere(reduites)).toBe(reglesDeTest)
  })

  it("laisse la formation professionnelle sur le plafond entier, quand le reste des cotisations suit le plafond réduit", () => {
    const enAnneePleine = calculerCotisationsTNS(30000, reglesDeTest)
    const lAnneeDeCreation = calculerCotisationsTNS(30000, reduites)

    expect(enAnneePleine.cotisations.formationProfessionnelle).toBe(100)
    expect(lAnneeDeCreation.cotisations.formationProfessionnelle).toBe(100)
    // Retraite de base : 20 % jusqu'au plafond, 1 % au-delà. Assiette de 22 500 € : sous le plafond entier, au-dessus du réduit.
    expect(enAnneePleine.cotisations.retraiteDeBase).toBeCloseTo(4500, 6)
    expect(lAnneeDeCreation.cotisations.retraiteDeBase).toBeCloseTo(20000 * 0.2 + 2500 * 0.01, 6)
  })
})

describe("reglesDeLaPeriode", () => {
  it("donne, pour une année entière, les règles de l'année telles quelles", () => {
    const entiere = reglesDeLaPeriode(reglesDeTest, { cas: "entiere" })

    expect(entiere).toEqual({ ...reglesDeTest, anneeEntiere: reglesDeTest })
    expect(entiere.TNS).toBe(reglesDeTest.TNS)
    expect(reglesDeLAnneeEntiere(entiere)).toBe(reglesDeTest)
    expect(calculerCotisationsTNS(30000, entiere)).toEqual(calculerCotisationsTNS(30000, reglesDeTest))
  })

  it("donne les règles réduites l'année de création", () => {
    const periode = periodeDeLActivite("2000-07", 2000)

    expect(reglesDeLaPeriode(reglesDeTest, periode)).toEqual(reglesDeLAnneeDeCreation(reglesDeTest, creeeEn("07")))
  })

  it("retire minimums et forfaits une année avant la création, sans réduire le plafond", () => {
    const avant = reglesDeLaPeriode(reglesDeTest, periodeDeLActivite("2001-03", 2000))

    expect(avant.TNS.plafondSecuriteSociale).toBe(40000)
    expect(avant.TNS.cotisationsMinimales).toEqual({ ...reglesDeTest.TNS.cotisationsMinimales, indemnitesJournalieres: 0, retraiteDeBase: 0, invaliditeDeces: 0 })
    expect(avant.TNS.formationProfessionnelle.tauxSurPlafond).toBe(0)
    expect(avant.liberauxReglementes.commun.cotisationsMinimales).toMatchObject({ indemnitesJournalieres: 0, retraiteDeBase: 0 })
    expect(avant.liberauxReglementes.CIPAV.invaliditeDeces).toMatchObject({ forfait: 0, assietteMinimalePartDuPlafond: 0 })
    expect(avant.liberauxReglementes.CARPIMKO.retraiteComplementaire).toMatchObject({ forfait: 0, assietteMinimale: 0 })
    expect(avant.liberauxReglementes.CARPIMKO.asv).toMatchObject({ forfaitPraticien: 0, forfaitAssuranceMaladie: 0 })
    expect(reglesDeLAnneeEntiere(avant)).toBe(reglesDeTest)
    // Sans revenu ni minimum ni forfait : aucune cotisation.
    expect(calculerCotisationsTNS(0, avant).total).toBe(0)
  })
})

describe("reglesDeLAnneeEntiere", () => {
  it("rend les règles d'une année telles quelles", () => {
    expect(reglesDeLAnneeEntiere(reglesDeTest)).toBe(reglesDeTest)
  })
})

describe("le compilateur distingue les règles d'une période de celles de l'année", () => {
  // Ces lignes ne vérifient rien à l'exécution : c'est « npm run typecheck:tests » qui échoue si l'une des deux
  // affectations devient permise (un « @ts-expect-error » sans erreur est lui-même une erreur).
  const pourLAnneeEntiere = (regles: ReglesFiscales): number => regles.TNS.plafondSecuriteSociale
  const pourLaPeriode = (regles: ReglesDeLaPeriode): number => regles.TNS.plafondSecuriteSociale

  it("refuse des règles de période à qui demande l'année entière, sauf à passer par reglesDeLAnneeEntiere", () => {
    const reduites = reglesDeLAnneeDeCreation(reglesDeTest, creeeEn("07"))

    // @ts-expect-error Des règles de période ne sont pas des règles de l'année : le plafond lu serait le plafond réduit.
    expect(pourLAnneeEntiere(reduites)).toBe(20000)
    expect(pourLAnneeEntiere(reglesDeLAnneeEntiere(reduites))).toBe(40000)
  })

  it("refuse les règles de l'année à qui demande celles d'une période : elles se fabriquent par reglesDeLaPeriode", () => {
    // @ts-expect-error Les règles de l'année ne portent pas la marque de celles d'une période.
    expect(pourLaPeriode(reglesDeTest)).toBe(40000)
    expect(pourLaPeriode(reglesDeLaPeriode(reglesDeTest, { cas: "entiere" }))).toBe(40000)
  })
})
