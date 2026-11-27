// src/backend/logic/references/epargne-retraite-du-benefice.reference.test.ts

import { expect, it } from "vitest"
import { grilleVide, type Company, type Entity, type Person, type Relationship, type SessionState, type SimulationReport } from "../../../types.js"
import { periodeDeLActivite, reglesDeLaPeriode } from "../annee-de-creation.js"
import { consigneDeLaMiseEnCommun } from "../epargne-retraite.js"
import { enTexteBrut } from "../format.js"
import { reglesPubliees, type ReglesApplicables } from "../regles.js"
import { runMetaSimulation } from "../simulation-engine.js"
import { simulerLesAnnees } from "../simulation-pluriannuelle.js"
import { activite, casDeReference, foyerDe, REGLES_DES_CAS, simuler, verifierIdentiteDuBilan } from "../testing/cas-de-reference.js"
import * as exacts from "../testing/revenus-exacts.js"
import { exercant, personne, relation, session, societe, type Flux } from "../testing/session-de-test.js"

/*
 * Cas de référence de l'épargne retraite déduite du bénéfice ou de la rémunération, article 154 bis du CGI (ADR 021,
 * livraison 2), dérivés à la main dans documentation/recherche/per.md, § 12, avec les règles réelles.
 *
 * Règles de 2026 utilisées (src/backend/regles/2026.json) :
 * - barème par part : 0 % jusqu'à 11 600 €, 11 % jusqu'à 29 579 €, 30 % jusqu'à 84 577 €, 41 % au-delà ; la tranche
 *   à 11 % entière donne 17 979 x 11 % = 1 977,69 € ; décote : 897 € (1 483 € pour un couple) moins 45,25 % de l'impôt ;
 * - déduction de 10 % sur les salaires et les rémunérations de dirigeant (de 509 € à 14 555 €) ;
 * - revenu global : minimum des versements de 2026, 10 % du plafond de la sécurité sociale de 2025 (47 100 €) = 4 710 € ;
 *   plafond calculé sur 2026 d'au moins 10 % de celui de 2026 (48 060 €), 4 806 € ;
 * - bénéfice ou rémunération : 10 % du revenu, retenu dans la limite de 8 plafonds, plus 15 % de sa part comprise entre
 *   1 et 8 plafonds ; au moins 10 % du plafond, 4 806 € ; le plafond de la sécurité sociale est réduit au prorata l'année
 *   de création (BOI-BIC-CHG-40-50-40-20, § 60).
 *
 * L'ordre (ADR 021) : le versement s'impute d'abord sur les plafonds du revenu global, ceux du conjoint compris ; ce
 * qui dépasse se déduit du bénéfice ou de la rémunération, dans la limite de l'année. La limite se calcule sur le revenu
 * avant le versement ; pour un gérant, sur sa rémunération après la déduction de 10 % (hypothèse 2), alors que le
 * versement se déduit avant elle. La part déduite du bénéfice ou de la rémunération n'est pas rajoutée au revenu fiscal
 * de référence ; elle réduit le plafond de l'année suivante, sauf pour sa part de 15 %.
 *
 * Les bénéfices et rémunérations sont fiscaux : un chiffre d'affaires ou une rémunération nette est cherché pour les
 * obtenir exactement, cotisations déduites.
 */

const avecPlafond = (id: string, plafondEpargneRetraite: number): Person => ({ ...personne(id), plafondEpargneRetraite })
const epargneDe = (report: SimulationReport, personId: string) => foyerDe(report, personId).epargneRetraite.personnes.find(p => p.personId === personId)!
const avertissements = (report: SimulationReport, personId: string) => foyerDe(report, personId).warnings.map(enTexteBrut)
const conseil = (autres: Partial<Company> = {}): Company => ({ ...societe("ei", "EI"), name: "Conseil de Sophie", ...autres })

/** Le chiffre d'affaires, sans charges, qui donne à une entreprise individuelle ce bénéfice imposable, cotisations déduites. */
const chiffreDAffairesPour = (beneficeImposable: number, regles: ReglesApplicables = REGLES_DES_CAS) => exacts.chiffreDAffairesPour(beneficeImposable, regles)

/** La rémunération nette qui donne à un gérant d'EURL cette rémunération imposable : CSG non déductible et CRDS comprises. */
const remunerationNettePour = (remunerationImposable: number, regles: ReglesApplicables = REGLES_DES_CAS) => exacts.remunerationNettePour(remunerationImposable, regles)

casDeReference("épargne retraite : entrepreneur individuel au réel, ce qui dépasse le plafond se déduit du bénéfice (cas 1 de l'étude)", () => {
  // 60 000 € de bénéfice imposable ; 6 000 € versés ; plafond non saisi : le minimum légal, 4 710 €.
  const acteurs = [personne("sophie"), conseil()]
  const relations = exercant("sophie", "ei", "EI")
  const flux: Flux[] = [["ei", "ca_services", chiffreDAffairesPour(60000)]]
  const sans = simuler(acteurs, relations, flux)
  const avec = simuler(acteurs, relations, [...flux, ["sophie", "versement_per", 6000]])

  it("sans versement : 60 000 € imposables, 1 977,69 + 30 421 x 30 % = 11 104 € d'impôt", () => {
    expect(foyerDe(sans, "sophie")).toMatchObject({ revenuImposableGlobal: 60000, impotSurLeRevenu: 11104, revenuFiscalDeReference: 60000 })
  })

  it("déduit 4 710 € du revenu global, puis 1 290 € du bénéfice, sous sa limite de 6 000 + 15 % x 11 940 = 7 791 €", () => {
    expect(activite(avec, "ei").epargneRetraite).toEqual({ activiteId: "ei", personId: "sophie", cadre: "benefice", montant: 1290, limite: 7791, baseDeLaLimite: "revenu", revenuDeLaLimite: 60000, revenuAvantDeduction: 60000, plafondSecuriteSociale: 48060 })
    expect(epargneDe(avec, "sophie")).toMatchObject({ verse: 6000, plafond: 4710, imputeSurSesPlafonds: 4710, nonDeduit: 0, deduitDuRevenuProfessionnel: { montant: 1290 } })
  })

  it("54 000 € imposables, 1 977,69 + 24 421 x 30 % = 9 304 € d'impôt : 1 800 € d'économie, 30 % des 6 000 €", () => {
    expect(foyerDe(avec, "sophie")).toMatchObject({ revenuImposableGlobal: 54000, deductionEpargneRetraite: 4710, impotSurLeRevenu: 9304, impotEconomiseEpargneRetraite: 1800, versementsEpargneRetraite: 6000 })
    expect(foyerDe(avec, "sophie").epargneRetraite.trancheMarginale).toBe(0.3)
  })

  it("ne rajoute au revenu fiscal de référence que la part du revenu global : 54 000 + 4 710 = 58 710 €", () => {
    expect(foyerDe(avec, "sophie").revenuFiscalDeReference).toBe(58710)
  })

  it("ne change ni les cotisations ni le bénéfice encaissé : le net après impôts monte de l'impôt économisé", () => {
    const { epargneRetraite, ...sansLaDeduction } = activite(avec, "ei")
    expect(epargneRetraite).toBeDefined()
    expect(sansLaDeduction).toEqual(activite(sans, "ei"))
    expect(avec.persons).toEqual(sans.persons)
    expect(foyerDe(avec, "sophie").netApresImpots).toBe(foyerDe(sans, "sophie").netApresImpots + 1800)
    verifierIdentiteDuBilan(avec)
  })

  it("calcule le plafond de 2027 sur le bénéfice après déduction, 10 % de 58 710 € ; la déduction ne le réduit pas, la part de 15 % la couvre", () => {
    expect(epargneDe(avec, "sophie")).toMatchObject({ revenusProfessionnels: 58710, plafondCalcule: 5871, baseDuPlafondCalcule: "revenus" })
    expect(epargneDe(avec, "sophie")).not.toHaveProperty("reductionDuPlafondCalcule")
  })

  it("n'avertit que du plafond retenu par défaut", () => {
    expect(avertissements(avec, "sophie")).toEqual(["Épargne retraite : le plafond de 2026 n'est pas saisi, le minimum légal est retenu (4 710 €). Le vôtre est sur l'avis d'impôt reçu en 2026, ligne « Plafond pour les cotisations versées en 2026 » : saisissez-le dans la fiche de la personne."])
  })

  it("au-delà de la limite, ce qui reste n'est pas déduit, et le dit", () => {
    const beaucoup = simuler(acteurs, relations, [...flux, ["sophie", "versement_per", 15000]])

    // 15 000 - 4 710 - 7 791 = 2 499 € : 60 000 - 7 791 - 4 710 = 47 499 € imposables.
    expect(epargneDe(beaucoup, "sophie")).toMatchObject({ imputeSurSesPlafonds: 4710, deduitDuRevenuProfessionnel: { montant: 7791, limite: 7791 }, nonDeduit: 2499 })
    expect(foyerDe(beaucoup, "sophie").revenuImposableGlobal).toBe(47499)
    expect(avertissements(beaucoup, "sophie")[0]).toBe("Versement PER : 2 499 € ne tiennent ni dans le plafond de 2026 (4 710 €), ni dans ce qui se déduit du bénéfice de « Conseil de Sophie » (7 791 €). Ils ne sont pas déduits, et ne le seront pas les années suivantes.")
  })
})

casDeReference("épargne retraite : gérant d'EURL, ce qui dépasse le plafond se déduit de la rémunération (cas 2 bis de l'étude)", () => {
  // 40 000 € de rémunération imposable, avant la déduction de 10 % ; 8 000 € versés ; plafond non saisi : 4 710 €.
  const acteurs: Entity[] = [personne("paul"), societe("s1", "EURL")]
  const relations = exercant("paul", "s1", "EURL")
  const flux: Flux[] = [["s1", "ca_services", 80000], ["s1", "director_remuneration", remunerationNettePour(40000)]]
  const sans = simuler(acteurs, relations, flux)
  const avec = simuler(acteurs, relations, [...flux, ["paul", "versement_per", 8000]])

  it("sans versement : 36 000 € imposables après la déduction de 10 %, 1 977,69 + 6 421 x 30 % = 3 904 € d'impôt", () => {
    expect(foyerDe(sans, "paul")).toMatchObject({ revenuImposableGlobal: 36000, impotSurLeRevenu: 3904 })
  })

  it("déduit 4 710 € du revenu global, puis 3 290 € de la rémunération, sous la limite minimale de 4 806 € (10 % de 36 000 € n'en donnent que 3 600)", () => {
    expect(activite(avec, "s1").epargneRetraite).toEqual({ activiteId: "s1", personId: "paul", cadre: "remuneration", montant: 3290, limite: 4806, baseDeLaLimite: "minimum", revenuDeLaLimite: 36000, revenuAvantDeduction: 40000, plafondSecuriteSociale: 48060 })
  })

  it("retire le versement avant la déduction de 10 % : (40 000 - 3 290) x 0,9 - 4 710 = 28 329 € imposables, 1 776 € d'impôt après décote", () => {
    // 16 729 x 11 % = 1 840,19 €, moins la décote de 897 - 45,25 % x 1 840,19 = 64,31 €.
    expect(foyerDe(avec, "paul")).toMatchObject({ revenuImposableGlobal: 28329, deductionEpargneRetraite: 4710, impotSurLeRevenu: 1776, impotEconomiseEpargneRetraite: 2128 })
  })

  it("revenu fiscal de référence : 28 329 + 4 710 = 33 039 € ; ni les cotisations ni la rémunération versée ne changent", () => {
    expect(foyerDe(avec, "paul").revenuFiscalDeReference).toBe(33039)
    const { epargneRetraite, ...sansLaDeduction } = activite(avec, "s1")
    expect(epargneRetraite).toBeDefined()
    expect(sansLaDeduction).toEqual(activite(sans, "s1"))
    verifierIdentiteDuBilan(avec)
  })

  it("plafond de 2027 : 10 % de 33 039 € < 4 806 €, diminué des 3 290 € déduits de la rémunération, 1 516 €", () => {
    expect(epargneDe(avec, "paul")).toMatchObject({ revenusProfessionnels: 33039, plafondCalcule: 1516, baseDuPlafondCalcule: "minimum", reductionDuPlafondCalcule: 3290 })
  })
})

casDeReference("épargne retraite : gérant d'EURL au-dessus du plafond de la sécurité sociale", () => {
  // 100 000 € de rémunération imposable, 90 000 € après la déduction de 10 % ; plafond saisi de 10 000 € ; 20 000 € versés.
  const acteurs: Entity[] = [avecPlafond("paul", 10000), societe("s1", "EURL")]
  const relations = exercant("paul", "s1", "EURL")
  const flux: Flux[] = [["s1", "ca_services", 200000], ["s1", "director_remuneration", remunerationNettePour(100000)]]
  const sans = simuler(acteurs, relations, flux)
  const avec = simuler(acteurs, relations, [...flux, ["paul", "versement_per", 20000]])

  it("sans versement : 90 000 € imposables, 1 977,69 + 54 998 x 30 % + 5 423 x 41 % = 20 701 € d'impôt", () => {
    expect(foyerDe(sans, "paul")).toMatchObject({ revenuImposableGlobal: 90000, impotSurLeRevenu: 20701 })
  })

  it("limite de 9 000 + 15 % x (90 000 - 48 060) = 15 291 € : les 10 000 € au-delà du plafond saisi s'y déduisent", () => {
    expect(activite(avec, "s1").epargneRetraite).toMatchObject({ cadre: "remuneration", montant: 10000, limite: 15291, baseDeLaLimite: "revenu", revenuDeLaLimite: 90000 })
  })

  it("ne réduit le revenu imposable que de 9 000 €, la déduction de 10 % baissant d'autant : 81 000 - 10 000 = 71 000 €, 14 404 € d'impôt", () => {
    expect(foyerDe(avec, "paul")).toMatchObject({ revenuImposableGlobal: 71000, impotSurLeRevenu: 14404, impotEconomiseEpargneRetraite: 6297, revenuFiscalDeReference: 81000 })
    expect(foyerDe(avec, "paul").epargneRetraite.trancheMarginale).toBe(0.41)
  })

  it("plafond de 2027 : 10 % de 81 000 €, moins 10 000 - 15 % x (81 000 - 48 060) = 5 059 €, soit 3 041 €", () => {
    expect(epargneDe(avec, "paul")).toMatchObject({ revenusProfessionnels: 81000, plafondCalcule: 3041, baseDuPlafondCalcule: "revenus", reductionDuPlafondCalcule: 5059 })
  })
})

casDeReference("épargne retraite : entrepreneur individuel créé en avril, limite sur le plafond réduit à 9 mois", () => {
  // 60 000 € de bénéfice imposable ; 14 500 € versés ; plafond non saisi : 4 710 €, et 9 790 € au-delà.
  const avril = reglesDeLaPeriode(REGLES_DES_CAS, periodeDeLActivite("2026-04", 2026))
  const acteurs = [personne("sophie"), conseil({ dateDeCreation: "2026-04" })]
  const relations = exercant("sophie", "ei", "EI")
  // Les montants dans le mois de création : avant elle, ils seraient comptés avec un avertissement.
  const donnees = session(acteurs, relations)
  donnees.monthlyData[3].flows.push({ id: "ca", label: "Recettes", amount: chiffreDAffairesPour(60000, avril), entityId: "ei", type: "ca_services" }, { id: "per", label: "Versement PER", amount: 14500, entityId: "sophie", type: "versement_per" })
  const report = runMetaSimulation(donnees, REGLES_DES_CAS, { annee: 2026 })

  it("limite de 6 000 + 15 % x (60 000 - 36 045) = 9 593 €, au lieu de 7 791 € avec le plafond de l'année entière", () => {
    expect(activite(report, "ei").epargneRetraite).toMatchObject({ montant: 9593, limite: 9593, revenuDeLaLimite: 60000, plafondSecuriteSociale: 36045 })
    expect(epargneDe(report, "sophie")).toMatchObject({ imputeSurSesPlafonds: 4710, nonDeduit: 197 })
  })

  it("plafond de 2027 sur l'année entière : 10 % de 50 407 €, moins 9 593 - 15 % x (50 407 - 36 045) = 7 439 €, soit rien", () => {
    expect(epargneDe(report, "sophie")).toMatchObject({ revenusProfessionnels: 50407, plafondCalcule: 0, reductionDuPlafondCalcule: 7439 })
  })
})

casDeReference("épargne retraite : entrepreneur individuel en zone, exonéré à 60 %", () => {
  // ZFU-TE, créée en janvier 2021 : 2026 est la sixième année, 60 % du bénéfice exonéré (48 000 € sur 80 000 €, sous le
  // plafond de 50 000 €). 6 000 € versés, plafond non saisi : 1 290 € au-delà des 4 710 €.
  const acteurs = [personne("sophie"), conseil({ dateDeCreation: "2021-01", implantationEnZone: {} })]
  const relations = exercant("sophie", "ei", "EI")
  const flux: Flux[] = [["ei", "ca_services", chiffreDAffairesPour(80000)]]
  const sans = simuler(acteurs, relations, flux)
  const avec = simuler(acteurs, relations, [...flux, ["sophie", "versement_per", 6000]])

  it("calcule la limite sur le bénéfice avant exonération : 8 000 + 15 % x 31 940 = 12 791 €", () => {
    expect(foyerDe(sans, "sophie")).toMatchObject({ beneficesExoneres: 48000, revenuImposableGlobal: 32000 })
    expect(activite(avec, "ei").epargneRetraite).toMatchObject({ montant: 1290, limite: 12791, revenuDeLaLimite: 80000 })
  })

  it("exonère 60 % du bénéfice après déduction : 47 226 €, et 78 710 - 47 226 - 4 710 = 26 774 € imposables", () => {
    expect(foyerDe(avec, "sophie")).toMatchObject({ beneficesExoneres: 47226, revenuImposableGlobal: 26774 })
    // Le revenu fiscal de référence contient le bénéfice exonéré et la part déduite du revenu global, pas celle du bénéfice.
    expect(foyerDe(avec, "sophie").revenuFiscalDeReference).toBe(26774 + 47226 + 4710)
  })
})

casDeReference("épargne retraite : couple marié, la mise en commun passe avant le bénéfice", () => {
  // Paul : 60 000 € de bénéfice, plafond saisi de 4 000 € ; Sophie, sans revenu : plafond de 4 710 €. Paul verse 12 000 €.
  const acteurs = [avecPlafond("paul", 4000), avecPlafond("sophie", 4710), conseil({ name: "Atelier de Paul" })]
  const relations: Relationship[] = [...exercant("paul", "ei", "EI"), relation("paul", "sophie", "Marié(e)")]
  const flux: Flux[] = [["ei", "ca_services", chiffreDAffairesPour(60000)]]
  const sans = simuler(acteurs, relations, flux)
  const avec = simuler(acteurs, relations, [...flux, ["paul", "versement_per", 12000]])

  it("prend 4 000 € sur le plafond de Paul, 4 710 € sur celui de Sophie, puis 3 290 € sur le bénéfice", () => {
    expect(epargneDe(avec, "paul")).toMatchObject({ imputeSurSesPlafonds: 4000, imputeSurLeConjoint: 4710, deduitDuRevenuProfessionnel: { montant: 3290, limite: 7791 }, nonDeduit: 0 })
    expect(epargneDe(avec, "sophie")).toMatchObject({ preteAuConjoint: 4710 })
  })

  it("48 000 € imposables pour 2 parts : 2 x 12 400 x 11 % = 2 728 €, moins la décote de 1 483 - 45,25 % x 2 728 = 248,58 €", () => {
    expect(foyerDe(sans, "paul")).toMatchObject({ revenuImposableGlobal: 60000, impotSurLeRevenu: 4208 })
    expect(foyerDe(avec, "paul")).toMatchObject({ revenuImposableGlobal: 48000, deductionEpargneRetraite: 8710, impotSurLeRevenu: 2479, impotEconomiseEpargneRetraite: 1729, revenuFiscalDeReference: 56710 })
  })

  it("rappelle la case 6QR sans chiffrer son effet : sans elle, les 4 710 € se déduiraient du bénéfice", () => {
    const epargne = foyerDe(avec, "paul").epargneRetraite
    expect(epargne.miseEnCommun).toMatchObject({ montant: 4710, deductibleDuRevenuProfessionnel: "benefice" })
    expect(enTexteBrut(consigneDeLaMiseEnCommun(epargne, id => (id === "paul" ? "Paul" : "Sophie"))!)).toBe("Pour déduire les 4 710 € pris sur le plafond de Sophie, cochez la case 6QR de la déclaration de revenus. Sans elle, ils ne se déduiraient que du bénéfice, dans la limite de l'année.")
  })
})

casDeReference("épargne retraite : rien ne se déduit d'une entreprise individuelle qui n'est pas encore créée", () => {
  // Créée en mars 2027 : en 2026, elle n'a pas d'exercice. Ce qui dépasse le plafond reste non déduit.
  const report = simuler([personne("sophie"), conseil({ dateDeCreation: "2027-03" })], exercant("sophie", "ei", "EI"), [["ei", "ca_services", chiffreDAffairesPour(60000)], ["sophie", "versement_per", 6000]])

  it("ne porte aucune déduction, et laisse les 1 290 € au-delà du plafond sans déduction", () => {
    expect(activite(report, "ei")).not.toHaveProperty("epargneRetraite")
    expect(epargneDe(report, "sophie")).toMatchObject({ imputeSurSesPlafonds: 4710, nonDeduit: 1290 })
  })
})

casDeReference("épargne retraite : président de SASU, rien ne se déduit de sa rémunération", () => {
  const acteurs: Entity[] = [personne("alice"), societe("s1", "SASU")]
  const report = simuler(acteurs, exercant("alice", "s1", "SASU"), [["s1", "ca_services", 100000], ["s1", "director_remuneration", 40000], ["alice", "versement_per", 6000]])

  it("assimilé salarié : ce qui dépasse le plafond n'est pas déduit", () => {
    expect(activite(report, "s1")).not.toHaveProperty("epargneRetraite")
    expect(epargneDe(report, "alice")).toMatchObject({ imputeSurSesPlafonds: 4710, nonDeduit: 1290 })
    expect(epargneDe(report, "alice")).not.toHaveProperty("deduitDuRevenuProfessionnel")
  })
})

/*
 * Sur deux années, avec les règles réelles de 2025 et 2026 : Paul, gérant d'EURL, 40 000 € de rémunération imposable en
 * 2025 (règles de 2025), la même rémunération nette en 2026. Plafond non saisi.
 * - 2025 : minimum légal de 4 637 € (10 % du plafond de la sécurité sociale de 2024, 46 368 €) ; 8 000 € versés, 3 363 €
 *   au-delà, sous la limite minimale de 4 710 € (10 % de 47 100 €). Plafond calculé sur 2025 : 10 % de
 *   (40 000 - 3 363) x 0,9 = 3 297 € < 4 710 €, le minimum, diminué des 3 363 € déduits : 1 347 €.
 * - 2026 : ce plafond de 1 347 € ; celui de 2025, entièrement utilisé, ne laisse rien. 2 000 € versés : 653 € au-delà.
 */
casDeReference("épargne retraite sur deux années : la déduction de la rémunération réduit le plafond suivant", () => {
  const net = remunerationNettePour(40000, reglesPubliees(2025))
  const grille = (annee: number, verse: number) => {
    const mois = grilleVide()
    mois[0].flows.push({ id: `ca-${annee}`, label: "Recettes", amount: 80000, entityId: "s1", type: "ca_services" }, { id: `remuneration-${annee}`, label: "Rémunération", amount: net, entityId: "s1", type: "director_remuneration" }, { id: `per-${annee}`, label: "Versement PER", amount: verse, entityId: "paul", type: "versement_per" })
    return mois
  }
  const deuxAnnees: SessionState = { name: "Paul, deux années", entities: [personne("paul"), societe("s1", "EURL")], relationships: exercant("paul", "s1", "EURL"), annees: [{ annee: 2025, monthlyData: grille(2025, 8000) }, { annee: 2026, monthlyData: grille(2026, 2000) }] }
  const [en2025, en2026] = simulerLesAnnees(deuxAnnees).annees.map(a => a.report!)

  it("2025 : 4 637 € sur le revenu global, 3 363 € sur la rémunération ; plafond de 2026 de 4 710 - 3 363 = 1 347 €", () => {
    expect(epargneDe(en2025, "paul")).toMatchObject({ plafond: 4637, imputeSurSesPlafonds: 4637, deduitDuRevenuProfessionnel: { montant: 3363, limite: 4710, plafondSecuriteSociale: 47100 }, nonDeduit: 0, plafondCalcule: 1347, baseDuPlafondCalcule: "minimum", reductionDuPlafondCalcule: 3363, plafondsRestants: [] })
  })

  it("2026 : 1 347 € calculés sur 2025, puis 653 € sur la rémunération", () => {
    expect(epargneDe(en2026, "paul")).toMatchObject({ plafond: 1347, originePlafond: "calcule", plafondsReportes: [], imputeSurSesPlafonds: 1347, deduitDuRevenuProfessionnel: { montant: 653, limite: 4806 }, nonDeduit: 0 })
    expect(foyerDe(en2026, "paul").warnings).toEqual([])
  })
})
