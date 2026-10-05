// src/backend/logic/comparateur.test.ts

import { describe, expect, it } from "vitest"
import { comparerStatuts, statutActuel } from "./comparateur.js"
import { optimiserRemuneration } from "./optimisation-remuneration.js"
import { reglesDeTest } from "./testing/regles-de-test.js"
import { micro, personne, relation, session, societe, type Flux } from "./testing/session-de-test.js"
import type { ComparaisonOptions, ComparaisonResult, Entity, PartageDuBenefice, Relationship, RepartitionBenefice, StatutCompare } from "../../types.js"

/*
 * Montants calculés à la main avec les règles de test : micro BNC à 25 % de cotisations et 30 % d'abattement,
 * versement libératoire BNC à 2 %, cotisations TNS des règles de test (voir cotisationsTNS.test.ts), IS à 15 % jusqu'à 40 000 €,
 * dividendes à 12 % d'IR forfaitaire ou au barème (abattement 40 %, CSG déductible 7 %) et 18 % de prélèvements sociaux.
 */

const options = (activityId: string, autres: Partial<ComparaisonOptions> = {}): ComparaisonOptions => ({ activityId, remunerationNette: 0, repartition: { mode: "dividendes", partDistribuee: 1 }, partBncPrestations: 1, ...autres })

const comparer = (entities: Entity[], relationships: Relationship[], flux: Flux[], opts: ComparaisonOptions) => comparerStatuts(session(entities, relationships, flux), opts, reglesDeTest)

function colonne(resultat: ComparaisonResult, statut: StatutCompare) {
  const trouvee = resultat.scenarios.find(s => s.statut === statut)
  if (!trouvee) throw new Error(`Colonne ${statut} absente`)
  return trouvee
}

describe("statutActuel", () => {
  it("distingue la micro-entreprise avec et sans versement libératoire", () => {
    expect(statutActuel(micro("m1"))).toBe("micro")
    expect(statutActuel(micro("m1", { opteVFL: true }))).toBe("micro-vfl")
    expect(statutActuel(societe("s1", "EURL"))).toBe("EURL")
  })
})

describe("comparerStatuts", () => {
  describe("micro-entreprise en prestations BNC", () => {
    const resultat = comparer([personne("alice"), micro("m1")], [relation("alice", "m1", "Titulaire")], [["m1", "ca_micro_services_bnc", 40000]], options("m1"))

    it("présente une colonne par statut, et repère le statut actuel", () => {
      expect(resultat.scenarios.map(s => s.statut)).toEqual(["SASU", "EURL", "EI", "micro", "micro-vfl"])
      expect(resultat.scenarios.filter(s => s.actuel).map(s => s.statut)).toEqual(["micro"])
    })

    it("calcule le net de chaque statut", () => {
      // Micro : 40 000 - 10 000 de cotisations - 1 800 d'impôt (28 000 € imposables).
      expect(colonne(resultat, "micro")).toMatchObject({ netApresImpots: 28200, cotisationsSociales: 10000, impotSurLeRevenu: 1800 })
      // Versement libératoire : 2 % du chiffre d'affaires au lieu du barème.
      expect(colonne(resultat, "micro-vfl")).toMatchObject({ netApresImpots: 29200, impotSurLeRevenu: 800 })
      // EI au réel : 40 000 € de bénéfice, 12 700 € de cotisations, 27 300 € encaissés ; 28 200 € imposables
      // (CSG non déductible et CRDS réintégrées), 1 820 € d'impôt.
      expect(colonne(resultat, "EI")).toMatchObject({ netApresImpots: 25480, cotisationsSociales: 12700, impotSurLeRevenu: 1820 })
      // SASU sans rémunération : 6 000 € d'IS, 34 000 € de dividendes imposés au barème (403 €) et 6 120 € de prélèvements sociaux.
      expect(colonne(resultat, "SASU")).toMatchObject({ netApresImpots: 27477, impotSocietes: 6000, impotSurLeRevenu: 403, prelevementsSociaux: 6120, resultatConserve: 0 })
      // EURL, capital de 1 000 €, sans rémunération : la société paie les cotisations minimales du gérant, 1 653,66 €
      // (voir calculsSociete.test.ts) ; bénéfice 38 346,34 €, IS 5 751,95 €, dividendes 32 594,39 €.
      // Au-delà de 100 €, les dividendes entrent dans le revenu soumis à cotisations : 1 653,66 + 32 494,39 = 34 148,05 €,
      // assiette 25 611,04 € ; cotisations 287,41 (maladie) + 256,11 (IJ) + 5 122,21 (retraite de base) + 2 048,88
      // (complémentaire) + 256,11 (invalidité-décès) + 2 561,10 (CSG-CRDS) + 100 = 10 631,82 €, dont 8 978,17 € sur les dividendes.
      // Encaissé 32 594,39 - 8 978,17 = 23 616,23 €. Barème : 32 594,39 x 60 % - 100 x 7 % = 19 549,63 € ; impôt brut 954,96 €,
      // décote 800 - 477,48 = 322,52 €, impôt 632,44 €, contre 3 911,33 € au forfait. Net : 23 616,23 - 632,44 - 18 = 22 965,79 €.
      expect(colonne(resultat, "EURL")).toMatchObject({ netApresImpots: 22966, cotisationsSociales: 10632, impotSurLeRevenu: 632, prelevementsSociaux: 18 })
    })

    it("désigne le statut au meilleur net", () => {
      expect(resultat.meilleur).toBe("micro-vfl")
      expect(resultat.warnings).toEqual([])
    })
  })

  describe("conversion des flux", () => {
    it("répartit les prestations d'une société entre BNC et BIC selon la part choisie", () => {
      // 40 000 € de prestations, moitié BNC (25 %), moitié BIC (20 %) : 9 000 € de cotisations.
      const resultat = comparer([personne("alice"), societe("s1", "SASU")], [relation("alice", "s1", "Président")], [["s1", "ca_services", 40000]], options("s1", { partBncPrestations: 0.5 }))

      expect(colonne(resultat, "micro").cotisationsSociales).toBe(9000)
      expect(colonne(resultat, "SASU").actuel).toBe(true)
    })

    it("garde la répartition d'une micro qui mêle vente, BIC et BNC", () => {
      const flux: Flux[] = [
        ["m1", "ca_micro_vente", 10000],
        ["m1", "ca_micro_services_bic", 10000],
        ["m1", "ca_micro_services_bnc", 10000]
      ]

      const resultat = comparer([personne("alice"), micro("m1")], [relation("alice", "m1", "Titulaire")], flux, options("m1", { partBncPrestations: 0 }))

      // 1 000 + 2 000 + 2 500 € : la part BNC choisie ne s'applique pas à une micro existante.
      // En EI, 30 000 € de bénéfice, assiette 22 500 € : 112,50 (maladie à 0,5 %) + 225 + 4 500 + 1 800 + 225 + 2 250 + 100 = 9 212,50 €.
      expect(colonne(resultat, "micro").cotisationsSociales).toBe(5500)
      expect(colonne(resultat, "EI").cotisationsSociales).toBe(9213)
    })

    it("rend déductibles en société les dépenses d'une micro, et l'inverse", () => {
      const resultat = comparer([personne("alice"), micro("m1")], [relation("alice", "m1", "Titulaire")], [["m1", "ca_micro_services_bnc", 40000], ["m1", "expense", 10000]], options("m1"))

      // En EI, 30 000 € de bénéfice : 9 213 € de cotisations. En micro, les dépenses ne changent pas les cotisations.
      expect(colonne(resultat, "EI").cotisationsSociales).toBe(9213)
      expect(colonne(resultat, "micro").cotisationsSociales).toBe(10000)
    })

    it("applique la rémunération choisie et conserve les dividendes saisis quand on ne distribue pas tout", () => {
      const flux: Flux[] = [
        ["s1", "ca_services", 100000],
        ["s1", "director_remuneration", 1000],
        ["s1", "dividends_payment", 20000]
      ]

      const resultat = comparer([personne("alice"), societe("s1", "SASU")], [relation("alice", "s1", "Président")], flux, options("s1", { remunerationNette: 24300, repartition: { mode: "grille", partDistribuee: 1 } }))

      // Rémunération de 24 300 € (30 000 € bruts) et 15 900 € de cotisations : 59 800 € de bénéfice, 10 950 € d'IS ; 20 000 € de dividendes saisis, 28 850 € conservés.
      expect(colonne(resultat, "SASU")).toMatchObject({ cotisationsSociales: 15900, impotSocietes: 10950, resultatConserve: 28850 })
    })
  })

  it("garde les salariés de l'activité dans chaque statut", () => {
    // Bob : 24 300 € nets, 30 000 € bruts, 5 400 € de cotisations patronales après réduction générale (voir simulation-engine.test.ts).
    // La colonne compte aussi les 5 700 € de cotisations salariales. En micro BNC : 25 % de 100 000 € = 25 000 €, en plus.
    const resultat = comparer(
      [personne("alice"), personne("bob"), societe("s1", "SASU")],
      [relation("alice", "s1", "Président"), relation("bob", "s1", "Salarié")],
      [
        ["s1", "ca_services", 100000],
        ["bob", "salary", 24300]
      ],
      options("s1")
    )

    expect(colonne(resultat, "micro").cotisationsSociales).toBe(25000 + 5400 + 5700)
    expect(colonne(resultat, "SASU").cotisationsSociales).toBe(5400 + 5700)
  })

  describe("frais de fonctionnement", () => {
    const frais = (montant: number) => ({ expertComptable: montant, banque: 0, logiciel: 0, assurance: 0, cfe: 0 })
    const resultat = comparer([personne("alice"), micro("m1")], [relation("alice", "m1", "Titulaire")], [["m1", "ca_micro_services_bnc", 40000]], options("m1", { fraisFonctionnement: { SASU: frais(2000), EURL: frais(2000), EI: frais(1000), micro: frais(1000) } }))

    it("retire de la poche les frais d'une micro, sans changer cotisations ni impôt", () => {
      // Comme sans frais (28 200 €), moins 1 000 € de dépenses non déductibles.
      expect(colonne(resultat, "micro")).toMatchObject({ fraisFonctionnement: 1000, netApresImpots: 27200, cotisationsSociales: 10000, impotSurLeRevenu: 1800 })
      expect(colonne(resultat, "micro-vfl").fraisFonctionnement).toBe(1000)
    })

    it("déduit les frais du bénéfice d'une société", () => {
      // 38 000 € de bénéfice, 5 700 € d'IS, 32 300 € de dividendes : barème 268 € (base 17 119 € après abattement
      // et CSG déductible, décote comprise), 5 814 € de prélèvements sociaux.
      expect(colonne(resultat, "SASU")).toMatchObject({ fraisFonctionnement: 2000, impotSocietes: 5700, impotSurLeRevenu: 268, prelevementsSociaux: 5814, netApresImpots: 26218 })
    })
  })

    describe("personnes reliées", () => {
    it("signale une activité reliée à personne", () => {
      const resultat = comparer([personne("alice"), micro("m1")], [], [["m1", "ca_micro_vente", 10000]], options("m1"))

      expect(resultat.warnings).toEqual([expect.stringContaining("reliée à aucune personne")])
      expect(colonne(resultat, "micro").netApresImpots).toBe(0)
    })

    it("prévient que les associés ne suivent pas en entreprise individuelle", () => {
      const resultat = comparer([personne("alice"), personne("bob"), societe("s1")], [relation("alice", "s1", "Président"), relation("bob", "s1", "Associé")], [["s1", "ca_services", 50000]], options("s1"))

      expect(resultat.warnings).toEqual([expect.stringContaining("autres associés")])
    })
  })

  it("demande de choisir une activité quand l'identifiant ne correspond à aucune", () => {
    const resultat = comparer([personne("alice")], [], [], options("inconnue"))

    expect(resultat).toEqual({ scenarios: [], meilleur: null, couples: [], warnings: ["Choisissez une activité à comparer."] })
  })

  describe("couples en union libre", () => {
    it("compare l'impôt actuel avec une imposition commune", () => {
      const resultat = comparer(
        [personne("alice"), personne("bob")],
        [relation("alice", "bob", "En couple")],
        [
          ["alice", "salary", 50000],
          ["bob", "salary", 5000]
        ],
        options("aucune")
      )

      // Séparés : 45 000 € imposables pour Alice (6 500 €), 4 500 € pour Bob (0 €).
      // Mariés : 49 500 € pour 2 parts, soit 2 x 1 475 € = 2 950 € d'impôt brut, sans décote.
      expect(resultat.couples).toEqual([{ personIds: ["alice", "bob"], netApresImpotsActuel: 48500, impotSurLeRevenuActuel: 6500, netApresImpotsMaries: 52050, impotSurLeRevenuMaries: 2950 }])
    })
  })
})

describe("répartition du bénéfice des sociétés", () => {
  const avec = (repartition: RepartitionBenefice, remunerationNette = 0) => comparer([personne("alice"), micro("m1")], [relation("alice", "m1", "Titulaire")], [["m1", "ca_micro_services_bnc", 40000]], options("m1", { remunerationNette, repartition }))
  const sommeDesPostes = (p: PartageDuBenefice) => p.remunerationNette + p.cotisationsRemuneration + p.impotSocietes + p.dividendesNets + p.cotisationsSurDividendes + p.resultatConserve

  it("détaille le partage du bénéfice en société seulement, et la somme des postes redonne le bénéfice", () => {
    const resultat = avec({ mode: "dividendes", partDistribuee: 1 })
    // SASU sans rémunération : 40 000 € de bénéfice, 6 000 € d'IS, 34 000 € de dividendes.
    expect(colonne(resultat, "SASU").partage).toEqual({ beneficeAvantRemuneration: 40000, remunerationNette: 0, cotisationsRemuneration: 0, impotSocietes: 6000, dividendesNets: 34000, cotisationsSurDividendes: 0, resultatConserve: expect.closeTo(0, 0) })
    expect(colonne(resultat, "EI").partage).toBeUndefined()
    expect(colonne(resultat, "micro").partage).toBeUndefined()
  })

  it("verse la part choisie du bénéfice distribuable, le reste étant conservé", () => {
    const resultat = avec({ mode: "personnalisee", partDistribuee: 0.25 })
    expect(colonne(resultat, "SASU").partage).toMatchObject({ impotSocietes: 6000, dividendesNets: 8500, resultatConserve: 25500 })
    expect(colonne(resultat, "SASU").resultatConserveActivite).toBe(25500)
  })

  it("en EURL, verse la part choisie du bénéfice distribuable final, cotisations sur dividendes comprises", () => {
    // Bénéfice distribuable de 32 594,39 € (voir plus haut) : 16 297,20 € de dividendes, au-delà de 10 % du capital
    // (100 €) soumis aux cotisations du gérant, et autant de conservé.
    const { partage } = colonne(avec({ mode: "personnalisee", partDistribuee: 0.5 }), "EURL")
    expect(partage!.dividendesNets + partage!.cotisationsSurDividendes).toBeCloseTo(16297, 0)
    expect(partage!.cotisationsSurDividendes).toBeGreaterThan(0)
    expect(partage!.resultatConserve).toBeCloseTo(16297, 0)
    expect(sommeDesPostes(partage!)).toBeCloseTo(partage!.beneficeAvantRemuneration, 6)
  })

  it("à 0 %, ne verse aucun dividende ; à 100 %, distribue tout comme le mode « le reste en dividendes »", () => {
    const aucun = avec({ mode: "personnalisee", partDistribuee: 0 })
    expect(colonne(aucun, "SASU").partage).toMatchObject({ dividendesNets: 0, resultatConserve: 34000 })
    expect(colonne(aucun, "EURL").partage).toMatchObject({ dividendesNets: 0, cotisationsSurDividendes: 0 })

    const tout = avec({ mode: "personnalisee", partDistribuee: 1 })
    const reference = avec({ mode: "dividendes", partDistribuee: 1 })
    for (const statut of ["SASU", "EURL"] as const) expect(colonne(tout, statut).netApresImpots).toBe(colonne(reference, statut).netApresImpots)
    // Une part hors bornes est ramenée entre 0 et 100 %.
    expect(colonne(avec({ mode: "personnalisee", partDistribuee: 2 }), "SASU").netApresImpots).toBe(colonne(reference, "SASU").netApresImpots)
  })

  it("« tout en rémunération » verse la plus haute rémunération possible, sans dividendes", () => {
    const resultat = avec({ mode: "remuneration", partDistribuee: 1 }, 5000)
    const s = session([personne("alice"), micro("m1")], [relation("alice", "m1", "Titulaire")], [["m1", "ca_micro_services_bnc", 40000]])
    for (const statut of ["SASU", "EURL"] as const) {
      const { partage } = colonne(resultat, statut)
      expect(partage!.remunerationNette).toBe(optimiserRemuneration(s, options("m1"), statut, reglesDeTest).remunerationMaximale)
      expect(partage!.remunerationNette).toBeGreaterThan(15000)
      expect(partage!.dividendesNets).toBe(0)
      // Il ne reste qu'un reliquat, faute de rémunération à 100 € près.
      expect(partage!.resultatConserve).toBeGreaterThanOrEqual(0)
      expect(partage!.resultatConserve).toBeLessThan(200)
    }
  })

  it("sans bénéfice, « tout en rémunération » ne verse rien", () => {
    const resultat = comparer([personne("alice"), micro("m1")], [relation("alice", "m1", "Titulaire")], [["m1", "ca_micro_services_bnc", 0]], options("m1", { repartition: { mode: "remuneration", partDistribuee: 1 } }))
    expect(colonne(resultat, "SASU").partage).toMatchObject({ remunerationNette: 0, dividendesNets: 0 })
  })

  it.each([
    ["dividendes", 0.5, 12000],
    ["remuneration", 1, 0],
    ["personnalisee", 0.35, 8000],
    ["grille", 1, 3000]
  ] as const)("en mode « %s », la somme des postes redonne exactement le bénéfice avant rémunération", (mode, partDistribuee, remuneration) => {
    const resultat = avec({ mode, partDistribuee }, remuneration)
    for (const statut of ["SASU", "EURL"] as const) {
      const { partage } = colonne(resultat, statut)
      expect(partage!.beneficeAvantRemuneration).toBe(40000)
      expect(sommeDesPostes(partage!)).toBeCloseTo(40000, 6)
    }
  })
})

describe("micro-entreprise au-delà des plafonds", () => {
  // Règles de test : plafond de 80 000 € pour les prestations de services.
  const titulaire = [relation("alice", "m1", "Titulaire")]

  it("signale les colonnes micro hors plafond, et ne les désigne jamais meilleur net", () => {
    const resultat = comparer([personne("alice"), micro("m1")], titulaire, [["m1", "ca_micro_services_bnc", 150000]], options("m1"))

    expect(resultat.scenarios.filter(s => s.horsPlafond).map(s => s.statut)).toEqual(["micro", "micro-vfl"])
    expect(["micro", "micro-vfl"]).not.toContain(resultat.meilleur)
    const meilleurTenable = Math.max(...resultat.scenarios.filter(s => !s.horsPlafond).map(s => s.netApresImpots))
    expect(colonne(resultat, resultat.meilleur!).netApresImpots).toBe(meilleurTenable)
  })

  it("sous le plafond, aucune colonne n'est hors plafond", () => {
    const resultat = comparer([personne("alice"), micro("m1")], titulaire, [["m1", "ca_micro_services_bnc", 80000]], options("m1"))
    expect(resultat.scenarios.some(s => s.horsPlafond)).toBe(false)
  })

  it("à un euro au-delà du plafond, la micro au meilleur net cède la place au meilleur statut tenable", () => {
    // 80 000 € de BNC : plafond atteint, pas dépassé ; la micro avec versement libératoire donne le meilleur net.
    // 80 001 € : les deux colonnes micro sont hors plafond, leur net reste le meilleur mais n'est plus retenu.
    const auPlafond = comparer([personne("alice"), micro("m1")], titulaire, [["m1", "ca_micro_services_bnc", 80000]], options("m1"))
    const auDela = comparer([personne("alice"), micro("m1")], titulaire, [["m1", "ca_micro_services_bnc", 80001]], options("m1"))

    expect(auPlafond.meilleur).toBe("micro-vfl")
    expect(auDela.scenarios.filter(s => s.horsPlafond).map(s => s.statut)).toEqual(["micro", "micro-vfl"])
    expect(Math.max(...auDela.scenarios.map(s => s.netApresImpots))).toBe(colonne(auDela, "micro-vfl").netApresImpots)
    expect(["SASU", "EURL", "EI"]).toContain(auDela.meilleur)
    expect(colonne(auDela, auDela.meilleur!).netApresImpots).toBe(Math.max(...auDela.scenarios.filter(s => !s.horsPlafond).map(s => s.netApresImpots)))
  })

  it("une société convertie en micro est aussi comparée au plafond", () => {
    const resultat = comparer([personne("alice"), societe("s1", "SASU")], [relation("alice", "s1", "Président")], [["s1", "ca_services", 90000]], options("s1"))
    expect(colonne(resultat, "micro").horsPlafond).toBe(true)
    expect(colonne(resultat, "SASU").horsPlafond).toBe(false)
  })
})

describe("au meilleur net", () => {
  /** Alice, présidente d'une SASU qui facture 100 000 € de prestations. */
  const sessionDAlice = (chiffreAffaires = 100000) => session([personne("alice"), societe("s1", "SASU")], [relation("alice", "s1", "Président")], [["s1", "ca_services", chiffreAffaires]])
  const auMeilleurNet = (avecRetraite?: boolean) => options("s1", { remunerationNette: 30000, repartition: { mode: "meilleurNet", partDistribuee: 1, ...(avecRetraite === undefined ? {} : { avecRetraite }) } })
  const s = sessionDAlice()
  const resultat = comparerStatuts(s, auMeilleurNet(), reglesDeTest)

  it.each(["SASU", "EURL"] as const)("en %s, verse la rémunération au meilleur net de l'arbitrage de ce statut, et tout le reste en dividendes", statut => {
    const { meilleur } = optimiserRemuneration(s, options("s1"), statut, reglesDeTest)
    const c = colonne(resultat, statut)

    expect(c.remunerationOptimale).toEqual({ remunerationNette: meilleur!.remunerationNette, avecRetraite: false, retraiteHorsDAtteinte: false })
    expect(c.partage!.remunerationNette).toBeCloseTo(meilleur!.remunerationNette, 6)
    expect(Math.round(c.netApresImpots)).toBe(meilleur!.netApresImpots)
    expect(c.partage!.resultatConserve).toBeCloseTo(0, 0)
  })

  it("chaque statut de société a sa propre rémunération, qu'aucune rémunération saisie ne remplace", () => {
    const sasu = colonne(resultat, "SASU").remunerationOptimale!.remunerationNette
    const eurl = colonne(resultat, "EURL").remunerationOptimale!.remunerationNette

    expect(sasu).not.toBe(eurl)
    expect(comparerStatuts(s, { ...auMeilleurNet(), remunerationNette: 0 }, reglesDeTest).scenarios).toEqual(resultat.scenarios)
  })

  it("fait au moins aussi bien que toute rémunération saisie avec le reste en dividendes", () => {
    for (const remunerationNette of [0, 10000, 30000, 50000]) {
      const saisie = comparerStatuts(s, options("s1", { remunerationNette }), reglesDeTest)
      for (const statut of ["SASU", "EURL"] as const) expect(colonne(resultat, statut).netApresImpots).toBeGreaterThanOrEqual(colonne(saisie, statut).netApresImpots - 0.5)
    }
  })

  it("rend l'arbitrage de chaque statut de société, tel que l'optimisation le calcule", () => {
    expect(resultat.optimisations).toEqual({ SASU: optimiserRemuneration(s, options("s1"), "SASU", reglesDeTest), EURL: optimiserRemuneration(s, options("s1"), "EURL", reglesDeTest) })
    expect(comparerStatuts(s, options("s1"), reglesDeTest).optimisations).toBeUndefined()
  })

  it("ne change rien aux colonnes EI et micro-entreprise, ni au choix du meilleur statut parmi les colonnes tenables", () => {
    const saisie = comparerStatuts(s, options("s1"), reglesDeTest)
    for (const statut of ["EI", "micro", "micro-vfl"] as const) {
      expect(colonne(resultat, statut)).toEqual(colonne(saisie, statut))
      expect(colonne(resultat, statut).remunerationOptimale).toBeUndefined()
    }
    const tenables = resultat.scenarios.filter(c => !c.horsPlafond)
    expect(resultat.meilleur).toBe(tenables.reduce((a, b) => (b.netApresImpots > a.netApresImpots ? b : a)).statut)
  })

  it.each(["SASU", "EURL"] as const)("avec 4 trimestres de retraite, en %s, retient le meilleur net parmi les rémunérations qui les valident", statut => {
    const { meilleurAvecRetraite } = optimiserRemuneration(s, options("s1"), statut, reglesDeTest)
    const c = colonne(comparerStatuts(s, auMeilleurNet(true), reglesDeTest), statut)

    expect(c.remunerationOptimale).toEqual({ remunerationNette: meilleurAvecRetraite!.remunerationNette, avecRetraite: true, retraiteHorsDAtteinte: false })
    expect(Math.round(c.netApresImpots)).toBe(meilleurAvecRetraite!.netApresImpots)
    expect(c.protectionSociale.trimestres).toBe(4)
  })

  it("quand aucune rémunération ne valide 4 trimestres, retient le meilleur net et le signale dans la colonne", () => {
    const petite = sessionDAlice(4000)
    expect(optimiserRemuneration(petite, options("s1"), "SASU", reglesDeTest).meilleurAvecRetraite).toBeNull()
    const { meilleur } = optimiserRemuneration(petite, options("s1"), "SASU", reglesDeTest)

    const c = colonne(comparerStatuts(petite, auMeilleurNet(true), reglesDeTest), "SASU")

    expect(c.remunerationOptimale).toEqual({ remunerationNette: meilleur!.remunerationNette, avecRetraite: false, retraiteHorsDAtteinte: true })
    expect(c.warnings).toContain("Aucune rémunération possible en SASU ne valide 4 trimestres de retraite : la colonne retient le meilleur net, sans cette condition.")
    expect(colonne(comparerStatuts(petite, auMeilleurNet(false), reglesDeTest), "SASU").warnings).not.toContainEqual(expect.stringContaining("4 trimestres"))
  })

  it("sans bénéfice, ne verse ni rémunération ni dividendes", () => {
    const resultatSansBenefice = comparerStatuts(sessionDAlice(0), auMeilleurNet(), reglesDeTest)
    for (const statut of ["SASU", "EURL"] as const) {
      const c = colonne(resultatSansBenefice, statut)
      expect(c.remunerationOptimale).toEqual({ remunerationNette: 0, avecRetraite: false, retraiteHorsDAtteinte: false })
      expect(c.partage).toMatchObject({ remunerationNette: 0, dividendesNets: 0 })
      expect(resultatSansBenefice.optimisations?.[statut]?.meilleur).toBeNull()
    }
  })
})
