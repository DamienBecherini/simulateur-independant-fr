// src/backend/logic/references/dispositifs.reference.test.ts

import { describe, expect, it } from "vitest"
import { grilleVide, type ComparaisonOptions, type FinancialFlow, type FraisFonctionnement, type MicroEntreprise, type SessionState } from "../../../types.js"
import { comparerStatutsDeLAnnee, simulerLesAnnees } from "../simulation-pluriannuelle.js"
import { micro, personne, relation } from "../testing/session-de-test.js"

/*
 * Cas de référence des dispositifs limités dans le temps, sur plusieurs années, avec les règles réelles
 * (config.json pour 2026, reprises pour 2027 et au-delà). Chaque attendu est dérivé à la main.
 *
 * Règles utilisées (sources dans config.json) :
 * - cotisations micro : prestations BIC 21,2 % du chiffre d'affaires ;
 * - ACRE d'une micro-entreprise (F11677, décret n° 2026-69) : du mois de création à la fin du 3e trimestre civil qui suit
 *   celui du début d'activité ; réduction de 50 % pour une création avant le 1er juillet 2026, de 25 % à partir de cette date ;
 * - plafonds 2026 : 83 600 € de prestations de services, 203 100 € au total, au prorata des jours d'activité l'année de
 *   création (F32353 : plafond x jours / 365) ; sortie du régime au 1er janvier qui suit deux années de suite au-delà ;
 * - CFE (F23547, article 1478 II du CGI) : non due l'année de création, base réduite de moitié l'année suivante.
 *
 * Alice, célibataire (1 part), est titulaire de la micro-entreprise « m1 » et n'a pas d'autre revenu.
 */

type TypeDeFlux = FinancialFlow["type"]

/** Une grille de douze mois où les mois donnés (0 pour janvier) portent chacun ces montants. */
function grille(mois: number[], montants: [TypeDeFlux, number][]) {
  const g = grilleVide()
  for (const m of mois) for (const [type, amount] of montants) g[m].flows.push({ id: `${type}-${m}-${amount}`, label: type, amount, entityId: "m1", type })
  return g
}

const TOUS_LES_MOIS = Array.from({ length: 12 }, (_, m) => m)
const DE_SEPTEMBRE = [8, 9, 10, 11]

function session(entreprise: MicroEntreprise, annees: { annee: number; monthlyData: ReturnType<typeof grille> }[]): SessionState {
  return { name: "Dispositifs", entities: [personne("alice"), entreprise], relationships: [relation("alice", "m1", "Titulaire")], annees }
}

const rapportDe = (s: SessionState, annee: number) => simulerLesAnnees(s).annees.find(a => a.annee === annee)!.report!
const activiteDe = (s: SessionState, annee: number) => rapportDe(s, annee).activities.find(a => a.entityId === "m1")!
/** Les montants sont écrits avec des espaces insécables (séparateur de milliers français) : on les compare en espaces simples. */
const espaces = (textes: string[] | undefined) => textes?.map(texte => texte.replace(/\s/g, " "))

describe("ACRE d'une micro-entreprise créée en septembre 2026, sur deux années", () => {
  // 5 000 € de prestations BIC par mois. Création le 1er septembre 2026, après le 1er juillet 2026 : réduction de 25 %.
  // Septembre est au 3e trimestre ; trois trimestres civils plus tard, l'aide finit le 30 juin 2027.
  const atelier: MicroEntreprise = { ...micro("m1", { beneficieACRE: true }), dateDeCreation: "2026-09" }
  const deuxAnnees = session(atelier, [
    { annee: 2026, monthlyData: grille(DE_SEPTEMBRE, [["ca_micro_services_bic", 5000]]) },
    { annee: 2027, monthlyData: grille(TOUS_LES_MOIS, [["ca_micro_services_bic", 5000]]) }
  ])

  it("2026 : réduction de 25 % sur les quatre mois d'activité", () => {
    // CA 20 000 € ; plein taux 20 000 x 21,2 % = 4 240 € ; réduction 20 000 x 21,2 % x 25 % = 1 060 € ; dû : 3 180 €.
    const resultat = activiteDe(deuxAnnees, 2026)
    expect(resultat).toMatchObject({ chiffreAffaires: 20000, cotisationsSociales: 3180, revenuVerse: 16820 })
    expect(resultat.acre).toEqual({ reduction: 0.25, debut: "2026-09", fin: "2027-06", mois: [8, 9, 10, 11], economie: 1060 })
    expect(espaces(resultat.dispositifs)).toContain("ACRE : cotisations réduites de 25 % sur le chiffre d'affaires de septembre à décembre 2026, soit 1 060 € de moins ; l'aide court de septembre 2026 à fin juin 2027. Pendant l'aide, les droits (trimestres de retraite, indemnités journalières) sont calculés sur les cotisations réduites.")
  })

  it("2026 : plafonds au prorata des 122 jours d'activité (septembre à décembre)", () => {
    // 30 + 31 + 30 + 31 = 122 jours. Services : 83 600 x 122 / 365 = 27 943,01 € ; total : 203 100 x 122 / 365 = 67 885,48 €.
    expect(espaces(activiteDe(deuxAnnees, 2026).dispositifs)).toContain("Année de création (septembre 2026) : plafonds du régime micro réduits au prorata de 122 jours d'activité, soit 27 943 € de prestations de services et 67 885 € de chiffre d'affaires total.")
  })

  it("2027 : réduction de 25 % de janvier à juin seulement", () => {
    // CA 60 000 € ; plein taux 12 720 € ; sous ACRE 30 000 € (janvier à juin), réduction 30 000 x 21,2 % x 25 % = 1 590 € ;
    // dû : 12 720 - 1 590 = 11 130 €.
    const resultat = activiteDe(deuxAnnees, 2027)
    expect(resultat).toMatchObject({ chiffreAffaires: 60000, cotisationsSociales: 11130 })
    expect(resultat.acre).toEqual({ reduction: 0.25, debut: "2026-09", fin: "2027-06", mois: [0, 1, 2, 3, 4, 5], economie: 1590 })
  })

  it("2028 : plus d'ACRE, cotisations à plein taux", () => {
    const troisAnnees = { ...deuxAnnees, annees: [...deuxAnnees.annees, { annee: 2028, monthlyData: grille(TOUS_LES_MOIS, [["ca_micro_services_bic", 5000]]) }] }
    const resultat = activiteDe(troisAnnees, 2028)
    expect(resultat.cotisationsSociales).toBe(12720)
    expect(resultat.acre).toBeUndefined()
  })
})

describe("ACRE : 50 % pour une création avant le 1er juillet 2026", () => {
  // Création en juin 2026 (2e trimestre) : l'aide court jusqu'à la fin du 1er trimestre 2027, le 31 mars 2027, à 50 %.
  const atelier: MicroEntreprise = { ...micro("m1", { beneficieACRE: true }), dateDeCreation: "2026-06" }
  const deuxAnnees = session(atelier, [
    { annee: 2026, monthlyData: grille([5, 6, 7, 8, 9, 10, 11], [["ca_micro_services_bic", 5000]]) },
    { annee: 2027, monthlyData: grille(TOUS_LES_MOIS, [["ca_micro_services_bic", 5000]]) }
  ])

  it("2026 : tout le chiffre d'affaires de juin à décembre à 50 %", () => {
    // CA 35 000 € ; 35 000 x 21,2 % x 50 % = 3 710 €.
    expect(activiteDe(deuxAnnees, 2026)).toMatchObject({ cotisationsSociales: 3710, acre: { reduction: 0.5, fin: "2027-03", economie: 3710 } })
  })

  it("2027 : 50 % de janvier à mars", () => {
    // 60 000 x 21,2 % = 12 720 € ; réduction 15 000 x 21,2 % x 50 % = 1 590 € ; dû : 11 130 €.
    expect(activiteDe(deuxAnnees, 2027)).toMatchObject({ cotisationsSociales: 11130, acre: { mois: [0, 1, 2], economie: 1590 } })
  })

  it("sans date de création, comme avant : 50 % sur toute l'année, chaque année", () => {
    const sansDate = { ...deuxAnnees, entities: [personne("alice"), micro("m1", { beneficieACRE: true })] }
    // 2027 : 60 000 x 21,2 % x 50 % = 6 360 €.
    expect(activiteDe(sansDate, 2027)).toMatchObject({ cotisationsSociales: 6360 })
    expect(activiteDe(sansDate, 2027).acre).toBeUndefined()
  })
})

describe("sortie du régime micro après deux années au-delà des plafonds", () => {
  // Prestations BNC de 150 000 € et 30 000 € de dépenses chaque année : au-delà du plafond des services (83 600 €).
  const annee = (a: number, ca = 150000) => ({ annee: a, monthlyData: grille([0], [["ca_micro_services_bnc", ca], ["expense", 30000]]) })
  const quatreAnnees = session(micro("m1"), [annee(2026), annee(2027), annee(2028), annee(2029, 50000)])

  it("2026 et 2027 restent au régime micro ; 2027 annonce la sortie au 1er janvier 2028", () => {
    expect(activiteDe(quatreAnnees, 2026)).toMatchObject({ type: "micro-entreprise", statut: "Micro-entreprise" })
    expect(activiteDe(quatreAnnees, 2026).dispositifs).toBeUndefined()
    expect(activiteDe(quatreAnnees, 2027).dispositifs).toEqual(["Deuxième année de suite au-delà des plafonds (2026 et 2027) : sortie du régime micro au 1er janvier 2028, l'activité passera au régime réel."])
  })

  it("2028 : simulée en entreprise individuelle au réel, comme le cas de référence d'un bénéfice de 120 000 €", () => {
    // Même calcul que « bénéfice de 120 000 € avant cotisations » (societes.reference.test.ts) : recettes 150 000 €,
    // charges déductibles 30 000 € ; assiette 88 800 € ; cotisations 35 694,45 € ; encaissé 84 305,55 € ;
    // imposable 86 880,75 € ; impôt 19 422 € ; net 64 883,55 €.
    const report = rapportDe(quatreAnnees, 2028)
    const resultat = activiteDe(quatreAnnees, 2028)
    expect(resultat).toMatchObject({ type: "company", statut: "EI au réel", chiffreAffaires: 150000, charges: 30000, cotisationsSociales: 35694, revenuVerse: 84306, sortieDuRegimeMicro: { depuis: 2028, depassements: [2026, 2027] } })
    expect(resultat.dispositifs?.[0]).toMatch(/^Sortie du régime micro au 1er janvier 2028 : chiffre d'affaires au-delà des plafonds en 2026 et 2027\./)
    expect(report.foyers[0]).toMatchObject({ revenuImposableGlobal: 86881, impotSurLeRevenu: 19422, netApresImpots: 64884 })
  })

  it("2029 : toujours au réel (2027 et 2028 au-delà), même si le chiffre d'affaires de 2029 retombe", () => {
    expect(activiteDe(quatreAnnees, 2029)).toMatchObject({ statut: "EI au réel", sortieDuRegimeMicro: { depuis: 2028, depassements: [2026, 2027] } })
    expect(activiteDe(quatreAnnees, 2029).dispositifs?.[0]).toMatch(/^Régime réel depuis le 1er janvier 2028/)
  })

  it("2030 : retour au régime micro, le chiffre d'affaires de 2029 étant sous les plafonds", () => {
    const cinqAnnees = { ...quatreAnnees, annees: [...quatreAnnees.annees, annee(2030, 50000)] }
    expect(activiteDe(cinqAnnees, 2030)).toMatchObject({ type: "micro-entreprise", dispositifs: ["Retour au régime micro au 1er janvier 2030 : le chiffre d'affaires de 2029 ne dépasse pas les plafonds."] })
  })

  it("une seule année au-delà ne fait pas sortir du régime", () => {
    const uneFois = session(micro("m1"), [annee(2026), annee(2027, 50000), annee(2028)])
    expect(activiteDe(uneFois, 2028).type).toBe("micro-entreprise")
  })

  it("dans le comparateur de 2028, les colonnes micro ne sont plus accessibles et l'EI au réel est le statut actuel", () => {
    const options: ComparaisonOptions = { activityId: "m1", remunerationNette: 0, repartition: { mode: "dividendes", partDistribuee: 1 }, partBncPrestations: 1 }
    const { scenarios, meilleur } = comparerStatutsDeLAnnee(quatreAnnees, options, 2028)
    const micros = scenarios.filter(s => s.statut === "micro" || s.statut === "micro-vfl")
    expect(micros.map(s => s.regimeMicroFerme)).toEqual([{ depuis: 2028, depassements: [2026, 2027] }, { depuis: 2028, depassements: [2026, 2027] }])
    expect(micros[0].warnings[0]).toMatch(/^Régime micro fermé en 2028 : chiffre d'affaires au-delà des plafonds en 2026 et 2027, sortie au 1er janvier 2028\./)
    expect(scenarios.find(s => s.actuel)?.statut).toBe("EI")
    expect(meilleur === "micro" || meilleur === "micro-vfl").toBe(false)
    // La colonne EI au réel redonne le net du rapport de l'année.
    expect(scenarios.find(s => s.statut === "EI")?.netApresImpots).toBe(64884)
  })
})

describe("plafonds au prorata l'année de création et sortie du régime", () => {
  // Création en septembre 2026 : plafond des services de 2026 ramené à 27 943,01 € (122 jours).
  const atelier: MicroEntreprise = { ...micro("m1"), dateDeCreation: "2026-09" }
  const avec = (ca2026: number) =>
    session(atelier, [
      { annee: 2026, monthlyData: grille(DE_SEPTEMBRE, [["ca_micro_services_bnc", ca2026 / 4]]) },
      { annee: 2027, monthlyData: grille([0], [["ca_micro_services_bnc", 90000]]) },
      { annee: 2028, monthlyData: grille([0], [["ca_micro_services_bnc", 90000]]) }
    ])

  it("30 000 € en 2026, au-delà du plafond au prorata, puis 90 000 € en 2027 : régime réel en 2028", () => {
    expect(activiteDe(avec(30000), 2026).warnings[0]).toMatch(/^Plafond du régime micro dépassé \(prestations de services 30\s000 € pour un plafond de 27\s943 €\)/)
    expect(activiteDe(avec(30000), 2028)).toMatchObject({ statut: "EI au réel", sortieDuRegimeMicro: { depuis: 2028, depassements: [2026, 2027] } })
  })

  it("27 000 € en 2026, sous le plafond au prorata : toujours au régime micro en 2028", () => {
    expect(activiteDe(avec(27000), 2028).type).toBe("micro-entreprise")
  })
})

describe("chiffre d'affaires au-delà des plafonds l'année qui précède la session", () => {
  const annees = [
    { annee: 2026, monthlyData: grille([0], [["ca_micro_services_bnc", 90000]]) },
    { annee: 2027, monthlyData: grille([0], [["ca_micro_services_bnc", 90000]]) }
  ]

  it("case cochée : 2025 et 2026 au-delà, régime réel dès 2027", () => {
    const s = session({ ...micro("m1"), horsPlafondAnneePrecedente: true }, annees)
    expect(activiteDe(s, 2026).dispositifs).toEqual(["Deuxième année de suite au-delà des plafonds (2025 et 2026) : sortie du régime micro au 1er janvier 2027, l'activité passera au régime réel."])
    expect(activiteDe(s, 2027)).toMatchObject({ statut: "EI au réel", sortieDuRegimeMicro: { depuis: 2027, depassements: [2025, 2026] } })
  })

  it("case non cochée : 2025 inconnue, la micro-entreprise reste au régime micro en 2027", () => {
    expect(activiteDe(session(micro("m1"), annees), 2027).type).toBe("micro-entreprise")
  })
})

describe("CFE d'une activité créée en mars 2026, dans le comparateur", () => {
  // Frais annuels saisis : micro 850 € dont 300 € de CFE ; EI au réel 2 050 € dont 300 € de CFE.
  // 2026 (création) : CFE non due, 550 € et 1 750 € ; 2027 : base réduite de moitié, 700 € et 1 900 € ; 2028 : 850 € et 2 050 €.
  const frais: FraisFonctionnement = {
    SASU: { expertComptable: 2000, banque: 200, logiciel: 150, assurance: 250, cfe: 300 },
    EURL: { expertComptable: 2000, banque: 200, logiciel: 150, assurance: 250, cfe: 300 },
    EI: { expertComptable: 1200, banque: 150, logiciel: 150, assurance: 250, cfe: 300 },
    micro: { expertComptable: 0, banque: 100, logiciel: 100, assurance: 350, cfe: 300 }
  }
  const options: ComparaisonOptions = { activityId: "m1", remunerationNette: 0, repartition: { mode: "dividendes", partDistribuee: 1 }, partBncPrestations: 1, fraisFonctionnement: frais }
  const annee = (a: number) => ({ annee: a, monthlyData: grille([0], [["ca_micro_services_bnc", 30000]]) })
  const s = session({ ...micro("m1"), dateDeCreation: "2026-03" }, [annee(2026), annee(2027), annee(2028)])
  const fraisDe = (a: number) => {
    const resultat = comparerStatutsDeLAnnee(s, options, a)
    return { micro: resultat.scenarios.find(c => c.statut === "micro")!.fraisFonctionnement, EI: resultat.scenarios.find(c => c.statut === "EI")!.fraisFonctionnement, note: resultat.noteCFE }
  }

  it("2026 : exonérée l'année de création", () => {
    expect(fraisDe(2026)).toEqual({ micro: 550, EI: 1750, note: "CFE exonérée l'année de création (2026) : le poste CFE des frais de fonctionnement n'est pas compté." })
  })

  it("2027 : base réduite de moitié", () => {
    expect(fraisDe(2027)).toEqual({ micro: 700, EI: 1900, note: "CFE de 2027, l'année qui suit la création : base d'imposition réduite de moitié, le poste CFE des frais de fonctionnement est compté pour 50 %." })
  })

  it("2028 : due en entier", () => {
    expect(fraisDe(2028)).toEqual({ micro: 850, EI: 2050, note: undefined })
  })
})
