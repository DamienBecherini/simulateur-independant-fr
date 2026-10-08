// src/backend/logic/references/liberaux.reference.test.ts

import { describe, expect, it } from "vitest"
import { grilleVide, type Company, type MicroEntreprise, type SessionState } from "../../../types.js"
import { comparerStatuts } from "../comparateur.js"
import { reglesDeLAnnee } from "../regles.js"
import { runMetaSimulation } from "../simulation-engine.js"
import { simulerLesAnnees } from "../simulation-pluriannuelle.js"
import { activite, casDeReference, simuler, verifierIdentiteDuBilan } from "../testing/cas-de-reference.js"
import { micro, personne, relation, session, societe, type Flux } from "../testing/session-de-test.js"
import { defaultComparisonOptions } from "../options-du-comparateur.js"

/*
 * Cas de référence des professions libérales réglementées : les huit cas du dossier de recherche
 * (documentation/recherche/caisses-des-liberaux.md, §9), calculés à la main à partir des pages officielles, sans lancer
 * le moteur. Hypothèses communes : France métropolitaine, pas d'ACRE, activité sur toute l'année, ni conjoint
 * collaborateur, ni RSA ; PASS 2026 de 48 060 € ; au réel, assiette = revenu avant cotisations - 26 %.
 *
 * Le dossier donne ses totaux hors CURPS : le moteur l'ajoute au total, comme l'ADR 015 le décide. Les lignes sont
 * comparées au centime près (le dossier arrondit chaque ligne au centime : un total peut différer d'un centime).
 */

const alice = personne("alice")

function enEI(id: string, profession: string, options: Partial<Company> = {}): Company {
  return { ...societe(id, "EI", 0), profession, ...options }
}

function enMicro(id: string, profession: string, options: Partial<MicroEntreprise> = {}): MicroEntreprise {
  return { ...micro(id), profession, ...options }
}

/** Une ligne du détail des cotisations du travailleur non salarié, au centime près. */
function attendreLignes(cotisations: Record<string, number>, attendues: Record<string, number>) {
  for (const [ligne, montant] of Object.entries(attendues)) expect(cotisations[ligne], ligne).toBeCloseTo(montant, 2)
}

casDeReference("Cas de référence : professions libérales réglementées (dossier, §9)", () => {
  describe("cas 1 : ostéopathe en micro-entreprise, 40 000 € de CA en 2026 (CIPAV)", () => {
    const flux: Flux[] = [["m1", "ca_micro_services_bnc", 40000]]
    const entites = [alice, enMicro("m1", "osteopathe")]
    const liens = [relation("alice", "m1", "Titulaire")]

    it("cotisations de 23,2 % (9 280 €) plus 80 € de formation professionnelle, au lieu de 25,6 % (960 € de trop)", () => {
      const report = simuler(entites, liens, flux)
      expect(activite(report, "m1")).toMatchObject({ cotisationsSociales: 9360, formationProfessionnelle: 80, profession: { id: "osteopathe", caisse: "CIPAV", tauxMicro: 0.232 } })
      verifierIdentiteDuBilan(report)
    })

    it("versement libératoire de 2,2 % (880 €) ; 4 trimestres (40 000 € ≥ 11 168 €)", () => {
      const vfl = simuler([alice, enMicro("m1", "osteopathe", { opteVFL: true, rfrN2: 10000 })], liens, flux)
      expect(vfl.foyers[0].impotSurLeRevenu).toBe(880)
      const comparaison = comparerStatuts(session(entites, liens, flux), defaultComparisonOptions(session(entites, liens, flux), "m1"))
      expect(comparaison.scenarios.find(s => s.statut === "micro")?.protectionSociale.trimestres).toBe(4)
    })
  })

  it("cas 2 : ostéopathe en micro-entreprise, 9 000 € de CA en 2026 : 2 088 € de cotisations, 3 trimestres (seuil 2 792 €)", () => {
    const flux: Flux[] = [["m1", "ca_micro_services_bnc", 9000]]
    const liens = [relation("alice", "m1", "Titulaire")]
    const report = simuler([alice, enMicro("m1", "osteopathe")], liens, flux)
    // 9 000 x 23,2 % = 2 088 €, plus 9 000 x 0,2 % = 18 € de formation professionnelle.
    expect(activite(report, "m1").cotisationsSociales).toBe(2106)
    // 9 000 x 23,2 % x 29,5 % / 10,6 % = 5 811 € de revenu validant : 3 trimestres de 1 803 €.
    const donnees = session([alice, enMicro("m1", "osteopathe")], liens, flux)
    const comparaison = comparerStatuts(donnees, defaultComparisonOptions(donnees, "m1"))
    expect(comparaison.scenarios.find(s => s.statut === "micro")?.protectionSociale.trimestres).toBe(3)
  })

  it("cas 3 : psychologue en EI au réel, 25 000 € de bénéfice en 2026 (CIPAV) : 6 317,42 €", () => {
    const report = simuler([alice, enEI("e1", "psychologue")], [relation("alice", "e1", "Titulaire")], [["e1", "ca_services", 25000]])
    const tns = activite(report, "e1").cotisationsTNS!
    expect(tns.assiette).toBeCloseTo(18500, 6)
    attendreLignes(tns.cotisations, {
      maladieMaternite: 256.6, // 1,38698 % x 18 500 (barème des indépendants)
      indemnitesJournalieres: 57.67, // 0,30 % x 19 224 (minimum)
      allocationsFamiliales: 0,
      retraiteDeBase: 1961, // (8,73 % + 1,87 %) x 18 500
      retraiteComplementaire: 2035, // 11 % x 18 500
      invaliditeDeces: 92.5, // 0,5 % x 18 500, au-dessus du minimum de 17 782 €
      csgDeductible: 1258, // 6,8 % x 18 500
      csgNonDeductibleEtCrds: 536.5, // 2,9 % x 18 500
      formationProfessionnelle: 120.15
    })
    expect(tns.caisse).toMatchObject({ caisse: "CIPAV", asv: 0, curps: 0, priseEnCharge: { maladie: 0, asv: 0 } })
    expect(tns.total).toBeCloseTo(6317.42, 1)
  })

  it("cas 4 : architecte en EI au réel, 120 000 € de bénéfice en 2026 (CIPAV) : 38 552,41 € (38 552,42 € ligne à ligne)", () => {
    const report = simuler([alice, enEI("e1", "architecte")], [relation("alice", "e1", "Titulaire")], [["e1", "ca_services", 120000]])
    const tns = activite(report, "e1").cotisationsTNS!
    expect(tns.assiette).toBeCloseTo(88800, 6)
    attendreLignes(tns.cotisations, {
      maladieMaternite: 6657.27,
      indemnitesJournalieres: 266.4, // 0,30 % x 88 800
      allocationsFamiliales: 2752.8,
      retraiteDeBase: 5856.2, // 8,73 % x 48 060 + 1,87 % x 88 800
      retraiteComplementaire: 13842, // 11 % x 48 060 + 21 % x 40 740
      invaliditeDeces: 444, // 0,5 % x 88 800, sous le plafond de 88 911 €
      formationProfessionnelle: 120.15
    })
    expect(tns.cotisations.csgDeductible + tns.cotisations.csgNonDeductibleEtCrds).toBeCloseTo(8613.6, 2)
    expect(tns.total).toBeCloseTo(38552.41, 1)
  })

  describe("cas 5 : masseur-kinésithérapeute conventionné en EI, 60 000 € de bénéfice en 2026 (CARPIMKO), revenu 2025 identique", () => {
    // Assiette : 60 000 - 15 600 = 44 400 €. Total hors CURPS 14 490,79 € ; CURPS 44,40 € ; part de la CPAM 3 004,10 €.
    const lignes = {
      maladieMaternite: 44.4, // barème 5,6192 % x 44 400 = 2 494,94 €, dont 0,10 % au praticien
      indemnitesJournalieres: 133.2,
      allocationsFamiliales: 0,
      retraiteDeBase: 4706.4, // 10,60 % x 44 400
      retraiteComplementaire: 3862.8, // 8,70 % x 44 400 (2025)
      invaliditeDeces: 1022,
      formationProfessionnelle: 120.15
    }
    const kine = enEI("e1", "masseur-kinesitherapeute")
    const titulaire = [relation("alice", "e1", "Titulaire")]

    function verifier(tns: NonNullable<ReturnType<typeof activite>["cotisationsTNS"]>, anneeDeLaBase: number, anneePrecedenteConnue: boolean) {
      attendreLignes(tns.cotisations, lignes)
      expect(tns.cotisations.csgDeductible + tns.cotisations.csgNonDeductibleEtCrds).toBeCloseTo(4306.8, 2)
      expect(tns.caisse?.asv).toBeCloseTo(295.04, 2) // 224 + 0,16 % x 44 400
      expect(tns.caisse?.curps).toBeCloseTo(44.4, 2) // 0,10 % x 44 400, sous le plafond de 240 €
      expect(tns.caisse?.priseEnCharge.maladie).toBeCloseTo(2450.54, 2)
      expect(tns.caisse?.priseEnCharge.asv).toBeCloseTo(553.56, 2) // 447 + 0,24 % x 44 400
      expect(tns.caisse?.baseDesCotisationsDeLAnneePrecedente).toMatchObject({ annee: anneeDeLaBase, anneePrecedenteConnue })
      expect(tns.total).toBeCloseTo(14490.79 + 44.4, 1)
    }

    it("2026 seule : complémentaire et ASV sur le revenu de 2026, faute de 2025 dans la session", () => {
      verifier(activite(simuler([alice, kine], titulaire, [["e1", "ca_services", 60000]]), "e1").cotisationsTNS!, 2026, false)
    })

    it("2025 et 2026 : complémentaire et ASV de 2026 sur l'assiette de 2025, identique", () => {
      const ca = (montant: number) => {
        const grille = grilleVide()
        grille[0].flows.push({ id: `ca-${montant}`, label: "Honoraires", amount: montant, entityId: "e1", type: "ca_services" })
        return grille
      }
      const deuxAnnees: SessionState = { name: "Kiné", entities: [alice, kine], relationships: titulaire, annees: [{ annee: 2025, monthlyData: ca(60000) }, { annee: 2026, monthlyData: ca(60000) }] }
      const [, annee2026] = simulerLesAnnees(deuxAnnees).annees
      verifier(activite(annee2026.report!, "e1").cotisationsTNS!, 2025, true)
    })

    it("moteur d'avant (sans profession) : 19 251,77 €, soit près de 4 760 € de trop", () => {
      const tns = activite(simuler([alice, societe("e1", "EI", 0)], titulaire, [["e1", "ca_services", 60000]]), "e1").cotisationsTNS!
      expect(tns.total).toBeCloseTo(19251.77, 1)
    })
  })

  it("cas 6 : infirmière conventionnée en EI, 20 000 € de bénéfice en 2026 (CARPIMKO) : 6 557,31 € hors CURPS, minimums compris", () => {
    const report = simuler([alice, enEI("e1", "infirmier")], [relation("alice", "e1", "Titulaire")], [["e1", "ca_services", 20000]])
    const tns = activite(report, "e1").cotisationsTNS!
    expect(tns.assiette).toBeCloseTo(14800, 6)
    attendreLignes(tns.cotisations, {
      maladieMaternite: 14.8, // barème 0,80955 % x 14 800 = 119,82 €, dont 0,10 % au praticien
      indemnitesJournalieres: 57.67, // minimum
      retraiteDeBase: 1568.8,
      retraiteComplementaire: 2090.61, // 8,70 % x 24 030 (minimum)
      invaliditeDeces: 1022,
      formationProfessionnelle: 120.15
    })
    expect(tns.caisse?.asv).toBeCloseTo(247.68, 2) // 224 + 0,16 % x 14 800
    expect(tns.caisse?.curps).toBeCloseTo(14.8, 2)
    expect(tns.total).toBeCloseTo(6557.31 + 14.8, 1)
  })

  it("cas 7 : psychologue en micro-entreprise, 30 000 € de CA en 2025 (CIPAV) : 6 960 € au lieu de 7 380 € ; 4 trimestres", () => {
    const { regles } = reglesDeLAnnee(2025)
    const donnees = session([alice, enMicro("m1", "psychologue")], [relation("alice", "m1", "Titulaire")], [["m1", "ca_micro_services_bnc", 30000]])
    const report = runMetaSimulation(donnees, regles!, { annee: 2025 })
    // 30 000 x 23,2 % = 6 960 €, plus 30 000 x 0,2 % = 60 € de formation professionnelle.
    expect(activite(report, "m1").cotisationsSociales).toBe(7020)
    const comparaison = comparerStatuts(donnees, defaultComparisonOptions(donnees, "m1"), regles!, { annee: 2025 })
    expect(comparaison.scenarios.find(s => s.statut === "micro")?.protectionSociale.trimestres).toBe(4)
  })

  describe("cas 8 : masseur-kinésithérapeute qui choisit la micro-entreprise", () => {
    const flux: Flux[] = [["m1", "ca_micro_services_bnc", 40000]]
    const entites = [alice, enMicro("m1", "masseur-kinesitherapeute")]
    const liens = [relation("alice", "m1", "Titulaire")]

    it("la simulation avertit que la micro-entreprise est interdite, et calcule au taux des libéraux non réglementés", () => {
      const resultat = activite(simuler(entites, liens, flux), "m1")
      expect(resultat.warnings).toContainEqual(expect.stringContaining("En tant que praticien ou auxiliaire médical vous ne pouvez pas être auto-entrepreneur"))
      expect(resultat.cotisationsSociales).toBe(10320)
    })

    it("le comparateur ne propose pas de colonne micro, et dit pourquoi", () => {
      const comparaison = comparerStatuts(session(entites, liens, flux), defaultComparisonOptions(session(entites, liens, flux), "m1"))
      expect(comparaison.scenarios.map(s => s.statut)).toEqual(["SASU", "EURL", "EI"])
      expect(comparaison.warnings).toContainEqual(expect.stringContaining("Micro-entreprise non proposée"))
      expect(comparaison.meilleur).not.toBe("micro")
    })
  })
})
