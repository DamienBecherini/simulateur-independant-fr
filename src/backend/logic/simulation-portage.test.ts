// src/backend/logic/simulation-portage.test.ts

import { describe, expect, it } from "vitest"
import { ConditionsPortageSchema, type ConditionsPortage } from "../../types.js"
import { calculerBulletinDuPorte, reductionGenerale } from "./cotisationsSalarie.js"
import { conditionsPortageParDefaut, conditionsPortageRetenues } from "./options-du-comparateur.js"
import { runMetaSimulation } from "./simulation-engine.js"
import { fraisDeGestionDuMois, masseSalarialePourUneEnveloppe, parametresDuBulletinDuPorte } from "./simulation-portage.js"
import { reglesDeTest } from "./testing/regles-de-test.js"
import { chaqueMois, personne, portage, relation, session } from "./testing/session-de-test.js"

/*
 * Règles de test (voir regles-de-test.ts) : plafond de 40 000 €. Salarié porté d'une société de 50 salariés et plus,
 * sous le plafond : cotisations patronales de 42,7 %, plus le forfait social de 10 % sur la prévoyance de 1 % (0,1 %),
 * soit 42,8 % ; salariales de 19,1 %, plus la CSG et la CRDS de 10 % sur cette prévoyance (0,1 %), soit 19,2 % (net =
 * 80,8 % du brut). CSG non déductible et CRDS : 3 % sur 90 % du brut et sur la prévoyance, soit 2,73 %. Réduction
 * générale : 2 % + 38,5 % x (60 000 / brut - 1) / 2.
 */

/** Camille, salariée portée, facture `parMois` chaque mois indiqué. */
function simulerPortage(parMois: number, conditions?: ConditionsPortage, mois?: number[], autres: (donnees: ReturnType<typeof session>) => void = () => {}) {
  const donnees = chaqueMois(session([personne("camille"), portage("p1", conditions)], [relation("camille", "p1", "Titulaire")]), "p1", "ca_services", parMois, mois)
  autres(donnees)
  return runMetaSimulation(donnees, reglesDeTest)
}

const activiteDe = (report: ReturnType<typeof runMetaSimulation>) => {
  const resultat = report.activities.find(a => a.entityId === "p1")
  if (!resultat?.portage) throw new Error("Activité en portage absente du rapport")
  return { resultat, detail: resultat.portage }
}

describe("fraisDeGestionDuMois", () => {
  const conditions = { ...conditionsPortageParDefaut(), plancherMensuel: 300, plafondMensuel: 2000, fraisFixesMensuels: 50 }

  it("taux du chiffre d'affaires, ramené entre le plancher et le plafond, plus les frais fixes", () => {
    expect(fraisDeGestionDuMois(10000, conditions)).toBeCloseTo(750) // 7 % = 700, + 50
    expect(fraisDeGestionDuMois(1000, conditions)).toBeCloseTo(350) // 7 % = 70, plancher 300, + 50
    expect(fraisDeGestionDuMois(100000, conditions)).toBeCloseTo(2050) // 7 % = 7 000, plafond 2 000, + 50
  })

  it("rien sans chiffre d'affaires, jamais plus que le chiffre d'affaires", () => {
    expect(fraisDeGestionDuMois(0, conditions)).toBe(0)
    expect(fraisDeGestionDuMois(-500, conditions)).toBe(0)
    expect(fraisDeGestionDuMois(200, conditions)).toBe(200)
  })
})

describe("masseSalarialePourUneEnveloppe", () => {
  const porte = parametresDuBulletinDuPorte(reglesDeTest, conditionsPortageParDefaut())

  it("la masse salariale dont le coût employeur épuise l'enveloppe", () => {
    // Sous le plafond : 55 800 / 1,428 = 39 075,63 €.
    const masse = masseSalarialePourUneEnveloppe(55800, porte)
    expect(masse).toBeCloseTo(39075.63, 2)
    expect(calculerBulletinDuPorte(masse, porte).coutEmployeur).toBeCloseTo(55800, 6)
  })

  it("aucune masse salariale sans enveloppe", () => {
    expect(masseSalarialePourUneEnveloppe(0, porte)).toBe(0)
    expect(masseSalarialePourUneEnveloppe(-100, porte)).toBe(0)
  })

  it("une enveloppe dans le saut du plafond n'est pas payée à l'euro près : jamais au-delà", () => {
    // Au plafond de 40 000 €, la contribution d'équilibre technique (1 % employeur sur tout le brut) fait sauter le coût de
    // 400 € : 40 000 x 1,428 = 57 120 €, et juste au-delà 57 520 €. Une enveloppe de 57 200 € paie au plus 40 000 €.
    const masse = masseSalarialePourUneEnveloppe(57200, porte)
    expect(masse).toBeCloseTo(40000, 4)
    expect(calculerBulletinDuPorte(masse, porte).coutEmployeur).toBeLessThanOrEqual(57200)
  })
})

describe("bulletin du salarié porté", () => {
  it("ajoute au bulletin d'un salarié les cotisations du cadre et celles de l'effectif", () => {
    const bulletin = calculerBulletinDuPorte(10000, parametresDuBulletinDuPorte(reglesDeTest, conditionsPortageParDefaut()))
    expect(bulletin.statut).toBe("porte")
    expect(bulletin.cotisations.fnal.patronale).toBeCloseTo(50)
    expect(bulletin.cotisations.formationProfessionnelle.patronale).toBeCloseTo(100)
    expect(bulletin.cotisationsDuPortage).toMatchObject({ apec: { salariale: expect.closeTo(10, 6), patronale: expect.closeTo(20, 6) }, prevoyanceCadres: { salariale: 0, patronale: expect.closeTo(100, 6) }, formationConventionnelle: { patronale: expect.closeTo(50, 6) }, effortConstruction: { patronale: expect.closeTo(50, 6) }, versementMobilite: { salariale: 0, patronale: 0 } })
    // Sur les 100 € de prévoyance patronale : CSG et CRDS de 10 € pour le salarié, forfait social de 10 € pour l'employeur ;
    // la CSG non déductible et la CRDS (3 €) rejoignent l'imposable.
    expect(bulletin.cotisationsDuPortage).toMatchObject({ csgCrdsPrevoyance: { salariale: expect.closeTo(10, 6), patronale: 0 }, forfaitSocialPrevoyance: { salariale: 0, patronale: expect.closeTo(10, 6) } })
    expect(bulletin.partNonDeductible).toBeCloseTo(0.03 * 9000 + 3, 6)
    expect(bulletin.totalPatronal).toBeCloseTo(4280)
    expect(bulletin.totalSalarial).toBeCloseTo(1920)
    expect(bulletin.reductionGenerale).toBe(0)
  })

  it("la réduction générale, quand la société la reverse, avec le paramètre de son effectif", () => {
    const conditions = { ...conditionsPortageParDefaut(), reductionGeneraleReversee: true }
    const bulletin = calculerBulletinDuPorte(30000, parametresDuBulletinDuPorte(reglesDeTest, conditions))
    // C = 0,02 + 0,385 x (60 000 / 30 000 - 1) / 2 = 0,2125 : 6 375 €.
    expect(bulletin.reductionGenerale).toBeCloseTo(6375)
    expect(bulletin.coutEmployeur).toBeCloseTo(30000 * 1.428 - 6375)
  })

  it("le forfait social sur la prévoyance, à partir de 11 salariés seulement ; la CSG et la CRDS partout", () => {
    const moinsDe11 = calculerBulletinDuPorte(10000, parametresDuBulletinDuPorte(reglesDeTest, { ...conditionsPortageParDefaut(), effectif: "moinsDe11" }))
    expect(moinsDe11.cotisationsDuPortage?.forfaitSocialPrevoyance.patronale).toBe(0)
    expect(moinsDe11.cotisationsDuPortage?.csgCrdsPrevoyance.salariale).toBeCloseTo(10, 6)
  })

  it("le versement mobilité, à partir de 11 salariés seulement", () => {
    const de11a49 = calculerBulletinDuPorte(10000, parametresDuBulletinDuPorte(reglesDeTest, { ...conditionsPortageParDefaut(), effectif: "de11a49", tauxVersementMobilite: 0.02 }))
    const moinsDe11 = calculerBulletinDuPorte(10000, parametresDuBulletinDuPorte(reglesDeTest, { ...conditionsPortageParDefaut(), effectif: "moinsDe11", tauxVersementMobilite: 0.02 }))
    expect(de11a49.cotisationsDuPortage?.versementMobilite.patronale).toBeCloseTo(200)
    expect(moinsDe11.cotisationsDuPortage?.versementMobilite.patronale).toBe(0)
  })
})

describe("activité en portage salarial", () => {
  it("60 000 € facturés en CDI, conditions typiques : la réserve, nette, reste sur le compte d'activité", () => {
    // Frais de gestion 7 % = 4 200 € ; enveloppe 55 800 € ; masse salariale 39 075,63 € ; net 80,8 % = 31 573,11 €.
    // Salaire de base 39 075,63 / 1,15 = 33 978,81 € ; réserve 10 % = 3 397,88 € ; part versée 1,05 / 1,15.
    // Net versé 31 573,11 x 1,05 / 1,15 = 28 827,62 € ; réserve nette 2 745,49 € ; imposable + 2,73 % x 35 677,75 = 974,00 €.
    const report = simulerPortage(5000)
    const { resultat, detail } = activiteDe(report)
    expect(detail).toMatchObject({ moisAvecChiffreDAffaires: 12, chiffreAffaires: 60000, fraisDeGestion: expect.closeTo(4200, 6), enveloppe: expect.closeTo(55800, 6) })
    expect(detail.masseSalariale).toBeCloseTo(39075.63, 2)
    expect(detail.salaireDeBase).toBeCloseTo(33978.81, 2)
    expect(detail.indemniteApportDAffaires).toBeCloseTo(1698.94, 2)
    expect(detail.reserve).toBeCloseTo(3397.88, 2)
    expect(detail.netVerse).toBeCloseTo(28827.62, 2)
    expect(detail.netImposable).toBeCloseTo(29801.62, 1)
    expect(detail.reserveConservee).toBeCloseTo(2745.49, 2)
    expect(detail.reliquat).toBeCloseTo(0, 6)
    expect(detail.valeursTypiques).toEqual(Object.keys(conditionsPortageParDefaut()))
    expect(resultat).toMatchObject({ type: "portage", statut: "Portage salarial", chiffreAffaires: 60000, charges: 4200, cotisationsSociales: 24227, impotSocietes: 0, revenuVerse: 28828, resultatConserve: 2745, beneficiaireIds: ["camille"], warnings: [] })
  })

  it("le salaire rejoint le foyer de la titulaire, avec la déduction de 10 %", () => {
    const report = simulerPortage(5000)
    const camille = report.persons.find(p => p.entityId === "camille")
    expect(camille?.detail.salairesPortage).toBe(28828)
    expect(camille?.revenusActivites).toBe(28828)
    // Imposable 29 801,62 €, moins 10 % : 26 821,46 €.
    expect(report.foyers[0].revenuImposableGlobal).toBe(26821)
    expect(report.foyers[0].resultatConserve).toBe(2745)
    expect(report.bilan.revenusAvantPrelevements).toBe(55800)
  })

  it("en CDD, l'indemnité de précarité est versée : rien n'est conservé", () => {
    const { detail, resultat } = activiteDe(simulerPortage(5000, { contrat: "CDD" }))
    expect(detail.brutVerse).toBeCloseTo(detail.masseSalariale, 6)
    expect(detail.netVerse).toBeCloseTo(31573.11, 2)
    expect(resultat.resultatConserve).toBe(0)
  })

  it("la mutuelle, retenue sur le net de chaque mois avec salaire, et déduite de l'imposable", () => {
    const sans = activiteDe(simulerPortage(5000, { contrat: "CDD" }))
    const avec = activiteDe(simulerPortage(5000, { contrat: "CDD", mutuelleMensuelle: 50 }, [0, 1, 2, 3, 4, 5]))
    expect(avec.detail.mutuelle).toBe(300)
    const sansSurSixMois = activiteDe(simulerPortage(5000, { contrat: "CDD" }, [0, 1, 2, 3, 4, 5]))
    expect(avec.detail.netVerse).toBeCloseTo(sansSurSixMois.detail.netVerse - 300, 6)
    expect(avec.detail.netImposable).toBeCloseTo(sansSurSixMois.detail.netImposable - 300, 6)
    expect(avec.resultat.cotisationsSociales - sansSurSixMois.resultat.cotisationsSociales).toBe(300)
    expect(sans.detail.mutuelle).toBe(0)
  })

  it("la réduction générale reversée augmente la masse salariale ; gardée, elle est dite", () => {
    const gardee = activiteDe(simulerPortage(5000, { contrat: "CDD" })).detail
    const reversee = activiteDe(simulerPortage(5000, { contrat: "CDD", reductionGeneraleReversee: true })).detail
    expect(gardee.reductionGeneraleGardee).toBeCloseTo(reductionGenerale(gardee.masseSalariale, { ...reglesDeTest.regimeGeneral.reductionGenerale, tDelta: 0.385 }), 6)
    expect(reversee.reductionGeneraleGardee).toBe(0)
    expect(reversee.bulletin.reductionGenerale).toBeGreaterThan(0)
    expect(reversee.masseSalariale).toBeGreaterThan(gardee.masseSalariale)
    expect(reversee.bulletin.coutEmployeur).toBeCloseTo(55800, 4)
  })

  it("frais professionnels remboursés : retirés de l'enveloppe, ni cotisés ni imposés", () => {
    const { detail, resultat } = activiteDe(simulerPortage(5000, { contrat: "CDD" }, undefined, donnees => chaqueMois(donnees, "p1", "deductible_expense", 500)))
    expect(detail.fraisProfessionnels).toBe(6000)
    expect(detail.enveloppe).toBeCloseTo(49800, 6)
    expect(resultat.charges).toBe(10200)
  })

  it("avertissements : vente écartée, frais au-delà du chiffre d'affaires, minimum conventionnel, versement mobilité non dû", () => {
    const vente = activiteDe(simulerPortage(5000, undefined, undefined, donnees => chaqueMois(donnees, "p1", "ca_vente", 1000)))
    expect(vente.detail.chiffreAffaires).toBe(60000)
    expect(vente.resultat.warnings).toContainEqual(expect.stringContaining("vente de marchandises n'est pas permise"))

    const deficit = activiteDe(simulerPortage(1000, undefined, [0], donnees => chaqueMois(donnees, "p1", "deductible_expense", 2000, [0])))
    expect(deficit.detail.masseSalariale).toBe(0)
    expect(deficit.resultat.resultatConserve).toBe(-1070) // 1 000 - 70 de frais de gestion - 2 000 de frais
    expect(deficit.resultat.warnings).toContainEqual(expect.stringContaining("dépassent le chiffre d'affaires"))

    // 1 500 € par mois : salaire de base d'environ 850 € par mois, sous le minimum de 2 000 € des règles de test.
    expect(activiteDe(simulerPortage(1500)).resultat.warnings).toContainEqual(expect.stringContaining("sous le minimum conventionnel"))
    expect(activiteDe(simulerPortage(5000)).resultat.warnings).toEqual([])

    expect(activiteDe(simulerPortage(5000, { effectif: "moinsDe11", tauxVersementMobilite: 0.02 })).resultat.warnings).toContainEqual(expect.stringContaining("versement mobilité n'est dû qu'à partir de 11 salariés"))
  })

  it("sans titulaire, le salaire n'est rattaché à aucun foyer", () => {
    const report = runMetaSimulation(chaqueMois(session([personne("camille"), portage("p1")]), "p1", "ca_services", 5000), reglesDeTest)
    const { resultat } = activiteDe(report)
    expect(resultat.beneficiaireIds).toEqual([])
    expect(resultat.warnings).toContainEqual(expect.stringContaining("Aucune relation « Titulaire »"))
    expect(report.bilan.nonRattache).toBe(28828)
  })
})

describe("conditions de la société de portage", () => {
  it("absentes : les valeurs typiques, toutes nommées", () => {
    const { conditions, valeursTypiques } = conditionsPortageRetenues(undefined)
    expect(conditions).toEqual({ tauxFraisDeGestion: 0.07, plancherMensuel: null, plafondMensuel: null, fraisFixesMensuels: 0, contrat: "CDI", effectif: "50EtPlus", tauxVersementMobilite: 0, reductionGeneraleReversee: false, mutuelleMensuelle: 0 })
    expect(valeursTypiques).toHaveLength(9)
  })

  it("saisies : elles remplacent les valeurs typiques", () => {
    const { conditions, valeursTypiques } = conditionsPortageRetenues({ tauxFraisDeGestion: 0.1, contrat: "CDD", plancherMensuel: 200 })
    expect(conditions).toMatchObject({ tauxFraisDeGestion: 0.1, contrat: "CDD", plancherMensuel: 200, plafondMensuel: null })
    expect(valeursTypiques).not.toContain("tauxFraisDeGestion")
    expect(valeursTypiques).toContain("plafondMensuel")
  })

  it("le schéma écarte seule une condition hors bornes, et un plancher au-dessus du plafond avec lui", () => {
    expect(ConditionsPortageSchema.parse({ tauxFraisDeGestion: 0.5, contrat: "CDD", effectif: "enorme", mutuelleMensuelle: -1 })).toEqual({ contrat: "CDD" })
    expect(ConditionsPortageSchema.parse({ plancherMensuel: 500, plafondMensuel: 300, fraisFixesMensuels: 20 })).toEqual({ fraisFixesMensuels: 20 })
    expect(ConditionsPortageSchema.parse({ plancherMensuel: 300, plafondMensuel: 500 })).toEqual({ plancherMensuel: 300, plafondMensuel: 500 })
  })
})
