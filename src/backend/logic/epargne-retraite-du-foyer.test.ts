// src/backend/logic/epargne-retraite-du-foyer.test.ts
// Les versements d'épargne retraite dans le moteur d'une année : déduction du revenu imposable, impôt économisé,
// revenu fiscal de référence, dividendes, couple, enfant rattaché, et ce que l'année reçoit de la précédente.

import { describe, expect, it } from "vitest"
import type { Entity, MicroEntreprise, Person, Relationship, SimulationReport } from "../../types.js"
import { enTexteBrut } from "./format.js"
import type { ContexteDeLAnnee } from "./routage-des-flux.js"
import { runMetaSimulation } from "./simulation-engine.js"
import { reglesDeTest } from "./testing/regles-de-test.js"
import { exercant, micro, personne, relation, session, societe, type Flux } from "./testing/session-de-test.js"

/*
 * Montants calculés à la main avec les règles de test : barème à 0 / 10 / 30 / 40 % (seuils 10 000, 30 000, 80 000 €),
 * décote 800 € - 50 % de l'impôt (1 400 € pour un couple), déduction de 10 % sur les salaires (500 € au moins),
 * dividendes à 12 % d'impôt forfaitaire, ou au barème après un abattement de 40 % et 7 % de CSG déductible.
 * Épargne retraite : minimum de 3 900 € pour les versements de l'année, plafond calculé d'au moins 4 000 €.
 * Un salaire saisi sans brut est son net imposable.
 */

const simuler = (entities: Entity[], relationships: Relationship[] = [], flux: Flux[] = [], contexte: ContexteDeLAnnee = {}) => runMetaSimulation(session(entities, relationships, flux), reglesDeTest, contexte)
const avecPlafond = (id: string, plafondEpargneRetraite: number): Person => ({ ...personne(id), plafondEpargneRetraite })
const foyerDe = (report: SimulationReport, personId: string) => report.foyers.find(f => f.personIds.includes(personId))!
const epargneDe = (report: SimulationReport, personId: string) => foyerDe(report, personId).epargneRetraite.personnes.find(p => p.personId === personId)!
const avertissements = (report: SimulationReport, personId: string) => foyerDe(report, personId).warnings.map(enTexteBrut)

describe("versement d'épargne retraite d'une personne seule", () => {
  // 50 000 € de salaire : 45 000 € imposables. Impôt : 20 000 x 10 % + 15 000 x 30 % = 6 500 €.
  const sansVersement = simuler([personne("alice")], [], [["alice", "salary", 50000]])

  it("n'ajoute aucun champ ni avertissement au foyer qui ne verse rien", () => {
    const foyer = foyerDe(sansVersement, "alice")

    expect(foyer).toMatchObject({ revenuImposableGlobal: 45000, revenuFiscalDeReference: 45000, impotSurLeRevenu: 6500, netApresImpots: 43500, warnings: [] })
    expect(foyer.deductionEpargneRetraite).toBeUndefined()
    expect(foyer.impotEconomiseEpargneRetraite).toBeUndefined()
    expect(foyer.versementsEpargneRetraite).toBeUndefined()
    expect(foyer.epargneRetraite.miseEnCommun).toBeUndefined()
  })

  it("se déduit du revenu imposable, dans la limite du plafond saisi", () => {
    const report = simuler([avecPlafond("alice", 5000)], [], [["alice", "salary", 50000], ["alice", "versement_per", 3000]])
    const foyer = foyerDe(report, "alice")

    // 42 000 € imposables : 2 000 + 12 000 x 30 % = 5 600 €, soit 900 € de moins (30 % de 3 000 €).
    expect(foyer).toMatchObject({ revenuImposableGlobal: 42000, deductionEpargneRetraite: 3000, impotSurLeRevenu: 5600, impotEconomiseEpargneRetraite: 900, versementsEpargneRetraite: 3000, warnings: [] })
    expect(foyer.epargneRetraite.trancheMarginale).toBe(0.3)
    expect(epargneDe(report, "alice")).toMatchObject({ verse: 3000, plafond: 5000, originePlafond: "saisi", imputeSurSesPlafonds: 3000, nonDeduit: 0 })
  })

  it("reste dans le net après impôts, et ne compte pas parmi les dépenses : l'argent est au foyer, bloqué", () => {
    const foyer = foyerDe(simuler([avecPlafond("alice", 5000)], [], [["alice", "salary", 50000], ["alice", "versement_per", 3000]]), "alice")

    expect(foyer.revenusEncaisses).toBe(50000)
    expect(foyer.netApresImpots).toBe(50000 - 5600)
    expect(foyer.depenses).toBe(0)
  })

  it("ne change pas le revenu fiscal de référence : la déduction y est rajoutée", () => {
    const foyer = foyerDe(simuler([avecPlafond("alice", 5000)], [], [["alice", "salary", 50000], ["alice", "versement_per", 3000]]), "alice")

    expect(foyer.revenuFiscalDeReference).toBe(45000)
  })

  it("additionne les versements de l'année, quel que soit le mois", () => {
    const donnees = session([avecPlafond("alice", 5000)], [], [["alice", "salary", 50000], ["alice", "versement_per", 1000]])
    donnees.monthlyData[6].flows.push({ id: "juillet", label: "PER", amount: 1500, entityId: "alice", type: "versement_per" })
    donnees.monthlyData[11].flows.push({ id: "decembre", label: "PER", amount: 500, entityId: "alice", type: "versement_per" })

    expect(foyerDe(runMetaSimulation(donnees, reglesDeTest), "alice")).toMatchObject({ versementsEpargneRetraite: 3000, deductionEpargneRetraite: 3000 })
  })

  it("n'est déduit que jusqu'au plafond : le reste ne l'est pas, et le foyer en est averti", () => {
    const report = simuler([avecPlafond("alice", 5000)], [], [["alice", "salary", 50000], ["alice", "versement_per", 6000]])

    // 40 000 € imposables : 2 000 + 10 000 x 30 % = 5 000 €.
    expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 40000, deductionEpargneRetraite: 5000, impotSurLeRevenu: 5000, impotEconomiseEpargneRetraite: 1500, versementsEpargneRetraite: 6000, revenuFiscalDeReference: 45000 })
    expect(epargneDe(report, "alice")).toMatchObject({ imputeSurSesPlafonds: 5000, nonDeduit: 1000 })
    expect(avertissements(report, "alice")).toEqual(["Versement PER : 1 000 € dépassent le plafond de 2000 (5 000 €). Ils ne sont pas déduits, et ne le seront pas les années suivantes."])
  })

  it("retient le minimum légal faute de plafond saisi, et le dit", () => {
    const report = simuler([personne("alice")], [], [["alice", "salary", 50000], ["alice", "versement_per", 3000]])

    expect(epargneDe(report, "alice")).toMatchObject({ plafond: 3900, originePlafond: "minimumFauteDeSaisie", imputeSurSesPlafonds: 3000 })
    expect(avertissements(report, "alice")).toEqual(["Épargne retraite : le plafond de 2000 n'est pas saisi, le minimum légal est retenu (3 900 €). Le vôtre est sur l'avis d'impôt reçu en 2000, ligne « Plafond pour les cotisations versées en 2000 » : saisissez-le dans la fiche de la personne."])
  })

  it("ne change ni les revenus de la personne ni le bilan des activités", () => {
    const avec = simuler([avecPlafond("alice", 5000)], [], [["alice", "salary", 50000], ["alice", "versement_per", 3000]])

    expect(avec.persons).toEqual(sansVersement.persons)
    expect(avec.bilan).toEqual({ ...sansVersement.bilan, impotSurLeRevenu: 5600, totalPrelevements: sansVersement.bilan.totalPrelevements - 900 })
  })
})

describe("versement que le revenu imposable ne permet pas de déduire", () => {
  it("ne rend jamais le revenu imposable négatif : la part en trop n'est pas déduite", () => {
    // 3 000 € de salaire : 2 500 € imposables après la déduction minimale de 500 €.
    const report = simuler([avecPlafond("alice", 3900)], [], [["alice", "salary", 3000], ["alice", "versement_per", 3900]])
    const foyer = foyerDe(report, "alice")

    expect(foyer).toMatchObject({ revenuImposableGlobal: 0, deductionEpargneRetraite: 2500, revenuFiscalDeReference: 2500, impotSurLeRevenu: 0, impotEconomiseEpargneRetraite: 0 })
    // Le plafond est consommé quand même (hypothèse 3 de l'ADR 021).
    expect(epargneDe(report, "alice")).toMatchObject({ imputeSurSesPlafonds: 3900, nonDeduit: 0 })
    expect(epargneDe(report, "alice").resteNonReporte).toBeUndefined()
    expect(avertissements(report, "alice")).toEqual(["Versement PER déduit en partie : le foyer n'a que 2 500 € de revenu imposable au barème. 1 400 € ne sont pas déduits, et ne le seront pas les années suivantes. L'option pour la non-déduction, à demander à l'assureur lors du versement, évite au moins l'impôt sur ces sommes à la sortie."])
  })

  it("est sans effet pour une micro-entreprise au versement libératoire, seule source de revenu du foyer", () => {
    const atelier: MicroEntreprise = { ...micro("m1", { opteVFL: true }), rfrN2: 20000 }
    const entites = [avecPlafond("karim", 4710), atelier]
    const titulaire = [relation("karim", "m1", "Titulaire")]
    const sans = foyerDe(simuler(entites, titulaire, [["m1", "ca_micro_services_bnc", 50000]]), "karim")
    const report = simuler(entites, titulaire, [["m1", "ca_micro_services_bnc", 50000], ["karim", "versement_per", 4710]])
    const foyer = foyerDe(report, "karim")

    // 50 000 € de recettes : 35 000 € après l'abattement de 30 %, hors barème ; versement libératoire de 2 % : 1 000 €.
    expect(foyer).toMatchObject({ revenuImposableGlobal: 0, deductionEpargneRetraite: 0, impotEconomiseEpargneRetraite: 0, versementsEpargneRetraite: 4710, impotSurLeRevenu: 1000, versementLiberatoire: 1000, revenuFiscalDeReference: 35000 })
    expect(foyer.impotSurLeRevenu).toBe(sans.impotSurLeRevenu)
    expect(foyer.netApresImpots).toBe(sans.netApresImpots)
    expect(avertissements(report, "karim")).toEqual(["Versement PER sans effet sur l'impôt : avec le versement libératoire, le foyer n'a aucun revenu au barème dont le déduire. Les 4 710 € ne sont pas déduits, et ne le seront pas les années suivantes. L'option pour la non-déduction, à demander à l'assureur lors du versement, évite au moins l'impôt sur ces sommes à la sortie."])
    // Les recettes après abattement comptent parmi les revenus d'activité professionnelle : 10 % de 35 000 € < 4 000 €.
    expect(epargneDe(report, "karim")).toMatchObject({ revenusProfessionnels: 35000, plafondCalcule: 4000, baseDuPlafondCalcule: "minimum" })
  })

  it("est sans effet pour un foyer qui ne paie pas d'impôt, déduction faite ou non", () => {
    // 12 000 € de salaire : 10 800 € imposables, 80 € d'impôt effacés par la décote.
    const report = simuler([avecPlafond("alice", 3000)], [], [["alice", "salary", 12000], ["alice", "versement_per", 3000]])

    expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 7800, deductionEpargneRetraite: 3000, impotSurLeRevenu: 0, impotEconomiseEpargneRetraite: 0, revenuFiscalDeReference: 10800 })
    expect(avertissements(report, "alice")).toEqual(["Versement PER sans effet sur l'impôt : le foyer ne paie pas d'impôt au barème, avec ou sans la déduction de 3 000 €. Elle consomme le plafond sans rien économiser. L'option pour la non-déduction, à demander à l'assureur lors du versement, évite au moins l'impôt sur ces sommes à la sortie."])
  })
})

describe("versement d'épargne retraite et dividendes", () => {
  const entites = [societe("sasu"), avecPlafond("alice", 3900)]
  const presidente = exercant("alice", "sasu", "SASU")

  it("se déduit du revenu au barème, dividendes compris, quand l'option pour le barème est la plus favorable", () => {
    const flux: Flux[] = [["sasu", "ca_services", 200000], ["sasu", "dividends_payment", 60000]]
    const sans = foyerDe(simuler(entites, presidente, flux), "alice")
    const avec = foyerDe(simuler(entites, presidente, [...flux, ["alice", "versement_per", 3900]]), "alice")

    // Au barème : 60 000 x 60 % - 60 000 x 7 % = 31 800 €, soit 2 000 + 1 800 x 30 % = 2 540 € (forfait : 7 200 €).
    expect(sans).toMatchObject({ optionDividendes: "bareme", revenuImposableGlobal: 31800, impotSurLeRevenu: 2540, revenuFiscalDeReference: 55800 })
    // Avec le versement : 27 900 €, soit 1 790 € ; au forfait, rien à déduire : il n'y a pas d'autre revenu.
    expect(avec).toMatchObject({ optionDividendes: "bareme", revenuImposableGlobal: 27900, deductionEpargneRetraite: 3900, impotSurLeRevenu: 1790, impotEconomiseEpargneRetraite: 750, revenuFiscalDeReference: 55800 })
    // Tranche marginale avant la déduction : 31 800 € sont dans la tranche à 30 %.
    expect(avec.epargneRetraite.trancheMarginale).toBe(0.3)
  })

  it("ne se déduit que des autres revenus quand les dividendes restent au prélèvement forfaitaire", () => {
    // 150 000 € de salaire : 136 000 € imposables (déduction plafonnée à 14 000 €), tranche à 40 % : le forfait à 12 % gagne.
    const flux: Flux[] = [["sasu", "ca_services", 200000], ["sasu", "dividends_payment", 20000], ["alice", "salary", 150000]]
    const sans = foyerDe(simuler(entites, presidente, flux), "alice")
    const avec = foyerDe(simuler(entites, presidente, [...flux, ["alice", "versement_per", 3900]]), "alice")

    expect(sans).toMatchObject({ optionDividendes: "pfu", revenuImposableGlobal: 136000 })
    expect(avec).toMatchObject({ optionDividendes: "pfu", revenuImposableGlobal: 132100, deductionEpargneRetraite: 3900, impotEconomiseEpargneRetraite: 1560 })
    expect(avec.revenuFiscalDeReference).toBe(sans.revenuFiscalDeReference)
    expect(avec.prelevementsSociaux).toBe(sans.prelevementsSociaux)
  })

  it("ne compte pas les dividendes parmi les revenus d'activité professionnelle", () => {
    const report = simuler(entites, presidente, [["sasu", "ca_services", 200000], ["sasu", "dividends_payment", 60000]])

    expect(epargneDe(report, "alice")).toMatchObject({ revenusProfessionnels: 0, plafondCalcule: 4000, baseDuPlafondCalcule: "minimum" })
  })
})

describe("couple marié : plafonds mis en commun", () => {
  const marie = [relation("paul", "sophie", "Marié(e)")]
  // 100 000 € de salaire : 90 000 € imposables, 2 parts. Impôt : 2 x (2 000 + 15 000 x 30 %) = 13 000 €.
  const salaire: Flux = ["paul", "salary", 100000]

  it("prend sur le plafond du conjoint ce qui dépasse, et chiffre ce que la case 6QR rapporte", () => {
    const report = simuler([avecPlafond("paul", 9000), avecPlafond("sophie", 4000)], marie, [salaire, ["paul", "versement_per", 12000]])
    const foyer = foyerDe(report, "paul")

    // 78 000 € imposables : 2 x (2 000 + 9 000 x 30 %) = 9 400 €, soit 3 600 € de moins.
    expect(foyer).toMatchObject({ revenuImposableGlobal: 78000, deductionEpargneRetraite: 12000, impotSurLeRevenu: 9400, impotEconomiseEpargneRetraite: 3600, revenuFiscalDeReference: 90000, warnings: [] })
    // Sans la mise en commun : 81 000 € imposables, 2 x (2 000 + 10 500 x 30 %) = 10 300 €, soit 900 € de plus.
    expect(foyer.epargneRetraite.miseEnCommun).toEqual({ montant: 3000, impotEnPlusSansElle: 900 })
    expect(epargneDe(report, "paul")).toMatchObject({ imputeSurSesPlafonds: 9000, imputeSurLeConjoint: 3000, nonDeduit: 0 })
    expect(epargneDe(report, "sophie")).toMatchObject({ preteAuConjoint: 3000, resteNonReporte: { annee: 2000, montant: 1000, utilisableJusquEn: 2003 } })
  })

  it("ne met rien en commun pour un couple en union libre : deux foyers", () => {
    const report = simuler([avecPlafond("paul", 9000), avecPlafond("sophie", 4000)], [relation("paul", "sophie", "En couple")], [salaire, ["paul", "versement_per", 12000]])

    expect(foyerDe(report, "paul").epargneRetraite.miseEnCommun).toBeUndefined()
    expect(epargneDe(report, "paul")).toMatchObject({ imputeSurSesPlafonds: 9000, imputeSurLeConjoint: 0, nonDeduit: 3000 })
    expect(epargneDe(report, "sophie").preteAuConjoint).toBe(0)
  })

  it("donne à chaque membre du foyer son plafond calculé sur ses propres revenus", () => {
    const report = simuler([personne("paul"), personne("sophie")], marie, [salaire])

    expect(epargneDe(report, "paul")).toMatchObject({ revenusProfessionnels: 90000, plafondCalcule: 9000, baseDuPlafondCalcule: "revenus" })
    expect(epargneDe(report, "sophie")).toMatchObject({ revenusProfessionnels: 0, plafondCalcule: 4000, baseDuPlafondCalcule: "minimum" })
  })
})

describe("enfant rattaché", () => {
  it("déduit ses versements du revenu du foyer, dans la limite de son propre plafond, sans mise en commun", () => {
    const report = simuler([personne("parent"), personne("enfant")], [relation("parent", "enfant", "Enfant")], [["parent", "salary", 50000], ["enfant", "versement_per", 5000]])
    const foyer = foyerDe(report, "parent")

    expect(foyer.personIds).toEqual(["parent", "enfant"])
    expect(foyer).toMatchObject({ deductionEpargneRetraite: 3900, versementsEpargneRetraite: 5000 })
    expect(epargneDe(report, "enfant")).toMatchObject({ imputeSurSesPlafonds: 3900, imputeSurLeConjoint: 0, nonDeduit: 1100 })
    expect(epargneDe(report, "parent")).toMatchObject({ preteAuConjoint: 0, plafondsRestants: [{ annee: 2000, montant: 3900, utilisableJusquEn: 2003 }] })
    expect(avertissements(report, "parent")[0]).toBe("Versement PER d'enfant : 1 100 € dépassent le plafond de 2000 (3 900 €). Ils ne sont pas déduits, et ne le seront pas les années suivantes.")
  })
})

describe("revenus d'activité professionnelle", () => {
  it("comptent les salaires et les allocations de chômage après la déduction de 10 %, pas les autres revenus", () => {
    const report = simuler([personne("alice")], [], [["alice", "salary", 40000], ["alice", "are", 10000], ["alice", "other_taxable_income", 30000]])

    // (40 000 + 10 000) x 90 % = 45 000 € ; les 30 000 € d'autres revenus, de nature inconnue, n'y entrent pas.
    expect(epargneDe(report, "alice")).toMatchObject({ revenusProfessionnels: 45000, plafondCalcule: 4500, baseDuPlafondCalcule: "revenus" })
    expect(foyerDe(report, "alice").revenuImposableGlobal).toBe(75000)
  })

  it("comptent le déficit d'une entreprise individuelle : le plafond calculé est alors le minimum", () => {
    const report = simuler([personne("alice"), societe("ei", "EI")], exercant("alice", "ei", "EI"), [["ei", "ca_services", 10000], ["ei", "deductible_expense", 30000]])

    expect(epargneDe(report, "alice").revenusProfessionnels).toBeLessThan(0)
    expect(epargneDe(report, "alice")).toMatchObject({ plafondCalcule: 4000, baseDuPlafondCalcule: "minimum" })
  })
})

describe("ce que l'année reçoit de la précédente", () => {
  const flux: Flux[] = [["alice", "salary", 50000], ["alice", "versement_per", 8000]]

  it("retient le plafond calculé sur l'année précédente et les plafonds reportés, pas le plafond saisi", () => {
    const herites = { plafondCalcule: 6000, plafondsRestants: [{ annee: 1999, montant: 1500, utilisableJusquEn: 2002 }] }
    const report = simuler([avecPlafond("alice", 20000)], [], flux, { epargneRetraite: { parPersonne: { alice: herites } } })

    expect(epargneDe(report, "alice")).toMatchObject({ plafond: 6000, originePlafond: "calcule", plafondsReportes: herites.plafondsRestants, imputeSurSesPlafonds: 7500, nonDeduit: 500, plafondsRestants: [] })
    expect(foyerDe(report, "alice").deductionEpargneRetraite).toBe(7500)
    expect(avertissements(report, "alice")).toEqual(["Versement PER : 500 € dépassent les plafonds utilisables en 2000 (7 500 €). Ils ne sont pas déduits, et ne le seront pas les années suivantes."])
  })

  it("retient le minimum légal quand l'année précédente n'est pas dans la session, ou n'y a pas cette personne", () => {
    const sansAnnee = simuler([avecPlafond("alice", 20000)], [], flux, { epargneRetraite: { parPersonne: null } })
    const sansPersonne = simuler([avecPlafond("alice", 20000)], [], flux, { epargneRetraite: { parPersonne: {} } })

    for (const report of [sansAnnee, sansPersonne]) expect(epargneDe(report, "alice")).toMatchObject({ plafond: 3900, originePlafond: "minimumFauteDAnneePrecedente", imputeSurSesPlafonds: 3900, nonDeduit: 4100 })
    expect(avertissements(sansAnnee, "alice")).toEqual([
      "Versement PER : 4 100 € dépassent le plafond de 2000 (3 900 €). Ils ne sont pas déduits, et ne le seront pas les années suivantes.",
      "Épargne retraite : l'année 1999 n'est pas dans la simulation, le minimum légal est retenu pour le plafond de 2000 (3 900 €)."
    ])
  })

  it("applique le plafond saisi sans contexte : première année de la session, ou simulation d'un an", () => {
    expect(epargneDe(simuler([avecPlafond("alice", 20000)], [], flux), "alice")).toMatchObject({ plafond: 20000, originePlafond: "saisi", imputeSurSesPlafonds: 8000, nonDeduit: 0 })
  })
})
