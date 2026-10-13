// src/backend/logic/changement-de-statut.test.ts

import { describe, expect, it } from "vitest"
import { changerLeStatut, refusDuChangement, statutDeLActivite, type StatutDUneActivite } from "./changement-de-statut.js"
import type { Activite } from "./conversion-de-statut.js"
import { reglesDeTest } from "./testing/regles-de-test.js"
import { micro, personne, relation, session as donneesDeLAnnee, societe, type Flux } from "./testing/session-de-test.js"
import { CAPITAL_SOCIAL_PAR_DEFAUT, type Entity, type FinancialFlow, type Relationship, type SessionState } from "../../types.js"

/** Une session de deux années, 2025 et 2026, avec les mêmes flux annuels (saisis en janvier) chaque année. */
function sessionDeDeuxAnnees(entities: Entity[], relationships: Relationship[], flux: Flux[]): SessionState {
  const { monthlyData } = donneesDeLAnnee(entities, relationships, flux)
  return { name: "Test", entities, relationships, annees: [2025, 2026].map(annee => ({ annee, monthlyData })) }
}

/** Les flux de l'activité d'une année, sans les mois. */
const fluxDe = (s: SessionState, annee: number, id: string): FinancialFlow[] => (s.annees.find(a => a.annee === annee)?.monthlyData ?? []).flatMap(m => m.flows).filter(f => f.entityId === id)

const relationsDe = (s: SessionState, id: string) => s.relationships.filter(r => r.fromId === id || r.toId === id).map(r => r.type).sort((a, b) => a.localeCompare(b))

const STATUTS: StatutDUneActivite[] = ["micro", "EI", "SASU", "EURL"]
const activiteDuStatut = (statut: StatutDUneActivite): Activite => (statut === "micro" ? micro("a1") : societe("a1", statut))
const DIRIGEANT: Record<StatutDUneActivite, Relationship["type"]> = { micro: "Titulaire", EI: "Titulaire", SASU: "Président", EURL: "Gérant" }

describe("changerLeStatut : chaque paire de statuts", () => {
  const paires = STATUTS.flatMap(de => STATUTS.filter(vers => vers !== de).map(vers => [de, vers] as const))

  it.each(paires)("%s → %s : l'activité prend le statut, la personne la relation de son dirigeant, le chiffre d'affaires est repris", (de, vers) => {
    const source = activiteDuStatut(de)
    const chiffre: Flux = de === "micro" ? ["a1", "ca_micro_vente", 30000] : ["a1", "ca_vente", 30000]
    const s = sessionDeDeuxAnnees([personne("alice"), source], [relation("alice", "a1", DIRIGEANT[de])], [chiffre])

    const { session: apres, activite } = changerLeStatut(s, source, vers)

    expect(statutDeLActivite(activite)).toBe(vers)
    expect(apres.entities.find(e => e.id === "a1")).toEqual(activite)
    expect(relationsDe(apres, "a1")).toEqual([DIRIGEANT[vers]])
    // La relation est modifiée sur place : même identifiant.
    expect(apres.relationships[0].id).toBe("alice-a1-" + DIRIGEANT[de])
    for (const annee of [2025, 2026]) expect(fluxDe(apres, annee, "a1")).toEqual([expect.objectContaining({ id: "flux-0", amount: 30000, type: vers === "micro" ? "ca_micro_vente" : "ca_vente" })])
  })

  it("garder le même statut ne change rien", () => {
    const source = micro("a1", { beneficieACRE: true })
    const s = sessionDeDeuxAnnees([personne("alice"), source], [relation("alice", "a1", "Titulaire")], [["a1", "ca_micro_services_bnc", 1000]])
    expect(changerLeStatut(s, source, "micro")).toEqual({ session: s, activite: source, fluxConvertis: [], fluxRetires: {}, relationsChangees: [], relationsRetirees: [] })
  })
})

describe("changerLeStatut : micro-entreprise vers le réel", () => {
  const source: Activite = { ...micro("a1", { beneficieACRE: true, opteVFL: true }), rfrN2: 30000, horsPlafondAnneePrecedente: true, dateDeCreation: "2025-03", profession: "osteopathe", partConventionnee: 0.8 }
  const s = sessionDeDeuxAnnees(
    [personne("alice"), source],
    [relation("alice", "a1", "Titulaire")],
    [
      ["a1", "ca_micro_services_bnc", 20000],
      ["a1", "ca_micro_services_bic", 5000],
      ["a1", "expense", 1200]
    ]
  )

  it("les prestations BNC et BIC deviennent des prestations de services, les charges des charges déductibles", () => {
    const { session: apres, fluxConvertis } = changerLeStatut(s, source, "EI")
    expect(fluxDe(apres, 2026, "a1").map(f => [f.id, f.type, f.amount])).toEqual([
      ["flux-0", "ca_services", 20000],
      ["flux-1", "ca_services", 5000],
      ["flux-2", "deductible_expense", 1200]
    ])
    // Montants additionnés sur les deux années.
    expect(fluxConvertis).toEqual([
      { de: "ca_micro_services_bnc", vers: "ca_services", montant: 40000 },
      { de: "ca_micro_services_bic", vers: "ca_services", montant: 10000 },
      { de: "expense", vers: "deductible_expense", montant: 2400 }
    ])
  })

  it("les réglages propres à la micro-entreprise sont retirés ; date de création, profession et part conventionnée sont gardées", () => {
    const { activite } = changerLeStatut(s, source, "EURL")
    expect(activite).toEqual({ id: "a1", type: "company", legalStatus: "EURL", name: "a1", avatar: source.avatar, locked: false, capitalSocial: CAPITAL_SOCIAL_PAR_DEFAUT, dateDeCreation: "2025-03", profession: "osteopathe", partConventionnee: 0.8 })
  })

  it("une entreprise individuelle n'a pas de capital", () => {
    expect(changerLeStatut(s, source, "EI").activite).toMatchObject({ legalStatus: "EI", capitalSocial: 0 })
  })
})

describe("changerLeStatut : réel vers micro-entreprise", () => {
  const source = societe("a1", "EI", 0)
  const s = sessionDeDeuxAnnees(
    [personne("alice"), personne("bob"), source],
    [relation("alice", "a1", "Titulaire"), relation("bob", "a1", "Salarié")],
    [
      ["a1", "ca_services", 30000],
      ["a1", "deductible_expense", 4000]
    ]
  )

  it("les prestations deviennent libérales (BNC) ou commerciales (BIC) selon la part choisie, sous le même identifiant", () => {
    expect(fluxDe(changerLeStatut(s, source, "micro", 1).session, 2026, "a1")[0]).toMatchObject({ id: "flux-0", type: "ca_micro_services_bnc", amount: 30000 })
    expect(fluxDe(changerLeStatut(s, source, "micro", 0).session, 2026, "a1")[0]).toMatchObject({ id: "flux-0", type: "ca_micro_services_bic", amount: 30000 })
  })

  it("les charges réelles restent des charges de l'activité, non déductibles (abattement forfaitaire), comme dans le comparateur", () => {
    expect(fluxDe(changerLeStatut(s, source, "micro").session, 2025, "a1")[1]).toMatchObject({ type: "expense", amount: 4000 })
  })

  it("la micro-entreprise part sans ACRE ni versement libératoire ; le salarié reste", () => {
    const { activite, session: apres } = changerLeStatut(s, source, "micro")
    expect(activite).toMatchObject({ type: "micro-entreprise", beneficieACRE: false, opteVFL: false })
    expect(relationsDe(apres, "a1")).toEqual(["Salarié", "Titulaire"])
  })
})

describe("changerLeStatut : rémunération, dividendes, capital et associés d'une société", () => {
  const source: Activite = { ...societe("a1", "SASU", 5000), reservesInitiales: 12000 }
  const s = sessionDeDeuxAnnees(
    [personne("alice"), personne("bob"), source],
    [relation("alice", "a1", "Président"), relation("alice", "a1", "Associé"), relation("bob", "a1", "Associé")],
    [
      ["a1", "ca_services", 80000],
      ["a1", "director_remuneration", 20000],
      ["a1", "dividends_payment", 10000]
    ]
  )

  it("d'une société à l'autre, rémunération, dividendes, capital, réserves et associés sont gardés", () => {
    const { session: apres, activite, fluxRetires, relationsChangees, relationsRetirees } = changerLeStatut(s, source, "EURL")
    expect(activite).toMatchObject({ legalStatus: "EURL", capitalSocial: 5000, reservesInitiales: 12000 })
    expect(fluxDe(apres, 2026, "a1").map(f => f.type)).toEqual(["ca_services", "director_remuneration", "dividends_payment"])
    expect(fluxRetires).toEqual({})
    expect(relationsDe(apres, "a1")).toEqual(["Associé", "Associé", "Gérant"])
    expect(relationsChangees).toEqual([{ relation: { ...relation("alice", "a1", "Président"), type: "Gérant" }, avant: "Président" }])
    expect(relationsRetirees).toEqual([])
  })

  it("vers une entreprise individuelle : rémunération et dividendes retirés (montants de toutes les années), ni capital ni réserves, plus d'associés", () => {
    const { session: apres, activite, fluxRetires, relationsRetirees } = changerLeStatut(s, source, "EI")
    expect(activite).toMatchObject({ legalStatus: "EI", capitalSocial: 0 })
    expect(activite).not.toHaveProperty("reservesInitiales")
    expect(fluxDe(apres, 2026, "a1").map(f => f.type)).toEqual(["ca_services"])
    expect(fluxRetires).toEqual({ director_remuneration: 40000, dividends_payment: 20000 })
    expect(relationsDe(apres, "a1")).toEqual(["Titulaire"])
    expect(relationsRetirees.map(r => r.fromId)).toEqual(["alice", "bob"])
  })

  it("une société sans dirigeant : son premier associé reprend l'entreprise individuelle, comme dans le comparateur", () => {
    const sansDirigeant = sessionDeDeuxAnnees([personne("alice"), personne("bob"), source], [relation("alice", "a1", "Associé"), relation("bob", "a1", "Associé")], [])
    const { session: apres, relationsChangees, relationsRetirees } = changerLeStatut(sansDirigeant, source, "micro")
    expect(relationsChangees).toEqual([{ relation: { ...relation("alice", "a1", "Associé"), type: "Titulaire" }, avant: "Associé" }])
    expect(relationsRetirees.map(r => r.fromId)).toEqual(["bob"])
    expect(apres.relationships).toHaveLength(1)
  })

  it("vers une société depuis une entreprise individuelle : capital par défaut, aucune rémunération ajoutée", () => {
    const ei = societe("a1", "EI", 0)
    const avecEI = sessionDeDeuxAnnees([personne("alice"), ei], [relation("alice", "a1", "Titulaire")], [["a1", "ca_services", 50000]])
    const { session: apres, activite } = changerLeStatut(avecEI, ei, "SASU")
    expect(activite).toMatchObject({ legalStatus: "SASU", capitalSocial: CAPITAL_SOCIAL_PAR_DEFAUT })
    expect(fluxDe(apres, 2026, "a1").map(f => f.type)).toEqual(["ca_services"])
  })

  it("les flux et relations des autres acteurs ne changent pas", () => {
    const autre = societe("a2", "SASU")
    const avecAutre = sessionDeDeuxAnnees([personne("alice"), source, autre], [relation("alice", "a1", "Président"), relation("alice", "a2", "Président")], [["a2", "director_remuneration", 5000]])
    const { session: apres } = changerLeStatut(avecAutre, source, "EI")
    expect(relationsDe(apres, "a2")).toEqual(["Président"])
    expect(fluxDe(apres, 2026, "a2")).toEqual(fluxDe(avecAutre, 2026, "a2"))
  })
})

describe("refusDuChangement", () => {
  it("la micro-entreprise est refusée à un auxiliaire médical de la CARPIMKO, avec la raison du comparateur", () => {
    const kine: Activite = { ...societe("a1", "EI", 0), profession: "masseur-kinesitherapeute" }
    expect(refusDuChangement(kine, "micro", reglesDeTest)).toMatch(/^Micro-entreprise non proposée : elle est interdite aux praticiens et auxiliaires médicaux.*Masseur-kinésithérapeute : régime réel seulement\.$/)
  })

  it("un statut au réel lui reste ouvert, et la micro-entreprise à une profession de la CIPAV ou non réglementée", () => {
    const kine: Activite = { ...societe("a1", "EI", 0), profession: "masseur-kinesitherapeute" }
    expect(refusDuChangement(kine, "EURL", reglesDeTest)).toBeNull()
    expect(refusDuChangement({ ...kine, profession: "osteopathe" }, "micro", reglesDeTest)).toBeNull()
    expect(refusDuChangement(societe("a1", "SASU"), "micro", reglesDeTest)).toBeNull()
  })
})
