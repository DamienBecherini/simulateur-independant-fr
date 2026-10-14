// src/backend/logic/chiffre-d-affaires-pour-un-net.test.ts

import { describe, expect, it } from "vitest"
import { avecUnChiffreDAffaires, chiffreDAffairesPourUnNet } from "./chiffre-d-affaires-pour-un-net.js"
import { CHIFFRE_D_AFFAIRES_MAXIMAL, CHIFFRE_D_AFFAIRES_REPARTI } from "./options-du-comparateur.js"
import { chiffreDAffaires, comparerStatuts } from "./comparateur.js"
import { activiteComparee } from "./conversion-de-statut.js"
import { runMetaSimulation, type ContexteDeLAnnee } from "./simulation-engine.js"
import { defaultComparisonOptions } from "./options-du-comparateur.js"
import { reglesPubliees, type ReglesFiscales } from "./regles.js"
import { reglesDeTest } from "./testing/regles-de-test.js"
import { micro, personne, relation, session, societe, type Flux } from "./testing/session-de-test.js"
import type { ChiffreDAffairesPourUnNet, ComparaisonOptions, DonneesDeLAnnee, Entity, Relationship, StatutCompare } from "../../types.js"

/*
 * Le calcul à l'envers se vérifie par l'aller-retour : le chiffre d'affaires trouvé, remis dans la grille, redonne au
 * comparateur lui-même le net visé à l'euro près, et un euro de moins ne l'atteint pas. Règles de test : plafond de la
 * micro-entreprise en services de 80 000 €.
 */

const options = (activityId: string, autres: Partial<ComparaisonOptions> = {}): ComparaisonOptions => ({ activityId, remunerationNette: 0, repartition: { mode: "dividendes", partDistribuee: 1 }, partBncPrestations: 1, ...autres })

const donnees = (entities: Entity[], relationships: Relationship[], flux: Flux[]) => session(entities, relationships, flux)

/** Alice seule, titulaire d'une micro-entreprise en prestations BNC. */
const aliceEnMicro = (ca: number) => donnees([personne("alice"), micro("m1")], [relation("alice", "m1", "Titulaire")], ca > 0 ? [["m1", "ca_micro_services_bnc", ca]] : [])

/** Le net de la colonne d'un statut d'après le comparateur, avec ce chiffre d'affaires pour l'activité. */
function netDuComparateur(d: DonneesDeLAnnee, opts: ComparaisonOptions, statut: StatutCompare, ca: number, regles: ReglesFiscales = reglesDeTest, contexte: ContexteDeLAnnee = {}): number {
  const source = activiteComparee(d, opts.activityId)!
  const colonne = comparerStatuts(avecUnChiffreDAffaires(d, source, ca), opts, regles, contexte).scenarios.find(s => s.statut === statut)
  if (!colonne) throw new Error(`Colonne ${statut} absente`)
  return colonne.netApresImpots
}

function colonne(resultat: ChiffreDAffairesPourUnNet, statut: StatutCompare) {
  const trouvee = resultat.colonnes.find(c => c.statut === statut)
  if (!trouvee) throw new Error(`Colonne ${statut} absente`)
  return trouvee
}

/** L'aller-retour de chaque colonne trouvée : net visé atteint à l'euro près, et pas avec un euro de moins. */
function verifierLAllerRetour(d: DonneesDeLAnnee, opts: ComparaisonOptions, resultat: ChiffreDAffairesPourUnNet, regles: ReglesFiscales = reglesDeTest, contexte: ContexteDeLAnnee = {}) {
  const trouvees = resultat.colonnes.filter(c => c.chiffreDAffaires !== null)
  expect(trouvees.length).toBeGreaterThan(0)
  for (const c of trouvees) {
    const ca = c.chiffreDAffaires!
    const net = netDuComparateur(d, opts, c.statut, ca, regles, contexte)
    expect(net, c.statut).toBeGreaterThanOrEqual(resultat.netVise)
    expect(net - resultat.netVise, c.statut).toBeLessThanOrEqual(1)
    expect(c.netApresImpots, c.statut).toBe(net)
    if (ca > 0) expect(netDuComparateur(d, opts, c.statut, ca - 1, regles, contexte), c.statut).toBeLessThan(resultat.netVise)
  }
}

describe("avecUnChiffreDAffaires", () => {
  const d = donnees(
    [personne("alice"), micro("m1"), societe("s1")],
    [relation("alice", "m1", "Titulaire")],
    [
      ["m1", "ca_micro_services_bnc", 30000],
      ["m1", "ca_micro_vente", 10000],
      ["m1", "expense", 2000],
      ["s1", "ca_services", 50000]
    ]
  )
  d.monthlyData[5].flows.push({ id: "juin", label: "Ventes de juin", amount: 10000, entityId: "m1", type: "ca_micro_vente" })
  const source = activiteComparee(d, "m1")!

  it("met à l'échelle le chiffre d'affaires saisi, mois par mois et nature par nature", () => {
    const doublee = avecUnChiffreDAffaires(d, source, 100000)
    expect(chiffreDAffaires(doublee, "m1")).toBeCloseTo(100000, 6)
    const montant = (mois: number, type: string) => doublee.monthlyData[mois].flows.filter(f => f.entityId === "m1" && f.type === type).reduce((s, f) => s + f.amount, 0)
    // 50 000 € saisis : 30 000 de BNC et 10 000 de ventes en janvier, 10 000 de ventes en juin ; tout est doublé.
    expect(montant(0, "ca_micro_services_bnc")).toBeCloseTo(60000, 6)
    expect(montant(0, "ca_micro_vente")).toBeCloseTo(20000, 6)
    expect(montant(5, "ca_micro_vente")).toBeCloseTo(20000, 6)
  })

  it("ne touche ni aux charges de l'activité, ni aux autres acteurs", () => {
    const doublee = avecUnChiffreDAffaires(d, source, 100000)
    expect(doublee.monthlyData[0].flows.find(f => f.type === "expense")?.amount).toBe(2000)
    expect(chiffreDAffaires(doublee, "s1")).toBe(50000)
    expect(doublee.entities).toBe(d.entities)
    expect(doublee.relationships).toBe(d.relationships)
  })

  it("sans chiffre d'affaires saisi, le répartit également sur les 12 mois : BNC en micro, prestations en société", () => {
    const vide = donnees([personne("alice"), micro("m1"), societe("s1")], [], [])
    const enMicro = avecUnChiffreDAffaires(vide, activiteComparee(vide, "m1")!, 24000)
    expect(enMicro.monthlyData.map(m => m.flows.filter(f => f.entityId === "m1").map(f => [f.type, f.amount]))).toEqual(Array.from({ length: 12 }, () => [["ca_micro_services_bnc", 2000]]))
    const enSociete = avecUnChiffreDAffaires(vide, activiteComparee(vide, "s1")!, 24000)
    expect(enSociete.monthlyData.every(m => m.flows.some(f => f.entityId === "s1" && f.type === "ca_services" && f.amount === 2000))).toBe(true)
  })
})

describe("chiffreDAffairesPourUnNet", () => {
  describe("une personne seule en micro-entreprise BNC", () => {
    const d = aliceEnMicro(40000)
    const opts = options("m1")
    const resultat = chiffreDAffairesPourUnNet(d, opts, 25000, reglesDeTest)

    it("donne une colonne par statut du comparateur, avec son titre", () => {
      expect(resultat.colonnes.map(c => c.statut)).toEqual(["SASU", "EURL", "EI", "micro", "micro-vfl"])
      expect(colonne(resultat, "micro-vfl").libelle).toBe("Micro + versement libératoire")
      expect(colonne(resultat, "micro").telleQueSaisie).toBe(true)
      expect(resultat.chiffreDAffairesSaisi).toBe(40000)
      expect(resultat.warnings).toEqual([])
    })

    it("trouve dans chaque statut le chiffre d'affaires qui redonne le net visé au comparateur, à l'euro près", () => {
      verifierLAllerRetour(d, opts, resultat)
      expect(resultat.colonnes.every(c => c.chiffreDAffaires !== null && c.chiffreDAffaires > 0)).toBe(true)
    })

    it("retrouve le chiffre d'affaires saisi pour le net de la situation telle que saisie", () => {
      const netActuel = runMetaSimulation(d, reglesDeTest).totalNetApresImpots
      const actuel = colonne(chiffreDAffairesPourUnNet(d, opts, netActuel, reglesDeTest), "micro")
      // Les nets sont arrondis à l'euro : un ou deux euros de chiffre d'affaires de moins peuvent donner le même net.
      expect(Math.abs(actuel.chiffreDAffaires! - 40000)).toBeLessThanOrEqual(2)
    })
  })

  it("trouve aussi le chiffre d'affaires d'une société au meilleur net, rémunération optimisée à chaque essai", () => {
    const d = donnees([personne("alice"), societe("s1")], [relation("alice", "s1", "Président")], [["s1", "ca_services", 50000]])
    const opts = options("s1", { repartition: { mode: "meilleurNet", partDistribuee: 1 } })
    const resultat = chiffreDAffairesPourUnNet(d, opts, 30000, reglesDeTest)
    verifierLAllerRetour(d, opts, resultat)
    expect(colonne(resultat, "SASU").libelle).toBe("SASU, rémunération optimisée")
  })

  it("dit la micro-entreprise hors de portée quand il faudrait dépasser son plafond, sans donner de chiffre", () => {
    // Micro BNC : environ 70 % du chiffre d'affaires en net ; 70 000 € nets demandent bien plus que le plafond de 80 000 €.
    const resultat = chiffreDAffairesPourUnNet(aliceEnMicro(40000), options("m1"), 70000, reglesDeTest)
    for (const statut of ["micro", "micro-vfl"] as const) expect(colonne(resultat, statut)).toMatchObject({ chiffreDAffaires: null, netApresImpots: null, horsDePortee: "plafondMicro" })
    expect(colonne(resultat, "EI").chiffreDAffaires).toBeGreaterThan(80000)
    verifierLAllerRetour(aliceEnMicro(40000), options("m1"), resultat)
  })

  it("rend 0 € quand le foyer atteint déjà le net visé sans chiffre d'affaires", () => {
    const d = donnees([personne("alice"), micro("m1")], [relation("alice", "m1", "Titulaire")], [["alice", "salary", 40000], ["m1", "ca_micro_services_bnc", 10000]])
    const resultat = chiffreDAffairesPourUnNet(d, options("m1"), 20000, reglesDeTest)
    expect(resultat.colonnes.map(c => c.chiffreDAffaires)).toEqual([0, 0, 0, 0, 0])
    expect(resultat.colonnes.every(c => c.netApresImpots !== null && c.netApresImpots >= 20000)).toBe(true)
  })

  it("compte les autres revenus du foyer : à deux parts, il faut moins de chiffre d'affaires pour le même net", () => {
    const seule = chiffreDAffairesPourUnNet(aliceEnMicro(40000), options("m1"), 35000, reglesDeTest)
    const enCouple = donnees([personne("alice"), personne("bob"), micro("m1")], [relation("alice", "m1", "Titulaire"), relation("alice", "bob", "Marié(e)")], [["m1", "ca_micro_services_bnc", 40000]])
    const aDeux = chiffreDAffairesPourUnNet(enCouple, options("m1"), 35000, reglesDeTest)
    verifierLAllerRetour(enCouple, options("m1"), aDeux)
    // Un seul revenu, deux parts : l'impôt du foyer baisse, le net visé arrive plus tôt.
    expect(colonne(aDeux, "EI").chiffreDAffaires!).toBeLessThan(colonne(seule, "EI").chiffreDAffaires!)
    expect(colonne(aDeux, "micro").chiffreDAffaires!).toBeLessThan(colonne(seule, "micro").chiffreDAffaires!)
  })

  it("sans chiffre d'affaires saisi, le répartit sur l'année et le dit", () => {
    const d = aliceEnMicro(0)
    const resultat = chiffreDAffairesPourUnNet(d, options("m1"), 20000, reglesDeTest)
    expect(resultat.chiffreDAffairesSaisi).toBe(0)
    expect(resultat.warnings).toContain(CHIFFRE_D_AFFAIRES_REPARTI)
    verifierLAllerRetour(d, options("m1"), resultat)
  })

  it("en partage « grille », dit que le net d'une société ne suit pas le chiffre d'affaires", () => {
    const d = donnees([personne("alice"), societe("s1")], [relation("alice", "s1", "Président")], [["s1", "ca_services", 60000], ["s1", "director_remuneration", 20000]])
    const resultat = chiffreDAffairesPourUnNet(d, options("s1", { repartition: { mode: "grille", partDistribuee: 1 } }), 30000, reglesDeTest)
    expect(colonne(resultat, "SASU")).toMatchObject({ chiffreDAffaires: null, horsDePortee: "partageSelonLaGrille", telleQueSaisie: true })
    expect(colonne(resultat, "EURL").horsDePortee).toBe("partageSelonLaGrille")
    expect(colonne(resultat, "EI").chiffreDAffaires).toBeGreaterThan(0)
  })

  it("dit la micro-entreprise hors de portée l'année où son régime est fermé", () => {
    const contexte: ContexteDeLAnnee = { annee: 2026, regimeMicro: { sorties: { m1: { depuis: 2026, depassements: [2024, 2025] } }, annonces: {}, retours: [] } }
    const resultat = chiffreDAffairesPourUnNet(aliceEnMicro(40000), options("m1"), 25000, reglesDeTest, contexte)
    expect(colonne(resultat, "micro").horsDePortee).toBe("regimeMicroFerme")
    expect(colonne(resultat, "micro-vfl").horsDePortee).toBe("regimeMicroFerme")
  })

  it("s'arrête à la borne de la recherche quand aucun chiffre d'affaires ne suffit", () => {
    const resultat = chiffreDAffairesPourUnNet(aliceEnMicro(40000), options("m1"), CHIFFRE_D_AFFAIRES_MAXIMAL, reglesDeTest)
    expect(colonne(resultat, "EI")).toMatchObject({ chiffreDAffaires: null, horsDePortee: "auDelaDeLaBorne" })
  })

  it("règles de 2026 : une EI à 40 000 €, 30 000 € nets visés, chaque colonne en aller-retour", () => {
    const regles = reglesPubliees(2026)
    const contexte: ContexteDeLAnnee = { annee: 2026 }
    const d = donnees([personne("alice"), societe("e1", "EI")], [relation("alice", "e1", "Titulaire")], [["e1", "ca_services", 40000]])
    const opts = defaultComparisonOptions(d, "e1")
    const resultat = chiffreDAffairesPourUnNet(d, opts, 30000, regles, contexte)
    expect(resultat.colonnes.every(c => c.chiffreDAffaires !== null)).toBe(true)
    verifierLAllerRetour(d, opts, resultat, regles, contexte)
    // La colonne « Micro + versement libératoire » tombe pile sur le chiffre d'affaires saisi, par coïncidence et non
    // parce qu'il serait renvoyé tel quel : 25,6 % de cotisations BNC, 0,2 % de formation et 2,2 % de versement
    // libératoire laissent 72 % de 40 000 €, soit 28 800 € ; la micro coûte 1 200 € de frais supposés de moins que
    // l'EI (850 € contre 2 050 €), d'où 30 000 €. À 39 999 €, le net est de 29 999 €.
    expect(colonne(resultat, "micro-vfl").chiffreDAffaires).toBe(40000)
    expect(netDuComparateur(d, opts, "micro-vfl", 40000, regles, contexte)).toBe(30000)
    expect(netDuComparateur(d, opts, "micro-vfl", 39999, regles, contexte)).toBe(29999)
    // Les autres colonnes ne retombent pas sur le chiffre d'affaires saisi : la recherche suit bien chaque statut.
    expect(new Set(resultat.colonnes.map(c => c.chiffreDAffaires)).size).toBe(resultat.colonnes.length)
  })

  it("demande une activité à comparer", () => {
    expect(chiffreDAffairesPourUnNet(aliceEnMicro(40000), options("inconnue"), 25000, reglesDeTest)).toEqual({ netVise: 25000, chiffreDAffairesSaisi: 0, colonnes: [], warnings: ["Choisissez une activité à comparer."] })
  })
})
