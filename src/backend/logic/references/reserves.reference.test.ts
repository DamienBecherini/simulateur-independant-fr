// src/backend/logic/references/reserves.reference.test.ts

import { describe, expect, it } from "vitest"
import { grilleVide, type Company, type SessionState } from "../../../types.js"
import { revenuAvantCotisationsPourUnNet } from "../cotisationsTNS.js"
import { reglesEnVigueur } from "../regles.js"
import { simulerLesAnnees } from "../simulation-pluriannuelle.js"
import { personne, relation, societe, type Flux } from "../testing/session-de-test.js"

/*
 * Cas de référence du bénéfice mis en réserve puis distribué (voir l'ADR 012), avec les règles réelles de 2025
 * (src/backend/regles/2025.json) et de 2026 (config.json). Chaque attendu est dérivé à la main.
 *
 * Règles officielles utilisées :
 * - IS (entreprendre.service-public.gouv.fr F23575) : 15 % jusqu'à 42 500 € de bénéfice, 25 % au-delà, en 2025 comme
 *   en 2026. Il est dû sur tout le bénéfice, distribué ou non : un dividende pris sur les réserves ne le supporte pas
 *   une seconde fois ;
 * - report en avant des déficits (article 209 I du CGI, BOI-IS-DEF-10-30) : le déficit s'impute sur le bénéfice des
 *   années suivantes, dans la limite de 1 000 000 € plus 50 % du bénéfice au-delà ;
 * - réserve légale (article L232-10 du code de commerce) : 5 % du bénéfice de l'exercice, diminué des pertes
 *   antérieures, jusqu'à ce qu'elle atteigne 10 % du capital. Une société créée pendant la simulation part de zéro ;
 *   une société plus ancienne est réputée l'avoir déjà constituée ;
 * - dividendes : en 2025, prélèvements sociaux de 17,2 % ; en 2026, de 18,6 % ; impôt forfaitaire de 12,8 % ou option
 *   pour le barème (abattement de 40 %, CSG déductible de 6,8 %), l'année du versement ;
 * - barème pour une part, en 2025 comme en 2026 : 0 % jusqu'à 11 600 €, 11 % jusqu'à 29 579 €, 30 % au-delà ; décote
 *   d'une personne seule : 897 € - 45,25 % de l'impôt brut ;
 * - EURL (entreprendre.service-public.gouv.fr F38152, article L131-6 du code de la sécurité sociale) : la part des
 *   dividendes du gérant au-delà de 10 % du capital supporte les cotisations sociales l'année où ils sont perçus.
 *
 * Alice, célibataire (1 part), n'a pas d'autre revenu que ce que lui verse sa société ; sans rémunération, le
 * président de SASU ne coûte aucune cotisation.
 */

const alice = personne("alice")

/** Une grille dont janvier porte les flux annuels de l'année. */
function grille(flux: Flux[]) {
  const monthlyData = grilleVide()
  flux.forEach(([entityId, type, amount], i) => monthlyData[0].flows.push({ id: `flux-${i}`, label: type, amount, entityId, type }))
  return monthlyData
}

function deuxAnnees(entreprise: Company, flux2025: Flux[], flux2026: Flux[]): SessionState {
  const lien = entreprise.legalStatus === "SASU" ? "Président" : "Gérant"
  return {
    name: "Réserves",
    entities: [alice, entreprise],
    relationships: [relation("alice", entreprise.id, lien)],
    annees: [
      { annee: 2025, monthlyData: grille(flux2025) },
      { annee: 2026, monthlyData: grille(flux2026) }
    ]
  }
}

function rapports(session: SessionState) {
  const [en2025, en2026] = simulerLesAnnees(session).annees.map(a => a.report!)
  return { en2025, en2026 }
}

describe("une SASU garde la moitié de son bénéfice en 2025 et la distribue en 2026", () => {
  // 2025 : bénéfice 60 000 € ; IS 42 500 x 15 % + 17 500 x 25 % = 6 375 + 4 375 = 10 750 € ; bénéfice après IS
  // 49 250 €, dont 24 625 € distribués et 24 625 € gardés. 2026 : aucun chiffre d'affaires, 24 625 € de dividendes
  // pris sur les réserves, sans IS.
  const session = deuxAnnees(
    societe("sasu"),
    [
      ["sasu", "ca_services", 60000],
      ["sasu", "dividends_payment", 24625]
    ],
    [["sasu", "dividends_payment", 24625]]
  )

  it("2025 : IS sur tout le bénéfice, la moitié gardée en réserve", () => {
    const sasu = rapports(session).en2025.activities[0]

    expect(sasu.impotSocietes).toBe(10750)
    expect(sasu.resultatConserve).toBe(24625)
    expect(sasu.reserves).toMatchObject({ auDebut: { reserves: 0 }, aLaFin: { reserves: 24625, reserveLegale: 100 }, dotationReserveLegale: 0, beneficeDistribuableDeLAnnee: 49250, distribuable: 49250 })
  })

  it("2025 : le foyer est imposé sur 24 625 € de dividendes", () => {
    // Barème : 24 625 x 60 % - 24 625 x 6,8 % = 14 775 - 1 674,50 = 13 100,50 € ; impôt brut 1 500,50 x 11 % = 165,06 €,
    // effacé par la décote (897 - 74,69 = 822,31 €). Au forfait : 24 625 x 12,8 % = 3 152 €. Le barème est retenu.
    // Prélèvements sociaux : 24 625 x 17,2 % = 4 235,50 €. Net : 24 625 - 4 235,50 = 20 389,50 €.
    // Revenu fiscal de référence : 13 100,50 + 24 625 x 40 % = 22 950,50 €.
    const foyer = rapports(session).en2025.foyers[0]

    expect(foyer).toMatchObject({ optionDividendes: "bareme", impotSurLeRevenu: 0, prelevementsSociaux: 4236, netApresImpots: 20390, revenuFiscalDeReference: 22951, resultatConserve: 24625 })
  })

  it("2026 : les dividendes viennent des réserves, sans nouvel IS", () => {
    const sasu = rapports(session).en2026.activities[0]

    expect(sasu.impotSocietes).toBe(0)
    expect(sasu.revenuVerse).toBe(24625)
    // Ce que la société produit en 2026 (rien) moins ce qu'elle verse : ses réserves baissent de 24 625 €.
    expect(sasu.resultatConserve).toBe(-24625)
    expect(sasu.reserves).toMatchObject({ auDebut: { reserves: 24625 }, aLaFin: { reserves: 0 }, beneficeDistribuableDeLAnnee: 0, distribuable: 24625, dividendesPrisSurLesReserves: 24625 })
    expect(sasu.warnings).toEqual([])
  })

  it("2026 : le foyer est imposé l'année du versement, avec les prélèvements sociaux de 2026", () => {
    // Même impôt sur le revenu (nul, au barème) ; prélèvements sociaux 24 625 x 18,6 % = 4 580,25 € ;
    // net 24 625 - 4 580,25 = 20 044,75 €.
    const foyer = rapports(session).en2026.foyers[0]

    expect(foyer).toMatchObject({ optionDividendes: "bareme", impotSurLeRevenu: 0, prelevementsSociaux: 4580, netApresImpots: 20045, revenuFiscalDeReference: 22951 })
  })

  it("tout distribuer en 2025 aurait coûté plus : l'impôt progressif porte sur 49 250 € en une fois", () => {
    // Barème : 49 250 x 60 % - 49 250 x 6,8 % = 29 550 - 3 349 = 26 201 € ; impôt brut 14 601 x 11 % = 1 606,11 € ;
    // décote 897 - 726,77 = 170,23 € ; impôt 1 435,88 € (au forfait : 6 304 €). Prélèvements sociaux 49 250 x 17,2 %
    // = 8 471 €. Net 49 250 - 1 435,88 - 8 471 = 39 343,12 €, contre 20 389,50 + 20 044,75 = 40 434,25 € en deux fois.
    const toutEn2025 = deuxAnnees(
      societe("sasu"),
      [
        ["sasu", "ca_services", 60000],
        ["sasu", "dividends_payment", 49250]
      ],
      []
    )
    const { en2025, en2026 } = rapports(toutEn2025)

    expect(en2025.foyers[0]).toMatchObject({ impotSurLeRevenu: 1436, prelevementsSociaux: 8471, netApresImpots: 39343 })
    expect(en2026.totalNetApresImpots).toBe(0)
  })
})

describe("le plafond des dividendes : bénéfice distribuable de l'année et réserves", () => {
  it("réserves de départ de 10 000 €, bénéfice 2026 de 17 000 € après IS : 27 000 € au plus", () => {
    // 2026 seule : bénéfice 20 000 €, IS 3 000 €, après IS 17 000 € ; 40 000 € demandés, 27 000 € versés.
    const sasu: Company = { ...societe("sasu"), reservesInitiales: 10000 }
    const session: SessionState = {
      name: "Plafond",
      entities: [alice, sasu],
      relationships: [relation("alice", "sasu", "Président")],
      annees: [
        {
          annee: 2026,
          monthlyData: grille([
            ["sasu", "ca_services", 20000],
            ["sasu", "dividends_payment", 40000]
          ])
        }
      ]
    }
    const [activite] = simulerLesAnnees(session).annees[0].report!.activities

    expect(activite.reserves).toMatchObject({ auDebut: { reserves: 10000 }, beneficeDistribuableDeLAnnee: 17000, distribuable: 27000, dividendesPrisSurLesReserves: 10000, aLaFin: { reserves: 0 } })
    expect(activite.revenuVerse).toBe(27000)
    expect(activite.warnings).toContainEqual(expect.stringMatching(/^Dividendes saisis \(40\s000 €\) supérieurs au bénéfice distribuable de l'année augmenté des réserves \(27\s000 €\) : seul ce dernier est retenu\.$/))
  })
})

describe("réserve légale d'une SASU créée en 2025", () => {
  // Capital de 5 000 € : la réserve légale s'arrête à 500 €. Bénéfice 20 000 € chaque année, IS 3 000 €, 17 000 € après IS.
  const creee: Company = { ...societe("sasu", "SASU", 5000), dateDeCreation: "2025-03" }
  const flux: Flux[] = [
    ["sasu", "ca_services", 20000],
    ["sasu", "dividends_payment", 17000]
  ]

  it("2025 : 5 % du bénéfice après IS (850 €), plafonnés à 500 €, ne sont pas distribuables", () => {
    const { en2025 } = rapports(deuxAnnees(creee, flux, flux))
    const [sasu] = en2025.activities

    expect(sasu.reserves).toMatchObject({ auDebut: { reserveLegale: 0 }, dotationReserveLegale: 500, beneficeDistribuableDeLAnnee: 16500, aLaFin: { reserveLegale: 500, reserves: 0 } })
    expect(sasu.revenuVerse).toBe(16500)
    expect(sasu.resultatConserve).toBe(500)
  })

  it("2026 : la réserve légale est constituée, tout le bénéfice après IS est distribuable", () => {
    const [sasu] = rapports(deuxAnnees(creee, flux, flux)).en2026.activities

    expect(sasu.reserves).toMatchObject({ auDebut: { reserveLegale: 500 }, dotationReserveLegale: 0, beneficeDistribuableDeLAnnee: 17000 })
    expect(sasu.revenuVerse).toBe(17000)
  })

  it("avec 50 000 € de capital, 850 € par an jusqu'à 5 000 €", () => {
    const [sasu] = rapports(deuxAnnees({ ...creee, capitalSocial: 50000 }, flux, flux)).en2026.activities

    expect(sasu.reserves).toMatchObject({ auDebut: { reserveLegale: 850 }, dotationReserveLegale: 850, aLaFin: { reserveLegale: 1700 } })
  })
})

describe("un déficit en 2025, un bénéfice en 2026", () => {
  // 2025 : 10 000 € de charges, aucun chiffre d'affaires : déficit de 10 000 €, qui passe en 2026.
  // 2026 : bénéfice 30 000 €, dont 10 000 € de déficit imputé : IS sur 20 000 € = 3 000 € ; après IS 27 000 €, dont il
  // faut d'abord combler la perte de 2025 : 17 000 € distribuables.
  const session = deuxAnnees(societe("sasu"), [["sasu", "deductible_expense", 10000]], [["sasu", "ca_services", 30000]])

  it("reporte le déficit sur l'IS de 2026 et la perte sur le bénéfice distribuable", () => {
    const { en2025, en2026 } = rapports(session)

    expect(en2025.activities[0].reserves).toMatchObject({ aLaFin: { reserves: -10000, deficitReportable: 10000 } })
    expect(en2026.activities[0].impotSocietes).toBe(3000)
    expect(en2026.activities[0].reserves).toMatchObject({ deficitImpute: 10000, beneficeDistribuableDeLAnnee: 17000, aLaFin: { reserves: 17000, deficitReportable: 0 } })
  })
})

describe("une EURL distribue ses réserves en 2026 : le seuil de 10 % du capital s'apprécie en 2026", () => {
  // Capital 10 000 € : 1 000 € de dividendes supportent les prélèvements sociaux, le reste les cotisations du gérant.
  // 2025 : 40 000 € de chiffre d'affaires, rien de distribué ; 2026 : aucun chiffre d'affaires, 6 000 € de dividendes
  // pris sur les réserves (bien moins que celles gardées en 2025, même après les cotisations minimales du gérant).
  const session = deuxAnnees(societe("eurl", "EURL", 10000), [["eurl", "ca_services", 40000]], [["eurl", "dividends_payment", 6000]])

  it("1 000 € aux prélèvements sociaux de 2026, 5 000 € dans le revenu soumis à cotisations du gérant", () => {
    const { en2026 } = rapports(session)
    const [eurl] = en2026.activities

    expect(eurl.reserves?.dividendesPrisSurLesReserves).toBeGreaterThan(5999)
    // 1 000 x 18,6 % = 186 €.
    expect(en2026.foyers[0].prelevementsSociaux).toBe(186)
    // Le revenu avant cotisations du gérant : celui de sa rémunération (nulle, mais il doit les cotisations minimales),
    // plus les dividendes au-delà du seuil.
    expect(eurl.cotisationsTNS!.revenuAvantCotisations - revenuAvantCotisationsPourUnNet(0, reglesEnVigueur.TNS)).toBeCloseTo(5000, 6)
    expect(eurl.partage?.cotisationsSurDividendes).toBeGreaterThan(0)
  })
})
