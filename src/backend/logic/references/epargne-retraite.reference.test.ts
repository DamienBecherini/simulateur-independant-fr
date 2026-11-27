// src/backend/logic/references/epargne-retraite.reference.test.ts

import { expect, it } from "vitest"
import { grilleVide, type Entity, type MicroEntreprise, type Person, type Relationship, type SessionState, type SimulationReport } from "../../../types.js"
import { enTexteBrut } from "../format.js"
import { simulerLesAnnees } from "../simulation-pluriannuelle.js"
import { activite, casDeReference, foyerDe, simuler, verifierIdentiteDuBilan } from "../testing/cas-de-reference.js"
import { exercant, micro, personne, relation, societe, type Flux } from "../testing/session-de-test.js"

/*
 * Cas de référence de l'épargne retraite (PER) déduite du revenu global, article 163 quatervicies du CGI (ADR 021),
 * dérivés à la main dans documentation/recherche/per.md, § 12, avec les règles réelles.
 *
 * Règles de 2026 utilisées (src/backend/regles/2026.json) :
 * - barème par part : 0 % jusqu'à 11 600 €, 11 % jusqu'à 29 579 €, 30 % jusqu'à 84 577 € ; la tranche à 11 % entière
 *   donne 17 979 x 11 % = 1 977,69 € ;
 * - décote : 897 € (1 483 € pour un couple) moins 45,25 % de l'impôt ;
 * - déduction de 10 % sur les salaires ;
 * - épargne retraite : plafond de la sécurité sociale de 2025, 47 100 € (minimum des versements de 2026 : 4 710 €) ;
 *   celui de 2026, 48 060 € (plafond calculé sur 2026 d'au moins 4 806 €) ; report de 5 ans ;
 * - micro-entreprise BNC : abattement de 34 %, versement libératoire de 2,2 %.
 *
 * Un salaire saisi sans brut est son net imposable : il donne un revenu imposable exact, sans cotisations à dériver.
 */

const avecPlafond = (id: string, plafondEpargneRetraite: number): Person => ({ ...personne(id), plafondEpargneRetraite })
const epargneDe = (report: SimulationReport, personId: string) => foyerDe(report, personId).epargneRetraite.personnes.find(p => p.personId === personId)!
const avertissements = (report: SimulationReport, personId: string) => foyerDe(report, personId).warnings.map(enTexteBrut)

casDeReference("épargne retraite : versement au-delà du plafond (cas 3 de l'étude)", () => {
  // 50 000 € de rémunération imposable : 45 000 € après la déduction de 10 %. 5 000 € versés, plafond non saisi.
  const flux: Flux[] = [["sophie", "salary", 50000]]
  const sans = simuler([personne("sophie")], [], flux)
  const avec = simuler([personne("sophie")], [], [...flux, ["sophie", "versement_per", 5000]])

  it("sans versement : 1 977,69 + 15 421 x 30 % = 6 604 € d'impôt", () => {
    expect(foyerDe(sans, "sophie")).toMatchObject({ revenuImposableGlobal: 45000, impotSurLeRevenu: 6604, revenuFiscalDeReference: 45000 })
  })

  it("déduit 4 710 €, le minimum légal : 40 290 € imposables, 1 977,69 + 10 711 x 30 % = 5 191 € d'impôt", () => {
    expect(foyerDe(avec, "sophie")).toMatchObject({ revenuImposableGlobal: 40290, deductionEpargneRetraite: 4710, impotSurLeRevenu: 5191, impotEconomiseEpargneRetraite: 1413, versementsEpargneRetraite: 5000 })
    expect(foyerDe(avec, "sophie").epargneRetraite.trancheMarginale).toBe(0.3)
  })

  it("laisse 290 € sans déduction ni report, et le dit, avec le plafond retenu par défaut", () => {
    expect(epargneDe(avec, "sophie")).toMatchObject({ verse: 5000, plafond: 4710, originePlafond: "minimumFauteDeSaisie", imputeSurSesPlafonds: 4710, nonDeduit: 290, plafondsRestants: [] })
    expect(avertissements(avec, "sophie")).toEqual([
      "Versement PER : 290 € dépassent le plafond de 2026 (4 710 €). Ils ne sont pas déduits, et ne le seront pas les années suivantes.",
      "Épargne retraite : le plafond de 2026 n'est pas saisi, le minimum légal est retenu (4 710 €). Le vôtre est sur l'avis d'impôt reçu en 2026, ligne « Plafond pour les cotisations versées en 2026 » : saisissez-le dans la fiche de la personne."
    ])
  })

  it("ne change ni le revenu fiscal de référence ni le net avant impôt : le net après impôts monte de l'impôt économisé", () => {
    expect(foyerDe(avec, "sophie").revenuFiscalDeReference).toBe(45000)
    expect(foyerDe(avec, "sophie").netApresImpots).toBe(foyerDe(sans, "sophie").netApresImpots + 1413)
    verifierIdentiteDuBilan(avec)
  })

  it("calcule sur 2026 le plafond de 2027 : 10 % de 45 000 € ne donnent que 4 500 €, le minimum de 4 806 € est retenu", () => {
    expect(epargneDe(avec, "sophie")).toMatchObject({ revenusProfessionnels: 45000, plafondCalcule: 4806, baseDuPlafondCalcule: "minimum" })
  })
})

casDeReference("épargne retraite : micro-entreprise BNC sans versement libératoire (cas 4 de l'étude)", () => {
  // 50 000 € de recettes : 33 000 € imposables après l'abattement de 34 %. 4 710 € versés, plafond saisi.
  const acteurs: Entity[] = [avecPlafond("karim", 4710), micro("m1")]
  const titulaire = [relation("karim", "m1", "Titulaire")]
  const flux: Flux[] = [["m1", "ca_micro_services_bnc", 50000]]
  const sans = simuler(acteurs, titulaire, flux)
  const avec = simuler(acteurs, titulaire, [...flux, ["karim", "versement_per", 4710]])

  it("sans versement : 1 977,69 + 3 421 x 30 % = 3 004 € d'impôt", () => {
    expect(foyerDe(sans, "karim")).toMatchObject({ revenuImposableGlobal: 33000, impotSurLeRevenu: 3004 })
  })

  it("avec : 28 290 € imposables, 16 690 x 11 % = 1 835,90 €, moins 66,26 € de décote = 1 770 €", () => {
    // L'économie, 1 234 €, n'est pas 30 % du versement : 3 421 € à 30 %, 1 289 € à 11 %, et la décote regagnée.
    expect(foyerDe(avec, "karim")).toMatchObject({ revenuImposableGlobal: 28290, deductionEpargneRetraite: 4710, impotSurLeRevenu: 1770, impotEconomiseEpargneRetraite: 1234, revenuFiscalDeReference: 33000, warnings: [] })
    expect(foyerDe(avec, "karim").epargneRetraite.trancheMarginale).toBe(0.3)
  })

  it("ne change rien à l'activité : ses cotisations sont assises sur les recettes", () => {
    expect(activite(avec, "m1")).toEqual(activite(sans, "m1"))
    verifierIdentiteDuBilan(avec)
  })
})

casDeReference("épargne retraite : micro-entreprise au versement libératoire (cas 5 de l'étude)", () => {
  // Revenu fiscal de référence de 2024 saisi sous le seuil (29 315 € par part) : le versement libératoire s'applique.
  const atelier: MicroEntreprise = { ...micro("m1", { opteVFL: true }), rfrN2: 20000 }
  const titulaire = [relation("karim", "m1", "Titulaire")]
  const recettes: Flux = ["m1", "ca_micro_services_bnc", 50000]
  const versement: Flux = ["karim", "versement_per", 4710]

  it("seul : rien à déduire, le foyer n'a aucun revenu au barème ; l'impôt reste les 2,2 % des recettes", () => {
    const report = simuler([avecPlafond("karim", 4710), atelier], titulaire, [recettes, versement])

    expect(foyerDe(report, "karim")).toMatchObject({ revenuImposableGlobal: 0, deductionEpargneRetraite: 0, impotSurLeRevenu: 1100, versementLiberatoire: 1100, impotEconomiseEpargneRetraite: 0, revenuFiscalDeReference: 33000, versementsEpargneRetraite: 4710 })
    expect(avertissements(report, "karim")).toEqual(["Versement PER sans effet sur l'impôt : avec le versement libératoire, le foyer n'a aucun revenu au barème dont le déduire. Les 4 710 € ne sont pas déduits, et ne le seront pas les années suivantes. L'option pour la non-déduction, à demander à l'assureur lors du versement, évite au moins l'impôt sur ces sommes à la sortie."])
    // Le plafond est consommé quand même (hypothèse 3) : il n'en reste rien à reporter.
    expect(epargneDe(report, "karim")).toMatchObject({ imputeSurSesPlafonds: 4710, nonDeduit: 0, plafondsRestants: [] })
    expect(epargneDe(report, "karim").resteNonReporte).toBeUndefined()
    // Les recettes après abattement comptent pour le plafond de 2027 : 10 % de 33 000 € < 4 806 €.
    expect(epargneDe(report, "karim")).toMatchObject({ revenusProfessionnels: 33000, plafondCalcule: 4806 })
    verifierIdentiteDuBilan(report)
  })

  it("marié à un conjoint salarié non imposable : la déduction se fait, sans rien économiser", () => {
    // 30 000 € imposables pour 2 parts : 2 x 3 400 x 11 % = 748 €, effacés par la décote du couple (1 483 - 338,47).
    const acteurs: Entity[] = [avecPlafond("karim", 4710), personne("lea"), atelier]
    const maries: Relationship[] = [...titulaire, relation("karim", "lea", "Marié(e)")]
    const report = simuler(acteurs, maries, [recettes, versement, ["lea", "salary", 33334]])

    expect(foyerDe(report, "karim")).toMatchObject({ deductionEpargneRetraite: 4710, impotSurLeRevenu: 1100, impotEconomiseEpargneRetraite: 0 })
    expect(foyerDe(report, "karim").revenuImposableGlobal).toBe(Math.round(33334 * 0.9) - 4710)
    expect(avertissements(report, "karim")).toEqual(["Versement PER sans effet sur l'impôt : le foyer ne paie pas d'impôt au barème, avec ou sans la déduction de 4 710 €. Elle consomme le plafond sans rien économiser. L'option pour la non-déduction, à demander à l'assureur lors du versement, évite au moins l'impôt sur ces sommes à la sortie."])
  })
})

casDeReference("épargne retraite : couple marié, plafonds mis en commun (cas 6 de l'étude)", () => {
  // Paul : 100 000 € de rémunération imposable, 90 000 € après 10 % ; plafond de 9 000 €. Sophie, sans revenu : 4 710 €.
  const acteurs = [avecPlafond("paul", 9000), avecPlafond("sophie", 4710)]
  const maries = [relation("paul", "sophie", "Marié(e)")]
  const salaire: Flux = ["paul", "salary", 100000]
  const sans = simuler(acteurs, maries, [salaire])
  const avec = simuler(acteurs, maries, [salaire, ["paul", "versement_per", 12000]])

  it("sans versement : 2 x (1 977,69 + 15 421 x 30 %) = 13 208 € d'impôt", () => {
    expect(foyerDe(sans, "paul")).toMatchObject({ totalParts: 2, revenuImposableGlobal: 90000, impotSurLeRevenu: 13208 })
  })

  it("déduit les 12 000 € : 9 000 € sur le plafond de Paul, 3 000 € sur celui de Sophie", () => {
    // 78 000 € imposables : 2 x (1 977,69 + 9 421 x 30 %) = 9 608 €.
    expect(foyerDe(avec, "paul")).toMatchObject({ revenuImposableGlobal: 78000, deductionEpargneRetraite: 12000, impotSurLeRevenu: 9608, impotEconomiseEpargneRetraite: 3600, revenuFiscalDeReference: 90000, warnings: [] })
    expect(epargneDe(avec, "paul")).toMatchObject({ imputeSurSesPlafonds: 9000, imputeSurLeConjoint: 3000, nonDeduit: 0 })
    expect(epargneDe(avec, "sophie")).toMatchObject({ imputeSurSesPlafonds: 0, preteAuConjoint: 3000 })
  })

  it("chiffre ce que rapporte la case 6QR : sans elle, 81 000 € imposables et 10 508 € d'impôt, 900 € de plus", () => {
    expect(foyerDe(avec, "paul").epargneRetraite.miseEnCommun).toEqual({ montant: 3000, impotEnPlusSansElle: 900 })
  })

  it("laisse à Sophie les 1 710 € qui restent de son plafond", () => {
    expect(epargneDe(avec, "sophie").resteNonReporte).toEqual({ annee: 2026, montant: 1710, utilisableJusquEn: 2031 })
    expect(epargneDe(avec, "paul").resteNonReporte).toBeUndefined()
  })

  it("calcule sur 2026 les plafonds de 2027 : 9 000 € pour Paul, le minimum de 4 806 € pour Sophie", () => {
    expect(epargneDe(avec, "paul")).toMatchObject({ plafondCalcule: 9000, baseDuPlafondCalcule: "revenus" })
    expect(epargneDe(avec, "sophie")).toMatchObject({ plafondCalcule: 4806, baseDuPlafondCalcule: "minimum" })
  })
})

casDeReference("épargne retraite : les cotisations et le revenu des activités ne changent pas", () => {
  /*
   * Un versement de 4 000 €, sous le plafond saisi, pour un entrepreneur individuel au réel, un gérant d'EURL et un
   * président de SASU dont le revenu imposable reste dans la tranche à 30 % avec ou sans lui : l'impôt baisse de
   * 30 % x 4 000 = 1 200 €, et rien d'autre ne bouge (cotisations, revenu versé, revenu fiscal de référence).
   */
  const montages: [string, Entity, Relationship[], Flux[]][] = [
    ["entrepreneur individuel au réel", societe("a", "EI"), exercant("alice", "a", "EI"), [["a", "ca_services", 100000], ["a", "deductible_expense", 20000]]],
    ["gérant d'EURL", societe("a", "EURL"), exercant("alice", "a", "EURL"), [["a", "ca_services", 100000], ["a", "director_remuneration", 40000]]],
    ["président de SASU", societe("a", "SASU"), exercant("alice", "a", "SASU"), [["a", "ca_services", 100000], ["a", "director_remuneration", 40000]]]
  ]

  it.each(montages)("%s", (_nom, activiteDuCas, relations, flux) => {
    const acteurs = [avecPlafond("alice", 4710), activiteDuCas]
    const sans = simuler(acteurs, relations, flux)
    const avec = simuler(acteurs, relations, [...flux, ["alice", "versement_per", 4000]])
    const [foyerSans, foyerAvec] = [foyerDe(sans, "alice"), foyerDe(avec, "alice")]

    // Avec ou sans le versement, le revenu imposable reste dans la tranche à 30 % (de 29 579 à 84 577 €).
    expect(foyerAvec.revenuImposableGlobal).toBeGreaterThan(29579)
    expect(foyerSans.revenuImposableGlobal).toBeLessThan(84577)
    expect(foyerAvec).toMatchObject({ deductionEpargneRetraite: 4000, impotEconomiseEpargneRetraite: 1200, revenuImposableGlobal: foyerSans.revenuImposableGlobal - 4000, impotSurLeRevenu: foyerSans.impotSurLeRevenu - 1200 })
    expect(foyerAvec.revenuFiscalDeReference).toBe(foyerSans.revenuFiscalDeReference)
    expect(avec.activities).toEqual(sans.activities)
    expect(avec.persons).toEqual(sans.persons)
    expect(avec.bilan.cotisationsSociales).toBe(sans.bilan.cotisationsSociales)
    verifierIdentiteDuBilan(avec)
  })
})

/*
 * Sur plusieurs années, avec les règles réelles de 2024, 2025 et 2026 (cas 7 de l'étude, étendu).
 *
 * Alice, salariée : 60 000 € imposables chaque année, 54 000 € après la déduction de 10 %. Plafond non saisi.
 * - 2024, première année : le minimum légal, 10 % du plafond de la sécurité sociale de 2023 (43 992 €) = 4 399 €.
 *   Plafond calculé sur 2024 : 10 % x 54 000 = 5 400 €, au-dessus du minimum (10 % de 46 368 € = 4 637 €).
 * - 2025 : plafond de 5 400 €, plus ce qui reste de 2024. Plafond calculé sur 2025 : 5 400 € (minimum : 4 710 €).
 * - 2026 : plafond de 5 400 €, plus ce qui reste de 2024 et de 2025.
 * Les plafonds de 2024 et 2025 se reportent 3 ans (jusqu'en 2027 et 2028), celui de 2026, 5 ans (jusqu'en 2031).
 */
function troisAnnees(versements: Record<number, number>, alice: Person = personne("alice"), annees = [2024, 2025, 2026]): SessionState {
  const grille = (annee: number) => {
    const mois = grilleVide()
    mois[0].flows.push({ id: `salaire-${annee}`, label: "Salaire", amount: 60000, entityId: "alice", type: "salary" })
    if (versements[annee]) mois[5].flows.push({ id: `per-${annee}`, label: "Versement PER", amount: versements[annee], entityId: "alice", type: "versement_per" })
    return mois
  }
  return { name: "Alice, trois années", entities: [alice], relationships: [], annees: annees.map(annee => ({ annee, monthlyData: grille(annee) })) }
}

const rapports = (session: SessionState) => Object.fromEntries(simulerLesAnnees(session).annees.map(a => [a.annee, a.report!]))

casDeReference("épargne retraite sur plusieurs années : plafonds calculés et reportés (cas 7 de l'étude)", () => {
  const annees = rapports(troisAnnees({ 2024: 1000, 2025: 1000, 2026: 10000 }))

  it("2024 : 1 000 € versés sur le minimum de 4 399 €, il en reste 3 399 € jusqu'en 2027", () => {
    expect(epargneDe(annees[2024], "alice")).toMatchObject({ plafond: 4399, originePlafond: "minimumFauteDeSaisie", imputeSurSesPlafonds: 1000, plafondsRestants: [{ annee: 2024, montant: 3399, utilisableJusquEn: 2027 }], revenusProfessionnels: 54000, plafondCalcule: 5400, baseDuPlafondCalcule: "revenus" })
  })

  it("2025 : plafond de 5 400 € calculé sur 2024 ; 1 000 € versés, il en reste 4 400 € jusqu'en 2028", () => {
    expect(epargneDe(annees[2025], "alice")).toMatchObject({
      plafond: 5400,
      originePlafond: "calcule",
      plafondsReportes: [{ annee: 2024, montant: 3399, utilisableJusquEn: 2027 }],
      imputeSurSesPlafonds: 1000,
      plafondsRestants: [
        { annee: 2024, montant: 3399, utilisableJusquEn: 2027 },
        { annee: 2025, montant: 4400, utilisableJusquEn: 2028 }
      ],
      plafondCalcule: 5400
    })
    expect(foyerDe(annees[2025], "alice").warnings).toEqual([])
  })

  it("2026 : 10 000 € versés s'imputent sur le plafond de l'année, puis sur celui de 2024, puis sur celui de 2025", () => {
    // 5 400 (2026) + 3 399 (2024) + 1 201 (2025) = 10 000 € : tout est déduit, il reste 3 199 € du plafond de 2025.
    expect(epargneDe(annees[2026], "alice")).toMatchObject({ plafond: 5400, originePlafond: "calcule", imputeSurSesPlafonds: 10000, nonDeduit: 0, plafondsRestants: [{ annee: 2025, montant: 3199, utilisableJusquEn: 2028 }] })
    // 44 000 € imposables : 1 977,69 + 14 421 x 30 % = 6 304 € ; sans versement, 9 304 € : 3 000 € d'économie.
    expect(foyerDe(annees[2026], "alice")).toMatchObject({ revenuImposableGlobal: 44000, deductionEpargneRetraite: 10000, impotSurLeRevenu: 6304, impotEconomiseEpargneRetraite: 3000, revenuFiscalDeReference: 54000, warnings: [] })
  })

  it("le plafond de 2026 qui n'est pas utilisé se reporte 5 ans, jusqu'en 2031", () => {
    const sansVersementEn2026 = rapports(troisAnnees({ 2024: 1000, 2025: 1000 }))[2026]

    expect(epargneDe(sansVersementEn2026, "alice").plafondsRestants).toEqual([
      { annee: 2024, montant: 3399, utilisableJusquEn: 2027 },
      { annee: 2025, montant: 4400, utilisableJusquEn: 2028 },
      { annee: 2026, montant: 5400, utilisableJusquEn: 2031 }
    ])
  })
})

casDeReference("épargne retraite sur plusieurs années : plafond saisi, année manquante", () => {
  it("applique le plafond saisi à la première année seulement, et ne reporte pas son reste", () => {
    const annees = rapports(troisAnnees({ 2024: 2000, 2025: 6000 }, avecPlafond("alice", 10000)))

    expect(epargneDe(annees[2024], "alice")).toMatchObject({ plafond: 10000, originePlafond: "saisi", imputeSurSesPlafonds: 2000, plafondsRestants: [], resteNonReporte: { annee: 2024, montant: 8000, utilisableJusquEn: 2027 } })
    // 2025 : plafond de 5 400 € calculé sur 2024, sans le reste du plafond saisi : 600 € ne sont pas déduits.
    expect(epargneDe(annees[2025], "alice")).toMatchObject({ plafond: 5400, originePlafond: "calcule", plafondsReportes: [], imputeSurSesPlafonds: 5400, nonDeduit: 600 })
    expect(avertissements(annees[2025], "alice")).toEqual([
      "Versement PER : 600 € dépassent le plafond de 2025 (5 400 €). Ils ne sont pas déduits, et ne le seront pas les années suivantes. Le plafond saisi pour 2024 n'avait pas été utilisé en entier : le simulateur ne reporte pas ce reste (8 000 €), faute de connaître l'année d'origine de chaque part. S'il est encore utilisable, la déduction réelle est plus élevée."
    ])
    expect(epargneDe(annees[2026], "alice")).toMatchObject({ plafond: 5400, originePlafond: "calcule" })
  })

  it("applique le plafond saisi à la première année que le simulateur sait simuler", () => {
    // 2023 est dans la session, mais d'avant les premières règles : elle n'est pas simulée, et 2024 est la première.
    const session = troisAnnees({ 2024: 6000 }, avecPlafond("alice", 12000), [2023, 2024])
    const [en2023, en2024] = simulerLesAnnees(session).annees

    expect(en2023.report).toBeNull()
    expect(epargneDe(en2024.report!, "alice")).toMatchObject({ plafond: 12000, originePlafond: "saisi", imputeSurSesPlafonds: 6000, nonDeduit: 0 })
    expect(foyerDe(en2024.report!, "alice").warnings).toEqual([])
  })

  it("garde son année quand la session en gagne une avant : la nouvelle première année retient le minimum légal, et le dit", () => {
    const alice: Person = { ...avecPlafond("alice", 12000), anneeDuPlafondEpargneRetraite: 2026 }
    const annees = rapports(troisAnnees({ 2025: 1000, 2026: 6000 }, alice, [2025, 2026]))

    // 2025 : 10 % du plafond de la sécurité sociale de 2024 (46 368 €) = 4 637 €.
    expect(epargneDe(annees[2025], "alice")).toMatchObject({ plafond: 4637, originePlafond: "minimumFauteDeSaisie", plafondSaisiPour: 2026, imputeSurSesPlafonds: 1000 })
    expect(avertissements(annees[2025], "alice")).toEqual(["Épargne retraite : le plafond saisi dans la fiche vaut pour 2026 ; pour 2025, le minimum légal est retenu (4 637 €)."])
    // 2026 : le plafond de l'avis d'impôt, qui contient déjà les restes et l'emporte sur le plafond calculé sur 2025.
    expect(epargneDe(annees[2026], "alice")).toMatchObject({ plafond: 12000, originePlafond: "saisi", plafondsReportes: [], imputeSurSesPlafonds: 6000, nonDeduit: 0 })
  })

  it("ne sert à aucune année quand la sienne n'est plus dans la session", () => {
    const alice: Person = { ...avecPlafond("alice", 12000), anneeDuPlafondEpargneRetraite: 2025 }
    const annees = rapports(troisAnnees({ 2026: 6000 }, alice, [2026]))

    expect(epargneDe(annees[2026], "alice")).toMatchObject({ plafond: 4710, originePlafond: "minimumFauteDeSaisie", plafondSaisiPour: 2025, imputeSurSesPlafonds: 4710, nonDeduit: 1290 })
  })

  it("retient le minimum légal quand l'année précédente n'est pas dans la session", () => {
    const annees = rapports(troisAnnees({ 2026: 5000 }, avecPlafond("alice", 10000), [2024, 2026]))

    // 2025 manque : ni le plafond calculé sur 2025 ni ce qui restait de 2024 ne sont connus ; minimum de 4 710 €.
    expect(epargneDe(annees[2026], "alice")).toMatchObject({ plafond: 4710, originePlafond: "minimumFauteDAnneePrecedente", plafondsReportes: [], imputeSurSesPlafonds: 4710, nonDeduit: 290 })
    expect(avertissements(annees[2026], "alice")).toEqual([
      "Versement PER : 290 € dépassent le plafond de 2026 (4 710 €). Ils ne sont pas déduits, et ne le seront pas les années suivantes.",
      "Épargne retraite : l'année 2025 n'est pas dans la simulation, le minimum légal est retenu pour le plafond de 2026 (4 710 €)."
    ])
  })
})
