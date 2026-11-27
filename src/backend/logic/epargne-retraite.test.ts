// src/backend/logic/epargne-retraite.test.ts

import { describe, expect, it } from "vitest"
import type { DeductionDuRevenuProfessionnel, EpargneRetraiteDeLaPersonne, PlafondReporte } from "../../types.js"
import {
  avecLePlafondEpargneRetraite,
  avertissementsEpargneRetraite,
  baseDuPlafondCalculeEnClair,
  consigneDeLaMiseEnCommun,
  deductionDuRevenuProfessionnel,
  duRevenuProfessionnelEnClair,
  effetSurLePlafondCalculeEnClair,
  epargneRetraiteDesMembres,
  excedentsSurLesPlafonds,
  limiteDuRevenuProfessionnel,
  limiteDuRevenuProfessionnelEnClair,
  origineDuPlafondEnClair,
  plafondCalculeSurLAnnee,
  plafondMinimalDeLAnnee,
  plafondSaisiDeLAnnee,
  plafondsLaissesALAnneeSuivante,
  reductionDuPlafondSuivant,
  type LectureDeLaDeduction,
  type MembreDuFoyer,
  type PlafondsHerites,
  type RevenuDeductible
} from "./epargne-retraite.js"
import { enTexteBrut } from "./format.js"
import { reglesPubliees } from "./regles.js"
import { reglesDeTest } from "./testing/regles-de-test.js"
import { personne } from "./testing/session-de-test.js"

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

  it("est le minimum légal quand l'année précédente n'est pas dans la session", () => {
    expect(seul({ herites: null, verse: 5000 })).toMatchObject({ plafond: 3900, originePlafond: "minimumFauteDAnneePrecedente", imputeSurSesPlafonds: 3900, nonDeduit: 1100 })
  })

  it("est le plafond saisi, quand il vaut pour l'année : il contient déjà les plafonds reportés, et l'emporte sur le calcul", () => {
    expect(seul({ herites: herites(5000, [reporte(1999, 2000)]), plafondSaisi: 12000, verse: 6000 })).toMatchObject({ plafond: 12000, originePlafond: "saisi", plafondsReportes: [], imputeSurSesPlafonds: 6000 })
    expect(seul({ herites: null, plafondSaisi: 12000, verse: 6000 })).toMatchObject({ plafond: 12000, originePlafond: "saisi" })
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
    return { annee: ANNEE, personnes, nomDe: id => NOMS[id] ?? id, nomDeLActivite: id => `Atelier ${id}`, deduction: impute, revenuAvantDeduction: 50000, impotEconomise: 1000, auVersementLiberatoire: false, ...autres }
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

describe("origine du plafond, en clair", () => {
  it("dit d'où vient le plafond de l'année, avec l'année précédente quand elle compte", () => {
    expect(origineDuPlafondEnClair({ originePlafond: "saisi" }, 2026)).toBe("saisi dans la fiche")
    expect(origineDuPlafondEnClair({ originePlafond: "calcule" }, 2026)).toBe("calculé sur les revenus de 2025")
    expect(origineDuPlafondEnClair({ originePlafond: "minimumFauteDeSaisie" }, 2026)).toBe("le minimum légal, faute de plafond saisi dans la fiche")
    expect(origineDuPlafondEnClair({ originePlafond: "minimumFauteDAnneePrecedente" }, 2026)).toBe("le minimum légal, 2025 n'étant pas dans la simulation")
  })

  it("nomme la fiche de la personne quand son nom est donné, avec l'élision", () => {
    expect(origineDuPlafondEnClair({ originePlafond: "saisi" }, 2026, "Sophie")).toBe("saisi dans la fiche de Sophie")
    expect(origineDuPlafondEnClair({ originePlafond: "minimumFauteDeSaisie" }, 2026, "Anne")).toBe("le minimum légal, faute de plafond saisi dans la fiche d'Anne")
    expect(origineDuPlafondEnClair({ originePlafond: "calcule" }, 2026, "Sophie")).toBe("calculé sur les revenus de 2025")
  })
})

describe("base du plafond calculé, en clair", () => {
  const base = (baseDuPlafondCalcule: "revenus" | "minimum" | "maximum", revenusProfessionnels: number) => enTexteBrut(baseDuPlafondCalculeEnClair({ baseDuPlafondCalcule, revenusProfessionnels }, 2026, 0.1))

  it("cite la part des revenus d'activité professionnelle, et leur montant", () => {
    expect(base("revenus", 60000)).toBe("10 % des revenus d'activité professionnelle de 2026 (60 000 €)")
  })

  it("dit ce que cette part aurait donné quand le minimum légal l'emporte, sauf sans revenu", () => {
    expect(base("minimum", 45000)).toBe("le minimum légal (10 % des revenus d'activité professionnelle de 2026 ne donnent que 4 500 €)")
    expect(base("minimum", 0)).toBe("le minimum légal")
    expect(base("minimum", -5000)).toBe("le minimum légal")
  })

  it("dit que le maximum légal est atteint", () => {
    expect(base("maximum", 500000)).toBe("le maximum légal")
  })
})

// --- Année du plafond saisi ---

describe("plafond saisi et son année", () => {
  const avec = (plafondEpargneRetraite?: number, anneeDuPlafondEpargneRetraite?: number) => ({ ...(plafondEpargneRetraite === undefined ? {} : { plafondEpargneRetraite }), ...(anneeDuPlafondEpargneRetraite === undefined ? {} : { anneeDuPlafondEpargneRetraite }) })

  it("vaut pour l'année enregistrée avec lui, et pour elle seule", () => {
    expect(plafondSaisiDeLAnnee(avec(12000, 2026), 2026, false)).toEqual({ plafondSaisi: 12000 })
    expect(plafondSaisiDeLAnnee(avec(12000, 2026), 2025, true)).toEqual({ plafondSaisi: undefined, plafondSaisiPour: 2026 })
    expect(plafondSaisiDeLAnnee(avec(12000, 2026), 2027, false)).toEqual({ plafondSaisi: undefined, plafondSaisiPour: 2026 })
  })

  it("sans année enregistrée (fichier d'avant), vaut pour la première année simulée", () => {
    expect(plafondSaisiDeLAnnee(avec(12000), 2025, true)).toEqual({ plafondSaisi: 12000 })
    expect(plafondSaisiDeLAnnee(avec(12000), 2026, false)).toEqual({ plafondSaisi: undefined })
    expect(plafondSaisiDeLAnnee(avec(), 2026, true)).toEqual({ plafondSaisi: undefined })
    expect(plafondSaisiDeLAnnee(undefined, 2026, true)).toEqual({ plafondSaisi: undefined })
  })

  it("s'enregistre avec la première année simulable, et garde son année quand il change", () => {
    const sophie = personne("s")

    const saisi = avecLePlafondEpargneRetraite(sophie, 4637, [2027, 2026, 2023])
    expect(saisi).toMatchObject({ plafondEpargneRetraite: 4637, anneeDuPlafondEpargneRetraite: 2026 })
    // Une année ajoutée avant ne déplace pas l'année d'un plafond qu'on corrige.
    expect(avecLePlafondEpargneRetraite(saisi, 5000, [2025, 2026, 2027])).toMatchObject({ plafondEpargneRetraite: 5000, anneeDuPlafondEpargneRetraite: 2026 })
    // Effacé, il emporte son année ; saisi de nouveau, il prend la première année d'alors.
    const efface = avecLePlafondEpargneRetraite(saisi, undefined, [2025, 2026])
    expect(efface).not.toHaveProperty("plafondEpargneRetraite")
    expect(efface).not.toHaveProperty("anneeDuPlafondEpargneRetraite")
    expect(avecLePlafondEpargneRetraite(efface, 4000, [2025, 2026])).toMatchObject({ anneeDuPlafondEpargneRetraite: 2025 })
  })

  it("prend la première année simulable pour un plafond d'un fichier d'avant, sans année, et reste sans année sans année simulable", () => {
    expect(avecLePlafondEpargneRetraite({ ...personne("s"), plafondEpargneRetraite: 4000 }, 4500, [2026])).toMatchObject({ plafondEpargneRetraite: 4500, anneeDuPlafondEpargneRetraite: 2026 })
    expect(avecLePlafondEpargneRetraite(personne("s"), 4500, [2020])).not.toHaveProperty("anneeDuPlafondEpargneRetraite")
  })

  it("dit, la première année, qu'un plafond saisi vaut pour une autre", () => {
    const [a] = epargne(membre("a", { verse: 1000, plafondSaisiPour: 2026 }))

    expect(a).toMatchObject({ plafond: 3900, originePlafond: "minimumFauteDeSaisie", plafondSaisiPour: 2026 })
    expect(origineDuPlafondEnClair(a, ANNEE, "Anne")).toBe("le minimum légal, celui saisi dans la fiche d'Anne valant pour 2026")
    expect(avertissementsEpargneRetraite({ annee: ANNEE, personnes: [a], nomDe: id => id, nomDeLActivite: id => id, deduction: 1000, revenuAvantDeduction: 50000, impotEconomise: 300, auVersementLiberatoire: false }).map(enTexteBrut)).toEqual([
      "Épargne retraite : le plafond saisi dans la fiche vaut pour 2026 ; pour 2000, le minimum légal est retenu (3 900 €)."
    ])
  })
})

// --- Déduction du bénéfice ou de la rémunération (article 154 bis) ---

/** Une déduction du bénéfice d'une entreprise individuelle, telle que le moteur la décide. */
const deduction = (autres: Partial<DeductionDuRevenuProfessionnel> = {}): DeductionDuRevenuProfessionnel => ({
  activiteId: "ei",
  personId: "a",
  cadre: "benefice",
  montant: 1000,
  limite: 5000,
  baseDeLaLimite: "revenu",
  revenuDeLaLimite: 50000,
  revenuAvantDeduction: 50000,
  plafondSecuriteSociale: PASS,
  ...autres
})

/** Les règles de la limite ne changent pas d'une année à l'autre : 10 %, 8 plafonds, 15 %, minimum de 10 % d'un plafond. */
const regles154bis = reglesPubliees(2026).IR.epargneRetraite.deductionDuRevenuProfessionnel

describe("limite de ce qui se déduit du bénéfice ou de la rémunération", () => {
  it("reproduit l'exemple du BOFiP : 150 000 € de bénéfice, plafond de 35 352 €, 15 000 + 15 % x 114 648 = 32 197 €", () => {
    expect(limiteDuRevenuProfessionnel(150000, 35352, regles154bis)).toEqual({ limite: 32197, baseDeLaLimite: "revenu" })
  })

  it("reproduit l'exemple de la brochure de 2025 : 50 000 € de bénéfice, plafond de 46 368 €, 5 000 + 545 = 5 545 €", () => {
    expect(limiteDuRevenuProfessionnel(50000, 46368, regles154bis)).toEqual({ limite: 5545, baseDeLaLimite: "revenu" })
  })

  it("retient le revenu dans la limite de 8 plafonds : au plus 1,85 plafond, 88 911 € en 2026", () => {
    expect(limiteDuRevenuProfessionnel(60000, 48060, regles154bis).limite).toBe(7791)
    expect(limiteDuRevenuProfessionnel(1000000, 48060, regles154bis).limite).toBe(88911)
    expect(limiteDuRevenuProfessionnel(8 * 48060, 48060, regles154bis).limite).toBe(88911)
  })

  it("vaut au moins 10 % du plafond, même sans bénéfice ou avec un déficit", () => {
    expect(limiteDuRevenuProfessionnel(30000, 48060, regles154bis)).toEqual({ limite: 4806, baseDeLaLimite: "minimum" })
    expect(limiteDuRevenuProfessionnel(0, 48060, regles154bis)).toEqual({ limite: 4806, baseDeLaLimite: "minimum" })
    expect(limiteDuRevenuProfessionnel(-10000, 48060, regles154bis)).toEqual({ limite: 4806, baseDeLaLimite: "minimum" })
  })

  it("suit le plafond de la sécurité sociale qu'on lui donne : réduit à 9 mois l'année de création, 36 045 €", () => {
    // 6 000 + 15 % x (60 000 - 36 045) = 9 593,25 €.
    expect(limiteDuRevenuProfessionnel(60000, 36045, regles154bis)).toEqual({ limite: 9593, baseDeLaLimite: "revenu" })
    expect(limiteDuRevenuProfessionnel(0, 36045, regles154bis).limite).toBe(3605)
  })
})

describe("déduction du bénéfice ou de la rémunération", () => {
  const candidat = (autres: Partial<RevenuDeductible> = {}): RevenuDeductible => ({ activiteId: "ei", personId: "sophie", cadre: "benefice", revenuAvantDeduction: 60000, revenuDeLaLimite: 60000, plafondSecuriteSociale: 48060, ...autres })

  it("n'existe pas sans rien au-delà des plafonds du revenu global, ni sans activité qui la permette", () => {
    expect(deductionDuRevenuProfessionnel(0, [candidat()], regles154bis)).toBeUndefined()
    expect(deductionDuRevenuProfessionnel(-100, [candidat()], regles154bis)).toBeUndefined()
    expect(deductionDuRevenuProfessionnel(1290, [], regles154bis)).toBeUndefined()
  })

  it("prend ce qui dépasse, dans la limite de l'année (cas 1 de l'étude : 1 290 € sous une limite de 7 791 €)", () => {
    expect(deductionDuRevenuProfessionnel(1290, [candidat()], regles154bis)).toEqual({ activiteId: "ei", personId: "sophie", cadre: "benefice", montant: 1290, limite: 7791, baseDeLaLimite: "revenu", revenuDeLaLimite: 60000, revenuAvantDeduction: 60000, plafondSecuriteSociale: 48060 })
    expect(deductionDuRevenuProfessionnel(10000, [candidat()], regles154bis)?.montant).toBe(7791)
  })

  it("va sur l'activité au plus grand revenu, quelle que soit leur place (hypothèse 4 de l'ADR 021)", () => {
    const petite = candidat({ activiteId: "petite", revenuAvantDeduction: 20000, revenuDeLaLimite: 20000 })
    const grande = candidat({ activiteId: "grande" })

    expect(deductionDuRevenuProfessionnel(1000, [petite, grande], regles154bis)?.activiteId).toBe("grande")
    expect(deductionDuRevenuProfessionnel(1000, [grande, petite], regles154bis)?.activiteId).toBe("grande")
  })

  it("peut creuser le déficit d'une entreprise individuelle, dans la limite minimale", () => {
    expect(deductionDuRevenuProfessionnel(6000, [candidat({ revenuAvantDeduction: -8000, revenuDeLaLimite: -8000 })], regles154bis)).toMatchObject({ montant: 4806, limite: 4806, baseDeLaLimite: "minimum" })
  })

  it("ne rend pas négative la rémunération d'un gérant, et n'existe pas sans rémunération", () => {
    const gerant = (remuneration: number) => candidat({ cadre: "remuneration", revenuAvantDeduction: remuneration, revenuDeLaLimite: remuneration * 0.9 })

    expect(deductionDuRevenuProfessionnel(5000, [gerant(3000.7)], regles154bis)).toMatchObject({ montant: 3000, limite: 4806 })
    expect(deductionDuRevenuProfessionnel(5000, [gerant(0)], regles154bis)).toBeUndefined()
  })
})

describe("ce que la déduction du bénéfice retire du plafond de l'année suivante", () => {
  it("retire son montant, moins la part de 15 % du bénéfice après déduction au-delà d'un plafond", () => {
    // Exemple de la brochure de 2025 : 4 000 - 15 % x (50 000 - 46 368) = 3 455 €.
    expect(reductionDuPlafondSuivant(4000, 50000, 46368, regles154bis)).toBe(3455)
    // Variante écartée du cas 1 de l'étude : 6 000 - 15 % x (54 000 - 48 060) = 5 109 €.
    expect(reductionDuPlafondSuivant(6000, 54000, 48060, regles154bis)).toBe(5109)
  })

  it("ne retire rien d'une déduction qui tient dans la part de 15 %, et tout sous un plafond de bénéfice", () => {
    // Cas 1 de l'étude : 1 290 - 15 % x (58 710 - 48 060) < 0.
    expect(reductionDuPlafondSuivant(1290, 58710, 48060, regles154bis)).toBe(0)
    expect(reductionDuPlafondSuivant(3290, 33039, 48060, regles154bis)).toBe(3290)
  })

  it("reproduit l'exemple de la brochure de 2025 : 5 000 € de plafond calculé, moins 3 455 €, laissent 1 545 €", () => {
    const regles2024 = reglesPubliees(2024)
    const duRevenuProfessionnel = { deduction: deduction({ montant: 4000, plafondSecuriteSociale: 46368 }), revenuApresDeduction: 50000 }
    // Plafond saisi nul : les 4 000 € versés passent tous sur le bénéfice.
    const [a] = epargneRetraiteDesMembres([membre("a", { plafondSaisi: 0, verse: 4000, revenusProfessionnels: 50000, duRevenuProfessionnel })], 2024, regles2024)

    expect(a).toMatchObject({ imputeSurSesPlafonds: 0, nonDeduit: 0, revenusProfessionnels: 50000, plafondCalcule: 1545, baseDuPlafondCalcule: "revenus", reductionDuPlafondCalcule: 3455 })
    expect(a.deduitDuRevenuProfessionnel).toEqual(duRevenuProfessionnel.deduction)
  })
})

describe("épargne retraite d'un membre qui déduit aussi de son bénéfice", () => {
  // Règles de test : plafond de la sécurité sociale de 40 000 €, minimum des versements de l'année de 3 900 €.
  const avecDeduction = (montant: number, revenuApresDeduction: number, autres: Partial<MembreDuFoyer> = {}) => seul({ verse: 10000, plafondSaisi: 4000, revenusProfessionnels: revenuApresDeduction, duRevenuProfessionnel: { deduction: deduction({ montant }), revenuApresDeduction }, ...autres })

  it("compte comme non déduit ce qui dépasse ses plafonds et la déduction du bénéfice", () => {
    expect(avecDeduction(5000, 45000)).toMatchObject({ verse: 10000, imputeSurSesPlafonds: 4000, nonDeduit: 1000, deduitDuRevenuProfessionnel: deduction({ montant: 5000 }) })
  })

  it("réduit son plafond calculé de la déduction, hors sa part de 15 % : 4 500 - (5 000 - 750) = 250 €", () => {
    expect(avecDeduction(5000, 45000)).toMatchObject({ plafondCalcule: 250, baseDuPlafondCalcule: "revenus", reductionDuPlafondCalcule: 4250 })
  })

  it("ne fait jamais passer le plafond calculé sous zéro", () => {
    expect(avecDeduction(6000, 20000)).toMatchObject({ plafondCalcule: 0, baseDuPlafondCalcule: "minimum", reductionDuPlafondCalcule: 6000 })
  })

  it("ne dit rien de la réduction quand la part de 15 % la couvre", () => {
    const sansReduction = avecDeduction(500, 60000)
    expect(sansReduction.plafondCalcule).toBe(6000)
    expect(sansReduction).not.toHaveProperty("reductionDuPlafondCalcule")
  })
})

describe("ce qui dépasse les plafonds du revenu global", () => {
  const versant = (personId: string, autres: Partial<MembreDuFoyer> = {}) => membre(personId, autres)

  it("est, pour chacun, ce que ses versements ne peuvent imputer sur ses plafonds", () => {
    expect(excedentsSurLesPlafonds([versant("a", { plafondSaisi: 4000, verse: 6000 })], ANNEE, reglesDeTest)).toEqual(new Map([["a", 2000]]))
    expect(excedentsSurLesPlafonds([versant("a", { plafondSaisi: 4000, verse: 3000 })], ANNEE, reglesDeTest)).toEqual(new Map([["a", 0]]))
  })

  it("compte d'abord ce que le conjoint marié ou pacsé a de reste", () => {
    const sophie = versant("sophie", { enCouple: true, plafondSaisi: 4710 })

    expect(excedentsSurLesPlafonds([versant("paul", { enCouple: true, plafondSaisi: 9000, verse: 12000 }), sophie], ANNEE, reglesDeTest).get("paul")).toBe(0)
    expect(excedentsSurLesPlafonds([versant("paul", { enCouple: true, plafondSaisi: 9000, verse: 15000 }), sophie], ANNEE, reglesDeTest).get("paul")).toBe(1290)
  })

  it("donne la même imputation que le calcul complet", () => {
    const membres = [versant("paul", { enCouple: true, plafondSaisi: 9000, verse: 15000 }), versant("sophie", { enCouple: true, plafondSaisi: 4710, verse: 1000 })]
    const complet = epargneRetraiteDesMembres(membres, ANNEE, reglesDeTest)

    expect([...excedentsSurLesPlafonds(membres, ANNEE, reglesDeTest).values()]).toEqual(complet.map(p => p.nonDeduit))
  })
})

describe("avertissements d'une déduction du bénéfice ou de la rémunération", () => {
  const lecture = (personnes: EpargneRetraiteDeLaPersonne[], autres: Partial<LectureDeLaDeduction> = {}): LectureDeLaDeduction => {
    const impute = personnes.reduce((cumul, p) => cumul + p.imputeSurSesPlafonds + p.imputeSurLeConjoint, 0)
    return { annee: ANNEE, personnes, nomDe: id => id, nomDeLActivite: id => (id === "ei" ? "Conseil de Sophie" : id), deduction: impute, revenuAvantDeduction: 50000, impotEconomise: 1000, auVersementLiberatoire: false, ...autres }
  }
  const messages = (personnes: EpargneRetraiteDeLaPersonne[], autres: Partial<LectureDeLaDeduction> = {}) => avertissementsEpargneRetraite(lecture(personnes, autres)).map(enTexteBrut)
  const avecDeduction = (verse: number, montant: number, autres: Partial<DeductionDuRevenuProfessionnel> = {}) => epargne(membre("a", { verse, plafondSaisi: 4000, duRevenuProfessionnel: { deduction: deduction({ montant, ...autres }), revenuApresDeduction: 50000 - montant } }))

  it("ne disent rien quand la déduction du bénéfice prend tout ce qui dépasse", () => {
    expect(messages(avecDeduction(6000, 2000))).toEqual([])
  })

  it("disent ce qui ne tient ni dans le plafond ni dans la limite du bénéfice, et de quelle activité", () => {
    expect(messages(avecDeduction(10000, 5000))).toEqual(["Versement PER : 1 000 € ne tiennent ni dans le plafond de 2000 (4 000 €), ni dans ce qui se déduit du bénéfice de « Conseil de Sophie » (5 000 €). Ils ne sont pas déduits, et ne le seront pas les années suivantes."])
    expect(messages(avecDeduction(10000, 5000, { cadre: "remuneration" }))[0]).toContain("ni dans ce qui se déduit de la rémunération de « Conseil de Sophie » (5 000 €)")
  })

  it("préviennent que la part du revenu global n'est pas déduite quand la déduction du bénéfice n'a rien laissé au barème", () => {
    expect(messages(avecDeduction(6000, 2000), { deduction: 0, revenuAvantDeduction: 0, impotEconomise: 300 })).toEqual([
      "Versement PER déduit en partie : après la déduction du bénéfice, le foyer n'a plus de revenu imposable au barème. 4 000 € ne sont pas déduits, et ne le seront pas les années suivantes. L'option pour la non-déduction, à demander à l'assureur lors du versement, évite au moins l'impôt sur ces sommes à la sortie."
    ])
  })

  it("préviennent qu'une déduction du seul bénéfice ne réduit pas l'impôt d'un foyer qui n'en paie pas, sans parler de plafond consommé", () => {
    const personnes = epargne(membre("a", { verse: 2000, plafondSaisi: 0, duRevenuProfessionnel: { deduction: deduction({ montant: 2000 }), revenuApresDeduction: 48000 } }))

    expect(messages(personnes, { deduction: 0, revenuAvantDeduction: 0, impotEconomise: 0 })).toEqual([
      "Versement PER sans effet sur l'impôt : le foyer ne paie pas d'impôt au barème, avec ou sans la déduction de 2 000 €. L'option pour la non-déduction, à demander à l'assureur lors du versement, évite au moins l'impôt sur ces sommes à la sortie."
    ])
  })
})

describe("consigne de la mise en commun, quand le bénéfice ou la rémunération pourrait prendre le relais", () => {
  const personnes = epargne(membre("paul", { enCouple: true, plafondSaisi: 9000, verse: 12000 }), membre("sophie", { enCouple: true, plafondSaisi: 4710 }))
  const nomDe = (id: string) => (id === "sophie" ? "Sophie" : "Paul")
  const consigne = (impotEnPlusSansElle: number, cadre: DeductionDuRevenuProfessionnel["cadre"]) => enTexteBrut(consigneDeLaMiseEnCommun({ trancheMarginale: 0.3, partDesRevenus: 0.1, miseEnCommun: { montant: 3000, impotEnPlusSansElle, deductibleDuRevenuProfessionnel: cadre }, personnes }, nomDe)!)

  it("ne chiffre pas l'impôt en plus, calculé comme si ces versements étaient perdus : ils se déduiraient du bénéfice", () => {
    expect(consigne(900, "benefice")).toBe("Pour déduire les 3 000 € pris sur le plafond de Sophie, cochez la case 6QR de la déclaration de revenus. Sans elle, ils ne se déduiraient que du bénéfice, dans la limite de l'année.")
    expect(consigne(0, "remuneration")).toBe("Pour déduire les 3 000 € pris sur le plafond de Sophie, cochez la case 6QR de la déclaration de revenus. Sans elle, ils ne se déduiraient que de la rémunération, dans la limite de l'année.")
  })
})

describe("la déduction du bénéfice ou de la rémunération, en clair", () => {
  it("dit la limite et ce qui la fixe", () => {
    const enClair = (autres: Partial<DeductionDuRevenuProfessionnel>) => enTexteBrut(limiteDuRevenuProfessionnelEnClair(deduction(autres), regles154bis))

    expect(enClair({ limite: 7791, revenuDeLaLimite: 60000, plafondSecuriteSociale: 48060 })).toBe("limite de 7 791 € : 10 % du bénéfice, plus 15 % de sa part au-delà du plafond de la sécurité sociale")
    expect(enClair({ limite: 5000, revenuDeLaLimite: 50000, plafondSecuriteSociale: 60000 })).toBe("limite de 5 000 € : 10 % du bénéfice")
    expect(enClair({ limite: 4806, baseDeLaLimite: "minimum" })).toBe("limite de 4 806 € : le minimum, 10 % du plafond de la sécurité sociale")
    expect(enClair({ cadre: "remuneration", limite: 15291, revenuDeLaLimite: 90000, plafondSecuriteSociale: 48060 })).toBe("limite de 15 291 € : 10 % de la rémunération après la déduction pour frais, plus 15 % de sa part au-delà du plafond de la sécurité sociale")
  })

  it("dit ce qu'elle retire du plafond calculé sur l'année", () => {
    expect(effetSurLePlafondCalculeEnClair({})).toBeNull()
    expect(effetSurLePlafondCalculeEnClair({ deduitDuRevenuProfessionnel: deduction({ montant: 1290 }) })).toBe("la part déduite du bénéfice ne le réduit pas ici")
    expect(enTexteBrut(effetSurLePlafondCalculeEnClair({ deduitDuRevenuProfessionnel: deduction({ cadre: "remuneration", montant: 3290 }), reductionDuPlafondCalcule: 3290 })!)).toBe("diminué des 3 290 € déduits de la rémunération")
    expect(enTexteBrut(effetSurLePlafondCalculeEnClair({ deduitDuRevenuProfessionnel: deduction({ montant: 10000 }), reductionDuPlafondCalcule: 5059 })!)).toBe("diminué de 5 059 € sur les 10 000 € déduits du bénéfice")
  })

  it("nomme le bénéfice, la rémunération, ou les deux", () => {
    expect(duRevenuProfessionnelEnClair([{ cadre: "benefice" }])).toBe("du bénéfice")
    expect(duRevenuProfessionnelEnClair([{ cadre: "remuneration" }, { cadre: "remuneration" }])).toBe("de la rémunération")
    expect(duRevenuProfessionnelEnClair([{ cadre: "benefice" }, { cadre: "remuneration" }])).toBe("du bénéfice ou de la rémunération")
  })
})
