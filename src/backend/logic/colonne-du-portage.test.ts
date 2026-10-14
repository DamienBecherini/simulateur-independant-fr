// src/backend/logic/colonne-du-portage.test.ts
// La colonne « Portage salarial » du comparateur (voir l'ADR 016) : l'activité comparée convertie en activité en
// portage, aux conditions réglées dans le comparateur ; ce qu'elle reprend, ce qu'elle écarte, et quand elle n'est pas
// retenue. Les montants se vérifient contre une activité en portage saisie directement (même moteur, mêmes règles de
// test) ; les cas chiffrés à la main sont dans references/portage.reference.test.ts.

import { describe, expect, it } from "vitest"
import type { ComparaisonOptions, ComparaisonResult, ConditionsPortage, Entity, Portage, Relationship } from "../../types.js"
import { chiffreDAffairesPourUnNet } from "./chiffre-d-affaires-pour-un-net.js"
import { comparerStatuts } from "./comparateur.js"
import { convertirLActivite } from "./conversion-de-statut.js"
import { montantBaremeKilometrique } from "./frais-kilometriques.js"
import { conditionsPortageRetenues, defaultFraisFonctionnement } from "./options-du-comparateur.js"
import { runMetaSimulation } from "./simulation-engine.js"
import { reglesDeTest } from "./testing/regles-de-test.js"
import { micro, personne, portage, relation, session, societe, type Flux } from "./testing/session-de-test.js"

const options = (activityId: string, autres: Partial<ComparaisonOptions> = {}): ComparaisonOptions => ({ activityId, remunerationNette: 0, repartition: { mode: "dividendes", partDistribuee: 1 }, partBncPrestations: 1, ...autres })

const comparer = (entities: Entity[], relationships: Relationship[], flux: Flux[], opts: ComparaisonOptions) => comparerStatuts(session(entities, relationships, flux), opts, reglesDeTest)

function colonneDuPortage(resultat: ComparaisonResult) {
  const trouvee = resultat.scenarios.find(s => s.statut === "portage")
  if (!trouvee) throw new Error("Colonne du portage absente")
  return trouvee
}

/** Le net du foyer d'Alice, salariée portée d'une activité saisie directement en portage. */
function netEnPortageSaisi(flux: Flux[], conditions?: ConditionsPortage): number {
  return runMetaSimulation(session([personne("alice"), portage("p1", conditions)], [relation("alice", "p1", "Titulaire")], flux), reglesDeTest).totalNetApresImpots
}

describe("convertirLActivite en portage salarial", () => {
  const avecUneSociete = session(
    [personne("alice"), personne("bob"), societe("s1", "SASU")],
    [relation("alice", "s1", "Président"), relation("bob", "s1", "Associé")],
    [["s1", "ca_services", 30000], ["s1", "ca_vente", 5000], ["s1", "deductible_expense", 2000], ["s1", "director_remuneration", 10000], ["s1", "dividends_payment", 4000]]
  )
  const convertie = convertirLActivite(avecUneSociete, avecUneSociete.entities[2] as Extract<Entity, { type: "company" }>, "portage", 1, true, { tauxFraisDeGestion: 0.05 })
  const flux = convertie.monthlyData.flatMap(mois => mois.flows).filter(f => f.entityId === "s1")

  it("l'activité devient une activité en portage, avec les conditions du comparateur, sans capital ni statut", () => {
    expect(convertie.entities.find(e => e.id === "s1")).toEqual({ id: "s1", type: "portage", name: "s1", avatar: expect.anything(), locked: false, conditions: { tauxFraisDeGestion: 0.05 } } satisfies Partial<Portage>)
  })

  it("prestations facturées, vente gardée (le calcul du portage l'écarte), charges remboursées ; ni rémunération ni dividendes", () => {
    const total = (type: string) => flux.filter(f => f.type === type).reduce((somme, f) => somme + f.amount, 0)
    expect([total("ca_services"), total("ca_vente"), total("deductible_expense"), total("director_remuneration"), total("dividends_payment")]).toEqual([30000, 5000, 2000, 0, 0])
  })

  it("le président devient le titulaire, salarié porté ; l'associé n'en reçoit plus rien", () => {
    const liens = convertie.relationships.filter(r => r.toId === "s1")
    expect(liens.map(r => [r.fromId, r.type])).toEqual([["alice", "Titulaire"]])
  })
})

describe("la colonne « Portage salarial »", () => {
  const alice = [personne("alice"), micro("m1")]
  const titulaire = [relation("alice", "m1", "Titulaire")]

  it("micro-entreprise en BNC : le même net qu'une activité en portage saisie, aux conditions typiques ou réglées", () => {
    expect(colonneDuPortage(comparer(alice, titulaire, [["m1", "ca_micro_services_bnc", 48000]], options("m1"))).netApresImpots).toBe(netEnPortageSaisi([["p1", "ca_services", 48000]]))
    const conditions: ConditionsPortage = { tauxFraisDeGestion: 0.1, contrat: "CDD", effectif: "moinsDe11" }
    expect(colonneDuPortage(comparer(alice, titulaire, [["m1", "ca_micro_services_bnc", 48000]], options("m1", { portage: conditions }))).netApresImpots).toBe(netEnPortageSaisi([["p1", "ca_services", 48000]], conditions))
  })

  it("aucun frais de fonctionnement supposé : moins ceux du statut actuel, en frais professionnels remboursés", () => {
    const resultat = comparer(alice, titulaire, [["m1", "ca_micro_services_bnc", 48000], ["m1", "expense", 3000]], options("m1", { fraisFonctionnement: defaultFraisFonctionnement() }))
    const colonne = colonneDuPortage(resultat)
    // Micro-entreprise : 850 € supposés ; en portage, aucun. Les 3 000 € de charges saisies, moins 850 €, sont remboursés.
    expect(colonne.ecartDeFrais).toEqual({ total: -850, postes: { banque: -100, logiciel: -100, assurance: -350, cfe: -300 } })
    expect(colonne.netApresImpots).toBe(netEnPortageSaisi([["p1", "ca_services", 48000], ["p1", "deductible_expense", 2150]]))
  })

  it("protection sociale d'un salarié du régime général, avec l'assurance chômage", () => {
    const colonne = colonneDuPortage(comparer(alice, titulaire, [["m1", "ca_micro_services_bnc", 48000]], options("m1")))
    expect(colonne.protectionSociale).toMatchObject({ etoiles: 5, trimestres: 4 })
    expect(colonne.protectionSociale.resume).toContain("assurance chômage")
    expect(colonne.horsPlafond).toBe(false)
  })

  it("dit les conditions typiques, et seulement celles qui le sont", () => {
    const typiques = colonneDuPortage(comparer(alice, titulaire, [["m1", "ca_micro_services_bnc", 48000]], options("m1"))).warnings
    expect(typiques).toContainEqual(expect.stringMatching(/^Conditions typiques d'une société de portage \(frais de gestion de 7\s%, CDI\) : à remplacer par celles de la vôtre\.$/))
    const reglees = colonneDuPortage(comparer(alice, titulaire, [["m1", "ca_micro_services_bnc", 48000]], options("m1", { portage: { tauxFraisDeGestion: 0.06, contrat: "CDD" } }))).warnings
    expect(reglees).toContainEqual(expect.stringMatching(/^Conditions de la société de portage à leur valeur typique \(plancher mensuel des frais de gestion, .*effectif de la société.*\)/))
    expect(reglees.join(" ")).not.toMatch(/typique \([^)]*\bcontrat\b/)
  })

  it("peut être désignée meilleur statut", () => {
    // Petite activité sortie du régime micro, sociétés selon la grille (sans rémunération) : face à l'EI au réel et à ses
    // cotisations minimales, un portage sans frais de gestion qui reverse la réduction générale fait mieux.
    const ferme = { annee: 2026, regimeMicro: { sorties: { m1: { depuis: 2026, depassements: [2024, 2025] as [number, number] } }, annonces: {}, retours: [] } }
    const resultat = comparerStatuts(session(alice, titulaire, [["m1", "ca_micro_services_bnc", 12000]]), options("m1", { repartition: { mode: "grille", partDistribuee: 1 }, portage: { tauxFraisDeGestion: 0, reductionGeneraleReversee: true } }), reglesDeTest, ferme)
    expect(resultat.meilleur).toBe("portage")
    expect(colonneDuPortage(resultat).netApresImpots).toBeGreaterThan(resultat.scenarios.find(s => s.statut === "EI")?.netApresImpots ?? Infinity)
  })

  it("une activité qui ne fait que de la vente : la colonne n'est pas retenue, et le dit", () => {
    const resultat = comparer(alice, titulaire, [["m1", "ca_micro_vente", 60000]], options("m1"))
    const colonne = colonneDuPortage(resultat)
    expect(colonne.portageNonRetenu).toBe("sansPrestations")
    expect(colonne.warnings).toContainEqual(expect.stringContaining("vente de marchandises n'est pas permise"))
    expect(colonne.warnings).toContainEqual(expect.stringContaining("Sans prestations de services, rien à facturer en portage salarial"))
    expect(resultat.meilleur).not.toBe("portage")
  })

  it("une activité avec des salariés : la colonne n'est pas retenue, même si elle fait mieux", () => {
    const resultat = comparer([...alice, personne("dan")], [...titulaire, relation("dan", "m1", "Salarié")], [["m1", "ca_micro_services_bnc", 48000], ["m1", "expense", 30000], ["dan", "salary", 20000]], options("m1", { portage: { tauxFraisDeGestion: 0 } }))
    expect(colonneDuPortage(resultat).portageNonRetenu).toBe("salaries")
    expect(resultat.meilleur).not.toBe("portage")
  })

  it("rembourse les déplacements professionnels au barème kilométrique, sur l'enveloppe", () => {
    const deplacements = { kmParAn: 5000, puissanceFiscale: "5" as const, electrique: false }
    const resultat = comparer([personne("alice"), { ...micro("m1"), deplacementsProfessionnels: deplacements }], titulaire, [["m1", "ca_micro_services_bnc", 48000]], options("m1"))
    const rembourses = montantBaremeKilometrique(5000, deplacements, reglesDeTest.baremeKilometrique)
    expect(colonneDuPortage(resultat).netApresImpots).toBe(netEnPortageSaisi([["p1", "ca_services", 48000], ["p1", "deductible_expense", rembourses]]))
  })

  it("dit qu'une profession libérale réglementée perd sa caisse et doit s'exercer pour des entreprises clientes", () => {
    const resultat = comparer([personne("alice"), { ...micro("m1"), profession: "osteopathe" }], titulaire, [["m1", "ca_micro_services_bnc", 48000]], options("m1"))
    expect(colonneDuPortage(resultat).warnings).toContainEqual(expect.stringContaining("entreprises clientes"))
  })
})

describe("le calcul à l'envers de la colonne du portage", () => {
  it("donne le chiffre d'affaires qui atteint le net visé, à l'euro", () => {
    const d = session([personne("alice"), micro("m1")], [relation("alice", "m1", "Titulaire")], [["m1", "ca_micro_services_bnc", 40000]])
    const colonne = chiffreDAffairesPourUnNet(d, options("m1"), 25000, reglesDeTest).colonnes.find(c => c.statut === "portage")
    const ca = colonne?.chiffreDAffaires ?? 0
    expect(ca).toBeGreaterThan(0)
    expect(netEnPortageSaisi([["p1", "ca_services", ca]])).toBeGreaterThanOrEqual(25000)
    expect(netEnPortageSaisi([["p1", "ca_services", ca - 1]])).toBeLessThan(25000)
  })

  it("hors de portée pour une activité qui ne fait que de la vente", () => {
    const d = session([personne("alice"), micro("m1")], [relation("alice", "m1", "Titulaire")], [["m1", "ca_micro_vente", 40000]])
    expect(chiffreDAffairesPourUnNet(d, options("m1"), 25000, reglesDeTest).colonnes.find(c => c.statut === "portage")).toMatchObject({ chiffreDAffaires: null, horsDePortee: "portageSansPrestations" })
  })
})

describe("conditionsPortageRetenues", () => {
  it("un plancher au-dessus du plafond fait écarter les deux, comme à la lecture d'un fichier", () => {
    expect(conditionsPortageRetenues({ plancherMensuel: 500, plafondMensuel: 300 }).conditions).toMatchObject({ plancherMensuel: null, plafondMensuel: null })
    expect(conditionsPortageRetenues({ plancherMensuel: 300, plafondMensuel: 500 }).conditions).toMatchObject({ plancherMensuel: 300, plafondMensuel: 500 })
  })
})
