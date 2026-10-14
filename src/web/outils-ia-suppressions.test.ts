// src/web/outils-ia-suppressions.test.ts
// Suppressions proposées par un client d'IA : acteurs avec leurs relations et leurs flux, années, plusieurs à la fois,
// et « repartir de zéro ». Chacune se relit dans le récapitulatif et le résumé, et s'annule en une étape (la session
// reçue, gelée, ne change jamais).

import { describe, expect, it } from "vitest"
import { ANNEE_PAR_DEFAUT, SessionStateSchema, type SessionState } from "@/types"
import { ajouterAnnee } from "@/backend/logic/annees"
import { empreinteDeLaSession } from "@/backend/logic/outils/commun"
import { relireLaProposition } from "@/lib/relecture-de-proposition"
import { appeler, appliquer, erreurDe, geler, TOUTE_L_ANNEE, type ResultatProposition } from "./outils-ia.testing"
import { sessionExemple } from "./session-exemple"

const exemple = () => geler(sessionExemple())
const proposer = (nom: string, session: SessionState, args: unknown) => appeler<ResultatProposition>(nom, session, args)
const supprimer = (session: SessionState, ...suppressions: unknown[]) => proposer("proposer_suppression", session, { suppressions })
const tousLesFlux = (session: SessionState) => session.annees.flatMap(a => a.monthlyData.flatMap(m => m.flows))

/** L'exemple sur trois années, 2025 à 2027, chacune avec la même grille. */
function surTroisAnnees(): SessionState {
  let rang = 0
  const nouvelId = () => `copie-${++rang}`
  return geler(ajouterAnnee(ajouterAnnee(sessionExemple(), "avant", true, nouvelId), "apres", true, nouvelId))
}

/** L'exemple avec un acteur verrouillé par l'utilisateur. */
const avecVerrou = (id: string) => {
  const session = sessionExemple()
  return geler({ ...session, entities: session.entities.map(e => (e.id === id ? { ...e, locked: true } : e)) })
}

describe("supprimer un acteur", () => {
  it("retire avec lui ses relations et ses flux de toutes les années, et le dit", () => {
    const session = exemple()
    const avant = JSON.stringify(session)
    const resultat = supprimer(session, { cible: "acteur", acteurId: "company-conseil" })
    expect(JSON.stringify(session)).toBe(avant)
    expect(resultat.recapitulatif).toBe("Supprimer 1 acteur, 1 relation et 7 séries de flux ?")
    expect(resultat.resume).toEqual(["Supprimer l'acteur « Conseil SASU » (SASU), avec 1 relation (Julien Martin — Président — Conseil SASU) et 7 séries de flux (51 flux, 2026)."])

    const apres = appliquer(session, resultat.proposition)
    expect(apres.entities.map(e => e.id)).not.toContain("company-conseil")
    expect(apres.relationships.map(r => r.id)).toEqual(["rel-titulaire", "rel-pacs", "rel-enfant"])
    expect(tousLesFlux(apres).some(f => f.entityId === "company-conseil")).toBe(false)
    expect(tousLesFlux(apres)).toHaveLength(tousLesFlux(session).length - 51)
    // Annuler, pour l'hôte, c'est revenir à la session d'avant : elle n'a pas bougé.
    expect(session).toEqual(sessionExemple())
  })

  it("refuse de laisser une rémunération ou des dividendes sans dirigeant, sauf s'ils partent aussi", () => {
    expect(erreurDe("proposer_suppression", exemple(), { suppressions: [{ cible: "acteur", acteurId: "person-julien" }] })).toContain("exigent une relation")
    // Julien et sa société : la relation « Président » n'est comptée qu'une fois.
    const resultat = supprimer(exemple(), { cible: "acteur", acteurId: "person-julien" }, { cible: "acteur", acteurId: "company-conseil" })
    expect(resultat.recapitulatif).toBe("Supprimer 2 acteurs, 2 relations et 7 séries de flux ?")
    expect(resultat.resume[0]).toBe("Supprimer l'acteur « Julien Martin » (personne), avec 2 relations (Julien Martin — Président — Conseil SASU ; Camille Martin et Julien Martin : PACSé(e)) et aucun flux.")
    expect(resultat.resume[1]).toMatch(/^Supprimer l'acteur « Conseil SASU » \(SASU\), avec aucune relation et 7 séries de flux/)
    expect(appliquer(exemple(), resultat.proposition).entities.map(e => e.id)).toEqual(["person-camille", "person-lea", "micro-atelier"])
  })

  it("ne supprime jamais un acteur verrouillé par l'utilisateur, ni un acteur inconnu", () => {
    expect(erreurDe("proposer_suppression", avecVerrou("micro-atelier"), { suppressions: [{ cible: "acteur", acteurId: "micro-atelier" }] })).toBe(
      "Opération 1 (supprimer_acteur « micro-atelier ») : « Atelier de Camille » est verrouillé par l'utilisateur : il ne peut pas être supprimé par une proposition (seulement en repartant de zéro)."
    )
    expect(erreurDe("proposer_suppression", exemple(), { suppressions: [{ cible: "acteur", acteurId: "x" }] })).toContain("Aucun acteur « x »")
  })

  it("retire les réglages du comparateur de l'acteur supprimé, sans refuser la proposition", () => {
    const session = exemple()
    const reglages = proposer("proposer_reglages_comparateur", session, { activiteId: "micro-atelier", reglages: { partBncPrestations: 0.5 } })
    const avecReglages = geler(appliquer(session, reglages.proposition))
    const apres = appliquer(avecReglages, supprimer(avecReglages, { cible: "acteur", acteurId: "micro-atelier" }).proposition)
    expect(apres.comparateur).toEqual({ reglagesParActivite: {} })
  })
})

describe("supprimer une année", () => {
  it("retire la plus ancienne ou la plus récente, et l'aperçu garde sa ligne, sans chiffres après", () => {
    const session = surTroisAnnees()
    const resultat = supprimer(session, { cible: "annee", annee: 2027 })
    expect(resultat.recapitulatif).toBe("Supprimer 1 année et 13 séries de flux ?")
    expect(resultat.resume).toEqual(["Supprimer l'année 2027 et sa grille : 13 séries de flux (101 flux, 2027)."])
    expect(resultat.apercu.map(a => a.annee)).toEqual([2025, 2026, 2027])
    expect(resultat.apercu[2]).toMatchObject({ annee: 2027, netAvant: expect.any(Number), netApres: null, ecart: null, resultatConserveApres: null, erreur: "Année supprimée par la proposition." })
    expect(resultat.apercu[1].ecart).toBe(0)
    expect(appliquer(session, resultat.proposition).annees.map(a => a.annee)).toEqual([2025, 2026])
  })

  it("en retire plusieurs, de proche en proche, mais jamais une année du milieu ni la dernière qui reste", () => {
    const session = surTroisAnnees()
    const deux = supprimer(session, { cible: "annee", annee: 2027 }, { cible: "annee", annee: 2026 })
    expect(deux.recapitulatif).toBe("Supprimer 2 années et 26 séries de flux ?")
    expect(appliquer(session, deux.proposition).annees.map(a => a.annee)).toEqual([2025])
    expect(erreurDe("proposer_suppression", session, { suppressions: [{ cible: "annee", annee: 2026 }] })).toContain("Seules la plus ancienne (2025) et la plus récente (2027) se suppriment")
    expect(erreurDe("proposer_suppression", exemple(), { suppressions: [{ cible: "annee", annee: 2026 }] })).toBe(
      "Opération 1 (supprimer_annee 2026) : 2026 est la seule année de la simulation, qui en garde toujours une : pour tout effacer, proposez de repartir de zéro (cible « simulation »)."
    )
    expect(erreurDe("proposer_suppression", exemple(), { suppressions: [{ cible: "annee", annee: 2030 }] })).toContain("L'année 2030 n'est pas dans la simulation")
  })

  it("laisse proposer des flux sur une année supprimée par la même proposition : elle est ajoutée de nouveau", () => {
    const session = surTroisAnnees()
    const sansLaDerniere = supprimer(session, { cible: "annee", annee: 2027 })
    const loyer = { annee: 2027, acteurId: "company-conseil", typeFlux: "deductible_expense", libelle: "Loyer", montant: 500, mois: [1] }
    const resultat = proposer("proposer_flux", session, { flux: [loyer], suiteDe: sansLaDerniere.proposition })
    expect(resultat.proposition.operations.map(o => o.type)).toEqual(["supprimer_annee", "ajouter_annee", "ajouter_flux"])
    expect(tousLesFlux(appliquer(session, resultat.proposition)).filter(f => f.label === "Loyer")).toHaveLength(1)
  })
})

describe("plusieurs suppressions", () => {
  it("en fait plusieurs dans une proposition, et les enchaîne avec suiteDe", () => {
    const session = exemple()
    const premiere = supprimer(session, { cible: "relation", relationId: "rel-enfant" }, { cible: "serie", annee: 2026, serie: { acteurId: "micro-atelier", typeFlux: "ca_micro_vente", libelle: "Ventes" } })
    const suite = proposer("proposer_suppression", session, { suppressions: [{ cible: "acteur", acteurId: "person-lea" }], suiteDe: premiere.proposition })
    expect(suite.recapitulatif).toBe("Supprimer 1 acteur, 1 relation et 1 série de flux ?")
    expect(suite.resume[2]).toBe("Supprimer l'acteur « Léa Martin » (personne), avec aucune relation et aucun flux.")
    const apres = appliquer(session, suite.proposition)
    expect(apres.entities).toHaveLength(4)
    expect(apres.relationships).toHaveLength(3)
  })

  it("met les suppressions en tête du récapitulatif quand la proposition ajoute aussi", () => {
    const session = exemple()
    const sansVentes = supprimer(session, { cible: "serie", annee: 2026, serie: { acteurId: "micro-atelier", typeFlux: "ca_micro_vente", libelle: "Ventes" } })
    const ventes = { annee: 2026, acteurId: "micro-atelier", typeFlux: "ca_micro_vente", libelle: "Ventes réelles", montant: 450, mois: [1, 2] }
    expect(proposer("proposer_flux", session, { flux: [ventes], suiteDe: sansVentes.proposition }).recapitulatif).toBe("Supprimer 1 série de flux ; ajouter 2 flux ?")
  })

  it("refuse plus de 50 suppressions dans une proposition", () => {
    const session = exemple()
    const relation = { cible: "relation", relationId: "rel-enfant" }
    expect(erreurDe("proposer_suppression", session, { suppressions: Array.from({ length: 51 }, () => relation) })).toContain("- suppressions : Trop grand : tableau doit avoir <=50 éléments")
    // Une proposition déjà pleine de suppressions ne se complète pas d'une de plus.
    const pleine = { empreinteSession: empreinteDeLaSession(session), operations: Array.from({ length: 50 }, () => ({ type: "supprimer_relation", relationId: "rel-enfant" })) }
    expect(erreurDe("proposer_suppression", session, { suppressions: [relation], suiteDe: pleine })).toContain("Une proposition fait au plus 50 suppressions")
  })
})

describe("repartir de zéro", () => {
  const vierge = SessionStateSchema.parse({})
  /** « , 2 années » : les années supprimées, toutes sauf celle d'une nouvelle simulation si la session l'avait. */
  const annees = (...presentes: number[]) => {
    const n = presentes.filter(a => a !== ANNEE_PAR_DEFAUT).length
    return n === 0 ? "" : `, ${n} année${n > 1 ? "s" : ""}`
  }

  it("vide la simulation comme « Nouvelle simulation », et le dit en entier", () => {
    const session = surTroisAnnees()
    const avant = JSON.stringify(session)
    const resultat = supprimer(session, { cible: "simulation" })
    expect(JSON.stringify(session)).toBe(avant)
    expect(resultat.recapitulatif).toBe(`Repartir de zéro : supprimer 5 acteurs, 4 relations${annees(2025, 2026, 2027)} et 39 séries de flux ?`)
    expect(resultat.resume).toEqual([expect.stringMatching(new RegExp(`^Repartir de zéro, comme « Nouvelle simulation » dans l'application : supprimer 5 acteurs, 4 relations, 39 séries de flux \\(303 flux, 2025, 2026 et 2027\\) et les réglages du comparateur\\. Il reste l'année ${ANNEE_PAR_DEFAUT}, vide, et le nom « Nouvelle Simulation »\\.$`))])
    expect(resultat.avertissements).toEqual([])

    const apres = appliquer(session, resultat.proposition)
    expect(empreinteDeLaSession(apres)).toBe(empreinteDeLaSession(vierge))
    expect(apres).toEqual(vierge)
    expect(resultat.apercu.map(a => [a.annee, a.erreur])).toEqual([2025, 2026, 2027].map(annee => [annee, annee === ANNEE_PAR_DEFAUT ? null : "Année supprimée par la proposition."]))
  })

  it("supprime aussi les acteurs verrouillés, mais le dit dans le récapitulatif, le résumé et un avertissement", () => {
    const session = avecVerrou("micro-atelier")
    const resultat = supprimer(session, { cible: "simulation" })
    expect(resultat.recapitulatif).toBe(`Repartir de zéro : supprimer 5 acteurs (dont 1 verrouillé), 4 relations${annees(2026)} et 13 séries de flux ?`)
    expect(resultat.resume[0]).toContain("supprimer 5 acteurs (dont « Atelier de Camille », verrouillé par l'utilisateur), 4 relations")
    expect(resultat.avertissements).toEqual(["Repartir de zéro supprime aussi « Atelier de Camille », que l'utilisateur a verrouillé : vérifiez avec lui que c'est bien voulu."])
    expect(appliquer(session, resultat.proposition).entities).toEqual([])
  })

  it("se complète avec suiteDe pour reconstruire, sans doublon signalé avec les flux d'avant", () => {
    const session = exemple()
    const zero = supprimer(session, { cible: "simulation" })
    const acteur = proposer("proposer_acteur", session, { genre: "micro-entreprise", nom: "Atelier", suiteDe: zero.proposition })
    const id = acteur.nouveauxIdentifiants[0].id
    const prestations = { annee: ANNEE_PAR_DEFAUT, acteurId: id, typeFlux: "ca_micro_services_bnc", libelle: "Prestations", montant: 2600, mois: TOUTE_L_ANNEE }
    // Une année voisine de celle qui reste est ajoutée, même si la simulation d'avant l'avait.
    const resultat = proposer("proposer_flux", session, { flux: [prestations, { ...prestations, annee: ANNEE_PAR_DEFAUT + 1 }], suiteDe: acteur.proposition })
    expect(resultat.recapitulatif).toBe(`Repartir de zéro : supprimer 5 acteurs, 4 relations${annees(2026)} et 13 séries de flux, puis ajouter 24 flux, ajouter 1 acteur et ajouter 1 année ?`)
    expect(resultat.avertissements.filter(a => a.includes("doublon"))).toEqual([])
    const apres = appliquer(session, resultat.proposition)
    expect(apres.entities.map(e => e.name)).toEqual(["Atelier"])
    expect(apres.annees.map(a => a.annee)).toEqual([ANNEE_PAR_DEFAUT, ANNEE_PAR_DEFAUT + 1])
  })

  it("ouvre toujours une proposition : jamais après d'autres opérations", () => {
    const session = exemple()
    const premiere = supprimer(session, { cible: "relation", relationId: "rel-enfant" })
    expect(erreurDe("proposer_suppression", session, { suppressions: [{ cible: "simulation" }], suiteDe: premiere.proposition })).toContain("Repartir de zéro ouvre une proposition")
  })
})

describe("suppressions périmées et relecture dans l'application", () => {
  it("refuse une suppression construite sur une autre version, et la rafraîchit sans ce qui a déjà disparu", () => {
    const session = exemple()
    const { proposition } = supprimer(session, { cible: "acteur", acteurId: "person-lea" }, { cible: "relation", relationId: "rel-pacs" })
    const sansLea = appliquer(session, supprimer(session, { cible: "acteur", acteurId: "person-lea" }).proposition)
    expect(erreurDe("appliquer_proposition", sansLea, { proposition })).toMatch(/^Proposition périmée/)
    const rafraichie = appeler<ResultatProposition & { retirees: { numero: number; operation: string; raison: string }[] }>("rafraichir_proposition", geler(sansLea), { proposition })
    expect(rafraichie.retirees).toEqual([{ numero: 1, operation: "supprimer_acteur « person-lea »", raison: expect.stringContaining("Aucun acteur « person-lea »") }])
    expect(rafraichie.recapitulatif).toBe("Supprimer 1 relation ?")
  })

  it("se relit dans l'application comme les autres propositions, sans modifier la session affichée", () => {
    const session = surTroisAnnees()
    const { proposition } = supprimer(session, { cible: "annee", annee: 2025 }, { cible: "acteur", acteurId: "person-lea" })
    const relecture = relireLaProposition(session, { id: "a.json", creeeLe: "2026-10-14T10:00:00.000Z", proposition: proposition as never })
    if (relecture.etat !== "applicable") throw new Error(relecture.etat)
    expect(relecture.recapitulatif).toBe("Supprimer 1 acteur, 1 relation, 1 année et 13 séries de flux ?")
    expect(relecture.apercu[0]).toMatchObject({ annee: 2025, netApres: null, erreur: "Année supprimée par la proposition." })
    expect(relecture.nouvelleSession.annees.map(a => a.annee)).toEqual([2026, 2027])
  })
})
