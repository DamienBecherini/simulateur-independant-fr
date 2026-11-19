// src/lib/conjoint.test.ts

import { describe, expect, it } from "vitest"
import { simulerLesAnnees } from "@/backend/logic/simulation-pluriannuelle"
import { ajoutDUnConjoint, personnesSansConjoint, prenomDuConjoint } from "./conjoint"
import { MONTAGES_TYPES, sessionDUnMontage } from "./montages/montages"
import type { SessionState } from "@/types"

const situation = (id: string): SessionState => {
  const montage = MONTAGES_TYPES.find(m => m.id === id)
  if (!montage) throw new Error(id)
  return sessionDUnMontage(montage)
}

const ANNEE = 2026

describe("Personnes à qui ajouter un conjoint", () => {
  it("une personne seule", () => {
    expect(personnesSansConjoint(situation("micro-bnc-seule"))).toEqual(new Set(["p-sophie"]))
  })

  it("ni les mariés ou pacsés, ni les concubins", () => {
    expect(personnesSansConjoint(situation("conjoint-salarie-sasu"))).toEqual(new Set())
    expect(personnesSansConjoint(situation("couple-union-libre"))).toEqual(new Set())
  })

  it("ni un enfant rattaché, ni une activité", () => {
    const session = situation("micro-bnc-seule")
    const avecUnEnfant: SessionState = {
      ...session,
      entities: [...session.entities, { id: "p-enfant", type: "person", name: "Léo", fiscalParts: 0.5, avatar: { type: "initials", value: "LE", color: "#3b82f6" }, locked: false }],
      relationships: [...session.relationships, { id: "r-enfant", fromId: "p-sophie", toId: "p-enfant", type: "Enfant" }]
    }
    expect(personnesSansConjoint(avecUnEnfant)).toEqual(new Set(["p-sophie"]))
  })
})

describe("Ajout d'un conjoint", () => {
  it("le prénom saisi, sans espaces autour, ou « Conjoint »", () => {
    expect(prenomDuConjoint("  Nadia ")).toBe("Nadia")
    expect(prenomDuConjoint("   ")).toBe("Conjoint")
  })

  it("ajoute la personne et la relation, sans salaire : la grille ne change pas", () => {
    const avant = situation("micro-bnc-seule")
    const { session, conjointId } = ajoutDUnConjoint(avant, ANNEE, "p-sophie", { prenom: "Nadia", lien: "PACSé(e)" })
    expect(session.entities.find(e => e.id === conjointId)).toMatchObject({ type: "person", name: "Nadia", fiscalParts: 1, avatar: { type: "initials", value: "NA" } })
    expect(session.relationships[session.relationships.length - 1]).toMatchObject({ fromId: "p-sophie", toId: conjointId, type: "PACSé(e)" })
    expect(session.annees).toBe(avant.annees)
    expect(avant.entities).toHaveLength(2)
  })

  it("avec un salaire : une ligne « Salaire » à ce montant chaque mois de l'année, aux identifiants distincts", () => {
    const { session, conjointId } = ajoutDUnConjoint(situation("micro-bnc-seule"), ANNEE, "p-sophie", { prenom: "Nadia", lien: "Marié(e)", salaireMensuel: 2500 })
    const salaires = session.annees[0].monthlyData.map(mois => mois.flows.filter(f => f.entityId === conjointId))
    expect(salaires.every(flux => flux.length === 1 && flux[0].type === "salary" && flux[0].amount === 2500 && flux[0].label === "Salaire")).toBe(true)
    expect(new Set(salaires.flat().map(f => f.id)).size).toBe(12)
  })

  it("seule l'année affichée reçoit le salaire", () => {
    const avant = situation("micro-bnc-seule")
    const deuxAnnees: SessionState = { ...avant, annees: [{ annee: 2025, monthlyData: avant.annees[0].monthlyData }, ...avant.annees] }
    const { session, conjointId } = ajoutDUnConjoint(deuxAnnees, ANNEE, "p-sophie", { prenom: "Nadia", lien: "Marié(e)", salaireMensuel: 2500 })
    expect(session.annees[0]).toBe(deuxAnnees.annees[0])
    expect(session.annees[1].monthlyData.flatMap(m => m.flows).filter(f => f.entityId === conjointId)).toHaveLength(12)
  })

  it("forme un seul foyer, sur deux parts, imposé sur les deux revenus", () => {
    const avant = situation("micro-bnc-seule")
    const { session, conjointId } = ajoutDUnConjoint(avant, ANNEE, "p-sophie", { prenom: "Nadia", lien: "Marié(e)", salaireMensuel: 2500 })
    const [{ report }] = simulerLesAnnees(session).annees
    expect(report?.foyers).toHaveLength(1)
    expect(report?.foyers[0]).toMatchObject({ personIds: ["p-sophie", conjointId], totalParts: 2 })
    expect(report?.foyers[0].revenusEncaisses).toBeGreaterThan(simulerLesAnnees(avant).annees[0].report?.foyers[0].revenusEncaisses ?? Infinity)
    expect(personnesSansConjoint(session)).toEqual(new Set())
  })
})
