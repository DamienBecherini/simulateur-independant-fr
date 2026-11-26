// src/backend/logic/epargne-retraite.test.ts

import { describe, expect, it } from "vitest"
import type { EpargneRetraiteDeLaPersonne, PlafondReporte } from "../../types.js"
import { avertissementsEpargneRetraite, consigneDeLaMiseEnCommun, epargneRetraiteDesMembres, plafondCalculeSurLAnnee, plafondMinimalDeLAnnee, plafondsLaissesALAnneeSuivante, type LectureDeLaDeduction, type MembreDuFoyer, type PlafondsHerites } from "./epargne-retraite.js"
import { enTexteBrut } from "./format.js"
import { reglesDeTest } from "./testing/regles-de-test.js"

// Règles de test : 10 % des revenus, retenus jusqu'à 8 plafonds de la sécurité sociale ; plafond de l'année 40 000 €
// (plafond calculé d'au moins 4 000 €, d'au plus 32 000 €) ; plafond de l'année précédente 39 000 € (minimum des
// versements de l'année : 3 900 €) ; report de 3 ans.
const regles = reglesDeTest.IR.epargneRetraite
const PASS = 40000
const ANNEE = 2000

const membre = (personId: string, autres: Partial<MembreDuFoyer> = {}): MembreDuFoyer => ({ personId, enCouple: false, verse: 0, plafondSaisi: undefined, herites: undefined, revenusProfessionnels: 0, ...autres })
const reporte = (annee: number, montant: number, utilisableJusquEn = annee + 3): PlafondReporte => ({ annee, montant, utilisableJusquEn })
const herites = (plafondCalcule: number, plafondsRestants: PlafondReporte[] = [], resteNonReporte?: PlafondReporte): PlafondsHerites => ({ plafondCalcule, plafondsRestants, ...(resteNonReporte ? { resteNonReporte } : {}) })
const epargne = (...membres: MembreDuFoyer[]) => epargneRetraiteDesMembres(membres, ANNEE, reglesDeTest)
const seul = (autres: Partial<MembreDuFoyer>) => epargne(membre("a", autres))[0]

describe("plafond calculé sur les revenus d'une année", () => {
  it("vaut 10 % des revenus d'activité professionnelle", () => {
    expect(plafondCalculeSurLAnnee(60000, PASS, regles)).toEqual({ plafondCalcule: 6000, baseDuPlafondCalcule: "revenus" })
  })

  it("ne descend pas sous 10 % du plafond de la sécurité sociale, même sans revenu ou avec un déficit", () => {
    expect(plafondCalculeSurLAnnee(30000, PASS, regles)).toEqual({ plafondCalcule: 4000, baseDuPlafondCalcule: "minimum" })
    expect(plafondCalculeSurLAnnee(0, PASS, regles).plafondCalcule).toBe(4000)
    expect(plafondCalculeSurLAnnee(-25000, PASS, regles)).toEqual({ plafondCalcule: 4000, baseDuPlafondCalcule: "minimum" })
  })

  it("retient les revenus dans la limite de 8 plafonds de la sécurité sociale", () => {
    expect(plafondCalculeSurLAnnee(400000, PASS, regles)).toEqual({ plafondCalcule: 32000, baseDuPlafondCalcule: "maximum" })
    expect(plafondCalculeSurLAnnee(319990, PASS, regles)).toEqual({ plafondCalcule: 31999, baseDuPlafondCalcule: "revenus" })
  })

  it("s'arrondit à l'euro, comme sur l'avis d'impôt", () => {
    // 10 % de 46 368 € = 4 636,80 € : la brochure de l'impôt écrit 4 637 €.
    expect(plafondCalculeSurLAnnee(0, 46368, regles).plafondCalcule).toBe(4637)
    expect(plafondCalculeSurLAnnee(52345, PASS, regles).plafondCalcule).toBe(5235)
  })

  it("donne pour minimum des versements de l'année 10 % du plafond de la sécurité sociale de l'année précédente", () => {
    expect(plafondMinimalDeLAnnee(ANNEE, reglesDeTest)).toBe(3900)
  })

  it("au-delà des dernières règles connues, l'année précédente est celle de ces règles : son plafond donne le minimum", () => {
    // 2001 et 2002 sont simulées avec les règles de 2000 : le dernier plafond de la sécurité sociale connu est le leur.
    expect(plafondMinimalDeLAnnee(ANNEE + 1, reglesDeTest)).toBe(4000)
    expect(plafondMinimalDeLAnnee(ANNEE + 2, reglesDeTest)).toBe(4000)
    expect(epargneRetraiteDesMembres([membre("a", { verse: 5000 })], ANNEE + 1, reglesDeTest)[0]).toMatchObject({ plafond: 4000, originePlafond: "minimumFauteDeSaisie", nonDeduit: 1000 })
  })
})

describe("plafond de la première année de la session", () => {
  it("est celui saisi dans la fiche, qui contient déjà les plafonds reportés", () => {
    const resultat = seul({ plafondSaisi: 10000, verse: 4000 })

    expect(resultat).toMatchObject({ plafond: 10000, originePlafond: "saisi", plafondsReportes: [], verse: 4000, imputeSurSesPlafonds: 4000, imputeSurLeConjoint: 0, nonDeduit: 0 })
  })

  it("ne reporte pas le reste du plafond saisi, dont l'année d'origine n'est pas connue, mais le dit", () => {
    const resultat = seul({ plafondSaisi: 10000, verse: 4000 })

    expect(resultat.plafondsRestants).toEqual([])
    expect(resultat.resteNonReporte).toEqual(reporte(ANNEE, 6000))
    expect(plafondsLaissesALAnneeSuivante(resultat).plafondsRestants).toEqual([])
  })

  it("ne garde aucun reste d'un plafond saisi entièrement utilisé", () => {
    expect(seul({ plafondSaisi: 4000, verse: 5000 })).toMatchObject({ imputeSurSesPlafonds: 4000, nonDeduit: 1000 })
    expect(seul({ plafondSaisi: 4000, verse: 5000 }).resteNonReporte).toBeUndefined()
  })

  it("accepte un plafond saisi nul : rien n'est déduit", () => {
    expect(seul({ plafondSaisi: 0, verse: 1000 })).toMatchObject({ plafond: 0, originePlafond: "saisi", imputeSurSesPlafonds: 0, nonDeduit: 1000 })
  })

  it("est le minimum légal faute de saisie, et son reste se reporte 3 ans", () => {
    const resultat = seul({ verse: 1000 })

    expect(resultat).toMatchObject({ plafond: 3900, originePlafond: "minimumFauteDeSaisie", imputeSurSesPlafonds: 1000, nonDeduit: 0 })
    expect(resultat.plafondsRestants).toEqual([reporte(ANNEE, 2900, ANNEE + 3)])
    expect(resultat.resteNonReporte).toBeUndefined()
  })

  it("laisse sans déduction ni report ce qui dépasse le plafond", () => {
    expect(seul({ verse: 5000 })).toMatchObject({ imputeSurSesPlafonds: 3900, nonDeduit: 1100, plafondsRestants: [] })
  })
})

describe("plafond d'une année suivante", () => {
  it("est celui calculé sur l'année précédente, plus les plafonds reportés encore utilisables, du plus ancien au plus récent", () => {
    const resultat = seul({ herites: herites(6000, [reporte(1999, 1000), reporte(1998, 500), reporte(1996, 800)]) })

    expect(resultat).toMatchObject({ plafond: 6000, originePlafond: "calcule" })
    // Le plafond de 1996, utilisable jusqu'en 1999, a expiré.
    expect(resultat.plafondsReportes).toEqual([reporte(1998, 500), reporte(1999, 1000)])
  })

  it("est le minimum légal quand l'année précédente n'est pas dans la session, sans égard au plafond saisi", () => {
    expect(seul({ herites: null, plafondSaisi: 20000, verse: 5000 })).toMatchObject({ plafond: 3900, originePlafond: "minimumFauteDAnneePrecedente", imputeSurSesPlafonds: 3900, nonDeduit: 1100 })
  })

  it("impute le versement sur le plafond de l'année, puis sur les plafonds reportés, du plus ancien au plus récent", () => {
    // Plafond de l'année 4 710 € ; 2 000 € reportés de 1997 (dernière année : 2000) et 1 000 € de 1999.
    const resultat = seul({ verse: 7000, herites: herites(4710, [reporte(1999, 1000), reporte(1997, 2000)]) })

    // 4 710 + 2 000 + 290 = 7 000 : tout est déduit, il reste 710 € du plafond de 1999.
    expect(resultat).toMatchObject({ imputeSurSesPlafonds: 7000, nonDeduit: 0 })
    expect(resultat.plafondsRestants).toEqual([reporte(1999, 710)])
  })

  it("garde le reste du plafond de l'année et des plafonds reportés, sauf ceux qui expirent cette année", () => {
    const resultat = seul({ verse: 1000, herites: herites(4710, [reporte(1999, 1000), reporte(1997, 2000)]) })

    // Le plafond de 1997 pouvait encore servir en 2000, plus après.
    expect(resultat.plafondsRestants).toEqual([reporte(1999, 1000), reporte(ANNEE, 3710)])
  })

  it("laisse à l'année suivante le plafond calculé sur l'année et les plafonds restants", () => {
    const resultat = seul({ verse: 1000, revenusProfessionnels: 60000, herites: herites(4710) })

    expect(resultat).toMatchObject({ revenusProfessionnels: 60000, plafondCalcule: 6000, baseDuPlafondCalcule: "revenus" })
    expect(plafondsLaissesALAnneeSuivante(resultat)).toEqual({ plafondCalcule: 6000, plafondsRestants: [reporte(ANNEE, 3710)] })
  })

  it("rappelle le reste non reporté de la première année tant qu'il pourrait encore servir", () => {
    const reste = reporte(1998, 6000, 2001)

    expect(seul({ herites: herites(4000, [], reste) }).resteNonReporte).toEqual(reste)
    expect(epargneRetraiteDesMembres([membre("a", { herites: herites(4000, [], reste) })], 2001, reglesDeTest)[0].resteNonReporte).toEqual(reste)
    expect(epargneRetraiteDesMembres([membre("a", { herites: herites(4000, [], reste) })], 2002, reglesDeTest)[0].resteNonReporte).toBeUndefined()
  })
})

describe("versements", () => {
  it("s'arrondissent à l'euro, et un total négatif ne compte pas", () => {
    expect(seul({ verse: 1000.4 }).verse).toBe(1000)
    expect(seul({ verse: -500 })).toMatchObject({ verse: 0, imputeSurSesPlafonds: 0, nonDeduit: 0 })
  })

  it("ne changent rien au plafond calculé sur l'année", () => {
    expect(seul({ verse: 3000, revenusProfessionnels: 60000 }).plafondCalcule).toBe(seul({ revenusProfessionnels: 60000 }).plafondCalcule)
  })
})

describe("plafonds d'un couple mis en commun", () => {
  const paul = (autres: Partial<MembreDuFoyer> = {}) => membre("paul", { enCouple: true, plafondSaisi: 9000, ...autres })
  const sophie = (autres: Partial<MembreDuFoyer> = {}) => membre("sophie", { enCouple: true, plafondSaisi: 4710, ...autres })

  it("prend ce qui dépasse le plafond de l'un sur ce qui reste à l'autre, qui garde le solde", () => {
    const [lui, elle] = epargne(paul({ verse: 12000 }), sophie())

    expect(lui).toMatchObject({ imputeSurSesPlafonds: 9000, imputeSurLeConjoint: 3000, preteAuConjoint: 0, nonDeduit: 0 })
    expect(elle).toMatchObject({ imputeSurSesPlafonds: 0, imputeSurLeConjoint: 0, preteAuConjoint: 3000, nonDeduit: 0 })
    expect(elle.resteNonReporte?.montant).toBe(1710)
    expect(lui.resteNonReporte).toBeUndefined()
  })

  it("laisse chacun épuiser d'abord son propre plafond", () => {
    const [lui, elle] = epargne(paul({ verse: 12000 }), sophie({ verse: 4000 }))

    // Il reste 710 € à Sophie après ses propres versements : Paul n'en prend pas plus.
    expect(elle).toMatchObject({ imputeSurSesPlafonds: 4000, preteAuConjoint: 710 })
    expect(lui).toMatchObject({ imputeSurSesPlafonds: 9000, imputeSurLeConjoint: 710, nonDeduit: 2290 })
  })

  it("joue dans les deux sens, quel que soit l'ordre des déclarants", () => {
    const [lui, elle] = epargne(paul(), sophie({ verse: 6000 }))

    expect(elle).toMatchObject({ imputeSurSesPlafonds: 4710, imputeSurLeConjoint: 1290, nonDeduit: 0 })
    expect(lui).toMatchObject({ preteAuConjoint: 1290 })
    expect(lui.resteNonReporte?.montant).toBe(7710)
  })

  it("ne déduit rien de plus quand les deux dépassent", () => {
    const [lui, elle] = epargne(paul({ verse: 10000 }), sophie({ verse: 5000 }))

    expect(lui).toMatchObject({ imputeSurLeConjoint: 0, nonDeduit: 1000 })
    expect(elle).toMatchObject({ imputeSurLeConjoint: 0, nonDeduit: 290 })
  })

  it("prend sur le plafond de l'année du conjoint, puis sur ses plafonds reportés, du plus ancien au plus récent", () => {
    const [lui, elle] = epargne(paul({ verse: 15000 }), membre("sophie", { enCouple: true, herites: herites(4000, [reporte(1999, 1000), reporte(1998, 2000)]) }))

    // 6 000 € à prendre : 4 000 € du plafond de l'année, puis les 2 000 € de 1998 ; les 1 000 € de 1999 restent.
    expect(lui).toMatchObject({ imputeSurLeConjoint: 6000, nonDeduit: 0 })
    expect(elle.plafondsRestants).toEqual([reporte(1999, 1000)])
  })

  it("ne joue ni pour deux personnes de foyers distincts ni pour un enfant rattaché", () => {
    const [parent, enfant] = epargne(membre("parent", { verse: 0 }), membre("enfant", { verse: 5000 }))

    expect(enfant).toMatchObject({ imputeSurSesPlafonds: 3900, imputeSurLeConjoint: 0, nonDeduit: 1100 })
    expect(parent.preteAuConjoint).toBe(0)
  })
})

describe("avertissements", () => {
  const NOMS: Record<string, string> = { a: "Anne", paul: "Paul", sophie: "Sophie" }
  const lecture = (personnes: EpargneRetraiteDeLaPersonne[], autres: Partial<LectureDeLaDeduction> = {}): LectureDeLaDeduction => {
    const impute = personnes.reduce((cumul, p) => cumul + p.imputeSurSesPlafonds + p.imputeSurLeConjoint, 0)
    return { annee: ANNEE, personnes, nomDe: id => NOMS[id] ?? id, deduction: impute, revenuAvantDeduction: 50000, impotEconomise: 1000, auVersementLiberatoire: false, ...autres }
  }
  const messages = (personnes: EpargneRetraiteDeLaPersonne[], autres: Partial<LectureDeLaDeduction> = {}) => avertissementsEpargneRetraite(lecture(personnes, autres)).map(enTexteBrut)

  it("ne disent rien d'un foyer sans versement", () => {
    expect(messages(epargne(membre("a")))).toEqual([])
    expect(messages(epargne(membre("paul", { enCouple: true }), membre("sophie", { enCouple: true })))).toEqual([])
  })

  it("ne disent rien d'un versement sous le plafond saisi, qui réduit l'impôt", () => {
    expect(messages(epargne(membre("a", { plafondSaisi: 5000, verse: 4000 })))).toEqual([])
  })

  it("donnent ce qui dépasse le plafond de l'année, sans nommer la personne quand elle est seule dans son foyer", () => {
    expect(messages(epargne(membre("a", { plafondSaisi: 4710, verse: 5000 })))).toEqual(["Versement PER : 290 € dépassent le plafond de 2000 (4 710 €). Ils ne sont pas déduits, et ne le seront pas les années suivantes."])
  })

  it("nomment la personne dans un foyer de plusieurs personnes, et comptent ce qui restait à son conjoint", () => {
    const personnes = epargne(membre("paul", { enCouple: true, plafondSaisi: 9000, verse: 15000 }), membre("sophie", { enCouple: true, plafondSaisi: 4710 }))

    expect(messages(personnes)).toEqual(["Versement PER de Paul : 1 290 € dépassent les plafonds utilisables en 2000 (13 710 €, avec ce qui restait à son conjoint). Ils ne sont pas déduits, et ne le seront pas les années suivantes."])
  })

  it("rappellent, au dépassement d'une année suivante, le reste du plafond saisi que le simulateur n'a pas reporté", () => {
    const [message] = messages(epargne(membre("a", { verse: 5000, herites: herites(4000, [], reporte(1999, 6000)) })))

    expect(message).toBe("Versement PER : 1 000 € dépassent le plafond de 2000 (4 000 €). Ils ne sont pas déduits, et ne le seront pas les années suivantes. Le plafond saisi pour 1999 n'avait pas été utilisé en entier : le simulateur ne reporte pas ce reste (6 000 €), faute de connaître l'année d'origine de chaque part. S'il est encore utilisable, la déduction réelle est plus élevée.")
  })

  it("préviennent qu'un versement est sans effet quand le foyer n'a aucun revenu au barème, et rappellent l'option pour la non-déduction", () => {
    const personnes = epargne(membre("a", { plafondSaisi: 4710, verse: 4710 }))

    expect(messages(personnes, { deduction: 0, revenuAvantDeduction: 0, impotEconomise: 0, auVersementLiberatoire: true })).toEqual([
      "Versement PER sans effet sur l'impôt : avec le versement libératoire, le foyer n'a aucun revenu au barème dont le déduire. Les 4 710 € ne sont pas déduits, et ne le seront pas les années suivantes. L'option pour la non-déduction, à demander à l'assureur lors du versement, évite au moins l'impôt sur ces sommes à la sortie."
    ])
    expect(messages(personnes, { deduction: 0, revenuAvantDeduction: 0, impotEconomise: 0 })[0]).toContain("sans effet sur l'impôt : le foyer n'a aucun revenu au barème")
  })

  it("préviennent qu'un versement n'est déduit qu'en partie quand le revenu imposable est plus faible que lui", () => {
    const personnes = epargne(membre("a", { plafondSaisi: 4710, verse: 4710 }))

    expect(messages(personnes, { deduction: 3000, revenuAvantDeduction: 3000, impotEconomise: 0 })).toEqual([
      "Versement PER déduit en partie : le foyer n'a que 3 000 € de revenu imposable au barème. 1 710 € ne sont pas déduits, et ne le seront pas les années suivantes. L'option pour la non-déduction, à demander à l'assureur lors du versement, évite au moins l'impôt sur ces sommes à la sortie."
    ])
  })

  it("préviennent qu'une déduction entière ne réduit pas l'impôt d'un foyer qui n'en paie pas", () => {
    const personnes = epargne(membre("a", { plafondSaisi: 4710, verse: 4710 }))

    expect(messages(personnes, { impotEconomise: 0 })).toEqual([
      "Versement PER sans effet sur l'impôt : le foyer ne paie pas d'impôt au barème, avec ou sans la déduction de 4 710 €. Elle consomme le plafond sans rien économiser. L'option pour la non-déduction, à demander à l'assureur lors du versement, évite au moins l'impôt sur ces sommes à la sortie."
    ])
  })

  it("disent que le minimum légal est retenu faute de plafond saisi, pour qui verse ou prête son plafond", () => {
    expect(messages(epargne(membre("a", { verse: 1000 })))).toEqual(["Épargne retraite : le plafond de 2000 n'est pas saisi, le minimum légal est retenu (3 900 €). Le vôtre est sur l'avis d'impôt reçu en 2000, ligne « Plafond pour les cotisations versées en 2000 » : saisissez-le dans la fiche de la personne."])

    const couple = messages(epargne(membre("paul", { enCouple: true, plafondSaisi: 9000, verse: 10000 }), membre("sophie", { enCouple: true })))
    expect(couple).toEqual(["Épargne retraite de Sophie : le plafond de 2000 n'est pas saisi, le minimum légal est retenu (3 900 €). Le vôtre est sur l'avis d'impôt reçu en 2000, ligne « Plafond pour les cotisations versées en 2000 » : saisissez-le dans la fiche de la personne."])
  })

  it("disent que le minimum légal est retenu quand l'année précédente manque à la simulation", () => {
    expect(messages(epargne(membre("a", { verse: 1000, herites: null })))).toEqual(["Épargne retraite : l'année 1999 n'est pas dans la simulation, le minimum légal est retenu pour le plafond de 2000 (3 900 €)."])
  })

  it("élident devant un nom qui commence par une voyelle", () => {
    const personnes = epargne(membre("a", { enCouple: true, plafondSaisi: 1000, verse: 1500 }), membre("paul", { enCouple: true, plafondSaisi: 0 }))

    expect(messages(personnes)[0]).toMatch(/^Versement PER d'Anne : 500 € dépassent le plafond de 2000/)
  })
})

describe("consigne de la mise en commun", () => {
  const personnes = epargne(membre("paul", { enCouple: true, plafondSaisi: 9000, verse: 12000 }), membre("sophie", { enCouple: true, plafondSaisi: 4710 }))
  const nomDe = (id: string) => (id === "sophie" ? "Sophie" : "Paul")

  it("dit de cocher la case 6QR, ce qui est pris sur le plafond du conjoint, et l'impôt en plus sans elle", () => {
    const consigne = consigneDeLaMiseEnCommun({ trancheMarginale: 0.3, partDesRevenus: 0.1, miseEnCommun: { montant: 3000, impotEnPlusSansElle: 900 }, personnes }, nomDe)

    expect(enTexteBrut(consigne!)).toBe("Pour déduire les 3 000 € pris sur le plafond de Sophie, cochez la case 6QR de la déclaration de revenus. Sans elle, ils ne seraient pas déduits : 900 € d'impôt en plus.")
  })

  it("ne chiffre pas un impôt en plus qui serait nul", () => {
    const consigne = consigneDeLaMiseEnCommun({ trancheMarginale: 0, partDesRevenus: 0.1, miseEnCommun: { montant: 3000, impotEnPlusSansElle: 0 }, personnes }, nomDe)

    expect(enTexteBrut(consigne!)).toBe("Pour déduire les 3 000 € pris sur le plafond de Sophie, cochez la case 6QR de la déclaration de revenus. Sans elle, ils ne seraient pas déduits.")
  })

  it("n'existe pas quand personne ne prend sur le plafond de l'autre", () => {
    expect(consigneDeLaMiseEnCommun({ trancheMarginale: 0.3, partDesRevenus: 0.1, personnes }, nomDe)).toBeNull()
  })
})
